import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type LeadPayload = {
  name?: string;
  email?: string;
  source?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  website?: string;
  _gotcha?: string;
  [key: string]: unknown;
};

const defaultAllowedOrigins = [
  "https://innergclaw.github.io",
  "https://ownyourweb.xyz",
  "https://www.ownyourweb.xyz",
];

function corsHeadersFor(req: Request) {
  const origin = req.headers.get("origin") || "";
  const envOrigins = (Deno.env.get("OWNER_STACK_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigins = [...defaultAllowedOrigins, ...envOrigins];
  const allowOrigin = allowedOrigins.includes(origin) ? origin : defaultAllowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeadersFor(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function clean(value: unknown, maxLength = 2000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function parseBody(req: Request): Promise<LeadPayload> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await req.json();
  }

  const form = await req.formData();
  return Object.fromEntries(form.entries());
}

function getIpAddress(req: Request) {
  return clean(
    req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for") ||
      ""
  );
}

function buildTelegramMessage(lead: {
  id: string;
  name: string;
  email: string;
  source: string;
  page_url: string;
  referrer: string;
}) {
  const submittedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });

  return [
    "New OwnYourWeb lead",
    "",
    `Name: ${lead.name || "Not provided"}`,
    `Email: ${lead.email}`,
    `Source: ${lead.source}`,
    `Page: ${lead.page_url || "Unknown page"}`,
    `Referrer: ${lead.referrer || "Direct / unknown"}`,
    `Lead ID: ${lead.id}`,
    `Submitted: ${submittedAt} ET`,
  ].join("\n");
}

async function notifyTelegram(lead: {
  id: string;
  name: string;
  email: string;
  source: string;
  page_url: string;
  referrer: string;
}) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId =
    Deno.env.get("TELEGRAM_OWNER_STACK_CHAT_ID") ||
    Deno.env.get("TELEGRAM_CHAT_ID") ||
    Deno.env.get("TELEGRAM_AGENT_STORE_TOPIC_CHAT_ID") ||
    "-1003997964845";
  const threadId =
    Deno.env.get("TELEGRAM_OWNER_STACK_THREAD_ID") ||
    Deno.env.get("TELEGRAM_AGENT_STORE_TOPIC_THREAD_ID");

  if (!token || !chatId) {
    return { ok: false, status: "telegram_not_configured", messageId: null, error: "" };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
      text: buildTelegramMessage(lead),
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok && data.ok === true,
    status: response.ok && data.ok === true ? "telegram_sent" : "telegram_failed",
    messageId: data?.result?.message_id || null,
    error: data?.description || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(req) });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  let body: LeadPayload;
  try {
    body = await parseBody(req);
  } catch {
    return json(req, { ok: false, error: "Invalid request body" }, 400);
  }

  if (clean(body.website) || clean(body._gotcha)) {
    return json(req, { ok: true, skipped: true });
  }

  const email = clean(body.email, 320).toLowerCase();
  if (!isValidEmail(email)) {
    return json(req, { ok: false, error: "A valid email is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(req, { ok: false, error: "Supabase environment is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const leadRow = {
    name: clean(body.name, 200),
    email,
    source: clean(body.source, 200) || "Owner Stack Website Gate",
    page_url: clean(body.pageUrl, 1000),
    referrer: clean(body.referrer, 1000) || "Direct / unknown",
    user_agent: clean(body.userAgent, 1000),
    ip_address: getIpAddress(req),
    raw_payload: body,
  };

  const { data: insertedLead, error: insertError } = await supabase
    .from("owner_stack_leads")
    .insert(leadRow)
    .select("id, name, email, source, page_url, referrer, created_at")
    .single();

  if (insertError) {
    return json(req, { ok: false, error: "Database insert failed", details: insertError.message }, 500);
  }

  EdgeRuntime.waitUntil(
    (async () => {
      const telegram = await notifyTelegram(insertedLead);
      await supabase
        .from("owner_stack_leads")
        .update({
          telegram_notified: telegram.ok,
          telegram_message_id: telegram.messageId,
          telegram_error: telegram.error || null,
        })
        .eq("id", insertedLead.id);
    })()
  );

  return json(req, {
    ok: true,
    leadId: insertedLead.id,
    database: { ok: true, status: "inserted" },
    telegram: { ok: true, status: "queued" },
  });
});
