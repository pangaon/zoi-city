// ZOI DELIVERY — delivery-create (STAGING)
// Inserts a STAGED delivery_orders row. NO real provider call, NO charge.
// The Stripe Connect destination-charge + application_fee step is MODEL ONLY
// (documented in docs/DELIVERY-BUILD-PLAN.md) and is NOT executed here.
// Talks to Postgres directly (zoi schema not exposed to PostgREST). Isolated.

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

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
  const { listing_id, option, customer = {} } = body ?? {};
  if (!listing_id || !option) return json({ ok: false, error: "listing_id and option required" }, 400);

  const order_id = crypto.randomUUID();
  const tracking_url = `https://csebihpaychdkanjjsmz.supabase.co/staging/track/${order_id}`;
  const fees = {
    customer_fee: option.customer_fee ?? null,
    provider_cost: option.provider_cost ?? null,
    zoi_margin: option.zoi_margin ?? null,
  };

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
  try {
    await sql`
      insert into zoi.delivery_orders
        (id, listing_id, mode, provider, customer, fees, status, tracking_url, stripe_ref)
      values
        (${order_id}, ${listing_id}, ${option.mode ?? null}, ${option.provider ?? null},
         ${sql.json(customer)}, ${sql.json(fees)}, 'staged', ${tracking_url}, null)`;
    // status 'staged' NEVER auto-advances; no charge, no dispatch.
    // stripe_ref stays null until Stripe Connect goes live.
    return json({ ok: true, order_id, tracking_url, status: "staged", source: "staged" });
  } catch (e) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500);
  } finally {
    await sql.end();
  }
});
