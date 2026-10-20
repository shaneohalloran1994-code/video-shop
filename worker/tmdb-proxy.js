// Take One: the shop's little helper on Cloudflare Workers. Version 3.1 (adds shared shops and Letterboxd top-up).
// 1. TMDB proxy: lets people use the app without their own TMDB key. The key stays here as a secret (TMDB_KEY).
// 2. Shared shops: when someone taps Share, their shelves are stored here under a short code until they stop sharing.
//    Needs a KV namespace bound to this Worker with the variable name SHOPS.
// 3. Letterboxd top-up: reads a member's public diary feed so new watches appear without a fresh export.

const ALLOWED_ORIGINS = ["https://shaneohalloran1994-code.github.io", "http://localhost:8765"];
const ALLOWED_PATHS = [
  /^\/3\/configuration$/,
  /^\/3\/search\/movie$/,
  /^\/3\/movie\/\d+$/,
  /^\/3\/movie\/(upcoming|now_playing)$/,
  /^\/3\/discover\/movie$/,
];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I mix-ups
const MAX_SHOP = 4 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Token",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response("Not allowed", { status: 403, headers: cors });
    const url = new URL(request.url);
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

    // ---- shared shops ----
    if (url.pathname === "/shop" || url.pathname.startsWith("/shop/")) {
      if (!env.SHOPS) return json({ error: "Sharing isn't set up on the Worker yet (no SHOPS binding)." }, 503);
      const code = (url.pathname.split("/")[2] || "").toUpperCase();
      if (request.method === "GET" && code) {
        const v = await env.SHOPS.get("shop:" + code, "arrayBuffer");
        if (!v) return json({ error: "No shop with that code." }, 404);
        return new Response(v, { headers: { ...cors, "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
      }
      if (request.method === "POST" && !code) {
        const body = await request.arrayBuffer();
        if (!body.byteLength || body.byteLength > MAX_SHOP) return json({ error: "Shop too big to share." }, 413);
        let c; for (let i = 0; i < 8; i++) { c = randomCode(6); if (!(await env.SHOPS.get("meta:" + c))) break; }
        const token = randomCode(24);
        await env.SHOPS.put("shop:" + c, body);
        await env.SHOPS.put("meta:" + c, JSON.stringify({ token: await sha(token), at: Date.now() }));
        return json({ code: c, token });
      }
      if ((request.method === "PUT" || request.method === "DELETE") && code) {
        const meta = JSON.parse((await env.SHOPS.get("meta:" + code)) || "null");
        if (!meta || meta.token !== (await sha(request.headers.get("X-Token") || ""))) return json({ error: "Not your shop." }, 403);
        if (request.method === "DELETE") { await env.SHOPS.delete("shop:" + code); await env.SHOPS.delete("meta:" + code); return json({ ok: true }); }
        const body = await request.arrayBuffer();
        if (!body.byteLength || body.byteLength > MAX_SHOP) return json({ error: "Shop too big to share." }, 413);
        await env.SHOPS.put("shop:" + code, body);
        await env.SHOPS.put("meta:" + code, JSON.stringify({ ...meta, at: Date.now() }));
        return json({ ok: true });
      }
      return json({ error: "Not found" }, 404);
    }

    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors });

    // ---- Letterboxd diary feed ----
    const lb = url.pathname.match(/^\/lb\/([A-Za-z0-9_]{1,40})$/);
    if (lb) {
      const r = await fetch(`https://letterboxd.com/${lb[1]}/rss/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
          "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
          "Accept-Language": "en-IE,en;q=0.9",
        },
        cf: { cacheTtl: 1800, cacheEverything: true },
      });
      if (!r.ok) return json({ error: `Couldn't read that Letterboxd feed (Letterboxd said ${r.status}).` }, r.status === 404 ? 404 : 502);
      return new Response(await r.text(), { headers: { ...cors, "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=1800" } });
    }

    // ---- TMDB ----
    if (!ALLOWED_PATHS.some(r => r.test(url.pathname))) return new Response("Not found", { status: 404, headers: cors });
    const target = new URL("https://api.themoviedb.org" + url.pathname);
    for (const [k, v] of url.searchParams) if (k !== "api_key") target.searchParams.set(k, v);
    target.searchParams.set("api_key", env.TMDB_KEY);
    const r = await fetch(target, { cf: { cacheTtl: url.pathname.includes("upcoming") || url.pathname.includes("now_playing") || url.pathname.includes("discover") ? 21600 : 86400, cacheEverything: true } });
    const body = await r.text();
    return new Response(body, { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
  },
};

function randomCode(n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map(x => CODE_CHARS[x % CODE_CHARS.length]).join("");
}
async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}
