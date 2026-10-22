// Coming Soon and In Cinemas Now, picked for you. Refreshed once a day.
let C = null;
export function init(ctx) { C = ctx; }
const $ = s => document.querySelector(s);
const today = () => new Date().toISOString().slice(0, 10);
const plus = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

async function ids(path, params, pages) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const r = await C.tmdb.list(C.key(), path, { ...params, page: p });
    (r?.results || []).forEach(x => out.push(x.id));
    if (!r || p >= (r.total_pages || 1)) break;
  }
  return [...new Set(out)];
}
async function fetchDetails(list) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < list.length) { const id = list[i++]; try { const d = await C.tmdb.details(C.key(), id, "release_dates"); if (d) out.push(d); } catch { } } }));
  return out;
}
async function load() {
  const cached = await C.store.get("coming");
  if (cached && cached.date === today()) return cached;
  const [nowIds, soonIds] = await Promise.all([
    ids("/movie/now_playing", { region: "IE" }, 2),
    ids("/discover/movie", { region: "IE", with_release_type: "2|3", "release_date.gte": plus(1), "release_date.lte": plus(200), sort_by: "popularity.desc" }, 3),
  ]);
  const [now, soon] = await Promise.all([fetchDetails(nowIds.slice(0, 36)), fetchDetails(soonIds.filter(i => !nowIds.includes(i)).slice(0, 54))]);
  const data = { date: today(), now, soon };
  await C.store.set("coming", data);
  return data;
}

// Why this one, for you.
function scorer() {
  const S = C.S, seen = new Set(S.seen.map(s => s.m.id));
  const favCol = new Map(), dirR = new Map(), castR = new Map();
  const src = S.house ? S.watchlist.filter(x => x.pick).map(x => ({ m: x.m, rating: 4.6 })) : S.seen.filter(s => s.rating != null);
  for (const s of src) {
    if (s.m.col && s.rating >= 4) favCol.set(s.m.col, s.m.t);
    s.m.dir.forEach(d => { const a = dirR.get(d) || []; a.push(s.rating); dirR.set(d, a); });
    s.m.cast.slice(0, 4).forEach(c => { const a = castR.get(c) || []; a.push(s.rating); castR.set(c, a); });
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const favDir = d => { const a = dirR.get(d); return a && a.length >= 2 && avg(a) >= 3.8; };
  const favCast = c => { const a = castR.get(c); return a && a.length >= 3 && avg(a) >= 3.8; };
  const who = S.house ? "Rasher" : "you";
  return m => {
    if (seen.has(m.id)) return null;
    const pop = Math.log10((m.pop || 1) + 1);
    let s = S.house ? pop : S.fit(m) * 0.6 + pop * 1.3;
    const why = [];
    if (m.col && favCol.has(m.col)) { s += 2; why.push(`Back to the world of ${favCol.get(m.col)}, which ${who} loved`); }
    const d = m.dir.find(favDir); if (d) { s += 1.4; why.push(`New one from ${d}`); }
    const c = m.cast.slice(0, 4).find(favCast); if (c) { s += 0.6; why.push(`${c}'s in it`); }
    if (!why.length && !S.house) { const r = S.reasons(m); if (r[0]) why.push(r[0]); }
    if (!why.length) why.push(S.house ? "Rasher's got a hunch about this one." : "Fits your taste");
    if (m.g.includes("Documentary") && !why.length) s -= .5;
    return { m, s, why };
  };
}
const fmtDate = d => d ? new Date(d + "T12:00").toLocaleDateString("en-IE", { day: "numeric", month: "short" }).toUpperCase() : "";

function tile(r, now) {
  const m = r.m, p = C.posterOf(m, "w342"), d = m.ie || m.rd;
  return `<article class="onesheet"><div class="os-poster" style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : C.esc(m.t)}<span class="os-date">${now ? "NOW SHOWING" : "OUT " + fmtDate(d)}</span></div>
    <h3 class="titlecard">${C.esc(m.t)}</h3><p class="os-why">${C.esc(r.why[0])}</p>
    <a class="tag" href="https://letterboxd.com/tmdb/${m.id}/" target="_blank" rel="noopener">Letterboxd</a></article>`;
}
let busy = false;
export async function render() {
  const box = $("#coming");
  if (!C.S) { box.innerHTML = ""; return; }
  if (!C.key() && !C.tmdb.hasProxy) { box.innerHTML = ""; return; }
  if (busy) return; busy = true;
  box.innerHTML = `<p class="note">Rasher's checking the distributor's list…</p>`;
  try {
    const data = await load(), score = scorer();
    const rank = (list, n) => list.map(score).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, n);
    const now = rank(data.now, 8), soon = rank(data.soon.filter(m => (m.ie || m.rd) > today()), 12).sort((a, b) => (a.m.ie || a.m.rd) < (b.m.ie || b.m.rd) ? -1 : 1);
    box.innerHTML = `${now.length ? `<h2 class="shelfname" id="cinemasHead">In cinemas now</h2><div class="wall">${now.map(r => tile(r, true)).join("")}</div>` : ""}
      ${soon.length ? `<h2 class="shelfname" id="soonHead">Coming soon</h2><p class="note">Irish release dates. Rasher's already excited.</p><div class="wall">${soon.map(r => tile(r, false)).join("")}</div>` : ""}`;
  } catch {
    box.innerHTML = `<p class="note">Couldn't reach the cinema listings just now. They'll be back next time you open this page.</p>`;
  }
  busy = false;
}
