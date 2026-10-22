// Where to watch: streaming, rent and buy options for your country, from JustWatch via TMDB.
import { prefs } from "./store.js?v=q2";

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
    return r ? { stream: names([...(r.flatrate || []), ...(r.free || []), ...(r.ads || [])]), rent: names(r.rent), buy: names(r.buy) } : { stream: [], rent: [], buy: [] };
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
