// Builds the shop from the imported profile: the shelves, your taste, recommendations and stats.

export function build(profile, films, extra, log) {
  const today = new Date().toISOString().slice(0, 10);
  const rec = k => films[k] || null;

  // What you've seen: Letterboxd history plus anything marked watched in the app.
  const seen = new Map(); // tmdb id -> info
  const touch = (m, patch) => {
    if (!m) return;
    const cur = seen.get(m.id) || { m, rating: null, last: null, count: 0, rewatched: false, uri: null };
    Object.assign(cur, patch(cur));
    seen.set(m.id, cur);
  };
  for (const w of profile.watched) touch(rec(w.key), c => ({ uri: c.uri || w.uri, count: Math.max(c.count, 1) }));
  for (const [k, r] of Object.entries(profile.ratings)) touch(rec(k), () => ({ rating: r }));
  for (const d of profile.diary) touch(rec(d.key), c => ({
    last: !c.last || d.date > c.last ? d.date : c.last,
    diaryN: (c.diaryN || 0) + 1,
    count: Math.max(c.count, (c.diaryN || 0) + 1),
    rewatched: c.rewatched || d.rewatch || (c.diaryN || 0) >= 1,
  }));
  for (const [id, e] of Object.entries(log || {})) {
    const m = films[e.key] || extra[id] || e.m;
    touch(m, c => ({ rating: e.rating ?? c.rating, last: e.date, count: c.count + 1, rewatched: c.count >= 1 || c.rewatched }));
  }

  const watchlist = [];
  const wlIds = new Set();
  for (const w of profile.watchlist) {
    const m = rec(w.key);
    if (!m || wlIds.has(m.id) || seen.has(m.id)) continue;
    wlIds.add(m.id);
    watchlist.push({ m, added: w.added, uri: w.uri });
  }
  const seenList = [...seen.values()];
  const unmatched = profile.watchlist.filter(w => !rec(w.key)).length;

  // ---- taste model: ridge regression fitted by coordinate descent ----
  const rated = seenList.filter(s => s.rating != null);
  const feats = m => {
    const f = [];
    for (const g of m.g) f.push("g:" + g);
    for (const d of m.dir) f.push("d:" + d);
    for (const a of m.cast.slice(0, 5)) f.push("a:" + a);
    if (m.y) f.push("dec:" + m.y.slice(0, 3) + "0s");
    f.push("l:" + m.l);
    for (const c of m.c.slice(0, 2)) f.push("c:" + c);
    return f;
  };
  const dense = m => {
    const va = m.va || 6.5, vc = m.vc || 0;
    return [vc >= 20 ? va - 6.8 : 0, Math.log10(vc + 1) - 3, ((m.rt || 100) - 110) / 30];
  };
  const cnt = new Map();
  for (const s of rated) for (const f of feats(s.m)) cnt.set(f, (cnt.get(f) || 0) + 1);
  const keep = new Map();
  for (const [f, n] of cnt) if (n >= (f[0] === "a" || f[0] === "c" ? 3 : 2)) keep.set(f, keep.size);
  const F = keep.size, D = 3, alpha = 10;
  const rows = rated.map(s => ({ idx: feats(s.m).map(f => keep.get(f)).filter(i => i != null), dv: dense(s.m), y: s.rating }));
  const n = rows.length;
  const mu = n ? rows.reduce((a, r) => a + r.y, 0) / n : 3.25;
  const w = new Float64Array(F), wd = new Float64Array(D);
  const resid = rows.map(r => r.y - mu);
  const cols = Array.from({ length: F }, () => []);
  rows.forEach((r, i) => r.idx.forEach(j => cols[j].push(i)));
  for (let ep = 0; ep < 40 && n; ep++) {
    for (let j = 0; j < F; j++) {
      const c = cols[j]; let s = 0;
      for (const i of c) s += resid[i] + w[j];
      const nw = s / (c.length + alpha), dlt = nw - w[j];
      if (dlt) { for (const i of c) resid[i] -= dlt; w[j] = nw; }
    }
    for (let j = 0; j < D; j++) {
      let s = 0, ss = 0;
      for (let i = 0; i < n; i++) { const x = rows[i].dv[j]; s += x * (resid[i] + x * wd[j]); ss += x * x; }
      const nw = s / (ss + alpha), dlt = nw - wd[j];
      if (dlt) { for (let i = 0; i < n; i++) resid[i] -= dlt * rows[i].dv[j]; wd[j] = nw; }
    }
  }
  const coef = f => { const j = keep.get(f); return j == null ? 0 : w[j]; };
  const predict = m => {
    let p = mu; for (const f of feats(m)) p += coef(f);
    const dv = dense(m); for (let j = 0; j < D; j++) p += wd[j] * dv[j];
    return Math.max(0.5, Math.min(5, p));
  };

  // ---- recent trend: genre share in the last 90 days vs all diary entries ----
  const dated = [];
  for (const d of profile.diary) { const m = rec(d.key); if (m && d.date) dated.push({ date: d.date, m }); }
  for (const [id, e] of Object.entries(log || {})) { const m = films[e.key] || extra[id] || e.m; if (m) dated.push({ date: e.date, m }); }
  dated.sort((a, b) => a.date < b.date ? -1 : 1);
  const lastDate = dated.length ? dated[dated.length - 1].date : today;
  const cut = new Date(new Date(lastDate).getTime() - 90 * 864e5).toISOString().slice(0, 10);
  const share = list => { const c = {}; list.forEach(x => x.m.g.forEach(g => c[g] = (c[g] || 0) + 1)); const t = list.length || 1; for (const g in c) c[g] /= t; return c; };
  const recentL = dated.filter(x => x.date >= cut);
  const recent = share(recentL), overall = share(dated);
  const lift = {}; for (const g of new Set([...Object.keys(recent), ...Object.keys(overall)])) lift[g] = (recent[g] || 0) - (overall[g] || 0);

  const fit = m => predict(m) + m.g.reduce((a, g) => a + Math.max(0, lift[g] || 0) * 1.5, 0);
  const reasons = (m, src) => {
    const out = [];
    const fs = feats(m).map(f => [coef(f), f]).sort((a, b) => b[0] - a[0]);
    for (const [c, f] of fs) {
      if (c < 0.08 || out.length >= 2) break;
      const [t, ...rest] = f.split(":"); const v = rest.join(":");
      if (t === "d") out.push(`You rate ${v} films highly`);
      else if (t === "a") out.push(`You tend to like films with ${v}`);
      else if (t === "g") out.push(`${v} is one of your strongest genres`);
      else if (t === "dec") out.push(`You rate films from the ${v} highly`);
    }
    const hot = m.g.find(g => (lift[g] || 0) > 0.06);
    if (hot) out.unshift(`You've been on a ${hot.toLowerCase()} run lately`);
    if (src && src.length) out.unshift("Keeps coming up off " + src.slice(0, 2).join(" and "));
    return out.slice(0, 3);
  };

  for (const x of watchlist) x.fit = fit(x.m);
  for (const s of seenList) s.fit = fit(s.m);

  // ---- candidates for "not on your list yet" ----
  const known = new Set([...seen.keys(), ...wlIds]);
  const srcW = new Map(), srcN = new Map();
  for (const s of rated) {
    if (s.rating < 4) continue;
    s.m.recs.forEach((rid, rank) => {
      if (known.has(rid)) return;
      srcW.set(rid, (srcW.get(rid) || 0) + (s.rating - 3.5) * (1 - rank / 25));
      if (!srcN.has(rid)) srcN.set(rid, []);
      srcN.get(rid).push([s.rating, s.m.t]);
    });
  }
  const candidateIds = [...srcW.keys()].sort((a, b) => srcW.get(b) - srcW.get(a)).slice(0, 160);
  const fresh = [];
  for (const id of candidateIds) {
    const m = extra[id];
    if (!m || m.vc < 150 || !m.rd || m.rd > today || m.rt < 60) continue;
    const src = srcN.get(id).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    fresh.push({ m, fit: fit(m) + Math.min(srcW.get(id), 4) * 0.12, why: reasons(m, src) });
  }
  fresh.sort((a, b) => b.fit - a.fit);

  const bestFits = [...watchlist].sort((a, b) => b.fit - a.fit).slice(0, 60).map(x => ({ ...x, why: reasons(x.m) }));

  return { watchlist, seen: seenList, unmatched, predict, fit, reasons, bestFits, fresh: fresh.slice(0, 60), candidateIds, lift, recent, overall, recentN: recentL.length, cut, lastDate, dated, mu, profile, films };
}

// ---- stats for the rental receipt ----
export function stats(S) {
  const seen = S.seen;
  const ratedL = seen.filter(s => s.rating != null);
  const avg = ratedL.reduce((a, s) => a + s.rating, 0) / (ratedL.length || 1);
  const mins = seen.reduce((a, s) => a + (s.m.rt || 0), 0);
  const tally = (fn) => { const c = new Map(); for (const s of seen) for (const k of fn(s)) { const o = c.get(k) || { n: 0, r: [] }; o.n++; if (s.rating != null) o.r.push(s.rating); c.set(k, o); } return c; };
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const genres = [...tally(s => s.m.g)].map(([k, o]) => ({ k, n: o.n, avg: mean(o.r) })).sort((a, b) => b.n - a.n);
  const decades = [...tally(s => s.m.y ? [s.m.y.slice(0, 3) + "0s"] : [])].map(([k, o]) => ({ k, n: o.n, avg: mean(o.r) })).sort((a, b) => a.k < b.k ? -1 : 1);
  const countries = [...tally(s => [...new Set(s.m.c.slice(0, 2))])].map(([k, o]) => ({ k, n: o.n })).sort((a, b) => b.n - a.n).slice(0, 8);
  const langs = [...tally(s => [s.m.l])].map(([k, o]) => ({ k, n: o.n })).sort((a, b) => b.n - a.n).slice(0, 6);
  const people = (fn, min) => {
    const c = tally(fn);
    const most = [...c].map(([k, o]) => ({ k, n: o.n, avg: mean(o.r) })).sort((a, b) => b.n - a.n || (a.k < b.k ? -1 : 1)).slice(0, 6);
    const best = [...c].filter(([, o]) => o.r.length >= min).map(([k, o]) => ({ k, n: o.r.length, avg: mean(o.r) })).sort((a, b) => b.avg - a.avg).slice(0, 6);
    return { most, best };
  };
  const directors = people(s => s.m.dir, 3), actors = people(s => s.m.cast.slice(0, 5), 4);
  const pairs = ratedL.filter(s => s.m.vc >= 50).map(s => ({ s, mine: s.rating, crowd: s.m.va / 2 }));
  const crowdAvg = mean(pairs.map(p => p.crowd));
  const gd = new Map();
  for (const p of pairs) for (const g of p.s.m.g) { const a = gd.get(g) || []; a.push(p.mine - p.crowd); gd.set(g, a); }
  const vsCrowd = [...gd].filter(([, a]) => a.length >= 15).map(([g, a]) => ({ g, d: mean(a), n: a.length })).sort((a, b) => a.d - b.d);
  const dis = [...pairs].sort((a, b) => (a.mine - a.crowd) - (b.mine - b.crowd));
  const dist = {}; for (const s of ratedL) dist[s.rating] = (dist[s.rating] || 0) + 1;
  const lately = Object.keys(S.recent).map(g => ({ g, r: S.recent[g] || 0, o: S.overall[g] || 0 })).sort((a, b) => (b.r - b.o) - (a.r - a.o));
  return {
    watched: seen.length, rated: ratedL.length, hours: Math.round(mins / 60), avg, watchlist: S.watchlist.length,
    genres, decades, countries, langs, directors, actors, crowdAvg, vsCrowd,
    harsher: dis.slice(0, 5), kinder: dis.slice(-5).reverse(), dist, lately: lately.slice(0, 3),
  };
}
