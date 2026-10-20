// Take One: TMDB proxy for Cloudflare Workers.
// Lets people use the app without their own TMDB key. Your key stays here as a secret, never in the app.
// Setup: add a secret called TMDB_KEY (Settings > Variables and Secrets) with your TMDB API key.

const ALLOWED_ORIGINS = ["https://shaneohalloran1994-code.github.io", "http://localhost:8765"];
const ALLOWED_PATHS = [/^\/3\/configuration$/, /^\/3\/search\/movie$/, /^\/3\/movie\/\d+$/];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors });
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response("Not allowed", { status: 403, headers: cors });

    const url = new URL(request.url);
    if (!ALLOWED_PATHS.some(r => r.test(url.pathname))) return new Response("Not found", { status: 404, headers: cors });

    const target = new URL("https://api.themoviedb.org" + url.pathname);
    for (const [k, v] of url.searchParams) if (k !== "api_key") target.searchParams.set(k, v);
    target.searchParams.set("api_key", env.TMDB_KEY);

    const r = await fetch(target, { cf: { cacheTtl: 86400, cacheEverything: true } });
    const body = await r.text();
    return new Response(body, { status: r.status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
  },
};
