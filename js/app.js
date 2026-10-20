import * as store from "./store.js?v=ph";
import * as tmdb from "./tmdb.js?v=ph";
import * as importer from "./importer.js?v=ph";
import * as lib from "./library.js?v=ph";
import * as snd from "./sound.js?v=ph";
import * as arcade from "./arcade.js?v=ph";
import * as coming from "./coming.js?v=ph";
import * as rasher from "./rasher.js?v=ph";
import { LINES } from "./lines.js?v=ph";
import * as friends from "./friends.js?v=ph";
import * as builder from "./builder.js?v=ph";
import * as where from "./where.js?v=ph";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LN = (() => { try { return new Intl.DisplayNames(["en"], { type: "language" }); } catch { return null; } })();
const RN = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
const lang = c => c === "xx" ? "No dialogue" : c === "cn" ? "Cantonese" : (() => { try { return LN ? LN.of(c) : c; } catch { return c; } })();
const region = c => { try { return RN ? RN.of(c) : c; } catch { return c; } };
const fmtRt = m => m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : "runtime n/a";
const poster = (p, size = "w342") => p ? tmdb.IMG + size + p : "";
let customPosters = store.prefs.get("posters", {});
const posterOf = (m, size = "w342") => poster(customPosters[m.id] || m.p, size);
const today = () => new Date().toISOString().slice(0, 10);
const lbLink = it => it.uri || `https://letterboxd.com/tmdb/${it.m.id}/`;
function toast(t) { const e = $("#toast"); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2600); }

// ---------- state ----------
let profile = null, films = {}, extra = {}, log = {}, S = null;
let apiKey = store.prefs.get("key", "");
const PRESETS = [
  ["friday", "Friday after work", { inc: ["Comedy", "Action", "Crime"], slot: "120", lang: "en", taste: true }],
  ["hangover", "Sunday hangover", { inc: ["Comedy", "Animation", "Family"], exc: ["Horror", "War"], slot: "100", lang: "en" }],
  ["date", "Date night", { inc: ["Romance", "Comedy", "Drama"], exc: ["Horror", "War"], slot: "150", crowdOn: true, c0: "3.5", c1: "5" }],
  ["group", "Group night", { inc: ["Action", "Comedy", "Crime", "Adventure"], exc: ["Documentary"], lang: "en", slot: "150", crowdOn: true, c0: "3", c1: "5" }],
  ["classics", "Classics", { y1: "1979", crowdOn: true, c0: "3.8", c1: "5" }],
  ["ridiculous", "Ridiculous", { crowdOn: true, c0: "0.5", c1: "3" }],
  ["brainon", "Brain on", { inc: ["Drama", "Mystery", "Science Fiction", "History"], crowdOn: true, c0: "3.8", c1: "5" }],
  ["rainy", "Rainy day", { len: ["epic"] }],
];
// Vibes, matched on TMDB's film keywords.
const VIBES = [
  ["hangout", "Hangout", ["slice of life", "hangout", "stoner", "stoner comedy", "slacker", "party", "last day of school", "bowling", "buddy comedy", "summer vacation", "male friendship", "bar"]],
  ["nostalgia", "Period nostalgia", ["1950s", "1960s", "1970s", "1980s", "1990s", "nostalgia", "period piece", "nostalgic"]],
  ["needle", "Needle-drops", ["disco", "rock music", "rock and roll", "punk rock", "soul music", "jukebox musical", "record store", "band", "musician", "music industry", "hip-hop", "soundtrack", "rock band", "pop music"]],
  ["slow", "Slow burn", ["slow burn", "psychological thriller", "atmospheric", "meditative", "existentialism", "minimalism", "contemplative", "psychological drama"]],
  ["bleak", "Bleak", ["dystopia", "nihilism", "despair", "tragedy", "grief", "post-apocalyptic future", "depression", "bleak", "tragic ending", "loneliness", "melancholy"]],
  ["cosy", "Cosy", ["christmas", "holiday", "heartwarming", "feel good", "cozy", "wholesome", "family relationships"]],
  ["oneloc", "One location", ["single location", "one location", "confined space", "chamber piece", "locked room", "based on play or musical", "trapped", "claustrophobic"]],
  ["heist", "Heist", ["heist", "robbery", "bank robbery", "con artist", "thief", "caper", "heist film", "swindle"]],
  ["road", "Road trip", ["road trip", "road movie", "on the road", "cross country"]],
  ["neon", "Neon-noir", ["neo-noir", "neon", "nightlife", "hitman", "synthwave", "film noir"]],
  ["coming", "Coming of age", ["coming of age", "teenager", "high school", "adolescence", "growing up", "first love", "teenage romance"]],
  ["twist", "Twisty", ["plot twist", "twist ending", "unreliable narrator", "nonlinear timeline", "mind-bending", "mind bending", "puzzle", "surprise ending", "whodunit"]],
  ["revenge", "Revenge", ["revenge", "vengeance", "vigilante", "retribution", "revenge story"]],
  ["small", "Small town", ["small town", "rural area", "village", "small town life", "rural"]],
  ["true", "True story", ["based on true story", "biography", "true crime", "based on real events", "historical figure", "based on a true story"]],
];
const VIBE_KW = Object.fromEntries(VIBES.map(([k, , w]) => [k, w]));
const DEFAULT_F = { vibes: [], inc: [], exc: [], len: [], slot: "", lang: "any", lp: "", y0: "", y1: "", crowdOn: false, c0: "3", c1: "5", myMin: "", since: "", neverRe: false, taste: false };
let F = Object.assign({}, DEFAULT_F, store.prefs.get("f", {}));
let poolMode = store.prefs.get("pool", "wl");
let N = store.prefs.get("n", 1);
let picks = [], active = 0, rolling = false, rolledEmpty = false;
let ownOpen = false;
let visit = store.prefs.get("visit", ""), FR = {}, mine = null;
let mode = store.prefs.get("mode", ""), house = null, blind = store.prefs.get("blind", false), vetoes = Infinity, swapRun = 0;
const POOLS = {
  own: [["wl", "Watchlist"], ["seen", "Seen it"], ["both", "Both"], ["picks", "Staff picks"]],
  house: [["all", "The shelves"], ["picks", "Staff picks"], ["untested", "Untested"]],
};
// Sections hang above the shelves like shop signs. Some only open at certain times.
const isLate = () => { const h = new Date().getHours(); return h >= 23 || h < 5; };
const isOctober = () => new Date().getMonth() === 9;
function sections() {
  const s = [];
  if (isOctober()) s.push(["shock", "Shocktober", "orange"]);
  if (isLate()) s.push(["midnight", "Midnight", "red"]);
  if (!S?.house) s.push(["rewind", "Rewind", "blue"]);
  s.push(["back", "Back room", "purple"], ["irish", "Irish shelf", "green"]);
  if (!S?.house) s.push(["shame", "Shame list", "yellow"]);
  const w = weekly(); if (w) s.unshift(["weekly", w.label, "teal"]);
  return s;
}
// A new sign every Monday, built from your own shelves.
let weeklyCache = null;
function weekly() {
  if (!S) return null;
  const d = new Date(), mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const wk = Math.floor(mon.getTime() / 6048e5);
  if (weeklyCache && weeklyCache.wk === wk && weeklyCache.S === S) return weeklyCache.v;
  const unseen = S.watchlist, all = S.house ? unseen : unseen.concat(S.seen);
  const seedPick = arr => arr[(wk * 2654435761 >>> 0) % arr.length];
  const count = (list, fn) => { const c = new Map(); list.forEach(x => fn(x.m).forEach(k => c.set(k, (c.get(k) || 0) + 1))); return c; };
  const types = ["dir", "dec", "country", "short", "epic"];
  let v = null;
  for (let i = 0; i < types.length && !v; i++) {
    const t = types[(wk + i) % types.length];
    if (t === "dir") { const c = [...count(unseen, m => m.dir)].filter(([, n]) => n >= 3).map(([k]) => k).sort(); if (c.length) { const p = seedPick(c); v = { label: p.split(" ").slice(-1)[0] + " week", fn: m => m.dir.includes(p) }; } }
    if (t === "dec") { const c = [...count(unseen, m => m.y ? [m.y.slice(0, 3) + "0"] : [])].filter(([, n]) => n >= 10).map(([k]) => k).sort(); if (c.length) { const p = seedPick(c); v = { label: `'${p.slice(2)}s week`, fn: m => (m.y || "").startsWith(p.slice(0, 3)) }; } }
    if (t === "country") { const c = [...count(unseen, m => m.c.slice(0, 1))].filter(([k, n]) => n >= 5 && !["US", "GB"].includes(k)).map(([k]) => k).sort(); if (c.length) { const p = seedPick(c); v = { label: region(p) + " week", fn: m => m.c.includes(p) }; } }
    if (t === "short") v = { label: "Under-90s week", fn: m => m.rt > 0 && m.rt < 90 };
    if (t === "epic") v = { label: "Epic week", fn: m => m.rt > 150 };
  }
  weeklyCache = { wk, S, v };
  return v;
}
const pools = () => S?.house ? POOLS.house : profile?.built ? POOLS.own.map(([k, l]) => [k, k === "wl" ? "The shelves" : l]) : POOLS.own;
const allPools = () => [...pools(), ...sections()];
const SEEN_POOLS = ["seen", "both", "rewind", "irish"];
const CULT_KW = ["cult film", "surrealism", "absurdism", "b movie", "midnight movie", "experimental", "grindhouse", "exploitation", "psychotronic"];
const isCult = m => (m.vc > 0 && m.vc < 400 && m.va >= 6.6) || (m.kw || []).some(k => CULT_KW.includes(k)) || (m.g.includes("Horror") && m.g.includes("Comedy"));
const isIrish = m => m.c.includes("IE") || m.l === "ga";
const MIDNIGHT_G = ["Horror", "Thriller", "Mystery", "Science Fiction"];
const NOTICES = [...LINES.notice, "Irish shelf restocked. Mostly Brendan Gleeson.", "Rasher's on break. Help yourself."];
const daySeed = () => { const d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); };

async function load() {
  profile = await store.get("profile");
  films = (await store.get("films")) || {};
  extra = (await store.get("extra")) || {};
  log = (await store.get("log")) || {};
  if (!profile && mode === "house") await loadHouse();
  FR = await friends.all(); if (visit && !FR[visit]) { visit = ""; store.prefs.del("visit"); }
  rebuild();
}
async function loadHouse() {
  if (house) return;
  try { house = await (await fetch("data/house.json")).json(); } catch { house = null; toast("Couldn't open the house shop. Check your connection."); }
}
function rebuild() {
  mine = profile ? lib.build(profile, films, extra, log) : null;
  if (visit && FR[visit]) { S = lib.buildHouse(friends.asHouse(FR[visit]), log); S.owner = FR[visit].name; S.visit = visit; }
  else S = mine || (mode === "house" && house ? lib.buildHouse(house, log) : null);
  if (S?.house && !S.visit) friends.applyTune(S);
  document.body.classList.toggle("visiting", !!S?.visit);
  staffIds = new Set((S?.bestFits || []).slice(0, 30).map(x => x.m.id));
  renderPoolKeys(); renderChalk(); renderClipping();
  document.body.classList.toggle("late", isLate()); document.body.classList.toggle("october", isOctober());
  buildFilterOptions(); syncFilters(); idleScreen(); renderPicks(); statsDirty = true;
  if ($("#v-receipt").hidden === false) renderReceipt();
  nudge(); counterState();
}

// ---------- street ----------
function street() {
  const st = $("#street");
  if (store.prefs.get("skipStreet", false)) { st.hidden = true; $("#shop").hidden = false; return; }
  $("#shop").hidden = true;
  rain();
  $("#walkIn").onclick = () => {
    snd.buzz();
    $("#neonTitle").classList.add("flick");
    if (RM) { st.hidden = true; $("#shop").hidden = false; maybeTour(); return; }
    st.classList.add("leaving");
    setTimeout(() => { st.hidden = true; $("#shop").hidden = false; stopRain = true; maybeTour(); }, 650);
  };
}
let stopRain = false;
function rain() {
  if (RM) return;
  const c = $("#rain"), x = c.getContext("2d");
  const drops = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), v: .6 + Math.random() * .8 }));
  function f() {
    if (stopRain || $("#street").hidden) return;
    c.width = c.clientWidth; c.height = c.clientHeight;
    x.strokeStyle = "rgba(170,190,230,.35)"; x.lineWidth = 1;
    x.beginPath();
    for (const d of drops) {
      d.y += .012 * d.v; d.x -= .002 * d.v; if (d.y > 1) { d.y = -.05; d.x = Math.random() * 1.1; }
      const px = d.x * c.width, py = d.y * c.height; x.moveTo(px, py); x.lineTo(px - 3, py + 14 * d.v);
    }
    x.stroke(); requestAnimationFrame(f);
  }
  f();
}

// ---------- tabs ----------
const TABS = ["roll", "picks", "arcade", "receipt", "counter"];
function tab(n) {
  TABS.forEach(t => { $("#v-" + t).hidden = t !== n; $(`[data-tab="${t}"]`).setAttribute("aria-selected", t === n); });
  store.prefs.set("tab", n);
  if (n === "receipt") renderReceipt();
  if (n === "picks") renderForYou();
  if (n === "arcade") arcade.open();
  scrollTo(0, 0);
}
$$("[data-tab]").forEach(b => b.onclick = () => tab(b.dataset.tab));

// ---------- filters ----------
const LENS = [["short", "Under 90m", m => m.rt > 0 && m.rt < 90], ["mid", "90m–2h", m => m.rt >= 90 && m.rt <= 120], ["long", "2h–2h30", m => m.rt > 120 && m.rt <= 150], ["epic", "Over 2h30", m => m.rt > 150]];
const SLOTS = [["100", "1h40"], ["120", "2 hours"], ["150", "2h30"], ["", "All night"]];
const ERAS = [["Before 1970", "", "1969"], ["70s–90s", "1970", "1999"], ["2000s", "2000", "2009"], ["2010 on", "2010", ""], ["Last 5 years", String(new Date().getFullYear() - 5), ""]];
const SINCE = [["", "Any time"], ["1", "Not in a year"], ["3", "Not in 3 years"], ["ages", "Ages ago"]];
for (let s = 0.5; s <= 5; s += 0.5) for (const id of ["#c0", "#c1"]) { const o = document.createElement("option"); o.value = String(s); o.textContent = s.toFixed(1) + "★"; $(id).append(o); }
LENS.forEach(([k, l]) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = l; b.dataset.len = k; b.onclick = () => { F.len = F.len.includes(k) ? F.len.filter(x => x !== k) : [...F.len, k]; changed(); }; $("#lengths").append(b); });
SLOTS.forEach(([v, l]) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = l; b.dataset.slot = v; b.onclick = () => { F.slot = F.slot === v ? "" : v; changed(); }; $("#slots").append(b); });
ERAS.forEach(([l, a, z]) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = l; b.onclick = () => { F.y0 = a; F.y1 = z; changed(true); }; $("#eras").append(b); });
SINCE.forEach(([v, l]) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = l; b.dataset.since = v; b.onclick = () => { F.since = v; changed(); }; $("#since").append(b); });
$$("[data-lang]").forEach(b => b.onclick = () => { F.lang = b.dataset.lang; changed(); });
$("#langPick").onchange = e => { F.lp = e.target.value; changed(); };
$("#y0").oninput = e => { F.y0 = e.target.value; changed(false); };
$("#y1").oninput = e => { F.y1 = e.target.value; changed(false); };
$("#crowdOn").onchange = e => { F.crowdOn = e.target.checked; changed(); };
$("#c0").onchange = e => { F.c0 = e.target.value; changed(); };
$("#c1").onchange = e => { F.c1 = e.target.value; changed(); };
$("#myMin").onchange = e => { F.myMin = e.target.value; changed(); };
$("#neverRe").onchange = e => { F.neverRe = e.target.checked; changed(); };
$("#taste").onchange = e => { F.taste = e.target.checked; changed(); };
$("#clearF").onclick = () => { F = Object.assign({}, DEFAULT_F, { vibes: [], inc: [], exc: [], len: [] }); changed(true); toast("Forget about it."); };
VIBES.forEach(([k, l]) => { const b = document.createElement("button"); b.className = "chip vibe"; b.textContent = l; b.dataset.vibe = k;
  b.onclick = () => { F.vibes = (F.vibes || []).includes(k) ? F.vibes.filter(x => x !== k) : [...(F.vibes || []), k]; changed(); }; $("#vibes").append(b); });
PRESETS.forEach(([k, l, f]) => {
  const b = document.createElement("button"); b.className = "mood"; b.dataset.mood = k; b.textContent = l;
  b.onclick = () => {
    F = Object.assign({}, DEFAULT_F, { vibes: [], inc: [], exc: [], len: [] }, f, { mood: k, last: F.last }); changed(true);
    openFilters(false); snd.click(); roll();
  };
  $("#moods").append(b);
});
function renderPoolKeys() {
  const ps = pools(), ss = sections();
  if (!allPools().some(p => p[0] === poolMode)) poolMode = ps[0][0];
  const box = $(".poolseg"); box.innerHTML = ps.map(([k, l]) => `<button data-pool="${k}" aria-pressed="${k === poolMode}">${l}</button>`).join("");
  const keep = poolMode, count = k => { poolMode = k; const n = pool().length; poolMode = keep; return n; };
  $("#sections").innerHTML = ss.map(([k, l, c]) => `<button class="secsign ${c}" data-pool="${k}" data-label="${esc(l)}" aria-pressed="${k === poolMode}">${l}<b>${S ? count(k) : ""}</b></button>`).join("");
  $("#sections").classList.remove("flick"); void $("#sections").offsetWidth; $("#sections").classList.add("flick");
  $$("[data-pool]").forEach(b => b.onclick = () => {
    const back = b.classList.contains("secsign") && poolMode === b.dataset.pool;
    poolMode = back ? ps[0][0] : b.dataset.pool; store.prefs.set("pool", poolMode); snd.click(); changed(); idleScreen();
    if (!back && b.classList.contains("secsign")) toast(`Rolling from ${b.dataset.label}. Tap the sign again to go back.`);
  });
}
$("#blindKey").onclick = () => { blind = !blind; store.prefs.set("blind", blind); syncFilters(); renderPicks(); };
$("#lastChance").onchange = e => { F.last = e.target.checked; changed(); };
$("#n1").onclick = () => { N = 1; store.prefs.set("n", 1); changed(); };
$("#n3").onclick = () => { N = 3; store.prefs.set("n", 3); changed(); };
function changed(full = true) { store.prefs.set("f", F); syncFilters(full); }
// Any manual change to a filter means it's no longer a preset.
$("#filters").addEventListener("click", e => { if (e.target.closest(".chip,input,select") && F.mood) { F.mood = ""; store.prefs.set("f", F); setTimeout(() => syncFilters(false)); } }, true);

function buildFilterOptions() {
  const all = S ? [...S.watchlist, ...S.seen] : [];
  const genres = [...new Set(all.flatMap(x => x.m.g))].sort();
  const g = $("#genres"); g.innerHTML = "";
  genres.forEach(name => { const b = document.createElement("button"); b.className = "chip"; b.textContent = name; b.dataset.g = name;
    b.onclick = () => { const i = F.inc.includes(name), x = F.exc.includes(name); F.inc = F.inc.filter(v => v !== name); F.exc = F.exc.filter(v => v !== name); if (!i && !x) F.inc.push(name); else if (i) F.exc.push(name); changed(); };
    g.append(b); });
  const lc = {}; all.forEach(x => lc[x.m.l] = (lc[x.m.l] || 0) + 1);
  const lp = $("#langPick"); lp.innerHTML = '<option value="">Any language</option>';
  Object.entries(lc).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => { const o = document.createElement("option"); o.value = c; o.textContent = `${lang(c)} (${n})`; lp.append(o); });
}
function syncFilters(full = true) {
  $$("#genres .chip").forEach(b => { const g = b.dataset.g; b.classList.toggle("on", F.inc.includes(g)); b.classList.toggle("no", F.exc.includes(g)); });
  $$("#vibes .chip").forEach(b => b.setAttribute("aria-pressed", (F.vibes || []).includes(b.dataset.vibe)));
  $$("#lengths .chip").forEach(b => b.setAttribute("aria-pressed", F.len.includes(b.dataset.len)));
  $$("#slots .chip").forEach(b => b.setAttribute("aria-pressed", F.slot !== "" && F.slot === b.dataset.slot));
  $$("#since .chip").forEach(b => b.setAttribute("aria-pressed", F.since === b.dataset.since));
  $$("[data-lang]").forEach(b => b.setAttribute("aria-pressed", F.lang === b.dataset.lang));
  $("#langPick").value = F.lp;
  if (full) { $("#y0").value = F.y0; $("#y1").value = F.y1; }
  $("#crowdOn").checked = F.crowdOn; $("#c0").value = F.c0; $("#c1").value = F.c1; $("#c0").disabled = $("#c1").disabled = !F.crowdOn;
  $("#myMin").value = F.myMin; $("#neverRe").checked = F.neverRe; $("#taste").checked = F.taste;
  $$("[data-pool]").forEach(b => b.setAttribute("aria-pressed", b.dataset.pool === poolMode));
  $(".seenonly").hidden = !!S?.house || !SEEN_POOLS.includes(poolMode);
  $("#blindKey").setAttribute("aria-pressed", blind); $("#lastChance").checked = !!F.last;
  $("#n1").setAttribute("aria-pressed", N === 1); $("#n3").setAttribute("aria-pressed", N === 3);
  $("#rollLabel").textContent = N === 3 ? "Take three" : "Take one";
  const n = pool().length;
  $("#inRun").textContent = S ? `${n.toLocaleString()} tape${n === 1 ? "" : "s"} in the running` : "";
  $("#roll").disabled = !S; $("#askRasher").hidden = !S;
  const act = (F.vibes || []).length + F.inc.length + F.exc.length + F.len.length + !!F.slot + (F.lang !== "any") + !!F.lp + !!(F.y0 || F.y1) + F.crowdOn + (!S?.house && SEEN_POOLS.includes(poolMode) ? !!F.myMin + !!F.since + F.neverRe : 0);
  const mood = PRESETS.find(p => p[0] === F.mood);
  const how = [N === 3 ? "Three" : "", blind ? "Blind" : ""].filter(Boolean).join(" · ");
  $("#ftag").textContent = [mood ? mood[1] : act ? `${act} filter${act > 1 ? "s" : ""}` : how ? "" : "No filters", how].filter(Boolean).join(" · ");
  $$(".mood").forEach(b => b.setAttribute("aria-pressed", b.dataset.mood === F.mood));
}

function pool() {
  if (!S) return [];
  let items = [];
  const nowY = Date.now();
  const unseen = () => S.watchlist.map(x => ({ ...x, src: "wl" }));
  const everything = () => { const u = unseen(), ids = new Set(u.map(x => x.m.id)); return S.house ? u : u.concat(S.seen.filter(s => !ids.has(s.m.id)).map(s => ({ ...s, src: "seen" }))); };
  if (poolMode === "weekly") { const w = weekly(); items = w ? unseen().filter(x => w.fn(x.m)) : []; }
  else if (poolMode === "back") items = unseen().filter(x => isCult(x.m));
  else if (poolMode === "irish") items = everything().filter(x => isIrish(x.m));
  else if (poolMode === "midnight") items = unseen().filter(x => x.m.g.some(g => MIDNIGHT_G.includes(g)));
  else if (poolMode === "shock") items = unseen().filter(x => x.m.g.includes("Horror"));
  else if (poolMode === "shame") items = unseen().filter(x => x.added && (nowY - new Date(x.added)) / 864e5 > 365).sort((a, b) => a.added < b.added ? -1 : 1).slice(0, 80);
  else if (S.house) {
    items = S.watchlist.filter(x => poolMode === "all" || (poolMode === "picks" ? x.pick : x.wl)).map(x => ({ ...x, src: "wl" }));
  } else if (poolMode === "picks") {
    items = S.bestFits.map(x => ({ ...x, src: "wl" }));
  } else if (poolMode === "rewind") {
    items = S.seen.filter(s => s.rating != null && s.rating >= 4.5 && (!s.last || (nowY - new Date(s.last)) / 31557600000 >= 2)).map(s => ({ ...s, src: "seen" }));
  } else {
    if (poolMode !== "seen") items = S.watchlist.map(x => ({ ...x, src: "wl" }));
    if (poolMode !== "wl") { const ids = new Set(items.map(x => x.m.id)); items = items.concat(S.seen.filter(s => !ids.has(s.m.id)).map(s => ({ ...s, src: "seen" }))); }
  }
  const y0 = parseInt(F.y0) || 0, y1 = parseInt(F.y1) || 9999, c0 = Math.min(+F.c0, +F.c1), c1 = Math.max(+F.c0, +F.c1);
  const lens = LENS.filter(l => F.len.includes(l[0]));
  const now = new Date();
  return items.filter(x => {
    const m = x.m;
    if (F.inc.length && !F.inc.some(g => m.g.includes(g))) return false;
    if (F.exc.some(g => m.g.includes(g))) return false;
    if (F.vibes?.length && !F.vibes.some(v => (VIBE_KW[v] || []).some(k => (m.kw || []).includes(k)))) return false;
    if (lens.length && !lens.some(l => l[2](m))) return false;
    if (F.slot && !(m.rt > 0 && m.rt <= +F.slot)) return false;
    if (F.lang === "en" && m.l !== "en") return false;
    if (F.lang === "sub" && (m.l === "en" || m.l === "xx")) return false;
    if (F.lp && m.l !== F.lp) return false;
    const y = parseInt(m.y) || 0; if (y < y0 || y > y1) return false;
    if (F.crowdOn) { if (m.vc < 25) return false; const s = m.va / 2; if (s < c0 || s > c1 + 0.049) return false; }
    if (x.src === "seen") {
      if (F.myMin && !(x.rating != null && x.rating >= +F.myMin)) return false;
      if (F.neverRe && x.rewatched) return false;
      if (F.since) {
        if (F.since === "ages") { if (x.last && (now - new Date(x.last)) / 31557600000 < 5) return false; }
        else if (x.last && (now - new Date(x.last)) / 31557600000 < +F.since) return false;
      }
    }
    return true;
  });
}

function draw(arr, n) {
  const a = arr.slice(), out = [];
  while (out.length < n && a.length) {
    let i;
    if (F.taste) {
      const mx = Math.max(...a.map(x => x.fit)); const w = a.map(x => Math.exp((x.fit - mx) / 0.3));
      let r = Math.random() * w.reduce((s, v) => s + v, 0); i = 0; while (r > w[i] && i < a.length - 1) { r -= w[i]; i++; }
    } else i = Math.floor(Math.random() * a.length);
    out.push(a.splice(i, 1)[0]);
  }
  return out;
}

// ---------- the TV ----------
function idleRack() {
  if (!S || rolling || picks.length) return;
  const pool0 = S.watchlist.length ? S.watchlist : S.seen;
  fillRack(draw(pool0, 18).map(x => x.m));
  const rack = $(".rack"), w = $("#strip").scrollWidth;
  $("#strip").style.transform = `translateX(${Math.min(0, (rack.clientWidth - w) / 2)}px)`;
}
function idleScreen() {
  idleRack();
  const c = $("#tvContent");
  if (rolling) return;
  if (!S) {
    c.innerHTML = `<div class="idle"><span class="big">NO TAPES</span><span>BRING YOUR LETTERBOXD</span><span>EXPORT TO THE COUNTER</span><span>OR BROWSE THE HOUSE SHOP<span class="blink">_</span></span></div>`;
    return;
  }
  const shelf = (allPools().find(p => p[0] === poolMode) || ["", ""])[1].toUpperCase();
  const h = new Date().getHours(), late = h < 5;
  c.innerHTML = `<div class="idle"><span>${S.visit ? esc(S.owner.toUpperCase()) + "'S SHOP" : S.house ? "HOUSE SHOP" : "VIDEO 1"}</span><span class="big">${pool().length.toLocaleString()} TAPES</span><span>SHELF: ${shelf}</span><span>${late ? rasher.line("tv_late", {}, { always: true, seed: daySeed() + h }) : "PRESS TAKE ONE ▶"}<span class="blink">_</span></span></div>`;
}
function playOnTV(it) {
  const m = it.m, c = $("#tvContent"), hide = blind && !it.revealed;
  const p = posterOf(m, "w500");
  c.innerHTML = `<div class="play-screen">${p ? `<div class="bg" style="background-image:url('${p}')"></div>` : ""}
    <div class="frame">${p ? `<img src="${p}" alt="Poster for ${esc(m.t)}">` : `<div class="noposter">${esc(m.t)}</div>`}</div>
    <div class="bars t"></div><div class="bars b"><div class="ttl">${hide ? "· · ·" : esc(m.t)}</div></div></div>`;
  osd(hide ? "PLAY ▶" : egg(m) || "PLAY ▶");
}
// Small nods to the films the shop loves. Kept short, never on every roll.
function egg(m) {
  const has = (arr, n) => arr.some(x => n.includes(x));
  if (has(m.dir, ["John Carpenter"])) return "CARPENTER NIGHT";
  if (has(m.dir, ["Joel Coen", "Ethan Coen"])) return "THE DUDE ABIDES";
  if (has(m.dir, ["Richard Linklater"])) return "ALRIGHT ALRIGHT";
  if (has(m.dir, ["Paul Thomas Anderson"])) return "PTA. NICE.";
  if (has(m.cast, ["James Gandolfini", "Michael Imperioli", "Steve Buscemi", "Tony Sirico"])) return "FROM THE BADA BING";
  if (m.y === "1976") return "SUMMER OF '76";
  if (m.y === "1977" || m.y === "1978") return "SAN FERNANDO VALLEY";
  return "";
}
function osd(t) { const o = $("#osd"); o.textContent = t; o.style.opacity = 1; clearTimeout(osd.t); osd.t = setTimeout(() => o.style.opacity = 0, 2200); }
function staticBurst(ms = 650) {
  return new Promise(res => {
    const cv = $("#tvStatic"), x = cv.getContext("2d"); cv.width = 120; cv.height = 90;
    $("#tv").classList.add("tracking"); cv.style.opacity = .9;
    const t0 = performance.now();
    (function f(t) {
      const img = x.createImageData(120, 90), d = img.data;
      const band = ((t - t0) / ms) * 110 - 10;
      for (let i = 0; i < d.length; i += 4) {
        const row = (i / 4 / 120) | 0; let v = Math.random() * 255;
        if (Math.abs(row - band) < 6) v = 200 + Math.random() * 55;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      if (t - t0 < ms) requestAnimationFrame(f); else { cv.style.opacity = 0; $("#tv").classList.remove("tracking"); res(); }
    })(t0);
  });
}

// ---------- the rack ----------
const INKS = [["#111214", "#f2f2f2"], ["#f2efe6", "#b3150e"], ["#b3150e", "#fff6e0"], ["#1d3d8f", "#ffd23f"], ["#f2c230", "#111"], ["#24573f", "#f2efe6"], ["#5b1a50", "#ffd6ec"], ["#e86a17", "#111"], ["#0f5e7a", "#fff"], ["#2b2b2b", "#ff3ea5"]];
const GDOT = { Horror: "#e3261d", Comedy: "#ffd23f", Drama: "#3b6fd8", Thriller: "#8a4fd1", Action: "#ff8a1f", "Science Fiction": "#4ee36a", Romance: "#ff6fb5", Documentary: "#f2efe6", Animation: "#3ec8ff", Crime: "#9a9a9a", Western: "#a0642f", War: "#6b7a3a", Fantasy: "#2ee0c0", Family: "#ffb547", Mystery: "#5b5bd6", Music: "#ff3ea5", History: "#c9a36b", Adventure: "#ff8a1f" };
let staffIds = new Set();
function spineHTML(m) {
  let h = m.id; h = ((h ^ (h >>> 7)) * 2654435761) >>> 0;
  const [bg, fg] = INKS[h % INKS.length], [bg2] = INKS[(h >>> 4) % INKS.length];
  const tpl = (h >>> 9) % 5, ht = 72 + ((h >>> 12) % 12), old = (parseInt(m.y) || 2000) < 1985;
  const wid = [22, 28, 28, 28, 34, 40][(h >>> 3) % 6], lean = (h >>> 15) % 11 === 0 ? -3 : (h >>> 15) % 11 === 1 ? 2.5 : 0;
  const fresh = m.rd && (Date.now() - new Date(m.rd)) / 864e5 < 365 && (Date.now() - new Date(m.rd)) > 0, staff = staffIds.has(m.id);
  const dot = GDOT[m.g[0]] || "#ddd";
  const t = esc(m.t);
  let inner = "", style = `height:${ht}px;flex-basis:${wid}px;${lean ? `--lean:${lean}deg;` : ""}`;
  if (tpl === 0) { style += `background:linear-gradient(${bg2} 0 26%,${bg} 26%);color:${fg}`; inner = `<span class="st">${t}</span>`; }
  else if (tpl === 1) { style += `background:#111214;color:${bg === "#111214" ? "#ff3ea5" : bg}`; inner = `<i class="edge" style="background:${bg}"></i><span class="st glow">${t}</span>`; }
  else if (tpl === 2) { style += `background:#f2efe6;color:#111`; inner = `<span class="st heavy">${t}</span><i class="foot" style="background:${bg === "#f2efe6" ? "#b3150e" : bg}"></i>`; }
  else if (tpl === 3) { style += `background:${bg === "#f2efe6" ? "#2b2b2b" : bg}`; inner = `<span class="tape"><span class="st hand">${t}</span></span>`; }
  else { style += `background:linear-gradient(160deg,${bg} 0 55%,${bg2} 55%);color:${fg}`; inner = `<span class="st">${t}</span>`; }
  const stk = staff ? `<i class="stk pick">STAFF PICK</i>` : fresh ? `<i class="stk new">NEW</i>` : "";
  return `<div class="spine t${tpl}${old ? " old" : ""}${wid >= 34 ? " fat" : wid <= 22 ? " thin" : ""}" style="${style}" data-id="${m.id}"><i class="gdot" style="background:${dot}"></i>${inner}${stk}<i class="rent">T1</i></div>`;
}
const SW = 31; // spine width + gap
function fillRack(list) { $("#strip").innerHTML = list.map(spineHTML).join(""); $("#strip").style.transform = "translateX(0)"; }

async function roll() {
  if (rolling || !S) return;
  const p = pool();
  if (!p.length) { rolledEmpty = true; picks = []; renderPicks(); return; }
  rolledEmpty = false;
  rolling = true; $("#roll").disabled = true;
  const chosen = draw(p, N);
  const fillers = draw(S.watchlist.concat(S.seen).filter(x => !chosen.includes(x)), 34);
  const at = 28;
  const strip = fillers.slice(0, at).map(x => x.m).concat(chosen.map(x => x.m), fillers.slice(at, at + 6).map(x => x.m));
  fillRack(strip);
  const rack = $(".rack"), el = $("#strip");
  const center = rack.clientWidth / 2;
  const kids = el.children, a0 = kids[at], a1 = kids[at + chosen.length - 1];
  const target = a0 && a1 ? -((a0.offsetLeft + a1.offsetLeft + a1.offsetWidth) / 2 - center) : -(at * SW + (chosen.length * SW) / 2 - center);
  $("#led").classList.add("on");
  if (!RM) {
    rack.classList.add("rolling"); snd.startDrone();
    await new Promise(res => {
      const dur = 1900, t0 = performance.now(); let lastIdx = 0;
      (function f(t) {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        const x = target * e; el.style.transform = `translateX(${x}px)`;
        const idx = Math.floor(-x / SW); if (idx !== lastIdx) { lastIdx = idx; snd.tick(0.8 + Math.random() * .4); }
        if (k < 1) requestAnimationFrame(f); else res();
      })(t0);
    });
    snd.stopDrone(); rack.classList.remove("rolling");
  } else el.style.transform = `translateX(${target}px)`;
  chosen.forEach(c => { const sp = el.querySelector(`.spine[data-id="${c.m.id}"]`); if (!sp) return; sp.classList.add("pulled"); setTimeout(() => sp.classList.add("gone"), RM ? 0 : 900); });
  await land(chosen);
}
async function land(chosen, ctx = {}) {
  snd.clunk(); rasher.slip("");
  picks = chosen; active = 0; vetoes = F.last ? 1 : Infinity; swapRun = 0;
  if (!RM) await staticBurst();
  playOnTV(picks[0]); snd.sting(picks[0].m);
  renderPicks();
  const first = picks[0], shame = poolMode === "shame" && !ctx.arcade && !ctx.direct && first.added;
  dealBox();
  rasher.slip(ctx.say || rasher.landLine(first.m, { ...ctx, mood: F.mood, shame, year: shame ? first.added.slice(0, 4) : null, blind: blind && !first.revealed, three: picks.length > 1, late: isLate(), rewatch: first.src === "seen" }), true, { poster: blind && !first.revealed ? "" : posterOf(first.m, "w185"), title: blind && !first.revealed ? "?" : first.m.t });
  if (F.last) toast("One veto. Use it wisely.");
  rolling = false; $("#roll").disabled = false; $("#led").classList.remove("on");
}

coming.init({ get S() { return S; }, key: () => apiKey, tmdb, store, posterOf, esc });
// The arcade sends its winners to the telly.
arcade.init({
  get S() { return S; }, esc, poster, posterOf, fmtRt, lang, region, draw: (arr, n) => draw(arr, n), toast, snd,
  vibes: VIBE_KW, vibeName: k => (VIBES.find(v => v[0] === k) || ["", k])[1],
  api: {
    search: q => tmdb.call(apiKey, "/search/movie", { query: q }),
    details: id => tmdb.details(apiKey, id),
    related: id => tmdb.call(apiKey, `/movie/${id}`, { append_to_response: "recommendations,similar" }),
  },
  group: (v, head, back) => groupNight(v, head, back),
  play: async (items, cab) => { tab("roll"); if (rolling) return; rolling = true; $("#roll").disabled = true; $("#led").classList.add("on"); await land(items.map(x => ({ ...x, src: x.src || "wl" })), { arcade: cab || "arc" }); },
});

// ---------- the chalkboard: Rasher's film of the day ----------
function chalkPick() {
  if (!S) return null;
  const list = (S.house ? S.bestFits : S.bestFits.slice(0, 40)).filter(x => !S.seen.some(s => s.m.id === x.m.id));
  if (!list.length) return null;
  const d = new Date(); const seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return list[(seed * 2654435761 >>> 0) % list.length];
}
function renderChalk() {
  const it = chalkPick(), el = $("#chalk");
  if (!it) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="chalk-h">Tonight's special</span><span class="chalk-t">${esc(it.m.t)}</span><span class="chalk-s">${esc(it.m.y)} · ${fmtRt(it.m.rt)} · chalked up by Rasher</span>${rasher.quiet() ? "" : `<span class="chalk-q">“${esc(rasher.line("chalk", {}, { seed: daySeed() }))}”</span>`}`;
  el.onclick = async () => {
    if (rolling) return; rolling = true; $("#roll").disabled = true; $("#led").classList.add("on");
    const r = $("#tv").getBoundingClientRect(); if (r.top < 60) scrollTo({ top: scrollY + r.top - 70, behavior: RM ? "auto" : "smooth" });
    await land([{ ...it, src: "wl" }], { direct: true });
  };
}
// A cutting pinned by the till: something off your shelves that came out this week, years ago.
function renderClipping() {
  const el = $("#clipping"); if (!S) { el.hidden = true; return; }
  const now = new Date(), y = now.getFullYear(), mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const inWeek = rd => { if (!rd || rd.length < 10) return false; const d = new Date(y + rd.slice(4)); return d >= mon && d < new Date(mon.getTime() + 6048e5) && +rd.slice(0, 4) < y; };
  const wl = new Set(S.watchlist.map(x => x.m.id));
  const all = [...S.watchlist, ...S.seen.filter(s => !wl.has(s.m.id))].filter(x => inWeek(x.m.rd)).sort((a, b) => b.m.vc - a.m.vc);
  if (!all.length) { el.hidden = true; return; }
  const wk = Math.floor(mon.getTime() / 6048e5), it = all[wk % Math.min(all.length, 3)], m = it.m;
  const when = new Date(m.rd).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });
  const yrs = y - +m.rd.slice(0, 4);
  el.hidden = false;
  el.innerHTML = `<span class="clip-h">This week in film history</span><span class="clip-t">${esc(m.t)}</span><span class="clip-s">Came out ${esc(when)}. ${yrs} years ago this week. ${wl.has(m.id) ? "Still on your watchlist." : S.house ? "On the shelves." : "You've seen it."}</span>`;
  el.onclick = async () => { if (rolling) return; rolling = true; $("#roll").disabled = true; $("#led").classList.add("on"); const r = $("#tv").getBoundingClientRect(); if (r.top < 60) scrollTo({ top: scrollY + r.top - 70, behavior: RM ? "auto" : "smooth" }); await land([{ ...it, src: wl.has(m.id) ? "wl" : "seen" }], { direct: true }); };
}
$("#roll").onclick = roll;
function openFilters(v) {
  const s = $("#filters"); s.hidden = !v; document.body.classList.toggle("noscroll", v);
  if (v) s.querySelector(".fpanel").scrollTop = 0; else $("#openFilters").focus();
}
$("#openFilters").onclick = () => openFilters(true);
$("#closeFilters").onclick = () => openFilters(false);
$("#filters").addEventListener("click", e => { if (e.target.id === "filters") openFilters(false); });
addEventListener("keydown", e => { if (e.key === "Escape" && !$("#filters").hidden) openFilters(false); });

// ---------- the picks (tape cases) ----------
function caseHTML(it, i) {
  const m = it.m, p = posterOf(m, "w185"), hide = blind && !it.revealed;
  const sticker = `<span class="rental">TAKE ONE VIDEO<br>3 NIGHTS</span>`;
  const swapBtn = vetoes > 0 ? `<button class="tag" data-a="swap">${F.last ? "Use my veto" : "Swap"}</button>` : "";
  const locked = F.last && vetoes <= 0 ? `<span class="stamp">Locked in</span>` : "";
  const fee = it.added && poolMode === "shame" ? lateFee(it.added) : "";
  if (hide) return `<article class="case blind ${i === active && picks.length > 1 ? "active" : ""}" data-i="${i}">
    <div class="sleeve"><button class="cover ${p ? "" : "none"}" data-a="tv" aria-label="Show this box on the telly" style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : "?"}</button>${sticker}</div>
    <div class="info">${m.tag ? `<p class="tagline">“${esc(m.tag)}”</p>` : `<p class="tagline">No blurb on the box. Brave.</p>`}
      <div class="acts"><button class="tag hot" data-a="rent">Rent it</button>${swapBtn}</div>${locked}</div></article>`;
  const langTxt = m.l === "en" ? "English" : `${lang(m.l)} · subs`;
  const again = it.src === "seen" || S.seen.some(s => s.m.id === m.id);
  return `<article class="case ${i === active && picks.length > 1 ? "active" : ""}" data-i="${i}">
    ${m.rt ? `<span class="dot">${Math.floor(m.rt / 60)}H${String(m.rt % 60).padStart(2, "0")}</span>` : ""}
    <div class="sleeve"><button class="cover ${p ? "" : "none"}" data-a="tv" aria-label="Play ${esc(m.t)} on the telly" style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : esc(m.t)}</button>${sticker}</div>
    <div class="info">
      <h3 class="titlecard">${esc(m.t)}</h3>
      ${m.tag ? `<p class="tagline">“${esc(m.tag)}”</p>` : ""}
      <div class="meta">${esc(m.y)} · ${fmtRt(m.rt).toUpperCase()} · ${esc(langTxt.toUpperCase())}</div>
      <div class="gen">${esc(m.g.slice(0, 3).join(" / "))}</div>
      ${fee}${bday(m)}
      <div class="where" data-where="${m.id}"><span class="wl">Checking where to watch…</span></div>
      ${m.dir.length ? `<div class="who">Directed by ${esc(m.dir.slice(0, 2).join(" & "))}${m.cast.length ? `<br><em>With ${esc(m.cast.slice(0, 3).join(", "))}</em>` : ""}</div>` : ""}
      <p class="syn" hidden>${esc(m.ov)}</p>
    </div>
      <div class="acts wide">
        <span class="ag act"><button class="tag hot" data-a="ret">${again ? "Watched it again" : "Watched it"}</button>
        ${swapBtn}</span>
        <span class="ag look">${m.ov ? `<button class="tag" data-a="syn">Synopsis</button>` : ""}
        <button class="tag" data-a="more">More like this</button>
        <button class="tag" data-a="poster">Poster</button></span>
        <span class="ag ext"><a class="tag" href="${esc(where.jwLink(m))}" target="_blank" rel="noopener">JustWatch</a>
        <a class="tag" href="https://open.spotify.com/search/${encodeURIComponent(m.t + " " + m.y + " soundtrack")}" target="_blank" rel="noopener">Soundtrack</a>
        <a class="tag" href="${esc(lbLink(it))}" target="_blank" rel="noopener">Letterboxd</a></span>
      </div>${locked}
    </article>`;
}
function bday(m) {
  const a = new Date().getFullYear() - (parseInt(m.y) || 0);
  return a > 0 && a < 120 && (a % 10 === 0 || a === 25) ? `<span class="bday">${a} this year</span>` : "";
}
// Rasher's hand slides the first box across under the telly, then lets go.
function dealBox() {
  const c = $("#cases .case"); if (!c || RM) return;
  c.classList.remove("dealt"); void c.offsetWidth; c.classList.add("dealt");
  if (!c.querySelector(".r-hand2")) c.insertAdjacentHTML("beforeend", rasher.HAND2);
  setTimeout(() => { c.classList.remove("dealt"); c.querySelector(".r-hand2")?.remove(); }, 3000);
}
function lateFee(added) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(added)) / 864e5) - 3);
  const due = new Date(new Date(added).getTime() + 3 * 864e5).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  return `<div class="latefee"><span>DUE BACK ${esc(due.toUpperCase())}</span><b>LATE FEE €${(days * 0.5).toLocaleString("en-IE", { minimumFractionDigits: 2 })}</b></div>`;
}
function renderPicks() {
  const box = $("#cases");
  if (!S) { box.innerHTML = ""; return; }
  if (!picks.length) { box.innerHTML = rolledEmpty ? `<div class="empty">Nothing on the shelf matches all that. Loosen a filter and try again.</div>` : ""; return; }
  box.classList.toggle("three", picks.length > 1);
  box.innerHTML = picks.map((it, i) => blind && !it.revealed ? caseHTML(it, i) : miniHTML(it, i)).join("");
  fillWhere(box);
  if (!$("#caseSheet").hidden) openCase(sheetI, true);
}
// The box as it lands on the counter: cover, title, where to watch. Tap for the full box.
function miniHTML(it, i) {
  const m = it.m, p = posterOf(m, "w342"), three = picks.length > 1;
  return `<article class="case mini${i === active && three ? " active" : ""}" data-i="${i}">
    <div class="sleeve"><button class="cover ${p ? "" : "none"}" data-a="open" aria-label="Open the box for ${esc(m.t)}" style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : esc(m.t)}</button><span class="rental">TAKE ONE VIDEO<br>3 NIGHTS</span></div>
    <div class="info"><h3 class="titlecard">${esc(m.t)}</h3><div class="meta">${esc(m.y)} · ${fmtRt(m.rt).toUpperCase()}</div>
      ${three ? "" : `<div class="where" data-where="${m.id}"><span class="wl">Checking where to watch…</span></div>`}
      <div class="acts">${three ? "" : vetoes > 0 ? `<button class="tag" data-a="swap">${F.last ? "Use my veto" : "Swap"}</button>` : ""}<button class="tag hot" data-a="open">${three ? "Open ▸" : "Open the box ▸"}</button></div>
      ${F.last && vetoes <= 0 && !three ? `<span class="stamp">Locked in</span>` : ""}</div></article>`;
}
let sheetI = 0;
function openCase(i, refresh = false) {
  const it = picks[i]; if (!it) return closeCase();
  sheetI = i; const body = $("#caseBody");
  body.innerHTML = caseHTML(it, i).replace('<p class="syn" hidden>', '<p class="syn">');
  fillWhere(body);
  if (!refresh) { $("#caseSheet").hidden = false; document.body.classList.add("noscroll"); snd.click(); }
}
function closeCase() { $("#caseSheet").hidden = true; document.body.classList.remove("noscroll"); }
$("#caseClose").onclick = closeCase;
$("#caseSheet").addEventListener("click", e => { if (e.target.id === "caseSheet") closeCase(); });
// Streaming info lands a moment after the box: one lookup per film, remembered for the session.
function fillWhere(root = document) {
  root.querySelectorAll("[data-where]").forEach(async el => {
    const it = picks.find(x => String(x.m.id) === el.dataset.where); if (!it) return;
    const w = await where.lookup((path, params) => tmdb.call(apiKey, path, params), it.m);
    if (!el.isConnected) return;
    el.innerHTML = w ? `<span class="wl">${where.line(w)}</span>` : "";
  });
}
function showOnTV(i) {
  const it = picks[i]; if (!it) return;
  active = i; playOnTV(it); snd.clunk();
  $$(".case").forEach(c => c.classList.toggle("active", +c.dataset.i === i && picks.length > 1));
  const tv = $("#tv"), r = tv.getBoundingClientRect();
  if (r.top < 60 || r.bottom > innerHeight) scrollTo({ top: scrollY + r.top - 70, behavior: RM ? "auto" : "smooth" });
}
$("#strip").addEventListener("click", e => {
  const sp = e.target.closest(".spine.pulled"); if (!sp) return;
  const i = picks.findIndex(p => String(p.m.id) === sp.dataset.id); if (i >= 0) showOnTV(i);
});
function caseClick(e) {
  const inSheet = !!e.target.closest("#caseBody");
  const b = e.target.closest("[data-a]");
  if (!b) { const card = e.target.closest(".case"); if (card && !inSheet && !e.target.closest("a,button")) { const i = +card.dataset.i; if (picks.length > 1) showOnTV(i); if (card.classList.contains("mini")) openCase(i); } return; }
  const card = b.closest(".case"), i = +card.dataset.i, it = picks[i];
  const a = b.dataset.a;
  if (a === "open") { if (picks.length > 1 && i !== active) { active = i; playOnTV(it); snd.clunk(); $$("#cases .case").forEach(c => c.classList.toggle("active", +c.dataset.i === i)); } openCase(i); return; }
  if (a === "tv") { if (inSheet) return; showOnTV(i); }
  if (inSheet && ["more", "poster", "ret"].includes(a)) closeCase();
  if (a === "syn") { const p = card.querySelector(".syn"); p.hidden = !p.hidden; b.textContent = p.hidden ? "Synopsis" : "Hide synopsis"; }
  if (a === "more") { tab("arcade"); arcade.moreLike(it.m); return; }
  if (a === "poster") { posterPicker(it.m); return; }
  if (a === "rent") { it.revealed = true; active = i; snd.clunk(); playOnTV(it); renderPicks(); }
  if (a === "swap") {
    if (vetoes <= 0) return;
    const p = pool().filter(x => !picks.some(c => c.m.id === x.m.id));
    const nx = draw(p, 1)[0];
    if (!nx) return toast("Nothing else on the shelf matches.");
    vetoes--; swapRun++;
    picks[i] = nx; active = i; snd.clunk(); playOnTV(nx); renderPicks();
    if (F.last && vetoes <= 0) { rasher.slip(""); toast(rasher.line("locked") || "That's your veto. This one's locked in."); }
    else if (swapRun === 4) { rasher.slip(""); toast("Just when I thought I was out…"); }
    else rasher.slip(swapRun === 2 && Math.random() < .4 ? rasher.quote("swap") : rasher.line("swap"));
  }
  if (a === "ret") openReturn(it);
}
$("#cases").addEventListener("click", caseClick);
$("#caseBody").addEventListener("click", caseClick);

// ---------- custom posters ----------
async function posterPicker(m) {
  const sh = $("#posterSheet"), grid = $("#posterGrid");
  $("#posterTitle").textContent = m.t; sh.hidden = false; document.body.classList.add("noscroll");
  grid.innerHTML = `<p class="note">Rummaging for alternative covers…</p>`;
  let list = [];
  try { list = await tmdb.posters(apiKey, m.id); } catch { }
  const cur = customPosters[m.id] || m.p;
  list = [m.p, ...list.filter(p => p !== m.p)].filter(Boolean).slice(0, 30);
  if (list.length <= 1) { grid.innerHTML = `<p class="note">No other covers for this one. The original it is.</p>`; return; }
  grid.innerHTML = list.map((p, i) => `<button class="pchoice ${p === cur ? "on" : ""}" data-p="${esc(p)}" aria-label="Cover ${i + 1}" style="background-image:url('${poster(p, "w185")}')">${i === 0 ? "<span>Original</span>" : ""}</button>`).join("");
  grid.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
    const p = b.dataset.p; if (p === m.p) delete customPosters[m.id]; else customPosters[m.id] = p;
    store.prefs.set("posters", customPosters); snd.click(); closePosters();
    renderPicks(); const i = picks.findIndex(x => x.m.id === m.id); if (i === active) playOnTV(picks[i]); toast("New cover on the box.");
  });
}
function closePosters() { $("#posterSheet").hidden = true; document.body.classList.remove("noscroll"); }
$("#posterClose").onclick = closePosters;
$("#posterSheet").addEventListener("click", e => { if (e.target.id === "posterSheet") closePosters(); });

// ---------- walk the aisles ----------
function openAisles() {
  if (!S || rolling) return;
  const items = S.house ? S.watchlist : S.watchlist;
  const by = new Map(); items.forEach(x => { const g = x.m.g[0] || "Other"; if (!by.has(g)) by.set(g, []); by.get(g).push(x); });
  const shelves = [...by].sort((a, b) => b[1].length - a[1].length);
  const colors = ["red", "blue", "purple", "green", "orange", "teal", "yellow"];
  $("#aisleBody").innerHTML = shelves.map(([g, l], i) => `<section class="aisle"><span class="secsign ${colors[i % colors.length]}">${esc(g)} <b>${l.length}</b></span>
    <div class="ashelf"><div class="astrip">${l.map(x => spineHTML(x.m)).join("")}</div></div></section>`).join("");
  aisleItems = new Map(items.map(x => [String(x.m.id), x]));
  $("#aisleCase").hidden = true;
  $("#aisles").hidden = false; document.body.classList.add("noscroll"); snd.click();
}
let aisleItems = new Map();
function closeAisles() { $("#aisles").hidden = true; document.body.classList.remove("noscroll"); }
$("#aisleClose").onclick = closeAisles;
$(".rack").addEventListener("click", e => { if (e.target.closest(".spine.pulled")) return; openAisles(); });
$("#aisleBody").addEventListener("click", e => {
  const sp = e.target.closest(".spine"); if (!sp) return;
  $$("#aisleBody .spine.pulled").forEach(s => s.classList.remove("pulled")); sp.classList.add("pulled"); snd.tick();
  const it = aisleItems.get(sp.dataset.id); if (!it) return;
  const m = it.m, p = posterOf(m, "w185");
  const c = $("#aisleCase"); c.hidden = false;
  c.innerHTML = `<div class="cover" style="${p ? `background-image:url('${p}')` : ""}"></div><div class="info"><h3 class="titlecard">${esc(m.t)}</h3>
    ${m.tag ? `<p class="tagline">“${esc(m.tag)}”</p>` : ""}<div class="meta">${esc(m.y)} · ${fmtRt(m.rt).toUpperCase()}</div><div class="gen">${esc(m.g.slice(0, 3).join(" / "))}${m.dir[0] ? " · " + esc(m.dir[0]) : ""}</div>
    <div class="acts"><button class="tag hot" id="aislePlay">Put it on</button><button class="tag" id="aisleMore">More like this</button></div></div>`;
  $("#aislePlay").onclick = async () => { closeAisles(); tab("roll"); if (rolling) return; rolling = true; $("#roll").disabled = true; await land([{ ...it, src: "wl" }]); };
  $("#aisleMore").onclick = () => { closeAisles(); tab("arcade"); arcade.moreLike(m); };
});

// ---------- returning a tape ----------
let retItem = null, retVal = null;
function openReturn(it) {
  retItem = it; retVal = null;
  $("#retTitle").textContent = it.m.t;
  $("#retAsk").hidden = false; $("#retReveal").hidden = true; $("#retGo").disabled = true;
  const st = $("#stars"); st.innerHTML = "";
  for (let i = 1; i <= 5; i++) st.insertAdjacentHTML("beforeend", `<span class="star" data-i="${i}"><span class="glyph">★</span><button class="l" data-v="${i - .5}" aria-label="${i - .5} stars"></button><button class="r" data-v="${i}" aria-label="${i} stars"></button></span>`);
  st.insertAdjacentHTML("beforeend", `<span class="val" id="starVal"></span>`);
  paintStars(0);
  $("#returnSheet").hidden = false;
}
function paintStars(v) { $$("#stars .star").forEach(s => { const i = +s.dataset.i; s.querySelector(".glyph").style.setProperty("--f", v >= i ? "100%" : v >= i - .5 ? "50%" : "0%"); }); $("#starVal").textContent = v ? v.toFixed(1) : ""; }
$("#stars").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; retVal = +b.dataset.v; paintStars(retVal); $("#retGo").disabled = false; });
$("#retCancel").onclick = () => $("#returnSheet").hidden = true;
$("#retGo").onclick = () => handBack(retVal);
$("#retNoRate").onclick = () => handBack(null);
async function handBack(rating) {
  const it = retItem, m = it.m;
  const prev = S.seen.find(s => s.m.id === m.id)?.rating ?? null;
  const guess = Math.round(S.predict(m) * 2) / 2;
  const crowd = m.vc >= 25 ? Math.round(m.va / 2 * 10) / 10 : null;
  const key = Object.keys(films).find(k => films[k] && films[k].id === m.id) || null;
  log[m.id] = { key, date: today(), rating, guess, crowd, prev, m: key ? undefined : m };
  await store.set("log", log);
  const box = $("#retReveal");
  const verdict = rasher.verdict(rating, guess, prev, m);
  box.innerHTML = `${rating != null ? `<div class="reveal3"><div>YOU<b>${rating.toFixed(1)}★</b></div><div>CROWD<b>${crowd != null ? crowd.toFixed(1) + "★" : "–"}</b></div><div>${S.house ? "RASHER SAID" : "RASHER GUESSED"}<b>${guess.toFixed(1)}★</b></div></div>
    ${prev != null ? `<p class="kicker">Last time you gave it ${prev.toFixed(1)}★</p>` : ""}${verdict ? `<p class="verdict">${esc(verdict)}</p>` : ""}` : `<p class="verdict">Back on the shelf. Crowd gave it ${crowd != null ? crowd.toFixed(1) + "★" : "nothing yet"}.</p>`}
    <div class="row"><a class="btn" href="${esc(lbLink(it))}" target="_blank" rel="noopener">Log it on Letterboxd</a><button class="ghost" id="retDone">Done</button></div>`;
  $("#retAsk").hidden = true; box.hidden = false;
  $("#retDone").onclick = () => { $("#returnSheet").hidden = true; };
  picks = picks.filter(p => p.m.id !== m.id); active = 0;
  rebuild(); if (picks[0]) playOnTV(picks[0]);
}

// ---------- For you ----------
let fitsN = 10, freshN = 10;
function pickHTML(it, i, card) {
  const m = it.m, p = posterOf(m, "w154");
  return `<article class="pick"><div class="cover" style="${p ? `background-image:url('${p}')` : ""}"></div><div class="info" style="min-width:0">
    <h3 class="titlecard">${esc(m.t)}</h3><div class="meta">${esc(m.y)} · ${fmtRt(m.rt).toUpperCase()}${m.l !== "en" ? " · " + esc(lang(m.l).toUpperCase()) : ""}</div>
    <div class="gen">${esc(m.g.slice(0, 3).join(" / "))}${m.dir[0] ? " · " + esc(m.dir[0]) : ""}</div>
    ${(it.why || []).length ? `<ul class="why talker${card ? " card" : ""}">${card ? `<li class="card-h">${S.owner ? esc(S.owner) : "Rasher"} recommends</li>` : ""}${it.why.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
    <div class="acts">${card ? `<button class="tag hot" data-put="${i}">Put it on</button>` : ""}<a class="tag" href="${esc(lbLink(it))}" target="_blank" rel="noopener">Letterboxd</a></div></div></article>`;
}
// Reasons for a page of picks: no line twice, specific ones (people, what you've watched lately) before genre and decade.
const KIND_RANK = { a: 0, d: 0, src: 1, hot: 2, g: 3, dec: 4 };
function pageReasons(list) {
  const used = new Set(), kinds = {};
  return list.map(it => {
    if (!S.reasonPool || S.house) return it;
    const pool = S.reasonPool(it.m).sort((a, b) => KIND_RANK[a[0]] - KIND_RANK[b[0]]);
    const why = it.via ? [`Because you loved ${it.via}.`] : [], mine = new Set(it.via ? ["src"] : []);
    for (const [k, t] of pool) {
      const fam = k === "a" || k === "d" ? "who" : k === "g" || k === "hot" ? "genre" : k;
      if (why.length >= 2 || used.has(t) || mine.has(fam)) continue;
      mine.add(fam);
      if ((k === "g" || k === "dec") && (kinds[k] || 0) >= 2) continue;
      why.push(t); used.add(t); kinds[k] = (kinds[k] || 0) + 1;
    }
    if (!why.length) why.push(fallbackReason(it));
    return { ...it, why };
  });
}
function fallbackReason(it) {
  const m = it.m;
  const d = m.dir.find(x => S.seen.some(s => s.m.dir.includes(x)));
  if (d) { const n = S.seen.filter(s => s.m.dir.includes(d)).length; return n > 1 ? `You've seen ${n} by ${d}. Here's another.` : `You've seen one by ${d}. Time for a second.`; }
  const a = m.g.includes("Documentary") ? null : m.cast.slice(0, 3).find(x => S.seen.some(s => s.m.cast.slice(0, 5).includes(x)));
  if (a) { const o = S.seen.find(s => s.m.cast.slice(0, 5).includes(a)); return `${a}, last seen in ${o.m.t}.`; }
  if (it.added && +it.added.slice(0, 4) < new Date().getFullYear()) return `On your list since ${it.added.slice(0, 4)}. Its time has come.`;
  if (m.y && +m.y < 1970) return `Older than most of the shop. Still holds up.`;
  return "Rasher's got a hunch about this one.";
}
// Staff picks as shelves you swipe along: a compact tape each, tap for the full card.
let shelf = { fits: [], fresh: [], deep: [] };
function tapeHTML(kind, i, m, sub) {
  const p = posterOf(m, "w185");
  return `<button class="ptape" data-pt="${kind}:${i}" aria-label="${esc(m.t)}"><i style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : esc(m.t)}</i><b>${esc(m.t)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
}
function renderForYou() {
  if (!S) { $("#bestFits").innerHTML = `<div class="empty">Stock the shelves at the counter first.</div>`; $("#fresh").innerHTML = ""; $("#pjump").innerHTML = ""; return; }
  const who = S.owner;
  $("#fitsHead").textContent = who ? `${who}'s favourites` : S.house ? "Rasher's favourites" : "Rasher's picks for you";
  $("#freshHead").textContent = who ? `Still on ${who}'s list` : S.house ? "Rasher hasn't seen these either" : "Not on your list. Should be.";
  $("#picksNote").textContent = who ? `${who}'s shelf. The ones they swear by, and the ones they still mean to get to. No scores.` : S.house ? "Rasher's shelf. His own favourites, and the ones he still means to get to." : rasher.line("picks_intro", {}, { seed: daySeed(), always: true });
  renderTuneCard();
  shelf.fits = pageReasons(S.bestFits.slice(0, 30));
  $("#bestFits").innerHTML = shelf.fits.map((x, i) => tapeHTML("fits", i, x.m, (x.why || [])[0])).join("");
  renderDeepDive();
  coming.render();
  shelf.fresh = S.fresh.slice(0, 30);
  $("#fresh").innerHTML = shelf.fresh.map((x, i) => tapeHTML("fresh", i, x.m, (x.why || [])[0])).join("");
  $("#freshNote").textContent = who ? `${who} hasn't got to these yet.` : S.house ? "Still on Rasher's list. He swears he'll get to them." : S.fresh.length ? "Off the back of the films you rated highest. Rasher reckons you've missed these." : "Still restocking these. Check back in a minute.";
  renderJump();
}
// Section signs at the top that jump to each shelf.
function renderJump() {
  const sig = [["fitsHead", "Picks", "red"], ["cinemasHead", "In cinemas", "blue"], ["soonHead", "Coming soon", "teal"], ["deepHead", "Finish the job", "purple"], ["freshHead", "Not on your list", "orange"]];
  $("#pjump").innerHTML = sig.filter(([id]) => { const e = document.getElementById(id); return e && !e.hidden; })
    .map(([id, l, c]) => `<button class="secsign ${c}" data-jump="${id}">${id === "fitsHead" && S?.owner ? esc(S.owner) + "'s picks" : id === "freshHead" && S?.house ? "Still to see" : l}</button>`).join("");
}
new MutationObserver(() => renderJump()).observe($("#coming"), { childList: true });
$("#pjump").addEventListener("click", e => { const b = e.target.closest("[data-jump]"); if (!b) return; snd.click(); const h = document.getElementById(b.dataset.jump); if (h) scrollTo({ top: scrollY + h.getBoundingClientRect().top - 80, behavior: RM ? "auto" : "smooth" }); });
// Finish the job: directors you're partway through, and the next one on your list.
function renderDeepDive() {
  const box = $("#deepDive"), head = $("#deepHead");
  if (!S || S.house) { box.innerHTML = ""; head.hidden = true; shelf.deep = []; return; }
  const seenBy = new Map(), wlBy = new Map();
  S.seen.forEach(s => s.m.dir.forEach(d => seenBy.set(d, (seenBy.get(d) || 0) + 1)));
  S.watchlist.forEach(x => x.m.dir.forEach(d => { if (!wlBy.has(d)) wlBy.set(d, []); wlBy.get(d).push(x); }));
  shelf.deep = [...wlBy].filter(([d]) => (seenBy.get(d) || 0) >= 2).map(([d, l]) => ({ d, seen: seenBy.get(d), left: l, next: l.slice().sort((a, b) => b.fit - a.fit)[0] }))
    .sort((a, b) => b.seen - a.seen || a.left.length - b.left.length)
    .filter((r, i, arr) => arr.findIndex(o => o.next.m.id === r.next.m.id) === i).slice(0, 12);
  head.hidden = !shelf.deep.length;
  box.innerHTML = shelf.deep.map((r, i) => tapeHTML("deep", i, r.next.m, `${r.d} · seen ${r.seen}, ${r.left.length} to go`)).join("");
}
// A tape up close: the full card in a pull-up sheet.
function openPick(kind, i) {
  const sh = $("#pickSheet"), body = $("#pickBody");
  let it, html;
  if (kind === "deep") {
    const r = shelf.deep[i]; it = r.next;
    $("#pickKind").textContent = "Finish the job";
    html = `<p class="note">${esc(r.d)}: you've seen ${r.seen}, ${r.left.length} still on your list. Next up:</p>` + pickHTML(it, i, false);
  } else {
    it = shelf[kind][i];
    $("#pickKind").textContent = kind === "fits" ? $("#fitsHead").textContent : $("#freshHead").textContent;
    html = pickHTML(it, i, kind === "fits");
  }
  body.innerHTML = html.replace('<div class="acts">', `<div class="where" data-where="${it.m.id}"><span class="wl">Checking where to watch…</span></div>${it.m.ov ? `<p class="syn">${esc(it.m.ov)}</p>` : ""}<div class="acts">${kind === "fits" ? "" : `<button class="tag hot" data-put="x">Put it on</button>`}`);
  where.lookup((path, params) => tmdb.call(apiKey, path, params), it.m).then(w => { const el = body.querySelector(".where"); if (el) el.innerHTML = w ? `<span class="wl">${where.line(w)}</span>` : ""; });
  body.querySelectorAll("[data-put]").forEach(b => b.onclick = async () => { closePick(); if (rolling) return; tab("roll"); rolling = true; $("#roll").disabled = true; $("#led").classList.add("on"); await land([{ ...it, src: "wl" }], { direct: true }); });
  sh.hidden = false; document.body.classList.add("noscroll"); snd.click();
}
function closePick() { $("#pickSheet").hidden = true; document.body.classList.remove("noscroll"); }
$("#pickClose").onclick = closePick;
$("#pickSheet").addEventListener("click", e => { if (e.target.id === "pickSheet") closePick(); });
$("#v-picks").addEventListener("click", e => { const b = e.target.closest("[data-pt]"); if (!b) return; const [k, i] = b.dataset.pt.split(":"); openPick(k, +i); });


// ---------- receipt ----------
let statsDirty = true;
function renderReceipt() {
  const r = $("#receipt");
  if (!S) { r.innerHTML = `<h2>TAKE ONE VIDEO</h2><p class="c">No rentals on file yet.</p>`; return; }
  if (!statsDirty) return; statsDirty = false;
  if (S.house && S.seen.filter(s => s.rating != null).length < 3) { r.innerHTML = `<h2>TAKE ONE VIDEO</h2><p class="c">HOUSE SHOP MEMBER</p><hr><p class="c">Return three tapes with a rating and your receipt starts printing.</p><p class="c">Or bring your own Letterboxd export to the counter.</p><hr>${barcode("house")}`; return; }
  const t = lib.stats(S);
  const ln = (a, b) => `<div class="ln"><span>${esc(a)}</span><span class="dots"></span><span>${esc(b)}</span></div>`;
  const bar = (n, max, w = 12) => "#".repeat(Math.max(1, Math.round(n / max * w)));
  const dmax = Math.max(...t.decades.map(d => d.n));
  const d = new Date();
  const who = (profile?.username || "HOUSE MEMBER").toUpperCase();
  let h = `<h2>TAKE ONE VIDEO</h2><p class="c">OPEN LATE · BE KIND, REWIND</p><hr>
    ${ln("MEMBER", who)}${ln("DATE", d.toLocaleDateString("en-IE"))}${ln("TIME", d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" }))}<hr>
    ${ln("FILMS RENTED", t.watched.toLocaleString())}${ln("HOURS IN FRONT OF THE TELLY", t.hours.toLocaleString())}${ln("RATINGS GIVEN", t.rated.toLocaleString())}${ln("YOUR AVERAGE", t.avg.toFixed(2) + "★")}${ln("THE CROWD, SAME FILMS", (t.crowdAvg || 0).toFixed(2) + "★")}${ln("STILL ON THE WATCHLIST", t.watchlist.toLocaleString())}<hr>
    <div class="sec">TOP GENRES</div>${t.genres.slice(0, 6).map(g => ln(g.k.toUpperCase(), `${g.n} · ${g.avg ? g.avg.toFixed(1) + "★" : "–"}`)).join("")}<hr>
    ${t.lately.length ? `<div class="sec">LATELY YOU'RE INTO</div>${t.lately.map(g => ln(g.g.toUpperCase(), `${g.n} OF LAST ${g.of} · USUALLY ${Math.round(g.o * 100)}%`)).join("")}<hr>` : ""}
    <div class="sec">BY DECADE</div><div class="hash">${t.decades.map(x => `${x.k.padEnd(6)}${bar(x.n, dmax).padEnd(13)}${String(x.n).padStart(4)}`).join("\n")}</div><hr>
    <div class="sec">DIRECTORS YOU RENT MOST</div>${t.directors.most.map(p => ln(p.k.toUpperCase(), p.n + " FILMS")).join("")}<hr>
    <div class="sec">DIRECTORS YOU RATE HIGHEST</div>${t.directors.best.map(p => ln(p.k.toUpperCase(), p.avg.toFixed(2) + "★")).join("")}<hr>
    <div class="sec">ACTORS YOU RENT MOST</div>${t.actors.most.map(p => ln(p.k.toUpperCase(), p.n + " FILMS")).join("")}<hr>
    <div class="sec">WHERE THEY'RE FROM</div>${t.countries.slice(0, 5).map(c => ln(region(c.k).toUpperCase(), c.n)).join("")}<hr>
    <div class="sec">HARSHER THAN THE CROWD ON</div>${t.vsCrowd.slice(0, 3).map(g => ln(g.g.toUpperCase(), g.d.toFixed(2) + "★")).join("")}
    <div class="sec" style="margin-top:8px">YOU RATED WAY UNDER THE CROWD</div>${t.harsher.slice(0, 3).map(p => ln(p.s.m.t.toUpperCase(), `${p.mine}★ v ${p.crowd.toFixed(1)}★`)).join("")}
    <div class="sec" style="margin-top:8px">YOU RATED WAY OVER THE CROWD</div>${t.kinder.slice(0, 3).map(p => ln(p.s.m.t.toUpperCase(), `${p.mine}★ v ${p.crowd.toFixed(1)}★`)).join("")}<hr>
    ${barcode(who + t.watched)}<p class="tiny">THANK YOU FOR RENTING · ALL TAPES DUE BACK BY NOON</p>`;
  r.innerHTML = h;
}
function barcode(seed) {
  let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  let rects = "", pos = 0;
  let black = true;
  while (pos < 200) { x = (x * 1103515245 + 12345) >>> 0; const w = 1 + ((x >>> 16) % 3); if (black) rects += `<rect x="${pos}" y="0" width="${w}" height="40" fill="#1d1a16"/>`; black = !black; pos += w; }
  return `<svg class="barcode" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
}

// ---------- counter ----------
function counterState() {
  $("#keyIn").placeholder = apiKey ? "Key saved. Paste a new one to change it" : "Paste your API key";
  $("#keyMsg").textContent = apiKey ? "Key saved on this phone." : tmdb.hasProxy ? "Optional. The shop has its own key, so you can skip straight to step 2." : "Get one free at themoviedb.org → Settings → API.";
  $("#stepHouse").hidden = !!profile;
  const showOwn = !!profile || !!apiKey || ownOpen;
  $("#stepKey").hidden = !showOwn || (tmdb.hasProxy && !apiKey && !profile); $("#stepZip").hidden = !showOwn;
  $("#ownGo").hidden = showOwn;
  $("#houseTxt").textContent = mode === "house" ? "You're browsing the house shop. Start your own any time." : "Pick a way in.";
  $("#houseGo").innerHTML = mode === "house" ? "<b>Leave the house shop</b><span>Back to the counter.</span>" : "<b>Just browsing</b><span>Walk round Rasher's own shelves. Nothing to set up.</span>";
  $("#buildMore").hidden = !profile?.built; $("#buildGo").hidden = $("#buildSwipe").hidden = !!profile;
  $("#zipMsg").textContent = profile?.built ? `Built by hand: ${Object.keys(profile.ratings).length} films rated${profile.username ? `, plus your Letterboxd diary` : ""}. ${S.watchlist.length.toLocaleString()} tapes on your shelves. Bring a full export any time for the whole picture.` : profile ? `Last export: ${new Date(profile.importedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}. ${S.watchlist.length.toLocaleString()} tapes on the watchlist shelf, ${S.seen.length.toLocaleString()} seen.${S.unmatched ? ` ${S.unmatched} watchlist entries couldn't be matched (usually TV series).` : ""}` : "";
  const n = Object.keys(log).length;
  $("#unwatch").hidden = !n; $("#unwatch").textContent = `Forget ${n} film${n > 1 ? "s" : ""} marked watched here`;
  $("#soundOn").checked = snd.isOn(); $("#skipStreet").checked = store.prefs.get("skipStreet", false); $("#quietOn").checked = rasher.quiet();
  const cs = LINES.counter, age = profile ? (Date.now() - new Date(profile.importedAt)) / 864e5 : 0;
  const say = rasher.quiet() ? "" : !S ? cs[3] : profile && age > 30 ? cs[2] : profile && age < 1 ? cs[1] : !profile ? cs[0] : Math.random() < .5 ? rasher.quote("counter") : "";
  renderFriends();
  $("#counterSays").hidden = !say; $("#counterSays").innerHTML = say ? `<p class="said"><b>Rasher</b>${esc(say)}</p>` : "";
}
$("#keySave").onclick = async () => {
  const k = $("#keyIn").value.trim(); if (!k) return;
  $("#keyMsg").textContent = "Checking…";
  if (await tmdb.checkKey(k)) { apiKey = k; store.prefs.set("key", k); $("#keyIn").value = ""; counterState(); toast("Key saved."); }
  else $("#keyMsg").textContent = "TMDB didn't accept that key. Copy the short API Key (not the long token) and try again.";
};
$("#zipIn").onchange = async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  if (!apiKey && !tmdb.hasProxy) { $("#zipMsg").textContent = "Save your TMDB key first, then pick the zip."; return; }
  const prog = $("#prog"); prog.hidden = false;
  const set = (d, t, label) => { $("#progBar").style.width = (t ? d / t * 100 : 100) + "%"; $("#progTxt").textContent = `${label} ${d.toLocaleString()} / ${t.toLocaleString()}`; };
  try {
    $("#zipMsg").textContent = "Reading the zip…";
    const p = await importer.readZip(file);
    $("#zipMsg").textContent = "Looking every film up. The first time takes a couple of minutes; keep the app open.";
    films = await importer.enrich(apiKey, p, (d, t) => set(d, t, "STOCKING SHELVES"));
    profile = p; await store.set("profile", profile); mode = ""; store.prefs.del("mode");
    rebuild();
    $("#zipMsg").textContent = "Restocking the new-releases shelf…";
    extra = await importer.enrichIds(apiKey, S.candidateIds, (d, t) => set(d, t, "NEW RELEASES"));
    rebuild();
    prog.hidden = true;
    toast(`Shelves stocked. ${S.watchlist.length.toLocaleString()} tapes on the watchlist shelf.`);
  } catch (err) {
    prog.hidden = true;
    $("#zipMsg").textContent = err.code === "bad_key" ? "TMDB stopped accepting your key. Save it again and retry." : (err.message || "Something went wrong reading that zip.");
  }
};
$("#ownGo").onclick = () => { ownOpen = true; counterState(); $("#stepKey").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" }); };
$("#houseGo").onclick = async () => {
  if (mode === "house") { mode = ""; store.prefs.del("mode"); picks = []; rebuild(); return; }
  mode = "house"; store.prefs.set("mode", "house"); await loadHouse(); picks = []; rebuild(); if (S) { tab("roll"); toast("Welcome in. Have a look around."); }
};
$("#soundOn").onchange = e => { snd.setOn(e.target.checked); store.prefs.set("sound", e.target.checked); };
$("#skipStreet").onchange = e => store.prefs.set("skipStreet", e.target.checked);
where.COUNTRIES.forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = region(c); $("#regionPick").append(o); });
$("#regionPick").value = where.country();
$("#regionPick").onchange = e => { where.setCountry(e.target.value); renderPicks(); toast(`Where-to-watch now for ${region(e.target.value)}.`); };
$("#quietOn").onchange = e => { rasher.setQuiet(e.target.checked); counterState(); renderChalk(); toast(e.target.checked ? "“Whatever happened to Gary Cooper? The strong, silent type.”" : "Rasher's back."); };
$("#tourAgain").onclick = () => { if (rasher.quiet()) return toast("Turn quiet mode off first."); tour(); };
$("#unwatch").onclick = async () => { log = {}; await store.set("log", log); rebuild(); toast("Marked-watched films are back on the shelf."); };
$("#wipe").onclick = () => $("#wipeConfirm").hidden = false;
$("#wipeNo").onclick = () => $("#wipeConfirm").hidden = true;
$("#wipeYes").onclick = async () => { await store.clearAll(); ["key", "f", "pool", "n", "tab", "mode", "blind"].forEach(k => store.prefs.del(k)); apiKey = ""; mode = ""; house = null; profile = null; films = {}; extra = {}; log = {}; picks = []; $("#wipeConfirm").hidden = true; rebuild(); toast("Cleared."); };

function nudge() {
  const n = $("#nudge");
  const nt = $("#notice"); nt.hidden = !S; nt.textContent = NOTICES[Math.floor(Math.random() * NOTICES.length)];
  const notice = () => { n.hidden = true; };
  if (!S) { n.hidden = false; n.textContent = "No tapes yet. Bring your Letterboxd export to the counter, or browse the house shop →"; n.onclick = () => tab("counter"); n.style.cursor = "pointer"; return; }
  if (S.visit) { n.hidden = false; n.textContent = `You're in ${S.owner}'s shop. Tap here to go back to your own.`; n.style.cursor = "pointer"; n.onclick = () => leaveVisit(); return; }
  if (!profile) return notice();
  const age = (Date.now() - new Date(profile.importedAt)) / 864e5;
  if (age > 30) { n.hidden = false; n.textContent = "These shelves are a month old. Bring in a fresh export →"; n.onclick = () => tab("counter"); n.style.cursor = "pointer"; }
  else notice();
}
// Tap the neon five times.
let neonTaps = 0;
$(".shopname").addEventListener("click", () => {
  if (++neonTaps < 5) return; neonTaps = 0;
  const el = $(".shopname .neon"), was = el.textContent; snd.buzz(); el.textContent = "Be kind rewind"; el.classList.add("flick");
  setTimeout(() => { el.textContent = was; el.classList.remove("flick"); }, 3200);
});

// ---------- Rasher shows you round (first visit) ----------
let touring = false, loaded = false;
function tour() {
  if (touring) return; touring = true;
  const W = LINES.welcome;
  const steps = [{ text: W[0], before: () => tab("roll") }, { text: W[1], at: "#roll" }, { text: W[2], at: "#sections" }, { text: W[3], at: "#openFilters" }, { text: W[4], at: ".deck" }];
  if (!S) steps.push({ text: LINES.counter[3], at: "#stepHouse", before: () => tab("counter") });
  rasher.welcome({ steps, done: () => { touring = false; scrollTo(0, 0); setTimeout(installTip, 1500); } });
}
function maybeTour() {
  if (!loaded || $("#shop").hidden) return;
  if (!store.prefs.get("welcomed", false) && !rasher.quiet()) setTimeout(tour, RM ? 0 : 700);
  else setTimeout(installTip, 2500);
}
// ---------- one-off tip: put the shop on your home screen ----------
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; });
function installTip() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone || touring || store.prefs.get("a2hs", false) || !$("#a2hs").hidden) return;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  $("#a2hsTxt").textContent = ios ? "Put the shop on your home screen. In Safari, tap Share (the square with the arrow), then Add to Home Screen." : installEvt ? "Put the shop on your home screen. One tap and it opens like a proper app." : "Put the shop on your home screen. In your browser menu, tap Add to Home screen or Install app.";
  $("#a2hsGo").hidden = !installEvt;
  $("#a2hs").hidden = false;
}
const closeTip = () => { $("#a2hs").hidden = true; store.prefs.set("a2hs", true); };
$("#a2hsNo").onclick = closeTip;
$("#a2hsGo").onclick = async () => { if (!installEvt) return closeTip(); installEvt.prompt(); try { await installEvt.userChoice; } catch { } installEvt = null; closeTip(); };

// ---------- Ask Rasher: three questions, then he picks ----------
const ASK = [
  ["How's the head?", [["sharp", "Sharp"], ["grand", "Grand"], ["bits", "In bits"]]],
  ["Who's on the couch?", [["me", "Just me"], ["date", "A date"], ["crew", "The lads"]]],
  ["What are we after?", [["laugh", "A laugh"], ["fright", "A fright"], ["chew", "Something to chew on"], ["any", "Surprise me"]]],
];
function askScore(x, a) {
  const m = x.m, g = n => m.g.includes(n), subs = m.l !== "en" && m.l !== "xx";
  let s = x.fit + Math.random() * (a[2] === "any" ? .9 : .35);
  if (a[0] === "bits") s += (m.rt && m.rt <= 110 ? .6 : 0) - (m.rt > 130 ? 1.5 : 0) - (subs ? .8 : 0) - (g("War") || g("History") || g("Documentary") ? .6 : 0) + (g("Comedy") || g("Animation") ? .3 : 0);
  if (a[0] === "grand") s -= m.rt > 160 ? .6 : 0;
  if (a[0] === "sharp") s += g("Drama") || g("Mystery") || g("Science Fiction") ? .2 : 0;
  if (a[1] === "date") s += (g("Romance") ? .6 : 0) + (g("Comedy") ? .3 : 0) - (g("Horror") || g("War") ? 1.2 : 0);
  if (a[1] === "crew") s += (g("Action") || g("Comedy") || g("Crime") || g("Horror") ? .4 : 0) - (subs ? .6 : 0) - (g("Documentary") ? 1 : 0);
  if (a[2] === "laugh") s += g("Comedy") ? 1.2 : -.6;
  if (a[2] === "fright") s += g("Horror") ? 1.2 : g("Thriller") ? .5 : -.8;
  if (a[2] === "chew") s += (g("Drama") || g("Mystery") || g("Science Fiction") || g("History") ? .5 : 0) - (m.g.length === 1 && g("Comedy") ? .3 : 0) + (m.va >= 7.3 ? .4 : 0);
  return s;
}
function openAsk() {
  if (!S || rolling) return;
  const a = [], sh = $("#askSheet"), body = $("#askBody");
  sh.hidden = false; document.body.classList.add("noscroll");
  const step = () => {
    const [q, opts] = ASK[a.length];
    body.innerHTML = `<div class="askq">${rasher.HEAD}<p class="said"><b>Rasher</b>${esc(q)}</p></div><div class="chips askopts">${opts.map(([k, l]) => `<button class="chip" data-ask="${k}">${esc(l)}</button>`).join("")}</div><p class="small rcount">${a.length + 1} of 3</p>`;
    body.querySelectorAll("[data-ask]").forEach(b => b.onclick = () => { snd.click(); a.push(b.dataset.ask); if (a.length < ASK.length) step(); else choose(); });
  };
  const choose = async () => {
    closeAsk();
    const list = S.watchlist.length ? S.watchlist : S.seen;
    const best = list.map(x => [askScore(x, a), x]).sort((p, q) => q[0] - p[0])[0][1];
    const why = (best.why && best.why[0]) || (S.reasons ? S.reasons(best.m)[0] : "");
    tab("roll"); rolling = true; $("#roll").disabled = true; $("#led").classList.add("on");
    await land([{ ...best, src: "wl" }], { direct: true, say: why ? `This one. ${why}.`.replace(/\.\.$/, ".") : "" });
  };
  step();
}
function closeAsk() { $("#askSheet").hidden = true; document.body.classList.remove("noscroll"); }
$("#askRasher").onclick = openAsk;
$("#askClose").onclick = closeAsk;
$("#askSheet").addEventListener("click", e => { if (e.target.id === "askSheet") closeAsk(); });
$("#rHead").innerHTML = rasher.HEAD;

// ---------- friends ----------
function leaveVisit() { visit = ""; store.prefs.del("visit"); picks = []; rebuild(); tab("roll"); toast("Back in your own shop."); }
async function walkInto(code) { visit = code; store.prefs.set("visit", code); picks = []; snd.buzz(); rebuild(); tab("roll"); toast(`Welcome to ${FR[code].name}'s shop.`); }
function wallTile(fr) {
  const top = fr.items.filter(x => x.pick && x.m.p).sort((a, b) => b.m.vc - a.m.vc).slice(0, 4);
  const fill = top.length < 4 ? fr.items.filter(x => x.m.p && !top.includes(x)).slice(0, 4 - top.length) : [];
  const ps = [...top, ...fill].map(x => `<i style="background-image:url('${poster(x.m.p, "w154")}')"></i>`).join("");
  const c = mine ? friends.compare(mine, fr) : null;
  const here = S?.visit === fr.code;
  return `<article class="ftile${here ? " here" : ""}"><div class="fposters">${ps}</div><div class="fname">${esc(fr.name)}<small>${c?.match != null ? `Taste match ${c.match}%` : `${fr.items.filter(x => x.wl).length.toLocaleString()} tapes`}</small></div>
    <div class="row"><button class="tag hot" data-fr="walk" data-code="${fr.code}">${here ? "You're here" : "Walk in"}</button>${mine ? `<button class="tag" data-fr="cmp" data-code="${fr.code}">Compare</button>` : ""}<button class="tag" data-fr="rm" data-code="${fr.code}" aria-label="Remove ${esc(fr.name)}">✕</button></div></article>`;
}
function renderFriends() {
  const sh = friends.shareInfo();
  $("#shareBox").hidden = !profile;
  $("#shareStart").hidden = !!sh; $("#shareOn").hidden = !sh;
  if (sh) $("#myCode").textContent = sh.code;
  if (!$("#myName").value) $("#myName").value = sh?.name || profile?.username || "";
  const list = Object.values(FR);
  $("#fwall").innerHTML = list.map(wallTile).join("") + (S?.visit ? `<button class="ghost" id="backHome">Back to my own shop</button>` : "");
  const bh = $("#backHome"); if (bh) bh.onclick = leaveVisit;
  $("#stepTop").hidden = !profile?.username || !tmdb.hasProxy;
  if (profile?.toppedAt) $("#topMsg").textContent = `Last topped up ${new Date(profile.toppedAt).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`;
}
const fmsg = t => $("#friendMsg").textContent = t;
$("#shareGo").onclick = async () => {
  const name = $("#myName").value.trim(); if (!name) { fmsg("Give your shop a name first."); $("#myName").focus(); return; }
  if (S?.visit) { fmsg("Go back to your own shop first."); return; }
  fmsg("Boxing up your shelves…");
  try { const code = await friends.share(mine, name); fmsg(`Shared. Your code is ${code}.`); renderFriends(); } catch (e) { fmsg(e.message); }
};
$("#shareUpd").onclick = async () => { fmsg("Updating your shared shop…"); try { await friends.share(mine, $("#myName").value.trim() || friends.shareInfo().name); fmsg("Updated. Mates get the new shelves next time they refresh."); } catch (e) { fmsg(e.message); } };
$("#shareStop").onclick = async () => { try { await friends.stopSharing(); fmsg("Stopped sharing. That code won't work any more."); renderFriends(); } catch (e) { fmsg(e.message); } };
$("#shareSend").onclick = async () => {
  const sh = friends.shareInfo(); const text = `Come round to my video shop. Open ${location.origin + location.pathname} then go to the Counter and add my code: ${sh.code}`;
  try { if (navigator.share) await navigator.share({ title: "Take One", text }); else { await navigator.clipboard.writeText(text); toast("Copied. Paste it to your mate."); } } catch { }
};
$("#codeGo").onclick = async () => {
  const v = $("#codeIn").value.trim(); if (!v) return;
  fmsg("Looking for that shop…");
  try { const fr = await friends.add(v); FR = await friends.all(); $("#codeIn").value = ""; fmsg(`${fr.name}'s shop is on your wall.`); snd.coin(); renderFriends(); }
  catch (e) { fmsg(e.message); }
};
$("#fwall").addEventListener("click", async e => {
  const b = e.target.closest("[data-fr]"); if (!b) return;
  const code = b.dataset.code, a = b.dataset.fr;
  if (a === "walk" && S?.visit !== code) { try { await friends.refresh(code); FR = await friends.all(); } catch { } walkInto(code); }
  if (a === "cmp") openCompare(FR[code]);
  if (a === "rm") { if (S?.visit === code) leaveVisit(); await friends.remove(code); FR = await friends.all(); renderFriends(); }
});
function openCompare(fr) {
  const c = friends.compare(mine, fr), ti = list => list.map(m => `<li>${esc(m.t)} <small>${esc(m.y)}</small></li>`).join("");
  $("#cmpTitle").textContent = `You and ${fr.name}`;
  $("#cmpBody").innerHTML = `${c.match != null ? `<div class="match"><b>${c.match}%</b><span>taste match</span></div>` : `<p>Not enough films you've both rated to call it yet.</p>`}
    <p class="small">You've both seen ${c.both.toLocaleString()} films${c.bothWl ? ` and ${c.bothWl} are on both your watchlists` : ""}.${c.genres.length ? ` You both go for ${c.genres.map(g => g.toLowerCase()).join(", ")}.` : ""}</p>
    ${c.loved.length ? `<h4>You both loved</h4><ul class="tlist">${ti(c.loved)}</ul>` : ""}
    ${c.apart.length ? `<h4>Miles apart on</h4><ul class="tlist">${ti(c.apart)}</ul>` : ""}
    ${c.neither.length ? `<h4>Neither of you has seen</h4><div class="nlist">${c.neither.map((x, i) => `<button class="nrow" data-nei="${i}"><span>${esc(x.m.t)} <small>${esc(x.m.y)}${x.onLists > 1 ? " · on both your lists" : ""}</small></span><b>Put it on ▸</b></button>`).join("")}</div>` : ""}`;
  $("#cmpBody").querySelectorAll("[data-nei]").forEach(b => b.onclick = async () => { const x = c.neither[+b.dataset.nei]; closeCmp(); tab("roll"); if (rolling) return; rolling = true; $("#roll").disabled = true; await land([{ m: x.m, src: "wl" }], { direct: true }); });
  $("#cmpSheet").hidden = false; document.body.classList.add("noscroll");
}
function closeCmp() { $("#cmpSheet").hidden = true; document.body.classList.remove("noscroll"); }
$("#cmpClose").onclick = closeCmp;
$("#cmpSheet").addEventListener("click", e => { if (e.target.id === "cmpSheet") closeCmp(); });

// ---------- Letterboxd top-up ----------
async function topUp(quietly) {
  if (!profile?.username || !tmdb.hasProxy) return;
  if (!quietly) $("#topMsg").textContent = "Reading your diary…";
  try {
    const n = await friends.topUp(profile, films, id => tmdb.details(apiKey, id));
    await store.set("profile", profile); await store.set("films", films);
    if (n || !quietly) { rebuild(); toast(n ? `Topped up: ${n} new film${n > 1 ? "s" : ""} from your diary.` : "Nothing new in your diary."); }
    renderFriends();
  } catch (e) { if (!quietly) $("#topMsg").textContent = e.message; }
}
$("#topGo").onclick = () => topUp(false);

// ---------- guest tuning ----------
function renderTuneCard() {
  const b = $("#tuneOpen"), show = !!S?.house && !S.visit;
  b.hidden = !show; if (!show) return;
  const t = friends.tuning(), n = t.like.length + t.nope.length;
  b.innerHTML = `<b>${n ? "Rasher's had a think" : "Tell Rasher what you like"}</b><span>${n ? `Tuned off ${n} film${n > 1 ? "s" : ""} you told him about. Tap to change.` : "Swipe through twenty well-known films and his picks will lean your way."}</span>`;
}
$("#tuneOpen").onclick = () => {
  const deck = friends.tuneDeck(lib.buildHouse(house, {})), t = friends.tuning();
  const st = new Map(); t.like.forEach(id => st.set(id, 1)); t.nope.forEach(id => st.set(id, 2));
  const paint = () => $$("#tuneGrid [data-t]").forEach(b => { b.dataset.s = st.get(+b.dataset.t) || 0; });
  $("#tuneGrid").innerHTML = deck.map(x => `<button class="pchoice" data-t="${x.m.id}" aria-label="${esc(x.m.t)}" style="background-image:url('${poster(x.m.p, "w185")}')"><span>${esc(x.m.t)}</span></button>`).join("");
  $("#tuneGrid").onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; const id = +b.dataset.t; st.set(id, ((st.get(id) || 0) + 1) % 3); snd.tick(); paint(); };
  paint(); $("#tuneSheet").hidden = false; document.body.classList.add("noscroll");
  $("#tuneDone").onclick = () => {
    friends.tuneSet([...st].filter(([, v]) => v === 1).map(([k]) => k), [...st].filter(([, v]) => v === 2).map(([k]) => k));
    $("#tuneSheet").hidden = true; document.body.classList.remove("noscroll"); rebuild(); renderForYou(); toast("Rasher's taken notes.");
  };
};

// ---------- group night (pass the phone) ----------
function groupNight(v, head, back) {
  const people = [...(mine ? [{ code: "me", name: friends.shareInfo()?.name || profile.username || "You" }] : []), ...Object.values(FR).map(f => ({ code: f.code, name: f.name }))];
  if (people.length < 2) { v.innerHTML = head + `<div class="empty">Add a mate's code at the Counter first. Group night needs at least two shops.</div>`; back(); return; }
  const g = { who: new Set(people.map(p => p.code)), short: false, nosubs: false };
  const setup = () => {
    v.innerHTML = head + `<p class="note">Who's on the couch? Rasher finds films none of you have seen, then you pass the phone round and veto.</p>
      <div class="chips" id="gWho">${people.map(p => `<button class="chip" data-who="${p.code}" aria-pressed="${g.who.has(p.code)}">${esc(p.name)}</button>`).join("")}</div>
      <label class="tog"><input type="checkbox" id="gShort" ${g.short ? "checked" : ""}> Keep it under 2 hours</label><label class="tog"><input type="checkbox" id="gSubs" ${g.nosubs ? "checked" : ""}> No subtitles</label>
      <div class="row center"><button class="play" id="gGo"><span class="tri"></span><span>Deal five tapes</span></button></div>`;
    back();
    v.querySelectorAll("[data-who]").forEach(b => b.onclick = () => { const c = b.dataset.who; g.who.has(c) ? g.who.delete(c) : g.who.add(c); b.setAttribute("aria-pressed", g.who.has(c)); snd.click(); });
    $("#gShort").onchange = e => g.short = e.target.checked; $("#gSubs").onchange = e => g.nosubs = e.target.checked;
    $("#gGo").onclick = start;
  };
  const start = () => {
    const room = people.filter(p => g.who.has(p.code));
    if (room.length < 2) return toast("Pick at least two of you.");
    const tapes = friends.neither(g.who.has("me") ? mine : null, room.filter(p => p.code !== "me").map(p => FR[p.code]), 5, { short: g.short, nosubs: g.nosubs, random: true });
    if (tapes.length < 2) return toast("Not enough films none of you have seen. Loosen it up.");
    veto({ room, tapes: tapes.map(t => ({ ...t, out: false })), turn: 0, passes: 0 });
  };
  const veto = st => {
    const left = st.tapes.filter(t => !t.out);
    if (left.length === 1 || st.passes >= st.room.length) return winner(st, left);
    const p = st.room[st.turn % st.room.length];
    v.innerHTML = head + `<div class="passphone"><span class="kicker">Pass the phone to</span><b>${esc(p.name)}</b><span>Tap the one you veto, or pass.</span></div>
      <div class="vlist">${st.tapes.map((t, i) => { const pp = posterOf(t.m, "w154"); return `<button class="vtape${t.out ? " out" : ""}" data-v="${i}" ${t.out ? "disabled" : ""}><i style="${pp ? `background-image:url('${pp}')` : ""}"></i><span>${esc(t.m.t)}<small>${esc(t.m.y)} · ${fmtRt(t.m.rt)}</small></span>${t.out ? `<em>VETOED</em>` : ""}</button>`; }).join("")}</div>
      <div class="row center"><button class="ghost" id="gPass">Pass</button></div>`;
    back();
    v.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { st.tapes[+b.dataset.v].out = true; st.passes = 0; st.turn++; snd.clunk(); veto(st); });
    $("#gPass").onclick = () => { st.passes++; st.turn++; snd.click(); veto(st); };
  };
  const winner = (st, left) => {
    const w = left.sort((a, b) => b.s - a.s)[0];
    play([{ m: w.m, src: "wl" }], "group");
  };
  const play = (items, cab) => { tab("roll"); if (rolling) return; rolling = true; $("#roll").disabled = true; $("#led").classList.add("on"); land(items, { arcade: cab }); };
  setup();
}

// ---------- start your own shop (no export) ----------
builder.init({
  house: async () => { await loadHouse(); return house; }, proxy: tmdb.hasProxy || !!apiKey,
  details: id => tmdb.details(apiKey, id), search: q => tmdb.call(apiKey, "/search/movie", { query: q }),
  posterOf, esc, head: rasher.HEAD, snd, toast,
  save: async (p, f) => {
    profile = p; films = { ...films, ...f }; await store.set("profile", profile); await store.set("films", films);
    mode = ""; store.prefs.del("mode"); visit = ""; store.prefs.del("visit"); picks = []; poolMode = "wl"; store.prefs.set("pool", "wl");
    rebuild(); tab("roll"); toast(`Shelves stocked. ${S.watchlist.length.toLocaleString()} tapes picked for you.`);
    try { extra = await importer.enrichIds(apiKey, S.candidateIds); rebuild(); } catch { }
  },
});
$("#buildGo").onclick = () => builder.open(null);
$("#buildSwipe").onclick = () => builder.open(null, true);
$("#buildMore").onclick = () => builder.open({ profile, films });

// ---------- start ----------
snd.setOn(store.prefs.get("sound", true));
street();
load().then(() => { const t = store.prefs.get("tab", "roll"); tab(S ? (TABS.includes(t) ? t : "roll") : "counter"); loaded = true; maybeTour();
  if (profile?.username && navigator.onLine && (!profile.toppedAt || Date.now() - new Date(profile.toppedAt) > 12 * 36e5)) setTimeout(() => topUp(true), 4000); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
