// The Arcade: other ways to pick, each in its own cabinet.
let C = null;
export function init(ctx) { C = ctx; }

const $ = s => document.querySelector(s);
const view = () => $("#v-arcade");
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const unseen = () => C.S ? C.S.watchlist : [];
const everything = () => { if (!C.S) return []; if (C.S.house) return C.S.watchlist; const ids = new Set(C.S.watchlist.map(x => x.m.id)); return C.S.watchlist.concat(C.S.seen.filter(s => !ids.has(s.m.id))); };
const hhmm = mins => { const m = ((mins % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

const CABS = [
  ["morelike", "More Like This", "Name a film. Get the ones that feel like it.", "purple"],
  ["blend", "Blend", "Two to four films, yours and a mate's. One pick that links them all.", "lime"],
  ["allday", "All-Dayer", "Two to five films, a proper day of it. Printed listings, start times, the lot.", "red"],
  ["double", "Double Bill", "Two films that belong together. Rasher pairs them.", "blue"],
  ["knockout", "Knockout", "Eight tapes, one winner. Pick between pairs till it's settled.", "orange"],
  ["swipe", "Swipe", "Tonight or not tonight. It learns your mood as you go.", "pink"],
  ["chain", "Chain", "Follow an actor or director from your last film to the next.", "green"],
  ["globe", "Spin the Globe", "A random country. A film from it. No arguments.", "teal"],
  ["bargain", "Bargain Bin", "Obscure stuff hardly anyone's rated. €1, no refunds.", "yellow"],
  ["group", "Group Night", "Everyone's shops in. Films none of you have seen. Pass the phone and veto.", "purple"],
];

function card(it, extra = "") {
  const m = it.m, p = C.posterOf(m, "w185");
  return `<div class="acard"><div class="acover" style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : C.esc(m.t)}</div>
    <div class="ainfo"><h3 class="titlecard">${C.esc(m.t)}</h3>
    <div class="meta">${C.esc(m.y)} · ${C.fmtRt(m.rt).toUpperCase()}${m.l && m.l !== "en" ? " · " + C.esc(C.lang(m.l).toUpperCase()) : ""}</div>
    <div class="gen">${C.esc(m.g.slice(0, 3).join(" / "))}${m.dir[0] ? " · " + C.esc(m.dir[0]) : ""}</div>${extra}</div></div>`;
}
function header(k) {
  const c = CABS.find(x => x[0] === k);
  return `<div class="ahead"><button class="tag" data-back>◀ Arcade</button><span class="amarquee ${c[3]}">${c[1]}</span></div>`;
}
function bindBack() { view().querySelectorAll("[data-back]").forEach(b => b.onclick = () => { C.snd.click(); open(); }); }
function empty(msg) { return `<div class="empty">${msg}</div>`; }

export function open() {
  const v = view();
  if (!C.S) { v.innerHTML = `<div class="neonhead"><span class="neon pink">Arcade</span></div>${empty("Stock the shelves at the counter first.")}`; return; }
  v.innerHTML = `<div class="neonhead"><span class="neon pink">Arcade</span><span class="byline">other ways to pick</span></div>
    <div class="cabs">${CABS.map(([k, n, d, c]) => `<button class="cab ${c}" data-cab="${k}"><span class="cab-top">${n}</span><span class="cab-screen">${d}</span><span class="cab-coin">Insert coin</span></button>`).join("")}</div>`;
  v.querySelectorAll("[data-cab]").forEach(b => b.onclick = () => { C.snd.coin?.(); GAMES[b.dataset.cab](); scrollTo(0, 0); });
}

// ---------- All-Dayer / Double Bill ----------
const LIGHT = ["Comedy", "Animation", "Adventure", "Family", "Romance"], HEAVY = ["Drama", "Crime", "War", "History", "Thriller"], NIGHT = ["Horror", "Science Fiction", "Mystery"];
const AD = { n: 3, style: "curated", genres: [], start: null, cap: 0 };
const STYLES = [["curated", "Rasher's curated"], ["same", "Same vibe"], ["mix", "Mix it up"], ["pick", "Pick the genres"], ["director", "One director"], ["decade", "One decade"]];
function defaultStart() { const d = new Date(); let m = d.getHours() * 60 + d.getMinutes() + 30; m = Math.ceil(m / 30) * 30; return Math.min(Math.max(m, 600), 1320); }

function slotsFor(n, style, U) {
  const has = (m, gs) => m.g.some(g => gs.includes(g));
  if (style === "curated") {
    const arc = [m => has(m, LIGHT), m => (parseInt(m.y) || 2000) < 1980 && m.va >= 7.2, m => has(m, HEAVY), m => has(m, NIGHT), m => m.g.includes("Comedy")];
    const order = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3], 5: [0, 1, 2, 4, 3] }[n];
    return { slots: order.map(i => arc[i]), why: "Light to start, a classic after, the heavy one in the evening, the weird one late." };
  }
  if (style === "same") {
    const counts = new Map(); U.forEach(x => x.m.g.forEach(g => counts.set(g, (counts.get(g) || 0) + 1)));
    const ok = [...counts].filter(([, c]) => c >= n * 2).map(([g]) => g); const g = rnd(ok.length ? ok : [...counts.keys()]);
    return { slots: Array(n).fill(m => m.g.includes(g)), why: `All ${g.toLowerCase()}, all day.` };
  }
  if (style === "mix") { const used = new Set(); return { slots: Array(n).fill(0).map(() => m => { const g = m.g[0]; if (!g || used.has(g)) return false; used.add(g); return true; }), why: "A different genre every time.", stateful: used }; }
  if (style === "pick") { const gs = AD.genres.length ? AD.genres : ["Comedy"]; return { slots: Array(n).fill(0).map((_, i) => m => m.g.includes(gs[i % gs.length])), why: gs.join(", then ") + "." }; }
  if (style === "director") {
    const c = new Map(); U.forEach(x => x.m.dir.forEach(d => c.set(d, (c.get(d) || 0) + 1)));
    const ok = [...c].filter(([, k]) => k >= n).map(([d]) => d);
    if (!ok.length) return null;
    const d = rnd(ok); return { slots: Array(n).fill(m => m.dir.includes(d)), why: `A ${d} day.`, sortYear: true };
  }
  if (style === "decade") {
    const c = new Map(); U.forEach(x => { const k = (x.m.y || "").slice(0, 3); if (k) c.set(k, (c.get(k) || 0) + 1); });
    const ok = [...c].filter(([, k]) => k >= n * 2).map(([d]) => d);
    if (!ok.length) return null;
    const d = rnd(ok); return { slots: Array(n).fill(m => (m.y || "").startsWith(d)), why: `Straight out of the ${d}0s.`, sortYear: true };
  }
}
function buildDay(n, style) {
  const U = style === "director" ? everything() : unseen();
  let best = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const plan = slotsFor(n, style, U); if (!plan) return null;
    plan.stateful?.clear?.();
    const chosen = [];
    for (const pred of plan.slots) {
      const opts = shuffle(U).filter(x => !chosen.includes(x) && x.m.rt >= 60);
      const pick = opts.find(x => pred(x.m)); if (!pick) break; chosen.push(pick);
    }
    if (chosen.length < n) continue;
    if (plan.sortYear) chosen.sort((a, b) => (a.m.y || "") < (b.m.y || "") ? -1 : 1);
    const total = chosen.reduce((s, x) => s + x.m.rt, 0) + 20 * (n - 1);
    const res = { films: chosen, why: plan.why, total, plan };
    if (!AD.cap || total <= AD.cap * 60) return res;
    if (!best || total < best.total) best = res;
  }
  if (best) best.over = true;
  return best;
}
let day = null;
function allDayer(double = false) {
  if (AD.start == null) AD.start = defaultStart();
  if (double) AD.n = 2;
  const v = view();
  const starts = []; for (let m = 600; m <= 1380; m += 30) starts.push(m);
  const genres = [...new Set(unseen().flatMap(x => x.m.g))].sort();
  v.innerHTML = `${header(double ? "double" : "allday")}
    <div class="aset">
      ${double ? "" : `<div class="fgroup"><h3>How many</h3><div class="chips">${[2, 3, 4, 5].map(n => `<button class="chip" data-n="${n}" aria-pressed="${AD.n === n}">${n} films</button>`).join("")}</div></div>
      <div class="fgroup"><h3>Style</h3><div class="chips">${STYLES.map(([k, l]) => `<button class="chip" data-st="${k}" aria-pressed="${AD.style === k}">${l}</button>`).join("")}</div>
        <div class="chips" id="adGenres" ${AD.style === "pick" ? "" : "hidden"}>${genres.map(g => `<button class="chip ${AD.genres.includes(g) ? "on" : ""}" data-g="${g}">${g}</button>`).join("")}</div></div>`}
      <div class="fgroup"><h3>Timing</h3><div class="row">
        <label>Starts <select id="adStart">${starts.map(m => `<option value="${m}" ${m === AD.start ? "selected" : ""}>${hhmm(m)}</option>`).join("")}</select></label>
        ${double ? "" : `<label>Fit it in <select id="adCap">${[[0, "no limit"], [5, "5 hours"], [6, "6 hours"], [8, "8 hours"], [10, "10 hours"], [12, "12 hours"]].map(([v, l]) => `<option value="${v}" ${v === AD.cap ? "selected" : ""}>${l}</option>`).join("")}</select></label>`}
      </div><p class="note">20 minutes between films for the kettle and the toilet.</p></div>
      <button class="play" id="adGo"><span class="tri"></span><span>${double ? "Pair them up" : "Print the listings"}</span></button>
    </div>
    <div id="adOut"></div>`;
  bindBack();
  v.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { AD.n = +b.dataset.n; C.snd.click(); allDayer(); });
  v.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { AD.style = b.dataset.st; C.snd.click(); allDayer(); });
  v.querySelectorAll("#adGenres [data-g]").forEach(b => b.onclick = () => { const g = b.dataset.g; AD.genres = AD.genres.includes(g) ? AD.genres.filter(x => x !== g) : [...AD.genres, g]; b.classList.toggle("on"); });
  $("#adStart").onchange = e => { AD.start = +e.target.value; if (day) renderDay(double); };
  if (!double) $("#adCap").onchange = e => { AD.cap = +e.target.value; };
  $("#adGo").onclick = () => {
    day = double ? buildPair() : buildDay(AD.n, AD.style);
    if (!day) { $("#adOut").innerHTML = empty("Not enough on your shelves for that. Try another style."); return; }
    C.snd.stab?.(); renderDay(double);
    setTimeout(() => $("#adOut").scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  if (day && day.double === double) renderDay(double);
}
function buildPair() {
  const U = unseen().filter(x => x.m.rt >= 60);
  for (let i = 0; i < 60; i++) {
    const a = rnd(U), others = U.filter(x => x !== a);
    let b = shuffle(others).find(x => x.m.dir.some(d => a.m.dir.includes(d))), why;
    if (b) why = `Both ${a.m.dir.find(d => b.m.dir.includes(d))}.`;
    if (!b) { b = shuffle(others).find(x => x.m.cast.slice(0, 3).some(c => a.m.cast.slice(0, 3).includes(c))); if (b) why = `${a.m.cast.find(c => b.m.cast.includes(c))} in both.`; }
    if (!b && i > 30) { b = shuffle(others).find(x => x.m.g[0] === a.m.g[0] && (x.m.y || "").slice(0, 3) === (a.m.y || "").slice(0, 3)); if (b) why = `Two ${a.m.g[0].toLowerCase()} films from the ${(a.m.y || "").slice(0, 3)}0s.`; }
    if (b) { const films = [a, b].sort((x, y) => (x.m.y || "") < (y.m.y || "") ? -1 : 1); return { films, why, total: a.m.rt + b.m.rt + 20, double: true }; }
  }
  return null;
}
function renderDay(double) {
  let t = AD.start;
  const rows = day.films.map((x, i) => { const s = t; t += x.m.rt + 20; return `<div class="lrow"><span class="ltime">${hhmm(s)}</span><span class="ltitle">${C.esc(x.m.t)}</span><span class="lmeta">${C.esc(x.m.y)} · ${C.fmtRt(x.m.rt)} · ${C.esc(x.m.g.slice(0, 2).join("/"))}</span>${double ? "" : `<button class="tag" data-swap="${i}">Swap</button>`}</div>`; }).join("");
  const end = t - 20;
  $("#adOut").innerHTML = `<div class="listings"><div class="lhead">TAKE ONE PICTURE HOUSE<small>${double ? "DOUBLE BILL" : "TODAY'S PROGRAMME"}</small></div>${rows}
    <div class="lfoot">${C.esc(day.why)} Finishes around ${hhmm(end)}.${day.over ? " Couldn't quite squeeze it in, so this is the shortest day on the shelves." : ""}</div></div>
    <div class="row center"><button class="play" id="adPlay"><span class="tri"></span><span>Start the first one</span></button><button class="ghost" id="adAgain">Reprint</button></div>`;
  day.double = double;
  $("#adOut").querySelectorAll("[data-swap]").forEach(b => b.onclick = () => {
    const i = +b.dataset.swap, pred = day.plan.slots[i];
    day.plan.stateful?.delete?.(day.films[i].m.g[0]);
    const pick = shuffle(unseen()).find(x => !day.films.includes(x) && x.m.rt >= 60 && (day.plan.stateful ? !day.films.some(f => f.m.g[0] === x.m.g[0]) : pred(x.m)));
    if (!pick) return C.toast("Nothing else fits that slot.");
    day.films[i] = pick; C.snd.click(); renderDay(double);
  });
  $("#adPlay").onclick = () => C.play(day.films, day.double ? "double" : "allday");
  $("#adAgain").onclick = () => $("#adGo").click();
}

// ---------- Knockout ----------
let ko = null;
function knockout() {
  const U = unseen(); if (U.length < 8) { view().innerHTML = header("knockout") + empty("Need at least 8 tapes on the shelf."); bindBack(); return; }
  ko = { round: shuffle(U).slice(0, 8), next: [], i: 0 };
  renderKo();
}
const RN = { 8: "Quarter-finals", 4: "Semi-finals", 2: "The final" };
function renderKo() {
  const v = view();
  if (ko.round.length === 1) {
    const w = ko.round[0];
    v.innerHTML = `${header("knockout")}<div class="champ"><span class="marker">Tonight's champion</span>${card(w)}</div>
      <div class="row center"><button class="play" id="koPlay"><span class="tri"></span><span>Put it on</span></button><button class="ghost" id="koAgain">New bracket</button></div>`;
    bindBack(); C.snd.stab?.();
    $("#koPlay").onclick = () => C.play([w], "knockout"); $("#koAgain").onclick = () => { C.snd.click(); knockout(); };
    return;
  }
  const a = ko.round[ko.i * 2], b = ko.round[ko.i * 2 + 1];
  const vs = x => { const p = C.posterOf(x.m, "w342"); return `<button class="kopick" data-w="${x.m.id}"><span class="kocover" style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : C.esc(x.m.t)}</span><span class="kot">${C.esc(x.m.t)}</span><span class="kom">${C.esc(x.m.y)} · ${C.fmtRt(x.m.rt)}</span></button>`; };
  v.innerHTML = `${header("knockout")}<div class="kohead"><span>${RN[ko.round.length]}</span><small>Match ${ko.i + 1} of ${ko.round.length / 2}</small></div>
    <div class="kovs">${vs(a)}<span class="kov">VS</span>${vs(b)}</div><p class="note center">Tap the one you'd rather watch tonight.</p>`;
  bindBack();
  v.querySelectorAll("[data-w]").forEach(btn => btn.onclick = () => {
    C.snd.click(); ko.next.push(+btn.dataset.w === a.m.id ? a : b); ko.i++;
    if (ko.i * 2 >= ko.round.length) { ko.round = ko.next; ko.next = []; ko.i = 0; }
    renderKo();
  });
}

// ---------- Swipe ----------
let sw = null;
function swipe() { sw = { left: shuffle(unseen()).slice(0, 60), yes: [], no: 0, w: {}, cur: null }; nextSwipe(); }
const feats = m => [...m.g.map(g => "g:" + g), "d:" + (m.y || "").slice(0, 3), "r:" + (m.rt < 95 ? "s" : m.rt < 130 ? "m" : "l"), "l:" + (m.l === "en" ? "en" : "sub")];
const swScore = m => feats(m).reduce((s, f) => s + (sw.w[f] || 0), 0);
function nextSwipe() {
  if (sw.yes.length >= 3 || !sw.left.length) return shortlist();
  const sc = sw.left.map(x => Math.exp(swScore(x.m) * 0.8)), tot = sc.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot, i = 0; while (r > sc[i] && i < sc.length - 1) { r -= sc[i]; i++; }
  sw.cur = sw.left.splice(i, 1)[0];
  const x = sw.cur, p = C.posterOf(x.m, "w342");
  view().innerHTML = `${header("swipe")}<div class="swhead"><span>${sw.yes.length} of 3 on the shortlist</span></div>
    <div class="swcard" id="swCard"><span class="swcover" style="${p ? `background-image:url('${p}')` : ""}">${p ? "" : C.esc(x.m.t)}</span>
    <span class="kot">${C.esc(x.m.t)}</span><span class="kom">${C.esc(x.m.y)} · ${C.fmtRt(x.m.rt)} · ${C.esc(x.m.g.slice(0, 2).join(" / "))}</span>
    <span class="swstamp yes">TONIGHT</span><span class="swstamp no">NAH</span></div>
    <div class="row center"><button class="ghost big" id="swNo">✕ Not tonight</button><button class="btn big" id="swYes">✓ Tonight</button></div>
    <p class="note center">Or swipe the tape left or right.</p>`;
  bindBack();
  const decide = yes => {
    feats(x.m).forEach(f => sw.w[f] = (sw.w[f] || 0) + (yes ? 1 : -0.5));
    if (yes) sw.yes.push(x); C.snd.click(); nextSwipe();
  };
  $("#swNo").onclick = () => decide(false); $("#swYes").onclick = () => decide(true);
  const el = $("#swCard"); let sx = null, dx = 0;
  el.addEventListener("pointerdown", e => { sx = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", e => { if (sx == null) return; dx = e.clientX - sx; el.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`; el.classList.toggle("lean-yes", dx > 40); el.classList.toggle("lean-no", dx < -40); });
  el.addEventListener("pointerup", () => { if (sx == null) return; sx = null; if (Math.abs(dx) > 80) decide(dx > 0); else { el.style.transform = ""; el.classList.remove("lean-yes", "lean-no"); } dx = 0; });
}
function shortlist() {
  const v = view();
  if (!sw.yes.length) { v.innerHTML = header("swipe") + empty("Nothing took your fancy. Fair enough.") + `<div class="row center"><button class="ghost" id="swAgain">Go again</button></div>`; bindBack(); $("#swAgain").onclick = swipe; return; }
  v.innerHTML = `${header("swipe")}<div class="kohead"><span>Your shortlist</span><small>Tap one, or let Rasher decide</small></div>
    <div class="list">${sw.yes.map(x => `<button class="pickbtn" data-id="${x.m.id}">${card(x)}</button>`).join("")}</div>
    <div class="row center"><button class="play" id="swRasher"><span class="tri"></span><span>Rasher decides</span></button><button class="ghost" id="swAgain">Go again</button></div>`;
  bindBack();
  v.querySelectorAll("[data-id]").forEach(b => b.onclick = () => C.play([sw.yes.find(x => x.m.id === +b.dataset.id)], "swipe"));
  $("#swRasher").onclick = () => { const best = sw.yes.slice().sort((a, b) => swScore(b.m) - swScore(a.m))[0]; C.play([best], "swipe") };
  $("#swAgain").onclick = () => { C.snd.click(); swipe(); };
}

// ---------- Chain ----------
let chain = null;
function startFilm() {
  const S = C.S;
  if (!S.house && S.dated && S.dated.length) { const m = S.dated[S.dated.length - 1].m; return { m }; }
  const log = S.seen.slice().sort((a, b) => (a.last || "") < (b.last || "") ? 1 : -1)[0];
  return log || rnd(S.bestFits.length ? S.bestFits : S.watchlist);
}
function chainGame() { chain = [{ it: startFilm(), via: null }]; renderChain(); }
function renderChain() {
  const cur = chain[chain.length - 1].it, used = new Set(chain.map(c => c.it.m.id));
  const pool = everything().filter(x => !used.has(x.m.id));
  const people = [...cur.m.dir.slice(0, 2).map(p => [p, "dir"]), ...cur.m.cast.slice(0, 4).map(p => [p, "cast"])];
  const opts = people.map(([p, k]) => { const ms = pool.filter(x => (k === "dir" ? x.m.dir : x.m.cast).includes(p)); const un = ms.filter(x => C.S.watchlist.includes(x)); return { p, k, ms: un.length ? un : ms }; });
  const path = chain.map((c, i) => `${i ? `<span class="via">→ ${C.esc(c.via)} →</span>` : ""}<span class="node">${C.esc(c.it.m.t)}</span>`).join("");
  view().innerHTML = `${header("chain")}<div class="chainpath">${path}</div>
    <p class="note">${chain.length === 1 ? "Starting from the last thing you watched." : "Keep following, or put this one on."}</p>${card(cur)}
    <div class="fgroup"><h3>Follow a thread</h3><div class="chips">${opts.map((o, i) => `<button class="chip" data-o="${i}" ${o.ms.length ? "" : "disabled"}>${o.k === "dir" ? "Dir. " : ""}${C.esc(o.p)} <b>${o.ms.length}</b></button>`).join("")}</div></div>
    <div class="row center">${chain.length > 1 ? `<button class="play" id="chPlay"><span class="tri"></span><span>Put this one on</span></button>` : ""}<button class="ghost" id="chReset">Start over</button></div>`;
  bindBack();
  view().querySelectorAll("[data-o]").forEach(b => b.onclick = () => { const o = opts[+b.dataset.o]; if (!o.ms.length) return; chain.push({ it: rnd(o.ms), via: o.p }); C.snd.click(); renderChain(); });
  const pl = $("#chPlay"); if (pl) pl.onclick = () => C.play([cur], "chain");
  $("#chReset").onclick = () => { C.snd.click(); chainGame(); };
}

// ---------- Spin the Globe ----------
let globeAll = false;
// Hand-drawn classroom globe. Rough continents in lon/lat, spun by sliding the map behind a round window.
const LAND = [
  [[-165,65],[-140,70],[-95,75],[-70,62],[-55,50],[-75,40],[-80,27],[-97,18],[-105,20],[-117,32],[-125,48],[-135,58],[-165,60]],
  [[-97,18],[-88,14],[-80,8],[-77,8],[-83,15],[-90,21]],
  [[-80,10],[-62,10],[-50,0],[-35,-7],[-40,-22],[-58,-38],[-68,-55],[-73,-45],[-71,-18],[-81,-5]],
  [[-55,60],[-45,60],[-20,72],[-30,83],[-60,80],[-70,77]],
  [[-10,36],[0,43],[-2,47],[5,52],[10,55],[5,62],[15,70],[30,71],[40,66],[40,50],[30,45],[25,36],[15,38],[10,44],[0,38]],
  [[-17,15],[-10,28],[0,35],[10,37],[32,31],[35,28],[43,12],[51,12],[40,-5],[40,-15],[32,-28],[20,-35],[13,-20],[9,0],[-8,5]],
  [[40,66],[60,70],[80,75],[110,77],[140,72],[170,68],[180,66],[160,60],[140,55],[135,43],[122,38],[122,30],[110,20],[105,10],[100,13],[95,18],[90,22],[80,15],[77,8],[72,20],[65,25],[57,25],[50,30],[48,28],[55,17],[45,12],[35,30],[30,45],[40,50]],
  [[115,-22],[122,-17],[131,-12],[137,-12],[142,-11],[146,-18],[153,-25],[150,-37],[140,-38],[132,-32],[115,-34]],
  [[130,32],[135,34],[141,38],[141,43],[138,38],[132,34]],
  [[-6,50],[2,51],[0,54],[-3,58],[-6,57],[-5,54]], [[-10,52],[-6,52],[-6,55],[-9,54]],
  [[95,5],[105,-6],[115,-8],[120,-5],[110,0]], [[172,-35],[178,-38],[174,-41],[168,-46],[167,-44]],
  [[44,-13],[50,-15],[48,-25],[44,-22]], [[-180,-72],[180,-72],[180,-90],[-180,-90]],
];
const SPOT = { US:[-98,39],GB:[-2,53],IE:[-8,53],FR:[2,46],DE:[10,51],IT:[12,43],ES:[-4,40],PT:[-8,39],NL:[5,52],BE:[4,51],DK:[10,56],SE:[16,62],NO:[9,61],FI:[26,63],IS:[-19,65],PL:[19,52],CZ:[15,50],HU:[19,47],AT:[14,47],CH:[8,47],GR:[22,39],RU:[60,58],UA:[31,49],TR:[35,39],IR:[53,32],IL:[35,31],EG:[30,27],MA:[-6,32],NG:[8,9],ZA:[24,-29],SN:[-14,14],IN:[78,22],CN:[104,35],HK:[114,22],TW:[121,24],JP:[138,37],KR:[128,36],TH:[101,15],PH:[122,12],ID:[118,-2],AU:[134,-25],NZ:[172,-41],CA:[-100,57],MX:[-102,23],CU:[-79,22],BR:[-52,-10],AR:[-64,-34],CL:[-71,-33],CO:[-74,4],PE:[-75,-9],VE:[-66,7],SU:[60,58],XG:[10,51],YU:[20,44],RS:[20,44],RO:[25,46],BG:[25,43],LB:[36,34],PS:[35,32],SA:[45,24],AE:[54,24],KZ:[67,48],MN:[103,47],VN:[106,16],MY:[102,4],SG:[104,1],PK:[70,30],BD:[90,24],LK:[81,8],GE:[44,42],AM:[45,40],EE:[25,59],LV:[25,57],LT:[24,55],SK:[19,49],SI:[15,46],HR:[16,45],BA:[18,44],MK:[22,42],AL:[20,41],CY:[33,35],MT:[14,36],LU:[6,50],TN:[9,34],DZ:[3,28],ET:[39,8],KE:[38,0],GH:[-1,8],CM:[12,6],CD:[23,-3],BO:[-64,-17],UY:[-56,-33],PY:[-58,-23],EC:[-78,-1],JM:[-77,18],PR:[-66,18],DO:[-70,19],GT:[-90,15],CR:[-84,10],PA:[-80,9],QA:[51,25],IQ:[44,33],SY:[38,35],JO:[36,31],AF:[66,34],NP:[84,28],KH:[105,12],MM:[96,21] };
const GK = 0.9, GW = 360 * GK;
function landPaths(dx) { return LAND.map(poly => `<path d="M${poly.map(([lo, la]) => `${((lo + 180) * GK + dx).toFixed(1)} ${((90 - la) * GK).toFixed(1)}`).join("L")}Z"/>`).join(""); }
function globeSVG() {
  const lines = [30, 60, 90, 120, 150].map(y => `<line x1="0" x2="${GW * 2}" y1="${y * GK}" y2="${y * GK}"/>`).join("") + Array.from({ length: 24 }, (_, i) => `<line y1="0" y2="${180 * GK}" x1="${i * 30 * GK}" x2="${i * 30 * GK}"/>`).join("");
  return `<svg viewBox="0 0 220 250" class="deskglobe" aria-hidden="true">
    <defs><clipPath id="gclip"><circle cx="110" cy="105" r="78"/></clipPath>
      <radialGradient id="gshade" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
      <linearGradient id="gbrass" x1="0" x2="1"><stop offset="0" stop-color="#7a5a22"/><stop offset=".5" stop-color="#d8b25a"/><stop offset="1" stop-color="#6b4c1a"/></linearGradient>
      <linearGradient id="gwood" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6a3c1e"/><stop offset="1" stop-color="#341b0c"/></linearGradient></defs>
    <ellipse cx="110" cy="236" rx="62" ry="10" fill="url(#gwood)" stroke="#1d0f06"/><rect x="104" y="196" width="12" height="40" fill="url(#gbrass)"/>
    <g transform="rotate(-18 110 105)">
      <g clip-path="url(#gclip)"><rect x="20" y="20" width="180" height="180" fill="#3f7f8c"/>
        <g id="gmap" transform="translate(0 ${105 - 90 * GK})"><g class="gl">${lines}</g><g class="gland">${landPaths(0)}${landPaths(GW)}</g></g>
        <g id="gpin" opacity="0"><line x1="110" y1="0" x2="110" y2="-14" stroke="#222" stroke-width="1.6"/><circle cx="110" cy="-16" r="5" fill="#e3261d" stroke="#5c0805"/></g>
        <circle cx="110" cy="105" r="78" fill="url(#gshade)"/></g>
      <circle cx="110" cy="105" r="78" fill="none" stroke="#1d2a2c" stroke-width="2"/>
      <path d="M110 17 A88 88 0 0 1 110 193" fill="none" stroke="url(#gbrass)" stroke-width="7"/>
      <circle cx="110" cy="17" r="4" fill="#d8b25a" stroke="#5a3f12"/><circle cx="110" cy="193" r="4" fill="#d8b25a" stroke="#5a3f12"/></g>
    <path d="M60 238 q50 -14 100 0" fill="none" stroke="rgba(255,255,255,.12)"/></svg>`;
}
let gx = 0;
function setGlobe(x, pinLat) {
  gx = x;
  const m = ((x % GW) + GW) % GW, p = m < GW / 2 ? m + GW : m;
  $("#gmap").setAttribute("transform", `translate(${(110 - p).toFixed(1)} ${105 - 90 * GK})`);
  const pin = $("#gpin");
  if (pinLat != null) { pin.setAttribute("transform", `translate(0 ${105 - pinLat * GK})`); pin.setAttribute("opacity", 1); } else pin.setAttribute("opacity", 0);
}
function globe() {
  view().innerHTML = `${header("globe")}<div class="globewrap">${globeSVG()}</div>
    <div class="country" id="country">Give it a spin</div>
    <div class="row center"><button class="play" id="spin"><span class="tri"></span><span>Spin it</span></button></div>
    <label class="tog center"><input type="checkbox" id="globeAll" ${globeAll ? "checked" : ""}> Include the US and UK</label>
    <div id="globeOut"></div>`;
  bindBack(); setGlobe(gx || (8 + 180) * GK, null);
  $("#globeAll").onchange = e => globeAll = e.target.checked;
  let busy = false;
  $("#spin").onclick = () => {
    if (busy) return;
    const U = unseen(), by = new Map();
    U.forEach(x => x.m.c.slice(0, 2).forEach(c => { if (!globeAll && (c === "US" || c === "GB")) return; if (!by.has(c)) by.set(c, []); by.get(c).push(x); }));
    const cs = [...by.keys()]; if (!cs.length) { $("#globeOut").innerHTML = empty("Nothing from abroad on your shelves."); return; }
    const c = rnd(cs), x = rnd(by.get(c)), spot = SPOT[c] || [Math.random() * 360 - 180, 20];
    busy = true; $("#globeOut").innerHTML = ""; $("#country").textContent = "…"; setGlobe(gx, null);
    const from = gx, cur = ((from % GW) + GW) % GW, want = (spot[0] + 180) * GK;
    const to = from + (GW * 2 + ((want - cur + GW) % GW));
    const dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 2400, t0 = performance.now(); let lastTick = from;
    (function f(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3), xx = from + (to - from) * e;
      setGlobe(xx, null);
      if (xx - lastTick > 24) { lastTick = xx; C.snd.tick?.(0.9 + Math.random() * .3); }
      if (k < 1) requestAnimationFrame(f); else { setGlobe(to, spot[1]); landed(); }
    })(t0);
    function landed() {
      busy = false; $("#country").textContent = C.region(c); C.snd.stab?.();
      $("#globeOut").innerHTML = `${card(x, `<div class="note">${by.get(c).length} film${by.get(c).length > 1 ? "s" : ""} from ${C.esc(C.region(c))} on your shelf</div>`)}<div class="row center"><button class="play" id="gPlay"><span class="tri"></span><span>Put it on</span></button></div>`;
      $("#gPlay").onclick = () => C.play([x], "globe");
    }
  };
}

// ---------- Bargain Bin ----------
const BIN_INK = ["#b3150e", "#1d3d8f", "#f2c230", "#24573f", "#5b1a50", "#e86a17", "#0f5e7a", "#111214", "#f2efe6"];
function binTapes(list) {
  return list.map((x, i) => {
    const h = ((x.m.id * 2654435761) >>> 0), ink = BIN_INK[h % BIN_INK.length], r = (h >>> 5) % 50 - 25, l = 1 + (i % 4) * 24 + ((h >>> 9) % 6), t = Math.floor(i / 4) * 30 + ((h >>> 13) % 10);
    return `<span class="btape" data-i="${i}" style="left:${l}%;top:${t}px;transform:rotate(${r}deg);--ink:${ink}"><em>${C.esc(x.m.t)}</em></span>`;
  }).join("");
}
function bargain() {
  const U = unseen().filter(x => x.m.vc >= 0).sort((a, b) => a.m.vc - b.m.vc);
  const bin = U.slice(0, Math.max(12, Math.round(U.length * 0.12)));
  let shown = shuffle(bin).slice(0, 10);
  view().innerHTML = `${header("bargain")}<div class="bin2"><div class="bintapes" id="binTapes">${binTapes(shown)}</div><div class="binwire"></div><span class="binsign">BARGAIN BIN<br><b>€1</b><small>NO REFUNDS</small></span></div>
    <div class="row center"><button class="play" id="rummage"><span class="tri"></span><span>Rummage</span></button></div><div id="binOut"></div>`;
  bindBack();
  $("#rummage").onclick = () => {
    const box = $("#binTapes"); box.classList.remove("rummage"); void box.offsetWidth; box.classList.add("rummage");
    C.snd.clunk?.(); setTimeout(() => C.snd.tick?.(1.1), 160); setTimeout(() => C.snd.tick?.(.9), 320);
    const x = rnd(bin);
    setTimeout(() => {
      shown = [x, ...shuffle(bin.filter(y => y !== x)).slice(0, 9)];
      box.innerHTML = binTapes(shown); box.querySelector('[data-i="0"]').classList.add("pulled");
      $("#binOut").innerHTML = `${card(x, `<div class="note">Only ${x.m.vc.toLocaleString()} people have ever rated this. Brave.</div>`)}<div class="row center"><button class="play" id="bPlay"><span class="tri"></span><span>Take a chance</span></button><button class="ghost" id="bAgain">Rummage again</button></div>`;
      $("#bPlay").onclick = () => C.play([x], "bargain"); $("#bAgain").onclick = () => $("#rummage").click();
    }, 520);
  };
}

// ---------- More Like This / Blend ----------
const idfCache = { S: null, idf: null };
function idf() {
  if (idfCache.S === C.S) return idfCache.idf;
  const c = new Map(), all = everything(); all.forEach(x => (x.m.kw || []).forEach(k => c.set(k, (c.get(k) || 0) + 1)));
  const n = all.length || 1, f = k => Math.log(1 + n / (1 + (c.get(k) || 0)));
  idfCache.S = C.S; idfCache.idf = f; return f;
}
function sim(a, b) {
  const f = idf(); let s = 0; const why = [];
  const kw = (a.kw || []).filter(k => (b.kw || []).includes(k) && !/stinger|woman director|based on novel/.test(k));
  s += Math.min(6, kw.reduce((t, k) => t + f(k), 0)) * 0.6;
  const d = a.dir.find(x => b.dir.includes(x)); if (d) { s += 3; why.push(`same director as ${a.t} (${d})`); }
  const c = a.cast.slice(0, 5).filter(x => b.cast.slice(0, 5).includes(x)); s += c.length; if (c.length && !d) why.push(`${c[0]}, like in ${a.t}`);
  s += a.g.filter(g => b.g.includes(g)).length * 0.5;
  if ((a.y || "").slice(0, 3) && (a.y || "").slice(0, 3) === (b.y || "").slice(0, 3)) s += 0.4;
  const rec = (a.recs || []).includes(b.id) || (a._rel || []).includes(b.id);
  if (rec) s += 1.5;
  if ((b.recs || []).includes(a.id)) s += 1;
  const vib = Object.entries(C.vibes || {}).filter(([, ws]) => ws.some(w => (a.kw || []).includes(w)) && ws.some(w => (b.kw || []).includes(w))).map(([k]) => k);
  if (!why.length && vib.length) why.push(`same ${C.vibeName(vib[0]).toLowerCase()} feel as ${a.t}`);
  if (!why.length && kw.length) why.push(`${kw.slice(0, 2).join(", ")}, like ${a.t}`);
  if (!why.length && rec) why.push(`comes up off ${a.t}`);
  return { s, why };
}
const seenIds = () => new Set(C.S.seen.map(s => s.m.id));
let ml = { seed: null, any: true, out: null }, bl = { seeds: [], any: true, out: null };
function searchBox(id, ph) {
  return `<div class="sbox"><input id="${id}" type="search" placeholder="${ph}" autocomplete="off"><div class="sugs" id="${id}S"></div></div>`;
}
function bindSearch(id, onPick) {
  const inp = $("#" + id), box = $("#" + id + "S"); let t = null, seq = 0;
  inp.oninput = () => {
    clearTimeout(t); const q = inp.value.trim().toLowerCase(); if (q.length < 2) { box.innerHTML = ""; return; }
    const local = []; const seen = new Set();
    for (const x of everything().concat(C.S.seen)) if (x.m.t.toLowerCase().includes(q) && !seen.has(x.m.id)) { seen.add(x.m.id); local.push(x.m); if (local.length >= 5) break; }
    const show = list => { box.innerHTML = list.map((m, i) => `<button class="sug" data-i="${i}">${C.esc(m.t)} <small>${C.esc((m.y || m.release_date || "").slice(0, 4))}</small></button>`).join(""); box.querySelectorAll(".sug").forEach(b => b.onclick = () => { box.innerHTML = ""; inp.value = ""; onPick(list[+b.dataset.i]); }); };
    show(local);
    const my = ++seq;
    t = setTimeout(async () => {
      try {
        const r = await C.api.search(q); if (my !== seq) return;
        const ids = new Set(local.map(m => m.id));
        const more = (r?.results || []).filter(x => !ids.has(x.id)).slice(0, 6 - Math.min(local.length, 3)).map(x => ({ id: x.id, t: x.title, y: (x.release_date || "").slice(0, 4), remote: true }));
        show(local.slice(0, 3).concat(more));
      } catch { }
    }, 350);
  };
}
async function full(m) {
  if (!m.remote && m.kw) return m;
  const local = everything().concat(C.S.seen).find(x => x.m.id === m.id); if (local) return local.m;
  return await C.api.details(m.id);
}
async function candidatesAny(seed) {
  const r = await C.api.related(seed.id);
  seed._rel = [...(r?.recommendations?.results || []), ...(r?.similar?.results || [])].map(x => x.id);
  return [...new Set([...(r?.recommendations?.results || []), ...(r?.similar?.results || [])].map(x => x.id))];
}
async function fetchAll(ids, n = 6) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < ids.length) { const id = ids[i++]; try { const d = await C.api.details(id); if (d) out.push(d); } catch { } } }));
  return out;
}
const resultCards = (list) => list.map((r, i) => `${card({ m: r.m }, `<ul class="why talker">${r.why.slice(0, 2).map(w => `<li>${C.esc(w.charAt(0).toUpperCase() + w.slice(1))}</li>`).join("")}</ul>
  <div class="acts"><button class="tag hot" data-play="${i}">Put it on</button><a class="tag" href="https://letterboxd.com/tmdb/${r.m.id}/" target="_blank" rel="noopener">Letterboxd</a></div>`)}`).join("");
function anyToggle(id, on) { return `<div class="seg keys mini" role="group" aria-label="Where from"><button data-any="0" aria-pressed="${!on}">Your shelves</button><button data-any="1" aria-pressed="${on}">Any film</button></div>`; }

export function moreLike(m) { ml.seed = m; ml.out = null; moreLikeView(); scrollTo(0, 0); }
function moreLikeView() {
  const v = view();
  v.innerHTML = `${header("morelike")}
    <div class="fgroup"><h3>More like…</h3>${ml.seed ? `<div class="seedchips"><span class="seed">${C.esc(ml.seed.t)} <small>${C.esc(ml.seed.y || "")}</small></span><button class="tag" id="mlClear">Change</button></div>` : searchBox("mlQ", "Type any film you love")}
    ${anyToggle("ml", ml.any)}</div>
    <div id="mlOut">${ml.out || ""}</div>`;
  bindBack();
  if (!ml.seed) bindSearch("mlQ", m => { ml.seed = m; ml.out = null; moreLikeView(); runMoreLike(); });
  else { $("#mlClear").onclick = () => { ml.seed = null; ml.out = null; moreLikeView(); }; if (!ml.out) runMoreLike(); }
  v.querySelectorAll("[data-any]").forEach(b => b.onclick = () => { ml.any = b.dataset.any === "1"; ml.out = null; C.snd.click(); moreLikeView(); });
  bindPlays(ml);
}
async function runMoreLike() {
  const out = $("#mlOut"); out.innerHTML = `<p class="note center blinkish">Rasher's having a look…</p>`;
  const seed = await full(ml.seed); if (!seed) { out.innerHTML = empty("Couldn't find that one."); return; }
  ml.seed = seed; const seen = seenIds(); let cands;
  if (ml.any) { const ids = (await candidatesAny(seed)).filter(id => !seen.has(id) && id !== seed.id).slice(0, 30); cands = (await fetchAll(ids)).map(m => ({ m })); }
  else cands = unseen().filter(x => x.m.id !== seed.id);
  const q = m => (m.vc >= 50 ? (m.va - 6.5) * 0.8 : -0.5) + Math.min(Math.log10((m.vc || 0) + 1), 4) * 0.25;
  const ranked = cands.map(x => { const r = sim(seed, x.m); return { m: x.m, s: r.s + q(x.m), why: r.why.length ? r.why : [`in the same spirit as ${seed.t}`] }; }).sort((a, b) => b.s - a.s).slice(0, 6);
  ml.list = ranked; ml.out = ranked.length ? resultCards(ranked) : empty("Nothing close enough. Try Any film.");
  if (view().querySelector("#mlOut")) { $("#mlOut").innerHTML = ml.out; bindPlays(ml); }
}
function bindPlays(st) { view().querySelectorAll("[data-play]").forEach(b => b.onclick = () => C.play([{ m: st.list[+b.dataset.play].m, src: "wl" }], "list")); }

function blendView() {
  const v = view();
  v.innerHTML = `${header("blend")}
    <div class="fgroup"><h3>The films <em>2 to 4, yours and a mate's</em></h3>
      <div class="seedchips">${bl.seeds.map((m, i) => `<span class="seed">${C.esc(m.t)} <small>${C.esc(m.y || "")}</small><button class="x" data-rm="${i}" aria-label="Remove">×</button></span>`).join("")}</div>
      ${bl.seeds.length < 4 ? searchBox("blQ", bl.seeds.length ? "Add another" : "Type a film") : ""}
      ${anyToggle("bl", bl.any)}</div>
    <button class="play" id="blGo" ${bl.seeds.length < 2 ? "disabled" : ""}><span class="tri"></span><span>Blend them</span></button>
    <div id="blOut">${bl.out || ""}</div>`;
  bindBack();
  if (bl.seeds.length < 4) bindSearch("blQ", async m => { const f = await full(m); if (f && !bl.seeds.some(s => s.id === f.id)) bl.seeds.push(f); bl.out = null; C.snd.click(); blendView(); setTimeout(() => $("#blQ")?.focus(), 30); });
  v.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { bl.seeds.splice(+b.dataset.rm, 1); bl.out = null; blendView(); });
  v.querySelectorAll("[data-any]").forEach(b => b.onclick = () => { bl.any = b.dataset.any === "1"; bl.out = null; C.snd.click(); blendView(); });
  $("#blGo").onclick = runBlend;
  bindPlays(bl);
}
async function runBlend() {
  const out = $("#blOut"); out.innerHTML = `<p class="note center">Rasher's working out what links them…</p>`;
  const seeds = bl.seeds, seen = seenIds(), sids = new Set(seeds.map(s => s.id));
  let cands;
  if (bl.any) {
    const counts = new Map();
    for (const s of seeds) (await candidatesAny(s)).forEach((id, r) => { if (!seen.has(id) && !sids.has(id)) counts.set(id, (counts.get(id) || 0) + 1 + (20 - Math.min(r, 20)) / 40); });
    const ids = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id]) => id);
    cands = (await fetchAll(ids)).map(m => ({ m }));
  } else cands = unseen().filter(x => !sids.has(x.m.id));
  const ranked = cands.map(x => {
    const rs = seeds.map(s => sim(s, x.m)), mn = Math.min(...rs.map(r => r.s)), avg = rs.reduce((t, r) => t + r.s, 0) / rs.length;
    const why = rs.map(r => r.why[0]).filter(Boolean);
    const qq = (x.m.vc >= 50 ? (x.m.va - 6.5) * 0.8 : -0.5) + Math.min(Math.log10((x.m.vc || 0) + 1), 4) * 0.25;
    return { m: x.m, s: mn * 1.5 + avg + qq, why: why.length ? why : ["sits right between them"] };
  }).sort((a, b) => b.s - a.s).slice(0, 3);
  bl.list = ranked; bl.out = ranked.length ? `<p class="note">Rasher's top three for ${seeds.map(s => C.esc(s.t)).join(" + ")}:</p>` + resultCards(ranked) : empty("Couldn't find a link. Try Any film.");
  if (view().querySelector("#blOut")) { $("#blOut").innerHTML = bl.out; bindPlays(bl); }
}

const GAMES = { morelike: () => { ml = { seed: null, any: ml.any, out: null }; moreLikeView(); }, blend: () => { bl.out = null; blendView(); }, allday: () => allDayer(false), double: () => allDayer(true), knockout, swipe, chain: chainGame, globe, bargain, group: () => C.group(view(), header("group"), bindBack) };
