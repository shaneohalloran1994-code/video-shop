// Start your own shop without a Letterboxd export: read a username's public diary and/or swipe through films.
// Produces the same profile + films shape as the zip importer, so the rest of the app can't tell the difference.
import * as friends from "./friends.js?v=p4";

let C = null;
export function init(ctx) { C = ctx; }
const $ = s => document.querySelector(s);
const keyOf = m => `${m.t}|${m.y}`;
const BUCKETS = [["5", "Loved it"], ["3.5", "Liked it"], ["1.5", "Not for me"], ["wl", "Want to see"], ["skip", "Haven't seen"]];

function likeness(a, b) {
  let s = (a.kw || []).filter(k => (b.kw || []).includes(k)).length * .5;
  if ((a.dir || []).some(d => (b.dir || []).includes(d))) s += 3;
  s += (a.cast || []).slice(0, 5).filter(c => (b.cast || []).slice(0, 5).includes(c)).length;
  s += (a.g || []).filter(g => (b.g || []).includes(g)).length * .5;
  return Math.min(1, s / 5);
}

// Forty well-known films, spread across genres and decades, that most people will have an opinion on.
function deck(items, skip) {
  const pool = items.filter(x => x.m.p && x.m.vc >= 2500 && !skip.has(x.m.id)).sort((a, b) => b.m.vc - a.m.vc).slice(0, 260);
  const out = [], g = {}, d = {};
  for (const x of pool.sort(() => Math.random() - .5).sort((a, b) => b.m.vc - a.m.vc)) {
    const gg = x.m.g[0], dd = (x.m.y || "").slice(0, 3);
    if ((g[gg] || 0) >= 6 || (d[dd] || 0) >= 9) continue;
    g[gg] = (g[gg] || 0) + 1; d[dd] = (d[dd] || 0) + 1; out.push(x.m);
    if (out.length >= 40) break;
  }
  return out;
}

const st = { profile: null, films: {}, answers: new Map(), deck: [], i: 0 };

export async function open(existing) {
  const house = await C.house(); if (!house) return C.toast("Couldn't open the shop's stock. Check your connection.");
  st.films = existing ? { ...existing.films } : {};
  st.profile = existing ? JSON.parse(JSON.stringify(existing.profile)) : { importedAt: new Date().toISOString(), username: "", watchlist: [], watched: [], ratings: {}, diary: [], built: true };
  st.answers = new Map();
  const known = new Set(Object.values(st.films).filter(Boolean).map(m => m.id));
  st.deck = deck(house.items, known); st.i = 0;
  $("#buildSheet").hidden = false; document.body.classList.add("noscroll");
  if (existing || !C.proxy) swipeView(); else startView();
}
function close() { $("#buildSheet").hidden = true; document.body.classList.remove("noscroll"); }

function startView() {
  $("#buildBody").innerHTML = `<div class="askq">${C.head}<p class="said"><b>Rasher</b>No export? No bother. Got a Letterboxd account? Give me your username and I'll read what you've logged lately.</p></div>
    <div class="row"><input id="bUser" autocomplete="off" autocapitalize="none" placeholder="Letterboxd username"><button class="btn" id="bRead">Read it</button></div>
    <p class="small" id="bMsg"></p>
    <div class="row"><button class="ghost" id="bNoLb">No Letterboxd, just ask me some films</button></div>`;
  $("#bRead").onclick = async () => {
    const u = $("#bUser").value.trim().replace(/^@/, "").replace(/.*letterboxd\.com\//, "").replace(/\/.*$/, "");
    if (!u) return;
    $("#bMsg").textContent = "Reading your diary…";
    try {
      st.profile.username = u;
      const n = await friends.topUp(st.profile, st.films, id => C.details(id));
      $("#bMsg").textContent = n ? `Got ${n} films from your diary.` : "Your diary's empty or private. We'll do it the other way.";
      st.deck = st.deck.filter(m => !st.profile.watched.some(w => w.key === keyOf(m)));
      setTimeout(swipeView, 900);
    } catch (e) { st.profile.username = ""; $("#bMsg").textContent = e.message; }
  };
  $("#bNoLb").onclick = swipeView;
}

function swipeView() {
  const answered = st.answers.size, m = st.deck[st.i];
  const enough = answered + st.profile.watched.length >= 10;
  if (!m) return finish();
  const p = C.posterOf(m, "w342");
  $("#buildBody").innerHTML = `<div class="bsearch"><input id="bQ" autocomplete="off" placeholder="Add a film you love…"><div id="bRes"></div></div>
    <div class="bcard"><div class="bposter" style="${p ? `background-image:url('${p}')` : ""}"></div><div class="btitle">${C.esc(m.t)} <small>${C.esc(m.y)}</small></div></div>
    <div class="bbtns">${BUCKETS.map(([k, l]) => `<button class="chip b-${k.replace(".", "")}" data-b="${k}">${l}</button>`).join("")}</div>
    <div class="row bfoot"><span class="rcount">${answered} rated · ${st.deck.length - st.i} to go</span>${enough ? `<button class="tag hot" id="bDone">That'll do, stock my shelves</button>` : `<span class="small">${10 - answered - st.profile.watched.length} more and Rasher has enough to go on</span>`}</div>`;
  $("#buildBody").querySelectorAll("[data-b]").forEach(b => b.onclick = () => { answer(m, b.dataset.b); st.i++; C.snd.tick?.(); swipeView(); });
  const d = $("#bDone"); if (d) d.onclick = finish;
  let t = null;
  $("#bQ").oninput = e => { clearTimeout(t); const q = e.target.value.trim(); if (q.length < 2) { $("#bRes").innerHTML = ""; return; } t = setTimeout(() => search(q), 350); };
}
async function search(q) {
  const r = await C.search(q).catch(() => null);
  const list = (r?.results || []).filter(x => x.release_date).slice(0, 5);
  $("#bRes").innerHTML = list.map(x => `<button class="bhit" data-id="${x.id}">${C.esc(x.title)} <small>${(x.release_date || "").slice(0, 4)}</small></button>`).join("");
  $("#bRes").querySelectorAll("[data-id]").forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = "Fetching…";
    const m = await C.details(+b.dataset.id); if (!m) return;
    st.deck.splice(st.i, 0, m); swipeView();
  });
}
function answer(m, b) {
  if (b === "skip") return;
  const k = keyOf(m); st.films[k] = m; st.answers.set(k, b);
  const today = new Date().toISOString().slice(0, 10);
  if (b === "wl") { if (!st.profile.watchlist.some(w => w.key === k)) st.profile.watchlist.push({ key: k, added: today, uri: "" }); return; }
  if (!st.profile.watched.some(w => w.key === k)) st.profile.watched.push({ key: k, date: today, uri: "" });
  st.profile.ratings[k] = +b;
}

// Stock the shelves: the films you said you want, plus the shop's films that sit closest to what you loved.
async function finish() {
  $("#buildBody").innerHTML = `<div class="askq">${C.head}<p class="said"><b>Rasher</b>Right. Stocking your shelves…</p></div>`;
  const house = await C.house();
  const rated = Object.entries(st.profile.ratings).map(([k, r]) => [st.films[k], r]).filter(([m]) => m);
  const loved = rated.filter(([, r]) => r >= 3.5).map(([m]) => m), hated = rated.filter(([, r]) => r < 2.5).map(([m]) => m);
  st.profile.watchlist = st.profile.watchlist.filter(w => !w.stock);
  const have = new Set([...st.profile.watched, ...st.profile.watchlist].map(w => w.key));
  const stock = house.items.filter(x => !have.has(keyOf(x.m))).map(x => {
    const up = loved.length ? loved.reduce((a, l) => a + likeness(l, x.m), 0) / loved.length : 0;
    const down = hated.length ? Math.max(...hated.map(h => likeness(h, x.m))) : 0;
    const best = loved.map(l => [likeness(l, x.m), l]).sort((a, b) => b[0] - a[0])[0];
    return [up * 2 - down + Math.log10(1 + x.m.vc) * .15 + Math.random() * .1, x, best && best[0] >= .4 ? best[1].t : ""];
  }).sort((a, b) => b[0] - a[0]).slice(0, 300);
  for (const [, x, via] of stock) { const k = keyOf(x.m); st.films[k] = x.m; st.profile.watchlist.push({ key: k, added: "", uri: x.uri || "", stock: 1, via }); }
  st.profile.built = true; st.profile.importedAt = new Date().toISOString();
  close();
  await C.save(st.profile, st.films);
}
$("#buildClose").onclick = close;
