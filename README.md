# OwnYourWeb Lead Magnet

This folder contains a static website version of `The Owner Stack Starter Kit`.

The visitor sees a popup email gate first. After they submit their name and email, the full Owner Stack details unlock on the same page.

## Preview

Run the page locally from this folder:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

## Supabase Lead Capture

The form posts to this Supabase Edge Function:

```text
https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/owner-stack-lead
```

The function inserts each lead into:

```text
public.owner_stack_leads
```

RLS is enabled on the table and public table access is revoked. The browser never receives the service role key; inserts happen inside the Edge Function.

The same Edge Function also sends Telegram notifications when `TELEGRAM_BOT_TOKEN` is set in Supabase secrets. It sends to `TELEGRAM_OWNER_STACK_CHAT_ID`, `TELEGRAM_CHAT_ID`, or the configured Owner Stack fallback chat.

For ConvertKit, Mailchimp, Formspree, or a custom backend, set `FORM_ENDPOINT` in `script.js` to the provider's form endpoint.

## Supabase Secrets

Set these in Supabase Edge Function secrets:

```text
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_OWNER_STACK_CHAT_ID=-1003997964845
```

After those are set, each submitted lead will send a Telegram message with name, email, source, page URL, referrer, and submit time.

Keep `TELEGRAM_BOT_TOKEN` out of `script.js`. It belongs only in Supabase secrets.

## Reset Local Gate

The preview stores unlock status in local storage. To see the popup again, clear local storage for `127.0.0.1:4173` or run this in the browser console:

```js
localStorage.removeItem("ownerStackSiteUnlocked");
```
