import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function rpc(fn: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${fn} ${r.status} ${await r.text()}`);
  return await r.json();
}

function clean(s: string) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
}
function parseRss(xml: string) {
  const items: Record<string, string>[] = [];
  const blocks = xml.split(/<item[ >]/i).slice(1);
  for (const b of blocks.slice(0, 60)) {
    const title = (b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
    const link = (b.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "";
    const date = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || "";
    items.push({ title: clean(title), link: clean(link), pubDate: clean(date) });
  }
  return items;
}

Deno.serve(async () => {
  try {
    const feeds = await rpc("zoi_active_feeds");
    let total = 0;
    const detail: unknown[] = [];
    for (const f of feeds as Array<{ id: string; name: string; url: string }>) {
      try {
        const res = await fetch(f.url, {
          headers: { "User-Agent": "ZoiDirectoryBot/1.0 (lawful RSS ingestion; contact founder)" },
        });
        if (!res.ok) { detail.push({ source: f.name, error: res.status }); continue; }
        const xml = await res.text();
        const items = parseRss(xml);
        const n = await rpc("zoi_worker_record", { p_source: f.id, p_items: items });
        total += n;
        detail.push({ source: f.name, fetched: items.length, recorded: n });
      } catch (e) {
        detail.push({ source: f.name, error: String(e) });
      }
    }
    return new Response(JSON.stringify({ ok: true, feeds: feeds.length, recorded: total, detail }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
