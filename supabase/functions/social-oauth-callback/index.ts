// social-oauth-callback: platform redirect target. Exchanges code -> tokens, stores channel, returns to app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
const back = (to: string, params: Record<string, string>) => {
  const u = new URL(to);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return Response.redirect(u.toString(), 302);
};
const expTs = (secs?: number) => (secs ? new Date(Date.now() + secs * 1000).toISOString() : null);

async function upsert(ws: string, platform: string, by: string | null, ch: {
  external_id: string; handle: string; display: string; avatar?: string;
  access_token: string; refresh_token?: string; expires?: number; scopes?: string[]; meta?: unknown;
}) {
  await sbRpc("social_channel_upsert", {
    p_workspace: ws, p_platform: platform, p_external_id: ch.external_id, p_handle: ch.handle,
    p_display: ch.display, p_avatar: ch.avatar ?? null, p_access_token: ch.access_token,
    p_refresh_token: ch.refresh_token ?? null, p_expires_at: expTs(ch.expires), p_scopes: ch.scopes ?? null,
    p_connected_by: by, p_meta: ch.meta ?? {},
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  const fallback = "https://www.zoi.city/social";
  if (!state) return back(fallback, { connect_error: err || "missing_state" });

  let st: any;
  try { st = await sbRpc("social_oauth_state_take", { p_state: state }); } catch { st = null; }
  if (!st) return back(fallback, { connect_error: "expired_state" });
  const to = st.return_to || fallback;
  const ws = st.workspace_id, platform = st.platform, by = st.profile_id, verifier = st.code_verifier;
  if (err) return back(to, { connect_error: err });
  if (!code) return back(to, { connect_error: "no_code" });

  try {
    if (platform === "facebook" || platform === "instagram") {
      const id = Deno.env.get("META_APP_ID")!, secret = Deno.env.get("META_APP_SECRET")!;
      const tk = await (await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${id}&client_secret=${secret}&redirect_uri=${encodeURIComponent(REDIRECT)}&code=${encodeURIComponent(code)}`)).json();
      if (!tk.access_token) throw new Error(tk.error?.message || "token_exchange_failed");
      const pages = await (await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${tk.access_token}`)).json();
      const list = pages.data || [];
      if (!list.length) throw new Error("no_pages_found");
      let n = 0;
      for (const pg of list) {
        if (platform === "facebook") {
          await upsert(ws, "facebook", by, { external_id: pg.id, handle: pg.name, display: pg.name, access_token: pg.access_token, scopes: ["pages_manage_posts"], meta: { page_id: pg.id } });
          n++;
        } else if (pg.instagram_business_account) {
          const ig = pg.instagram_business_account;
          await upsert(ws, "instagram", by, { external_id: ig.id, handle: ig.username || pg.name, display: ig.username || pg.name, avatar: ig.profile_picture_url, access_token: pg.access_token, scopes: ["instagram_content_publish"], meta: { ig_user_id: ig.id, page_id: pg.id } });
          n++;
        }
      }
      if (!n) throw new Error(platform === "instagram" ? "no_instagram_business_account" : "no_pages");
      return back(to, { connected: platform, count: String(n) });
    }

    if (platform === "linkedin") {
      const id = Deno.env.get("LINKEDIN_CLIENT_ID")!, secret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;
      const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: id, client_secret: secret });
      const tk = await (await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })).json();
      if (!tk.access_token) throw new Error(tk.error_description || "token_exchange_failed");
      const me = await (await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${tk.access_token}` } })).json();
      await upsert(ws, "linkedin", by, { external_id: me.sub, handle: me.name || "LinkedIn", display: me.name || "LinkedIn", avatar: me.picture, access_token: tk.access_token, refresh_token: tk.refresh_token, expires: tk.expires_in, scopes: ["w_member_social"], meta: { urn: `urn:li:person:${me.sub}` } });
      return back(to, { connected: "linkedin", count: "1" });
    }

    if (platform === "tiktok") {
      const key = Deno.env.get("TIKTOK_CLIENT_KEY")!, secret = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
      const body = new URLSearchParams({ client_key: key, client_secret: secret, code, grant_type: "authorization_code", redirect_uri: REDIRECT, code_verifier: verifier || "" });
      const tk = await (await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })).json();
      if (!tk.access_token) throw new Error(tk.error_description || tk.error || "token_exchange_failed");
      await upsert(ws, "tiktok", by, { external_id: tk.open_id, handle: "TikTok", display: "TikTok", access_token: tk.access_token, refresh_token: tk.refresh_token, expires: tk.expires_in, scopes: (tk.scope || "").split(","), meta: { open_id: tk.open_id } });
      return back(to, { connected: "tiktok", count: "1" });
    }

    if (platform === "x") {
      const id = Deno.env.get("X_CLIENT_ID")!, secret = Deno.env.get("X_CLIENT_SECRET")!;
      const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier || "", client_id: id });
      const tk = await (await fetch("https://api.twitter.com/2/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + btoa(`${id}:${secret}`) }, body })).json();
      if (!tk.access_token) throw new Error(tk.error_description || "token_exchange_failed");
      const me = await (await fetch("https://api.twitter.com/2/users/me", { headers: { Authorization: `Bearer ${tk.access_token}` } })).json();
      const u = me.data || {};
      await upsert(ws, "x", by, { external_id: u.id || "x", handle: u.username || "X", display: u.name || u.username || "X", access_token: tk.access_token, refresh_token: tk.refresh_token, expires: tk.expires_in, scopes: (tk.scope || "").split(" "), meta: { user_id: u.id } });
      return back(to, { connected: "x", count: "1" });
    }

    if (platform === "youtube") {
      const id = Deno.env.get("GOOGLE_CLIENT_ID")!, secret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
      const body = new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: REDIRECT, grant_type: "authorization_code" });
      const tk = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })).json();
      if (!tk.access_token) throw new Error(tk.error_description || "token_exchange_failed");
      const ch = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${tk.access_token}` } })).json();
      const c = (ch.items || [])[0] || {};
      await upsert(ws, "youtube", by, { external_id: c.id || "youtube", handle: c.snippet?.title || "YouTube", display: c.snippet?.title || "YouTube", avatar: c.snippet?.thumbnails?.default?.url, access_token: tk.access_token, refresh_token: tk.refresh_token, expires: tk.expires_in, scopes: ["youtube.upload"], meta: { channel_id: c.id } });
      return back(to, { connected: "youtube", count: "1" });
    }

    return back(to, { connect_error: "unsupported_platform" });
  } catch (e) {
    return back(to, { connect_error: String(e?.message ?? e).slice(0, 120) });
  }
});
