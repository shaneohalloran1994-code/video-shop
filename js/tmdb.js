// TMDB lookups. The key is the viewer's own, saved on their device in Settings.
import { TMDB_PROXY } from "./config.js?v=p4";
const API = "https://api.themoviedb.org/3";
export const hasProxy = !!TMDB_PROXY;
export const IMG = "https://image.tmdb.org/t/p/";

export async function call(key, path, params = {}) {
  if (!key && !TMDB_PROXY) throw Object.assign(new Error("bad_key"), { code: "bad_key" });
  const u = new URL((key ? API : TMDB_PROXY.replace(/\/$/, "") + "/3") + path);
  if (key) u.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, v);
  for (let i = 0; i < 6; i++) {
    let r;
    try { r = await fetch(u); } catch { await sleep(800 * (i + 1)); continue; }
    if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
    if (r.status === 401) throw Object.assign(new Error("bad_key"), { code: "bad_key" });
    if (r.status === 404) return null;
    if (!r.ok) { await sleep(700 * (i + 1)); continue; }
    return r.json();
  }
  return null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function checkKey(key) {
  try { const r = await call(key, "/configuration"); return !!r; } catch { return false; }
}

const norm = s => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

// Find the TMDB film for a Letterboxd title + year. Title must match; year breaks ties.
export async function match(key, name, year) {
  const y = parseInt(year) || null;
  const nn = norm(name);
  const tries = y ? [{ query: name, primary_release_year: y }, { query: name, year: y }, { query: name }] : [{ query: name }];
  const cands = new Map();
  for (const t of tries) {
    const r = await call(key, "/search/movie", t);
    for (const m of r?.results || []) cands.set(m.id, m);
    if ([...cands.values()].some(m => exact(m) && yr(m) === y)) break;
  }
  function yr(m) { const v = parseInt((m.release_date || "").slice(0, 4)); return isNaN(v) ? null : v; }
  function exact(m) { return nn === norm(m.title) || nn === norm(m.original_title); }
  function score(m) {
    let s;
    const tn = norm(m.title);
    if (exact(m)) s = 10;
    else if (nn.length > 4 && tn.includes(nn)) s = 3;
    else return -99;
    const ry = yr(m);
    if (y && ry) s += ry === y ? 4 : Math.abs(ry - y) <= 2 ? 2 : -Math.abs(ry - y);
    s += Math.min(m.vote_count || 0, 2000) / 1000;
    return s;
  }
  let best = null, bs = -1e9;
  for (const m of cands.values()) { const s = score(m); if (s > bs) { bs = s; best = m; } }
  return best && bs >= 11 ? best.id : null;
}

export async function details(key, id, extra = "") {
  const d = await call(key, `/movie/${id}`, { append_to_response: "credits,keywords,recommendations" + (extra ? "," + extra : "") });
  if (!d) return null;
  const crew = d.credits?.crew || [];
  return {
    id: d.id, t: d.title, ot: d.original_title, y: (d.release_date || "").slice(0, 4), rd: d.release_date || "",
    g: (d.genres || []).map(x => x.name), rt: d.runtime || 0, l: d.original_language || "",
    c: (d.production_countries || []).map(x => x.iso_3166_1), va: d.vote_average || 0, vc: d.vote_count || 0,
    p: d.poster_path || "", bd: d.backdrop_path || "",
    dir: crew.filter(x => x.job === "Director").map(x => x.name),
    comp: crew.filter(x => x.job === "Original Music Composer").map(x => x.name).slice(0, 2),
    cast: (d.credits?.cast || []).slice(0, 6).map(x => x.name),
    kw: (d.keywords?.keywords || []).slice(0, 20).map(x => x.name),
    recs: (d.recommendations?.results || []).slice(0, 20).map(x => x.id),
    col: d.belongs_to_collection?.id || null, ov: d.overview || "", imdb: d.imdb_id || "", tag: d.tagline || "",
    pop: d.popularity || 0,
    ie: (() => { const r = (d.release_dates?.results || []).find(x => x.iso_3166_1 === "IE" || x.iso_3166_1 === "GB"); const t = (r?.release_dates || []).find(x => x.type === 3) || (r?.release_dates || [])[0]; return t ? t.release_date.slice(0, 10) : ""; })(),
  };
}

// Run tasks with limited concurrency and report progress.
export async function pool(items, n, fn, onTick) {
  let i = 0, done = 0;
  async function worker() {
    while (i < items.length) {
      const k = i++;
      try { await fn(items[k], k); } catch (e) { if (e.code === "bad_key") throw e; }
      done++; onTick && onTick(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

export const list = (key, path, params) => call(key, path, params);
export async function posters(key, id) {
  const d = await call(key, `/movie/${id}`, { append_to_response: "images", include_image_language: "en,null,xx,fr,de,it,es,ja,ko,pt" });
  return (d?.images?.posters || []).sort((a, b) => b.vote_count - a.vote_count || b.vote_average - a.vote_average).map(p => p.file_path);
}
