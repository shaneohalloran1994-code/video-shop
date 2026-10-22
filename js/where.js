// Where to watch: streaming, rent and buy options for your country, from JustWatch via TMDB.
import { prefs } from "./store.js?v=r1";

export const COUNTRIES = ["IE", "GB", "US", "CA", "AU", "NZ", "DE", "FR", "ES", "IT", "NL", "BE", "DK", "SE", "NO", "FI", "PL", "PT", "AT", "CH", "BR", "MX", "AR", "IN", "JP", "KR", "ZA"];
export const country = () => prefs.get("region", "IE");
export const setCountry = c => { prefs.set("region", c); cache.clear(); };
// JustWatch uses "uk" for the UK; everything else is the lower-case country code.
const jwCode = c => c === "GB" ? "uk" : c.toLowerCase();
export const jwLink = m => `https://www.justwatch.com/${jwCode(country())}/search?q=${encodeURIComponent(m.t)}`;

// "Netflix Standard with Ads" is still Netflix; "Apple TV Store" is Apple TV.
const tidy = n => n.replace(/ (Amazon|Apple TV|Roku Premium) Channel$/, "").replace(/ (Standard|Basic)? ?with Ads$/, "").replace(/ (Premium|Store|Movies)$/, "").trim();
const placeName = () => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(country()); } catch { return "your country"; } };
const cache = new Map();
export async function lookup(call, m) {
  const k = country() + ":" + m.id;
  if (cache.has(k)) return cache.get(k);
  const p = call(`/movie/${m.id}`, { append_to_response: "watch/providers" }).then(d => {
    const r = d?.["watch/providers"]?.results?.[country()] || null;
    const names = arr => [...new Set((arr || []).sort((a, b) => a.display_priority - b.display_priority).map(x => tidy(x.provider_name)))];
    const w = r ? { stream: names([...(r.flatrate || []), ...(r.free || []), ...(r.ads || [])]), rent: names(r.rent), buy: names(r.buy) } : { stream: [], rent: [], buy: [] };
    learn(w); return w;
  }).catch(() => null);
  cache.set(k, p);
  return p;
}
export function line(w) {
  if (!w) return "";
  const list = a => a.slice(0, 3).join(", ") + (a.length > 3 ? ` +${a.length - 3}` : "");
  if (w.stream.length) return `<b>Streaming</b> on ${list(w.stream)}`;
  const rb = [...new Set([...w.rent, ...w.buy])];
  if (w.rent.length) return `<b>Rent</b> on ${list(rb)}`;
  if (w.buy.length) return `<b>Buy</b> on ${list(rb)}`;
  return `<b>Not streaming</b> in ${placeName().replace(/^United/, "the United")} right now`;
}

// ---------- what you've got: the services you pay for, so a roll can skip films you'd have to rent ----------
const SVC = {
  IE: ["Netflix", "Amazon Prime Video", "Disney Plus", "Apple TV+", "Now TV", "Sky Go", "MUBI", "RTÉ Player", "Virgin Media Player", "Paramount Plus", "Curzon Home Cinema"],
  GB: ["Netflix", "Amazon Prime Video", "Disney Plus", "Apple TV+", "Now TV", "Sky Go", "MUBI", "BBC iPlayer", "ITVX", "Channel 4", "Paramount Plus", "BFI Player", "Curzon Home Cinema"],
  US: ["Netflix", "Amazon Prime Video", "Disney Plus", "Hulu", "Max", "Apple TV+", "Peacock", "Paramount Plus", "MUBI", "Criterion Channel", "Tubi", "Kanopy"],
};
const norm = s => s.toLowerCase().replace(/\+|plus\b/g, "").replace(/[^a-z0-9]/g, "");
export const services = () => {
  const learned = prefs.get("svcSeen", []);
  const base = SVC[country()] || ["Netflix", "Amazon Prime Video", "Disney Plus", "Apple TV+", "MUBI", "Paramount Plus"];
  const out = [...base]; for (const n of learned) if (!out.some(b => norm(b) === norm(n))) out.push(n);
  return out;
};
export const mine = () => prefs.get("subs", []);
export const setMine = list => prefs.set("subs", list);
const same = (a, b) => { const x = norm(a), y = norm(b); return x && y && (x === y || x.startsWith(y) || y.startsWith(x)); };
// True / false once the lookup is in; null if we couldn't find out.
export function onMine(w) {
  if (!w) return null;
  const subs = mine(); if (!subs.length) return null;
  return w.stream.some(s => subs.some(m => same(s, m)));
}
// Remember service names seen in lookups so they can be ticked in Settings.
export function learn(w) {
  if (!w?.stream?.length) return;
  const seen = prefs.get("svcSeen", []); let ch = false;
  for (const n of w.stream) if (!seen.some(s => norm(s) === norm(n))) { seen.push(n); ch = true; }
  if (ch) prefs.set("svcSeen", seen.slice(-30));
}
