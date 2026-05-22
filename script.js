const FORM_ENDPOINT = "";
const SUPABASE_LEAD_ENDPOINT =
  "https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/owner-stack-lead";
const UNLOCK_KEY = "ownerStackSiteUnlocked";

const leadForm = document.querySelector("#leadForm");
const emailGate = document.querySelector("#emailGate");
const formMessage = document.querySelector("#formMessage");
const stackDetails = document.querySelector("#stackDetails");
const unlockBanner = document.querySelector("#unlockBanner");

function saveLeadLocally(formData) {
  const existing = JSON.parse(localStorage.getItem("ownerStackLeads") || "[]");
  existing.push({
    name: formData.get("name"),
    email: formData.get("email"),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem("ownerStackLeads", JSON.stringify(existing));
}

function isStaticPreview() {
  if (window.location.protocol === "file:") {
    return true;
  }

  const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalPreview && window.location.port !== "8888") {
    return true;
  }

  return false;
}

function isGithubPages() {
  return window.location.hostname.endsWith("github.io");
}

function getLeadCollectionEndpoint() {
  if (FORM_ENDPOINT) {
    return FORM_ENDPOINT;
  }

  if (SUPABASE_LEAD_ENDPOINT) {
    return SUPABASE_LEAD_ENDPOINT;
  }

  if (!isStaticPreview() && !isGithubPages() && leadForm.dataset.netlify === "true") {
    return "/";
  }

  return "";
}

function unlockStack({ shouldScroll = true } = {}) {
  localStorage.setItem(UNLOCK_KEY, "true");
  document.body.classList.remove("is-locked");
  emailGate.hidden = true;
  unlockBanner.hidden = false;

  if (shouldScroll) {
    stackDetails.focus({ preventScroll: true });
    stackDetails.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function submitLead(formData) {
  formData.set("pageUrl", window.location.href);
  formData.set("referrer", document.referrer || "Direct / unknown");
  formData.set("userAgent", navigator.userAgent);

  const endpoints = [getLeadCollectionEndpoint()].filter(Boolean);
  if (!endpoints.length) {
    return;
  }

  const body = new URLSearchParams(formData).toString();
  const requests = endpoints.map((endpoint) =>
    fetch(endpoint, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    })
  );

  const results = await Promise.allSettled(requests);
  if (results.every((result) => result.status === "rejected")) {
    throw new Error("Lead submission failed");
  }
}

if (localStorage.getItem(UNLOCK_KEY) === "true") {
  unlockStack({ shouldScroll: false });
}

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(leadForm);
  saveLeadLocally(formData);
  formMessage.textContent = "Opening the full stack...";

  try {
    await submitLead(formData);
  } catch {
    formMessage.textContent = "Saved locally for preview. Opening the full stack...";
  }

  unlockStack();
});
