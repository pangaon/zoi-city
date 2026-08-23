// zoi-feed-publish — publishes scheduled composer posts to the Zoi community feed.
//
// Deliberately a SEPARATE worker from social-publish rather than a branch inside
// it. social-publish runs every minute, handles six external networks plus
// scheduled email, and is working; adding a branch would mean redeploying it from
// the repo, and if the live copy has drifted from source that regresses something
// that currently works. This is additive: if it breaks, nothing else notices.
//
// Authorship is the whole reason this exists. feed_post() takes the author from
// the caller's session, so a worker with no session cannot post as anyone.
// zoi.social_posts already records author_profile, so feed_post_as() uses that —
// service-role only, never reachable from a browser.
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

  let due: Array<{ id: string; author_profile: string; body: string; media: unknown; nameday_ref: string | null }> = [];
  try {
    due = (await rpc("feed_due_community_posts", { p_limit: limit })) ?? [];
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }

  for (const p of due) {
    // Time-box, so a long queue cannot run past the platform's request limit and
    // leave everything marked neither published nor failed.
    if (Date.now() - started > 100_000) { bump("stopped-time-budget"); break; }
    try {
      const res = await rpc("feed_post_as", {
        p_profile: p.author_profile,
        p_body: p.body,
        p_listing: null,
        p_nameday: p.nameday_ref ?? null,
        p_media: Array.isArray(p.media) ? p.media : [],
      });
      const ok = !!(res && (res.ok === true || res.id));
      await rpc("feed_mark_published", {
        p_id: p.id, p_ok: ok, p_note: ok ? "posted to the community feed" : "feed_post_as returned no id",
      });
      bump(ok ? "published" : "rejected");
    } catch (e) {
      // Record the failure rather than retrying forever: a post that cannot be
      // published should show as failed in the calendar, not sit as scheduled
      // looking like it is still going to happen.
      const note = String(e).slice(0, 160);
      try { await rpc("feed_mark_published", { p_id: p.id, p_ok: false, p_note: note }); } catch { /* nothing more to do */ }
      bump("error:" + note.split(":")[0].slice(0, 30));
    }
  }

  return json({ ok: true, due: due.length, ms: Date.now() - started, stats });
});
