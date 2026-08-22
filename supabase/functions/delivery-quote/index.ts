// ZOI DELIVERY — delivery-quote (STAGING)
// Rate-shop engine behind a clean ADAPTER interface. NO live API keys yet:
// every adapter returns a realistic STAGED quote flagged source:'staged' + the
// provider's api_status, computed from delivery_config + a distance heuristic.
// Swapping in a real provider API later is a ONE-FUNCTION change (see adapters).
// verify_jwt = false (public quote endpoint). NO charges. NO real provider calls.
//
// NOTE: the zoi schema is NOT exposed to PostgREST (only public/graphql_public),
// so this function talks to Postgres directly via the postgres driver using the
// pooled DB connection. This keeps the build fully ISOLATED — we do NOT alter the
// global PostgREST exposed-schemas config (which would affect other systems).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Dropoff = { address?: string; city?: string; country?: string; lat?: number; lng?: number };
type ProviderRow = {
  provider: string; geo: string; mode: string; white_label: boolean;
  api_status: string; per_delivery_cost_est: number | null; notes: string | null;
};
type Quote = {
  mode: string; provider: string; eta_min: number;
  customer_fee: number; provider_cost: number; zoi_margin: number;
  white_label: boolean; source: "staged" | "live"; api_status: string;
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function estimateKm(origin: { lat?: number | null; lng?: number | null } | null, dropoff: Dropoff): number {
  if (origin?.lat != null && origin?.lng != null && dropoff.lat != null && dropoff.lng != null) {
    return Math.max(0.5, haversineKm(origin.lat, origin.lng, dropoff.lat, dropoff.lng));
  }
  return 5; // heuristic default when coordinates are unknown (no listing geo yet)
}
const round2 = (n: number) => Math.round(n * 100) / 100;

// ============================================================================
// ADAPTER INTERFACE — one function per mode. STAGED today; to go live, replace
// the body with a real fetch() to the provider API and set source:'live'.
// Engine, ranking, persistence are untouched.
// ============================================================================
interface AdapterCtx { row: ProviderRow; km: number; cfg: any | null; items: unknown[]; }

function stagedOndemand(ctx: AdapterCtx): Quote {
  const { row, km, cfg } = ctx;
  const od = cfg?.ondemand ?? {};
  const baseCost = row.per_delivery_cost_est ?? 7.0;
  const perKm = od.per_km ?? 0.35;
  const provider_cost = round2(baseCost + perKm * Math.max(0, km - 3));
  const markupPct = od.markup_pct ?? 25;
  const baseFee = od.base_fee ?? 0;
  const customer_fee = round2(Math.max(baseFee, provider_cost * (1 + markupPct / 100)));
  return adapt(row, "ondemand", customer_fee, provider_cost, Math.round(20 + km * 2.2));
}
function stagedOwn(ctx: AdapterCtx): Quote {
  const { row, km, cfg } = ctx;
  const provider_cost = 0.5;
  const own = cfg?.own ?? {};
  const flat = own.flat_fee ?? 3.99;
  const customer_fee = round2(flat + 0.25 * Math.max(0, km - 3));
  return adapt(row, "own", customer_fee, provider_cost, Math.round(25 + km * 2.5));
}
function stagedShip(ctx: AdapterCtx): Quote {
  const { row, km } = ctx;
  const labelCost = row.per_delivery_cost_est && row.per_delivery_cost_est < 1
    ? row.per_delivery_cost_est + 4.5
    : 5.5;
  const provider_cost = round2(labelCost);
  const customer_fee = round2(provider_cost + 1.0);
  return adapt(row, "ship", customer_fee, provider_cost, km > 50 ? 2880 : 1440);
}
function adapt(row: ProviderRow, mode: string, customer_fee: number, provider_cost: number, eta_min: number): Quote {
  return {
    mode, provider: row.provider, eta_min,
    customer_fee, provider_cost, zoi_margin: round2(customer_fee - provider_cost),
    white_label: row.white_label, source: "staged", api_status: row.api_status,
  };
}
const ADAPTERS: Record<string, (c: AdapterCtx) => Quote> = {
  ondemand: stagedOndemand, own: stagedOwn, ship: stagedShip,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
  const { listing_id, dropoff = {}, items = [] } = body ?? {};
  if (!listing_id) return json({ ok: false, error: "listing_id required" }, 400);

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
  try {
    // Read listing geo/country — READ ONLY, never mutated.
    const listingRows = await sql`
      select country, latitude, longitude from zoi.listings where id = ${listing_id} limit 1`;
    const listing = listingRows[0] ?? null;
    const country = String(dropoff.country || listing?.country || "US").toUpperCase();
    const isGR = country === "GR" || country === "CY";
    const currency = isGR ? "EUR" : (country === "CA" ? "CAD" : "USD");
    const origin = listing ? { lat: listing.latitude, lng: listing.longitude } : null;
    const km = estimateKm(origin, dropoff as Dropoff);

    // Per-listing config (may be absent).
    const cfgRows = await sql`select * from zoi.delivery_config where listing_id = ${listing_id} limit 1`;
    const cfg = cfgRows[0] ?? null;

    let wantProviders: string[] | null = null;
    const wantModes: string[] | null = cfg?.modes_enabled?.length ? cfg.modes_enabled : null;
    if (cfg) {
      const p = new Set<string>();
      (cfg.ondemand?.providers ?? []).forEach((x: string) => p.add(x));
      if (cfg.own?.dispatch_provider) p.add(cfg.own.dispatch_provider);
      (cfg.shipping?.providers ?? []).forEach((x: string) => p.add(x));
      if (p.size) wantProviders = [...p];
    }
    if (!wantProviders) {
      wantProviders = isGR ? ["Wolt Drive", "ACS Courier", "BoxNow"] : ["Uber Direct", "Shippo"];
    }

    const providers = await sql`
      select provider, geo, mode, white_label, api_status,
             per_delivery_cost_est::float8 as per_delivery_cost_est, notes
      from zoi.delivery_providers
      where provider = any(${wantProviders}) and status = 'staging'` as unknown as ProviderRow[];

    const options: Quote[] = [];
    for (const row of providers) {
      if (wantModes && !wantModes.includes(row.mode)) continue;
      const fn = ADAPTERS[row.mode];
      if (!fn) continue; // orchestration providers not directly quoted in staging
      options.push(fn({ row, km, cfg, items }));
    }
    options.sort((a, b) => a.customer_fee - b.customer_fee || a.eta_min - b.eta_min);

    // Persist the quote (audit/analytics).
    await sql`insert into zoi.delivery_quotes (listing_id, dropoff, options)
      values (${listing_id}, ${sql.json(dropoff)}, ${sql.json(options)})`;

    return json({ ok: true, currency, distance_km_est: round2(km), source: "staged", options });
  } catch (e) {
    return json({ ok: false, error: String(e?.message ?? e) }, 500);
  } finally {
    await sql.end();
  }
});
