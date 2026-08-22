// social-connect: begins an OAuth handshake for a platform, or reports it is not yet configured.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT = `${SUPABASE_URL}/functions/v1/social-oauth-callback`;

async function sbRpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function pkce() {
  const v = b64url(crypto.getRandomValues(new Uint8Array(48)).buffer);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return { verifier: v, challenge: b64url(digest) };
}

type Cfg = { env: string[]; scope: string; pkce?: boolean; build: (id: string, state: string, challenge?: string) => string };
const REG: Record<string, Cfg> = {
  facebook: { env: ["META_APP_ID", "META_APP_SECRET"], scope: "pages_show_list,pages_manage_posts,pages_read_engagement,business_management",
    build: (id, state) => `https://www.facebook.com/v19.0/dialog/oauth?client_id=${id}&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}&scope=${encodeURIComponent("pages_show_list,pages_manage_posts,pages_read_engagement,business_management")}&response_type=code` },
  instagram: { env: ["META_APP_ID", "META_APP_SECRET"], scope: "instagram_basic,instagram_content_publish,pages_show_list,business_management",
    build: (id, state) => `https://www.facebook.com/v19.0/dialog/oauth?client_id=${id}&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}&scope=${encodeURIComponent("instagram_basic,instagram_content_publish,pages_show_list,business_management")}&response_type=code` },
  linkedin: { env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"], scope: "openid,profile,w_member_social",
    build: (id, state) => `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${id}&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}&scope=${encodeURIComponent("openid profile w_member_social")}` },
  tiktok: { env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], scope: "user.info.basic,video.publish", pkce: true,
    build: (id, state, ch) => `https://www.tiktok.com/v2/auth/authorize/?client_key=${id}&scope=${encodeURIComponent("user.info.basic,video.publish")}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${state}&code_challenge=${ch}&code_challenge_method=S256` },
  x: { env: ["X_CLIENT_ID", "X_CLIENT_SECRET"], scope: "tweet.read,tweet.write,users.read,offline.access", pkce: true,
    build: (id, state, ch) => `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${id}&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent("tweet.read tweet.write users.read offline.access")}&state=${state}&code_challenge=${ch}&code_challenge_method=S256` },
  youtube: { env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], scope: "https://www.googleapis.com/auth/youtube.upload",
    build: (id, state) => `https://accounts.google.com/o/oauth2/v2/auth?client_id=${id}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&access_type=offline&prompt=consent&state=${state}&scope=${encodeURIComponent("https://www.googleapis.com/auth/youtube.upload")}` },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { workspace, platform, profile, return_to } = await req.json();
    if (!workspace || !platform) return J({ error: "workspace and platform required" }, 400);
    const cfg = REG[platform];
    if (!cfg) return J({ available: false, reason: "unsupported" });
    const clientId = Deno.env.get(cfg.env[0]);
    const ok = cfg.env.every((k) => !!Deno.env.get(k));
    if (!ok || !clientId) return J({ available: false, reason: "not_configured" });

    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    let verifier: string | null = null, challenge: string | undefined;
    if (cfg.pkce) { const p = await pkce(); verifier = p.verifier; challenge = p.challenge; }
    await sbRpc("social_oauth_state_put", {
      p_state: state, p_workspace: workspace, p_platform: platform,
      p_profile: profile ?? null, p_return_to: return_to ?? `https://www.zoi.city/social`,
      p_code_verifier: verifier, p_extra: {},
    });
    const url = cfg.build(clientId, state, challenge);
    return J({ available: true, url });
  } catch (e) {
    return J({ error: String(e?.message ?? e) }, 500);
  }
});
