// ZOI DELIVERY — delivery-connect-onboard (STAGED / INERT until live Stripe keys exist)
//
// PURPOSE (go-live): stand up a merchant's Stripe Connect *Express* connected
// account and return a one-time AccountLink onboarding URL. When onboarding
// completes, the connected account id (acct_...) is stored on
// zoi.delivery_config.stripe_account_id for that listing, which delivery-charge
// then uses as transfer_data.destination.
//
// SAFETY GATE: if STRIPE_SECRET_KEY is absent (it is, today), this function
// creates NOTHING — no Account, no AccountLink — and returns
// { ok:false, staged:true, reason:'awaiting live keys' }. Inert by design.
// (Account creation moves no money, but we still gate it so the whole Connect
// surface stays founder-controlled until live keys are supplied.)
//
// 2026 API NOTE: Stripe now steers NEW platforms toward Accounts v2 / the
// interactive platform guide. This stub uses the still-supported v1 Express
// flow (POST /v1/accounts type=express + POST /v1/account_links
// type=account_onboarding) because it is the simplest path that matches the
// destination-charge model already documented. Swap to Accounts v2 here if the
// platform profile requires it — delivery-charge does not change either way.
//
// Talks to Postgres directly (zoi schema is not exposed to PostgREST). Isolated.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  // ===================== SAFETY GATE =====================
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) {
    return json({ ok: false, staged: true, reason: "awaiting live keys" });
  }
  // ======================================================

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
  const { listing_id, email, country, return_url, refresh_url } = body ?? {};
  if (!listing_id) return json({ ok: false, error: "listing_id required" }, 400);
  if (!return_url || !refresh_url) return json({ ok: false, error: "return_url and refresh_url required" }, 400);

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
  try {
    // Reuse an existing connected account if this listing already has one.
    const existing = await sql`
      select stripe_account_id from zoi.delivery_config where listing_id = ${listing_id} limit 1`;
    let accountId: string | null = existing[0]?.stripe_account_id ?? null;

    // 1) Create the Express connected account if needed.
    if (!accountId) {
      const acctForm = new URLSearchParams();
      acctForm.set("type", "express");
      if (country) acctForm.set("country", String(country));
      if (email) acctForm.set("email", String(email));
      acctForm.set("capabilities[transfers][requested]", "true");
      acctForm.set("capabilities[card_payments][requested]", "true");
      acctForm.set("metadata[listing_id]", String(listing_id));

      const acctResp = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `acct-${listing_id}`,
        },
        body: acctForm,
      });
      const acct = await acctResp.json();
      if (!acctResp.ok) return json({ ok: false, error: "stripe account error", detail: acct?.error?.message ?? acct }, 502);
      accountId = acct.id;

      // Persist immediately (upsert) so a retry reuses the same account.
      await sql`
        insert into zoi.delivery_config (listing_id, stripe_account_id, status)
        values (${listing_id}, ${accountId}, 'staging')
        on conflict (listing_id) do update set stripe_account_id = excluded.stripe_account_id`;
    }

    // 2) Create a single-use AccountLink onboarding URL.
    const linkForm = new URLSearchParams();
    linkForm.set("account", accountId!);
    linkForm.set("refresh_url", String(refresh_url));
    linkForm.set("return_url", String(return_url));
    linkForm.set("type", "account_onboarding");

    const linkResp = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: linkForm,
    });
    const link = await linkResp.json();
    if (!linkResp.ok) return json({ ok: false, error: "stripe account_link error", detail: link?.error?.message ?? link }, 502);

    return json({ ok: true, stripe_account_id: accountId, onboarding_url: link.url, expires_at: link.expires_at });
  } catch (e) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500);
  } finally {
    await sql.end();
  }
});
