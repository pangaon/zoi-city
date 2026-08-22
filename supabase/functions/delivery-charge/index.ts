// ZOI DELIVERY — delivery-charge (STAGED / INERT until live Stripe keys exist)
//
// PURPOSE (go-live): create a Stripe Connect *destination charge* for the
// customer's delivery fee. The full customer_fee is charged on the platform
// (Zoi) account and transferred to the merchant's connected account via
// transfer_data.destination; Zoi keeps application_fee_amount = zoi_margin.
//
// SAFETY GATE: if STRIPE_SECRET_KEY is absent (it is, today), this function
// creates NOTHING — no PaymentIntent, no transfer, no charge — and returns
// { ok:false, staged:true, reason:'awaiting live keys' }. Deploying it is
// therefore completely inert. Money movement is founder-only.
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

// Currency minor-unit conversion. zoi_margin / customer_fee are major-unit
// decimals (e.g. 9.63 EUR). Stripe wants integer minor units (cents).
// Zero-decimal currencies (JPY etc.) are not used by this delivery layer
// (GR/CY→EUR, CA→CAD, else USD) so a flat ×100 is correct here.
const toMinor = (v: number) => Math.round(Number(v) * 100);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  // ===================== SAFETY GATE =====================
  // No live key => create NOTHING. Inert by design.
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) {
    return json({ ok: false, staged: true, reason: "awaiting live keys" });
  }
  // ======================================================

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
  const { order_id } = body ?? {};
  if (!order_id) return json({ ok: false, error: "order_id required" }, 400);

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
  try {
    // Load the staged order + the merchant's connected account from config.
    const rows = await sql`
      select o.id, o.listing_id, o.mode, o.provider, o.fees, o.status, o.stripe_ref,
             c.stripe_account_id
      from zoi.delivery_orders o
      left join zoi.delivery_config c on c.listing_id = o.listing_id
      where o.id = ${order_id}
      limit 1`;
    if (rows.length === 0) return json({ ok: false, error: "order not found" }, 404);
    const order = rows[0];

    // Idempotency at the data layer: never double-charge an order.
    if (order.stripe_ref) {
      return json({ ok: true, already_charged: true, order_id, stripe_ref: order.stripe_ref });
    }

    const fees = order.fees ?? {};
    const customerFee = Number(fees.customer_fee);
    const zoiMargin = Number(fees.zoi_margin);
    const destination = order.stripe_account_id;

    if (!destination) return json({ ok: false, error: "merchant has no connected stripe_account_id; onboard first" }, 409);
    if (!Number.isFinite(customerFee) || customerFee <= 0) return json({ ok: false, error: "invalid customer_fee on order" }, 422);
    if (!Number.isFinite(zoiMargin) || zoiMargin < 0) return json({ ok: false, error: "invalid zoi_margin on order" }, 422);

    const currency = String(fees.currency ?? "usd").toLowerCase();
    const amount = toMinor(customerFee);                 // total charged to customer
    const applicationFee = toMinor(zoiMargin);           // Zoi's cut = customer_fee - provider_cost

    // Destination charge: charge on platform, transfer to merchant, keep app fee.
    // Idempotency-Key = delivery_order id => safe to retry without double charge.
    const form = new URLSearchParams();
    form.set("amount", String(amount));
    form.set("currency", currency);
    form.set("application_fee_amount", String(applicationFee));
    form.set("transfer_data[destination]", destination);
    form.set("confirm", "false"); // create intent only; confirmation/capture is a separate, founder-driven step
    form.set("metadata[order_id]", String(order.id));
    form.set("metadata[listing_id]", String(order.listing_id ?? ""));
    form.set("metadata[mode]", String(order.mode ?? ""));
    form.set("metadata[provider]", String(order.provider ?? ""));

    const resp = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": String(order.id),
      },
      body: form,
    });
    const pi = await resp.json();
    if (!resp.ok) {
      return json({ ok: false, error: "stripe error", detail: pi?.error?.message ?? pi }, 502);
    }

    // Persist the PaymentIntent id on the order. status lifecycle is advanced
    // by a separate, founder-approved step — we only record the reference here.
    await sql`update zoi.delivery_orders set stripe_ref = ${pi.id} where id = ${order.id}`;

    return json({
      ok: true,
      order_id: order.id,
      stripe_ref: pi.id,
      payment_intent_status: pi.status,
      amount,
      currency,
      application_fee_amount: applicationFee,
      destination,
    });
  } catch (e) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500);
  } finally {
    await sql.end();
  }
});
