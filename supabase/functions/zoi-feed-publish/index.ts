// zoi-feed-publish — publishes scheduled composer posts to the Zoi community feed.
//
// Both publisher workers call the same atomic SQL operation. A dedicated
// community worker remains available, and concurrent runs are safe because
// delivery identity is recorded transactionally against the saved social post.
// Browser callers use a separate wrapper with workspace and author checks.
// Scheduled delivery is service-role only.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (platform-provided),
//      FEED_PUBLISH_ENABLED=on   kill switch, fails closed
//      ENRICH_TOKEN              reused as the shared caller secret

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENABLED = (Deno.env.get("FEED_PUBLISH_ENABLED") || "").toLowerCase() === "on";
const TOKEN = Deno.env.get("ENRICH_TOKEN") || "";

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${t.slice(0, 180)}`);
  return t ? JSON.parse(t) : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Only the scheduler gets in. Security must not depend on a deploy flag. */
function authorised(req: Request): boolean {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const header = (req.headers.get("x-enrich-token") || "").trim();
  for (const supplied of [bearer, header]) {
    if (!supplied) continue;
    if (TOKEN && timingSafeEqual(supplied, TOKEN)) return true;
    if (SERVICE && timingSafeEqual(supplied, SERVICE)) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body, null, 1), {
      status, headers: { "Content-Type": "application/json" },
    });

  if (!authorised(req)) return json({ ok: false, error: "unauthorised" }, 401);
  if (!ENABLED) return json({ ok: false, error: "FEED_PUBLISH_ENABLED is not 'on'" }, 503);

  let limit = 50;
  try {
    const b = await req.json();
    if (b && typeof b.limit === "number") limit = Math.max(1, Math.min(200, Math.floor(b.limit)));
  } catch { /* no body is fine */ }

  const started = Date.now();
  const stats: Record<string, number> = {};
  const bump = (k: string) => (stats[k] = (stats[k] || 0) + 1);

  let due: Array<{ id: string }> = [];
  try {
    due = (await rpc("feed_due_community_post_ids", { p_limit: limit })) ?? [];
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }

  for (const p of due) {
    // Time-box, so a long queue cannot run past the platform's request limit and
    // leave everything marked neither published nor failed.
    if (Date.now() - started > 100_000) { bump("stopped-time-budget"); break; }
    try {
      const res = await rpc("feed_publish_scheduled_post", { p_id: p.id });
      const ok = !!(res && res.ok === true && res.id);
      bump(ok ? (res.already_published ? "already-published" : "published") : "rejected");
    } catch (e) {
      // The atomic RPC rolls back on failure. Leave the saved post available
      // for retry; never finalize an entire mixed-network post here.
      const note = String(e).slice(0, 160);
      bump("error:" + note.split(":")[0].slice(0, 30));
    }
  }

  return json({ ok: true, due: due.length, ms: Date.now() - started, stats });
});
