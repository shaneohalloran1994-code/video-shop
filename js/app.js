import * as store from "./store.js";
import * as tmdb from "./tmdb.js";
import * as importer from "./importer.js";
import * as lib from "./library.js";
import * as snd from "./sound.js";

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
const today = () => new Date().toISOString().slice(0, 10);
const lbLink = it => it.uri || `https://letterboxd.com/tmdb/${it.m.id}/`;
function toast(t) { const e = $("#toast"); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2600); }

// ---------- state ----------
let profile = null, films = {}, extra = {}, log = {}, S = null;
let apiKey = store.prefs.get("key", "");
const DEFAULT_F = { inc: [], exc: [], len: [], slot: "", lang: "any", lp: "", y0: "", y1: "", crowdOn: false, c0: "3", c1: "5", myMin: "", since: "", neverRe: false, taste: false };
let F = Object.assign({}, DEFAULT_F, store.prefs.get("f", {}));
let poolMode = store.prefs.get("pool", "wl");
let N = store.prefs.get("n", 1);
let picks = [], active = 0, rolling = false, rolledEmpty = false;

async function load() {
  profile = await store.get("profile");
  films = (await store.get("films")) || {};
  extra = (await store.get("extra")) || {};
  log = (await store.get("log")) || {};
  rebuild();
}
function rebuild() {
  S = profile ? lib.build(profile, films, extra, log) : null;
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
    if (RM) { st.hidden = true; $("#shop").hidden = false; return; }
    st.classList.add("leaving");
    setTimeout(() => { st.hidden = true; $("#shop").hidden = false; stopRain = true; }, 650);
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
const TABS = ["roll", "picks", "receipt", "counter"];
function tab(n) {
  TABS.forEach(t => { $("#v-" + t).hidden = t !== n; $(`[data-tab="${t}"]`).setAttribute("aria-selected", t === n); });
  store.prefs.set("tab", n);
  if (n === "receipt") renderReceipt();
  if (n === "picks") renderForYou();
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
$("#clearF").onclick = () => { F = Object.assign({}, DEFAULT_F); changed(true); };
$$("[data-pool]").forEach(b => b.onclick = () => { poolMode = b.dataset.pool; store.prefs.set("pool", poolMode); changed(); idleScreen(); });
$("#n1").onclick = () => { N = 1; store.prefs.set("n", 1); changed(); };
$("#n3").onclick = () => { N = 3; store.prefs.set("n", 3); changed(); };
function changed(full = true) { store.prefs.set("f", F); syncFilters(full); }

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
  $$("#lengths .chip").forEach(b => b.setAttribute("aria-pressed", F.len.includes(b.dataset.len)));
  $$("#slots .chip").forEach(b => b.setAttribute("aria-pressed", F.slot !== "" && F.slot === b.dataset.slot));
  $$("#since .chip").forEach(b => b.setAttribute("aria-pressed", F.since === b.dataset.since));
  $$("[data-lang]").forEach(b => b.setAttribute("aria-pressed", F.lang === b.dataset.lang));
  $("#langPick").value = F.lp;
  if (full) { $("#y0").value = F.y0; $("#y1").value = F.y1; }
  $("#crowdOn").checked = F.crowdOn; $("#c0").value = F.c0; $("#c1").value = F.c1; $("#c0").disabled = $("#c1").disabled = !F.crowdOn;
  $("#myMin").value = F.myMin; $("#neverRe").checked = F.neverRe; $("#taste").checked = F.taste;
  $$("[data-pool]").forEach(b => b.setAttribute("aria-pressed", b.dataset.pool === poolMode));
  $(".seenonly").hidden = poolMode === "wl";
  $("#n1").setAttribute("aria-pressed", N === 1); $("#n3").setAttribute("aria-pressed", N === 3);
  $("#rollLabel").textContent = N === 3 ? "Take three" : "Take one";
  const n = pool().length;
  $("#inRun").textContent = S ? `${n.toLocaleString()} tape${n === 1 ? "" : "s"} in the running` : "";
  $("#roll").disabled = !S;
  const act = F.inc.length + F.exc.length + F.len.length + !!F.slot + (F.lang !== "any") + !!F.lp + !!(F.y0 || F.y1) + F.crowdOn + (poolMode !== "wl" ? !!F.myMin + !!F.since + F.neverRe : 0);
  $("#ftag").textContent = act ? `${act} filter${act > 1 ? "s" : ""} on` : "No filters";
}

function pool() {
  if (!S) return [];
  let items = [];
  if (poolMode !== "seen") items = S.watchlist.map(x => ({ ...x, src: "wl" }));
  if (poolMode !== "wl") { const ids = new Set(items.map(x => x.m.id)); items = items.concat(S.seen.filter(s => !ids.has(s.m.id)).map(s => ({ ...s, src: "seen" }))); }
  const y0 = parseInt(F.y0) || 0, y1 = parseInt(F.y1) || 9999, c0 = Math.min(+F.c0, +F.c1), c1 = Math.max(+F.c0, +F.c1);
  const lens = LENS.filter(l => F.len.includes(l[0]));
  const now = new Date();
  return items.filter(x => {
    const m = x.m;
    if (F.inc.length && !F.inc.some(g => m.g.includes(g))) return false;
    if (F.exc.some(g => m.g.includes(g))) return false;
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
function idleScreen() {
  const c = $("#tvContent");
  if (rolling) return;
  if (!S) {
    c.innerHTML = `<div class="idle"><span class="big">NO TAPES</span><span>BRING YOUR LETTERBOXD</span><span>EXPORT TO THE COUNTER<span class="blink">_</span></span></div>`;
    return;
  }
  const shelf = poolMode === "wl" ? "WATCHLIST" : poolMode === "seen" ? "SEEN IT" : "EVERYTHING";
  c.innerHTML = `<div class="idle"><span>VIDEO 1</span><span class="big">${pool().length.toLocaleString()} TAPES</span><span>SHELF: ${shelf}</span><span>PRESS TAKE ONE ▶<span class="blink">_</span></span></div>`;
}
function playOnTV(it) {
  const m = it.m, c = $("#tvContent");
  const p = poster(m.p, "w500");
  c.innerHTML = `<div class="play-screen">${p ? `<div class="bg" style="background-image:url('${p}')"></div>` : ""}
    <div class="frame">${p ? `<img src="${p}" alt="Poster for ${esc(m.t)}">` : `<div class="noposter">${esc(m.t)}</div>`}</div>
    <div class="bars t"></div><div class="bars b"><div class="ttl">${esc(m.t)}</div></div></div>`;
  osd("PLAY ▶");
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
const SPINES = [["#111", "#f2f2f2"], ["#f4f1e8", "#c0392b"], ["#c0392b", "#fff"], ["#1d3d8f", "#ffd23f"], ["#ffd23f", "#111"], ["#2d6a4f", "#fff"], ["#6a1e5c", "#ffd6ec"], ["#e8e2d0", "#1d3d8f"], ["#e86a17", "#111"], ["#0f5e7a", "#fff"]];
const spineHTML = m => { const [bg, fg] = SPINES[m.id % SPINES.length]; return `<div class="spine" style="background:${bg};color:${fg}" data-id="${m.id}"><span>${esc(m.t)}</span></div>`; };
const SW = 29; // spine width + gap
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
  const target = -(at * SW + (chosen.length * SW) / 2 - center);
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
  chosen.forEach(c => el.querySelector(`.spine[data-id="${c.m.id}"]`)?.classList.add("pulled"));
  snd.clunk();
  picks = chosen; active = 0;
  if (!RM) await staticBurst();
  playOnTV(picks[0]); snd.stab();
  renderPicks();
  rolling = false; $("#roll").disabled = false; $("#led").classList.remove("on");
  if (innerWidth < 700) $("#filters").open = false;
}
$("#roll").onclick = roll;

// ---------- the picks (tape cases) ----------
function caseHTML(it, i) {
  const m = it.m, p = poster(m.p, "w185");
  const langTxt = m.l === "en" ? "English" : `${lang(m.l)} · subs`;
  const again = it.src === "seen" || S.seen.some(s => s.m.id === m.id);
  return `<article class="case ${i === active && picks.length > 1 ? "active" : ""}" data-i="${i}">
    ${m.rt ? `<span class="dot">${Math.floor(m.rt / 60)}H${String(m.rt % 60).padStart(2, "0")}</span>` : ""}
    <button class="cover ${p ? "" : "none"}" data-a="tv" aria-label="Play ${esc(m.t)} on the telly" style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : esc(m.t)}</button>
    <div class="info">
      <h3 class="titlecard">${esc(m.t)}</h3>
      <div class="meta">${esc(m.y)} · ${fmtRt(m.rt).toUpperCase()} · ${esc(langTxt.toUpperCase())}</div>
      <div class="gen">${esc(m.g.slice(0, 3).join(" / "))}</div>
      ${m.dir.length ? `<div class="who">Directed by ${esc(m.dir.slice(0, 2).join(" & "))}${m.cast.length ? `<br><em>With ${esc(m.cast.slice(0, 3).join(", "))}</em>` : ""}</div>` : ""}
      <p class="syn" hidden>${esc(m.ov)}</p>
      <div class="acts">
        <button class="tag hot" data-a="ret">${again ? "Watched it again" : "Watched it"}</button>
        <button class="tag" data-a="swap">Swap</button>
        ${m.ov ? `<button class="tag" data-a="syn">Synopsis</button>` : ""}
        <a class="tag" href="https://open.spotify.com/search/${encodeURIComponent(m.t + " " + m.y + " soundtrack")}" target="_blank" rel="noopener">Soundtrack</a>
        <a class="tag" href="${esc(lbLink(it))}" target="_blank" rel="noopener">Letterboxd</a>
      </div>
    </div></article>`;
}
function renderPicks() {
  const box = $("#cases");
  if (!S) { box.innerHTML = ""; return; }
  if (!picks.length) { box.innerHTML = rolledEmpty ? `<div class="empty">Nothing on the shelf matches all that. Loosen a filter and try again.</div>` : ""; return; }
  box.innerHTML = picks.map(caseHTML).join("");
}
$("#cases").addEventListener("click", e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const card = b.closest(".case"), i = +card.dataset.i, it = picks[i];
  const a = b.dataset.a;
  if (a === "tv") { active = i; playOnTV(it); snd.clunk(); $$(".case").forEach(c => c.classList.toggle("active", +c.dataset.i === i && picks.length > 1)); }
  if (a === "syn") { const p = card.querySelector(".syn"); p.hidden = !p.hidden; b.textContent = p.hidden ? "Synopsis" : "Hide synopsis"; }
  if (a === "swap") {
    const p = pool().filter(x => !picks.some(c => c.m.id === x.m.id));
    const nx = draw(p, 1)[0];
    if (!nx) return toast("Nothing else on the shelf matches.");
    picks[i] = nx; active = i; snd.clunk(); playOnTV(nx); renderPicks();
  }
  if (a === "ret") openReturn(it);
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
  let verdict = "";
  if (rating != null) { const d = rating - guess; verdict = Math.abs(d) <= .5 ? "Called it." : d > 0 ? "You liked it more than we thought." : "Not your night, then."; }
  box.innerHTML = `${rating != null ? `<div class="reveal3"><div>YOU<b>${rating.toFixed(1)}★</b></div><div>CROWD<b>${crowd != null ? crowd.toFixed(1) + "★" : "–"}</b></div><div>WE GUESSED<b>${guess.toFixed(1)}★</b></div></div>
    ${prev != null ? `<p class="kicker">Last time you gave it ${prev.toFixed(1)}★</p>` : ""}<p class="verdict">${verdict}</p>` : `<p class="verdict">Back on the shelf. Crowd gave it ${crowd != null ? crowd.toFixed(1) + "★" : "nothing yet"}.</p>`}
    <div class="row"><a class="btn" href="${esc(lbLink(it))}" target="_blank" rel="noopener">Log it on Letterboxd</a><button class="ghost" id="retDone">Done</button></div>`;
  $("#retAsk").hidden = true; box.hidden = false;
  $("#retDone").onclick = () => { $("#returnSheet").hidden = true; };
  picks = picks.filter(p => p.m.id !== m.id); active = 0;
  rebuild(); if (picks[0]) playOnTV(picks[0]);
}

// ---------- For you ----------
let fitsN = 10, freshN = 10;
function pickHTML(it) {
  const m = it.m, p = poster(m.p, "w154");
  return `<article class="pick"><div class="cover" style="${p ? `background-image:url('${p}')` : ""}"></div><div class="info" style="min-width:0">
    <h3 class="titlecard">${esc(m.t)}</h3><div class="meta">${esc(m.y)} · ${fmtRt(m.rt).toUpperCase()}${m.l !== "en" ? " · " + esc(lang(m.l).toUpperCase()) : ""}</div>
    <div class="gen">${esc(m.g.slice(0, 3).join(" / "))}${m.dir[0] ? " · " + esc(m.dir[0]) : ""}</div>
    <ul class="why">${(it.why || []).map(w => `<li>${esc(w)}</li>`).join("")}</ul>
    <div class="acts"><a class="tag" href="${esc(lbLink(it))}" target="_blank" rel="noopener">Letterboxd</a></div></div></article>`;
}
function renderForYou() {
  if (!S) { $("#bestFits").innerHTML = `<div class="empty">Stock the shelves at the counter first.</div>`; $("#fresh").innerHTML = ""; $("#moreFits").hidden = $("#moreFresh").hidden = true; return; }
  $("#bestFits").innerHTML = S.bestFits.slice(0, fitsN).map(pickHTML).join("");
  $("#moreFits").hidden = fitsN >= S.bestFits.length;
  $("#fresh").innerHTML = S.fresh.slice(0, freshN).map(pickHTML).join("");
  $("#moreFresh").hidden = freshN >= S.fresh.length;
  $("#freshNote").textContent = S.fresh.length ? "Films that keep coming up off the ones you rated 4★ and higher." : "Still restocking these. Check back in a minute.";
}
$("#moreFits").onclick = () => { fitsN += 10; renderForYou(); };
$("#moreFresh").onclick = () => { freshN += 10; renderForYou(); };

// ---------- receipt ----------
let statsDirty = true;
function renderReceipt() {
  const r = $("#receipt");
  if (!S) { r.innerHTML = `<h2>TAKE ONE VIDEO</h2><p class="c">No rentals on file yet.</p>`; return; }
  if (!statsDirty) return; statsDirty = false;
  const t = lib.stats(S);
  const ln = (a, b) => `<div class="ln"><span>${esc(a)}</span><span class="dots"></span><span>${esc(b)}</span></div>`;
  const bar = (n, max, w = 12) => "#".repeat(Math.max(1, Math.round(n / max * w)));
  const dmax = Math.max(...t.decades.map(d => d.n));
  const d = new Date();
  const who = (profile.username || "MEMBER").toUpperCase();
  let h = `<h2>TAKE ONE VIDEO</h2><p class="c">OPEN LATE · BE KIND, REWIND</p><hr>
    ${ln("MEMBER", who)}${ln("DATE", d.toLocaleDateString("en-IE"))}${ln("TIME", d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" }))}<hr>
    ${ln("FILMS RENTED", t.watched.toLocaleString())}${ln("HOURS IN FRONT OF THE TELLY", t.hours.toLocaleString())}${ln("RATINGS GIVEN", t.rated.toLocaleString())}${ln("YOUR AVERAGE", t.avg.toFixed(2) + "★")}${ln("THE CROWD, SAME FILMS", (t.crowdAvg || 0).toFixed(2) + "★")}${ln("STILL ON THE WATCHLIST", t.watchlist.toLocaleString())}<hr>
    <div class="sec">TOP GENRES</div>${t.genres.slice(0, 6).map(g => ln(g.k.toUpperCase(), `${g.n} · ${g.avg ? g.avg.toFixed(1) + "★" : "–"}`)).join("")}<hr>
    <div class="sec">LATELY YOU'RE INTO</div>${t.lately.map(g => ln(g.g.toUpperCase(), `${Math.round(g.r * 100)}% (USUALLY ${Math.round(g.o * 100)}%)`)).join("")}<hr>
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
  $("#keyMsg").textContent = apiKey ? "Key saved on this phone." : "Get one free at themoviedb.org → Settings → API.";
  $("#zipMsg").textContent = profile ? `Last export: ${new Date(profile.importedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}. ${S.watchlist.length.toLocaleString()} tapes on the watchlist shelf, ${S.seen.length.toLocaleString()} seen.${S.unmatched ? ` ${S.unmatched} watchlist entries couldn't be matched (usually TV series).` : ""}` : "";
  const n = Object.keys(log).length;
  $("#unwatch").hidden = !n; $("#unwatch").textContent = `Forget ${n} film${n > 1 ? "s" : ""} marked watched here`;
  $("#soundOn").checked = snd.isOn(); $("#skipStreet").checked = store.prefs.get("skipStreet", false);
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
  if (!apiKey) { $("#zipMsg").textContent = "Save your TMDB key first, then pick the zip."; return; }
  const prog = $("#prog"); prog.hidden = false;
  const set = (d, t, label) => { $("#progBar").style.width = (t ? d / t * 100 : 100) + "%"; $("#progTxt").textContent = `${label} ${d.toLocaleString()} / ${t.toLocaleString()}`; };
  try {
    $("#zipMsg").textContent = "Reading the zip…";
    const p = await importer.readZip(file);
    $("#zipMsg").textContent = "Looking every film up. The first time takes a couple of minutes; keep the app open.";
    films = await importer.enrich(apiKey, p, (d, t) => set(d, t, "STOCKING SHELVES"));
    profile = p; await store.set("profile", profile);
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
$("#soundOn").onchange = e => { snd.setOn(e.target.checked); store.prefs.set("sound", e.target.checked); };
$("#skipStreet").onchange = e => store.prefs.set("skipStreet", e.target.checked);
$("#unwatch").onclick = async () => { log = {}; await store.set("log", log); rebuild(); toast("Marked-watched films are back on the shelf."); };
$("#wipe").onclick = () => $("#wipeConfirm").hidden = false;
$("#wipeNo").onclick = () => $("#wipeConfirm").hidden = true;
$("#wipeYes").onclick = async () => { await store.clearAll(); ["key", "f", "pool", "n", "tab"].forEach(k => store.prefs.del(k)); apiKey = ""; profile = null; films = {}; extra = {}; log = {}; picks = []; $("#wipeConfirm").hidden = true; rebuild(); toast("Cleared."); };

function nudge() {
  const n = $("#nudge");
  if (!profile) { n.hidden = false; n.textContent = "No tapes yet. Bring your Letterboxd export to the counter →"; n.onclick = () => tab("counter"); n.style.cursor = "pointer"; return; }
  const age = (Date.now() - new Date(profile.importedAt)) / 864e5;
  if (age > 30) { n.hidden = false; n.textContent = "These shelves are a month old. Bring in a fresh export →"; n.onclick = () => tab("counter"); n.style.cursor = "pointer"; }
  else n.hidden = true;
}

// ---------- start ----------
snd.setOn(store.prefs.get("sound", true));
street();
load().then(() => { const t = store.prefs.get("tab", "roll"); tab(profile ? (TABS.includes(t) ? t : "roll") : "counter"); });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
