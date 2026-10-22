// Friends: sharing your shop by code, visiting a mate's, comparing taste, group night, guest tuning and the Letterboxd top-up.
import * as store from "./store.js?v=q9";
import { TMDB_PROXY } from "./config.js?v=q9";
import * as shelf from "./shelf.js?v=q9";

const BASE = (TMDB_PROXY || "").replace(/\/$/, "");
let C = null;
export function init(ctx) { C = ctx; }

// ---------- packing a shop ----------
async function gzip(str) {
  const s = new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function gunzip(buf) {
  const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(s).text();
}
const slim = m => { const { bd, comp, ot, ie, _rel, ...rest } = m; return rest; };

// What travels: the shelves, what they've seen, and their ratings. The app never shows a mate's ratings;
// they're only used to compare taste and to rank their staff picks.
export function payload(S, name) {
  const items = [];
  for (const x of S.watchlist) items.push({ m: slim(x.m), wl: 1, fit: +x.fit.toFixed(2), uri: x.uri || "" });
  const wl = new Set(S.watchlist.map(x => x.m.id));
  for (const s of S.seen) if (!wl.has(s.m.id)) items.push({ m: slim(s.m), wl: 0, pick: s.rating != null && s.rating >= 4.5 ? 1 : 0, r: s.rating ?? null, fit: +(s.rating ?? S.fit(s.m)).toFixed(2), uri: s.uri || "" });
  return { v: 1, name, at: new Date().toISOString(), items, shelf: shelf.forShare() };
}

async function api(method, path, body, token) {
  const r = await fetch(BASE + path, { method, body, headers: { ...(body ? { "Content-Type": "application/octet-stream" } : {}), ...(token ? { "X-Token": token } : {}) } });
  if (r.status === 404 && method === "GET") throw new Error("No shop with that code. Check it and try again.");
  if (r.status === 503) throw new Error("Sharing's not working right now. Try again later.");
  if (!r.ok) { let e = ""; try { e = (await r.json()).error; } catch { } throw new Error(e || "The shop's line is down. Try again in a minute."); }
  return r;
}
export const shareInfo = () => store.prefs.get("share", null);
export async function share(S, name) {
  const body = await gzip(JSON.stringify(payload(S, name)));
  const cur = shareInfo();
  if (cur) { await api("PUT", "/shop/" + cur.code, body, cur.token); store.prefs.set("share", { ...cur, name, at: Date.now() }); return cur.code; }
  const { code, token } = await (await api("POST", "/shop", body)).json();
  store.prefs.set("share", { code, token, name, at: Date.now() });
  return code;
}
export async function stopSharing() {
  const cur = shareInfo(); if (!cur) return;
  try { await api("DELETE", "/shop/" + cur.code, null, cur.token); } catch (e) { if (!/Not your shop/.test(e.message)) throw e; }
  store.prefs.del("share");
}

// ---------- notes for the shop owner ----------
export async function tell(text, from, where) {
  const r = await fetch(BASE + "/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, from, where }) });
  if (!r.ok) throw new Error("The shop's line is down. Try again in a minute.");
}

// ---------- swapping shops: both of you on each other's wall ----------
// Your code drops into their inbox; their app adds you next time it opens.
export const swapped = () => new Set(store.prefs.get("swapped", []));
const markSwapped = code => { const s = swapped(); s.add(code); store.prefs.set("swapped", [...s]); };
export async function swapWith(S, name, code) {
  if (!shareInfo()) await share(S, name);
  const me = shareInfo();
  await api("POST", "/inbox/" + code, JSON.stringify({ from: me.code, name: me.name }));
  markSwapped(code);
}
// Mates who swapped with you since you last looked. Each gets added to your wall.
export async function checkInbox() {
  const me = shareInfo(); if (!me) return [];
  const r = await fetch(BASE + "/inbox/" + me.code, { headers: { "X-Token": me.token } });
  if (!r.ok) return [];
  const { items = [] } = await r.json();
  if (!items.length) return [];
  await fetch(BASE + "/inbox/" + me.code, { method: "DELETE", headers: { "X-Token": me.token } }).catch(() => {});
  const f = await all(), added = [];
  for (const it of items) {
    try {
      const fr = await add(it.from); markSwapped(it.from); added.push(fr);
      // Same mate, new code: drop the old one if it's gone dead.
      for (const old of Object.values(f)) if (old.code !== it.from && old.name.toLowerCase() === fr.name.toLowerCase()) {
        try { await refresh(old.code); } catch (e) { if (/No shop/.test(e.message)) await remove(old.code); }
      }
    } catch { }
  }
  return added;
}
// A new code: the old one stops working, and every mate on your wall gets the new one.
export async function newCode(S, name) {
  const old = shareInfo(); if (!old) return share(S, name);
  try { await api("DELETE", "/shop/" + old.code, null, old.token); } catch { }
  store.prefs.del("share");
  const code = await share(S, name || old.name);
  const me = shareInfo();
  for (const c of Object.keys(await all())) await api("POST", "/inbox/" + c, JSON.stringify({ from: me.code, name: me.name })).catch(() => {});
  return code;
}

// ---------- friends on this phone ----------
let friends = null;
export async function all() { if (!friends) friends = (await store.get("friends")) || {}; return friends; }
export async function add(code) {
  code = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) throw new Error("Codes are six letters and numbers.");
  if (shareInfo()?.code === code) throw new Error("That's your own shop.");
  const data = JSON.parse(await gunzip(await (await api("GET", "/shop/" + code)).arrayBuffer()));
  const f = await all(); f[code] = { code, name: data.name || "A mate", at: data.at, items: data.items, shelf: data.shelf || [], fetched: Date.now() };
  await store.set("friends", f); return f[code];
}
export async function refresh(code) { const f = await all(); if (f[code]) return add(code); }
export async function remove(code) { const f = await all(); delete f[code]; await store.set("friends", f); }

// A mate's shop, shaped like the house shop so the rest of the app can walk round it.
export function asHouse(fr) {
  const n = fr.name;
  return {
    items: fr.items.map(x => ({ ...x, why: x.pick ? [`One of ${n}'s favourites.`] : x.wl ? [`Still on ${n}'s list.`] : [`${n}'s seen this one.`] })),
  };
}

// ---------- comparing taste ----------
// mine: your own built shop (or null). Returns plain words and titles, never a mate's numbers.
export function compare(mine, fr) {
  const theirs = new Map(fr.items.map(x => [x.m.id, x]));
  const mySeen = mine ? mine.seen : [];
  const both = mySeen.filter(s => theirs.has(s.m.id) && !theirs.get(s.m.id).wl);
  const rated = both.filter(s => s.rating != null && theirs.get(s.m.id).r != null).map(s => ({ m: s.m, a: s.rating, b: theirs.get(s.m.id).r }));
  const diff = rated.length ? rated.reduce((t, p) => t + Math.abs(p.a - p.b), 0) / rated.length : null;
  const match = diff == null || rated.length < 5 ? null : Math.max(0, Math.min(100, Math.round(100 - diff * 32)));
  const loved = rated.filter(p => p.a >= 4.5 && p.b >= 4.5).sort((x, y) => y.m.vc - x.m.vc).slice(0, 6).map(p => p.m);
  const apart = rated.filter(p => Math.abs(p.a - p.b) >= 2).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 4).map(p => p.m);
  const g = list => { const c = {}; list.forEach(m => m.g.forEach(x => c[x] = (c[x] || 0) + 1)); return c; };
  const ga = g(mySeen.filter(s => s.rating >= 4).map(s => s.m)), gb = g(fr.items.filter(x => x.r >= 4).map(x => x.m));
  const ta = Object.values(ga).reduce((a, b) => a + b, 0) || 1, tb = Object.values(gb).reduce((a, b) => a + b, 0) || 1;
  const genres = Object.keys(ga).filter(k => gb[k]).map(k => [k, Math.min(ga[k] / ta, gb[k] / tb)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  const bothWl = mine ? mine.watchlist.filter(x => theirs.get(x.m.id)?.wl).length : 0;
  return { both: both.length, rated: rated.length, match, loved, apart, genres, bothWl, neither: neither(mine, [fr], 3) };
}

// Films nobody in the room has seen, best for the room first.
export function neither(mine, frs, n = 5, opts = {}) {
  const seen = new Set(), cand = new Map();
  const people = [];
  if (mine) { mine.seen.forEach(s => seen.add(s.m.id)); people.push({ fit: m => mine.fit(m), has: new Map(mine.watchlist.map(x => [x.m.id, x])) }); }
  for (const fr of frs) {
    const has = new Map(fr.items.map(x => [x.m.id, x]));
    fr.items.forEach(x => { if (!x.wl) seen.add(x.m.id); });
    const mu = fr.items.reduce((a, x) => a + x.fit, 0) / (fr.items.length || 1);
    people.push({ fit: m => has.get(m.id)?.fit ?? mu - .2, has });
  }
  for (const p of people) for (const [id, x] of p.has) if (x.wl !== 0 && !cand.has(id)) cand.set(id, x.m);
  const out = [];
  for (const [id, m] of cand) {
    if (seen.has(id)) continue;
    if (opts.short && !(m.rt > 0 && m.rt <= 125)) continue;
    if (opts.nosubs && m.l !== "en" && m.l !== "xx") continue;
    const onLists = people.filter(p => p.has.get(id) && p.has.get(id).wl !== 0).length;
    const s = people.reduce((t, p) => t + p.fit(m), 0) / people.length + (onLists - 1) * .6;
    out.push({ m, s, onLists });
  }
  out.sort((a, b) => b.s - a.s);
  if (opts.random) { const top = out.slice(0, 40); const pick = []; while (pick.length < n && top.length) pick.push(top.splice(Math.floor(Math.random() * Math.min(top.length, 12)), 1)[0]); return pick; }
  return out.slice(0, n);
}

// ---------- guest tuning: tell Rasher a few films you love or can't stand ----------
function likeness(a, b) {
  let s = (a.kw || []).filter(k => (b.kw || []).includes(k)).length * .5;
  if (a.dir.some(d => b.dir.includes(d))) s += 3;
  s += a.cast.slice(0, 5).filter(c => b.cast.slice(0, 5).includes(c)).length;
  s += a.g.filter(g => b.g.includes(g)).length * .5;
  return Math.min(1, s / 5);
}
export const tuning = () => store.prefs.get("tune", { like: [], nope: [] });
export function tuneSet(like, nope) { store.prefs.set("tune", { like, nope }); }
export function applyTune(S) {
  const t = tuning(); if (!S || (!t.like.length && !t.nope.length)) return S;
  const byId = new Map(S.watchlist.map(x => [x.m.id, x.m]));
  const likes = t.like.map(id => byId.get(id)).filter(Boolean), nopes = t.nope.map(id => byId.get(id)).filter(Boolean);
  const gone = new Set([...t.like, ...t.nope]);
  S.watchlist = S.watchlist.filter(x => !gone.has(x.m.id)).map(x => {
    const up = likes.length ? Math.max(...likes.map(l => likeness(l, x.m))) : 0, down = nopes.length ? Math.max(...nopes.map(l => likeness(l, x.m))) : 0;
    return { ...x, fit: x.fit + up * .8 - down * .6 };
  });
  S.bestFits = S.watchlist.filter(x => x.pick).sort((a, b) => b.fit - a.fit);
  S.fresh = S.watchlist.filter(x => x.wl).sort((a, b) => b.fit - a.fit).slice(0, 60);
  S.tuned = true;
  return S;
}
// Twenty well-known films from the shop to swipe through, a spread of genres.
export function tuneDeck(S) {
  const pool = S.watchlist.filter(x => x.m.vc >= 3000 && x.m.p).sort((a, b) => b.m.vc - a.m.vc).slice(0, 120);
  const out = [], seenG = {};
  for (const x of pool) { const g = x.m.g[0]; if ((seenG[g] || 0) >= 3) continue; seenG[g] = (seenG[g] || 0) + 1; out.push(x); if (out.length >= 20) break; }
  return out;
}

// ---------- Letterboxd top-up from the public diary feed ----------
export async function topUp(profile, films, details) {
  if (!profile?.username) throw new Error("No Letterboxd username in your export.");
  const r = await fetch(BASE + "/lb/" + encodeURIComponent(profile.username));
  if (!r.ok) throw new Error(r.status === 404 ? "Couldn't find your Letterboxd diary. Check the username, or try again in a minute." : "Letterboxd didn't answer. Try again later.");
  const xml = new DOMParser().parseFromString(await r.text(), "application/xml");
  const tag = (el, n) => el.getElementsByTagName(n)[0]?.textContent?.trim() || "";
  const watchedKeys = new Set(profile.watched.map(w => w.key)), diaryKeys = new Set(profile.diary.map(d => d.key + "|" + d.date));
  let added = 0;
  for (const it of [...xml.getElementsByTagName("item")]) {
    const title = tag(it, "letterboxd:filmTitle"), year = tag(it, "letterboxd:filmYear"); if (!title) continue;
    const key = `${title}|${year}`, date = tag(it, "letterboxd:watchedDate") || tag(it, "pubDate").slice(0, 16);
    const rating = parseFloat(tag(it, "letterboxd:memberRating")) || null, rewatch = tag(it, "letterboxd:rewatch") === "Yes";
    const tmdbId = parseInt(tag(it, "tmdb:movieId")) || null;
    if (diaryKeys.has(key + "|" + date)) continue;
    profile.diary.push({ key, date, rating, rewatch }); diaryKeys.add(key + "|" + date);
    if (rating != null) profile.ratings[key] = rating;
    if (!watchedKeys.has(key)) { profile.watched.push({ key, date, uri: tag(it, "link") }); watchedKeys.add(key); added++; }
    profile.watchlist = profile.watchlist.filter(w => w.key !== key);
    if (!(key in films) && tmdbId) films[key] = await details(tmdbId);
  }
  profile.toppedAt = new Date().toISOString();
  return added;
}
