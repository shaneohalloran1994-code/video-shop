// Rasher, the clerk. Picks what he says, remembers what he said lately, and keeps quiet when asked.
import { LINES } from "./lines.js?v=r2";
import { prefs } from "./store.js?v=r2";
import { QUOTES } from "./quotes.js?v=r2";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

export const quiet = () => prefs.get("quiet", false);
export function setQuiet(v) { prefs.set("quiet", !!v); if (v) hideSlip(); }

// Recently used lines, so he doesn't repeat himself.
let recent = prefs.get("rsaid", []);
function remember(t) { recent = [t, ...recent.filter(x => x !== t)].slice(0, 40); prefs.set("rsaid", recent); }
function pickFrom(list, seed) {
  if (!list || !list.length) return "";
  if (seed != null) return list[(seed * 2654435761 >>> 0) % list.length];
  const fresh = list.filter(t => !recent.includes(t));
  const from = fresh.length ? fresh : list.filter(t => t !== recent[0]);
  const t = (from.length ? from : list)[Math.floor(Math.random() * (from.length || list.length))];
  remember(t); return t;
}
const fill = (t, ctx = {}) => t.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? "");

// A line for a moment. Returns "" in quiet mode (except shop signage, which isn't him talking).
export function line(moment, ctx = {}, opts = {}) {
  if (quiet() && !opts.always) return "";
  let list = LINES[moment];
  if (ctx.year == null) list = (list || []).filter(t => !t.includes("{year}")).length ? (list || []).filter(t => !t.includes("{year}")) : list;
  return fill(pickFrom(list, opts.seed), ctx);
}

// Now and then he quotes a film instead of talking. Never the one you're about to watch.
export function quote(tag, notFilm = "") {
  if (quiet()) return "";
  const list = QUOTES.filter(x => x.tag === tag && x.film !== notFilm).map(x => `“${x.q}” — ${x.film}`);
  return list.length ? pickFrom(list) : "";
}
// Which bank fits a film that's just landed.
const GENRE = { Horror: "g_horror", Comedy: "g_comedy", Romance: "g_romance", "Science Fiction": "g_scifi", Western: "g_western", War: "g_war", Documentary: "g_doc", Animation: "g_animation", Crime: "g_crime", Thriller: "g_thriller", Mystery: "g_mystery", Drama: "g_drama" };
const DIR_ALIAS = { "Ethan Coen": "Joel Coen", "Benny Safdie": "Josh Safdie" };
export function landLine(m, c = {}) {
  if (quiet()) return "";
  if (c.shame) return line("shame", { year: c.year });
  if (c.arcade) return line(LINES["arc_" + c.arcade] ? "arc_" + c.arcade : "arc");
  if (c.rewatch && Math.random() < .5) return line("rewatch");
  if (c.three) return line("land_three");
  // Special shelves and the small hours get their own lines more often than not.
  const shelf = { shock: "shock", back: "backroom", irish: "irish" }[c.pool];
  if (shelf && LINES[shelf] && Math.random() < .6) return line(shelf);
  if (c.late && (m.g || []).includes("Horror") && Math.random() < .6) return line("horror_late");
  const dirs = m.dir || [], roll = Math.random();
  if (c.mood === "hangover" && roll < .35) return quote("hangover", m.t) || line("land");
  if (c.mood === "date" && roll < .25) return quote("date", m.t) || line("land");
  if (dirs.includes("Francis Ford Coppola") && roll < .5) return quote("godfather", m.t) || line("land");
  if ((m.l === "it" || (m.c || []).includes("IT")) && roll < .4) return quote("italian", m.t) || line("land");
  if ((m.c || []).some(x => x === "CZ" || x === "XC") && roll < .4) return quote("czech", m.t) || line("land");
  if ((m.g || []).includes("Western") && roll < .3) return quote("western", m.t) || line("g_western");
  if (dirs.includes("John Carpenter") && roll < .45) return quote("carpenter", m.t) || line("d_John Carpenter");
  if ((dirs.includes("Joel Coen") || dirs.includes("Ethan Coen")) && roll < .45) return quote("coen", m.t) || line("d_Joel Coen");
  if (dirs.includes("Richard Linklater") && roll < .3) return quote("linklater", m.t) || line("d_Richard Linklater");
  if (c.blind) return line("blind");
  const d = (m.dir || []).map(x => DIR_ALIAS[x] || x).find(x => LINES["d_" + x]);
  if (d && !recent.includes(LINES["d_" + d][0])) return line("d_" + d);
  if (c.late && Math.random() < .5) return line("land_late");
  // Drama is on half the shelf, so it only counts when it's the film's main genre.
  const g = (m.g || []).filter((x, i) => x !== "Drama" || i === 0).map(x => GENRE[x]).filter(Boolean).find(k => LINES[k].some(t => !recent.includes(t)));
  if (g && Math.random() < .4) return line(g);
  return line("land");
}

// What he says when a tape comes back. guess is his number; in the house shop it's his own rating.
export function verdict(rating, guess, prev, m) {
  if (rating == null) return "";
  const d = rating - guess;
  if (quiet()) return Math.abs(d) <= .5 ? "Right where the guess was." : d > 0 ? "Higher than the guess." : "Lower than the guess.";
  if (rating === 0.5) return "Yeah, well, that's just, like, your opinion, man.";
  if (rating === 5 && guess <= 3.5) return "Alright, alright, alright.";
  if (rating >= 4.5 && (m.dir || []).includes("John Carpenter")) return "Carpenter never misses.";
  if (prev != null && Math.abs(d) <= .5) return line("rewatch");
  if (Math.abs(d) <= .5) return (Math.random() < .3 && quote("rate_called")) || line("rate_called");
  if (d > 0) return line("rate_surprise");
  if (guess >= 4 && d <= -1) return line("rate_he_loved");
  return (Math.random() < .3 && quote("rate_low")) || line("rate_low");
}

// ---------- drawings (hand-drawn SVG, no images) ----------
const SLEEVE = `<defs><pattern id="rcheck" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#6b2d22"/><rect width="4" height="8" fill="#7f3a2b"/><rect width="8" height="3" y="2" fill="#4a1d17" opacity=".7"/><rect width="1" height="8" x="6" fill="#c9a36b" opacity=".35"/></pattern></defs>`;
export const HAND = `<svg class="r-hand" viewBox="0 0 220 70" aria-hidden="true">${SLEEVE}
  <g class="r-tape"><rect x="4" y="16" width="86" height="40" rx="3" fill="#121214" stroke="#000"/><rect x="12" y="22" width="70" height="14" rx="1.5" fill="#f2efe6"/><path d="M16 27h40M16 31h28" stroke="#b3150e" stroke-width="1.6" stroke-linecap="round"/><circle cx="30" cy="46" r="5" fill="#2a2a2e"/><circle cx="64" cy="46" r="5" fill="#2a2a2e"/></g>
  <g class="r-arm"><path d="M84 30c8-4 18-6 24-4l8 2c3 1 3 5 0 6l-12 1 22 2c3 0 3 5 0 5l-22 1 20 2c3 0 3 5 0 5l-19 0 15 2c3 0 3 4 0 5c-8 1-20 1-30-1c-6-1-9-4-10-8z" fill="#e8b996" stroke="#5a3a2a" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M92 26c4-6 12-9 18-8c2 0 3 3 1 4c-5 2-9 5-11 8" fill="#e8b996" stroke="#5a3a2a" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M120 22h110v40H120c-6-6-8-14-6-22c1-8 3-14 6-18z" fill="url(#rcheck)" stroke="#2a110d" stroke-width="1.4"/><path d="M121 23c-4 6-6 13-5 20c1 7 3 13 6 18" fill="none" stroke="#2a110d" stroke-width="3" opacity=".5"/></g></svg>`;
export const HEAD = `<svg class="r-head" viewBox="0 0 120 110" aria-hidden="true">${SLEEVE}<defs><radialGradient id="rglow"><stop offset="0" stop-color="#ffb547" stop-opacity=".55"/><stop offset="1" stop-color="#ffb547" stop-opacity="0"/></radialGradient></defs>
  <circle cx="60" cy="52" r="56" fill="url(#rglow)"/>
  <rect x="49" y="64" width="22" height="20" rx="6" fill="#7a5038" stroke="#3a2418" stroke-width="1.2"/>
  <path d="M6 110c2-22 22-31 54-31s52 9 54 31z" fill="url(#rcheck)" stroke="#2a110d" stroke-width="1.5"/>
  <path d="M42 81q18 9 36 0" fill="none" stroke="#2a110d" stroke-width="2.2"/>
  <path d="M24 52C20 24 38 8 60 8s40 16 36 44c-1 10-3 19-7 24l-4-2-3 4-5-3-4 4-5-3-4 4-5-3-4 4-5-3-4 4-4-3-4 2c-7-6-11-13-12-21z" fill="#3b2617" stroke="#1b110a" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M60 12c-3 14-2 30 1 46M48 14c-6 12-8 28-5 44M72 14c6 12 8 28 4 44M38 22c-6 10-8 24-6 36M83 22c6 10 7 24 5 36M54 30c-1 10 0 22 2 32M67 30c1 10 0 22-2 32" fill="none" stroke="#6b4a2c" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M25 48C22 18 42 3 60 3s38 15 35 45" fill="none" stroke="#151518" stroke-width="5" stroke-linecap="round"/>
  <rect x="15" y="38" width="15" height="25" rx="6" fill="#1d1d22" stroke="#000"/><rect x="90" y="38" width="15" height="25" rx="6" fill="#1d1d22" stroke="#000"/>
  <rect x="18" y="43" width="4" height="15" rx="2" fill="#ff3ea5" opacity=".9"/><rect x="98" y="43" width="4" height="15" rx="2" fill="#ff3ea5" opacity=".9"/>
  <path d="M98 63c5 12 5 26-3 40" fill="none" stroke="#151518" stroke-width="2"/></svg>`;

// ---------- the counter slip under the telly ----------
function hideSlip() { const s = $("#rasher"); if (s) s.hidden = true; }
// A hand seen from above, flat on the box, pushing it across the counter.
export const HAND2 = `<svg class="r-hand2" viewBox="0 0 230 110" aria-hidden="true">${SLEEVE}
  <g stroke="#4a2c1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" fill="#eab894">
    <rect x="18" y="20" width="66" height="15" rx="7.5"/><rect x="12" y="37" width="74" height="15" rx="7.5"/><rect x="16" y="54" width="70" height="15" rx="7.5"/><rect x="26" y="71" width="60" height="14" rx="7"/>
    <path d="M70 18 C98 8 126 14 136 30 C142 50 141 70 134 84 C114 99 88 97 70 88 Z"/><path d="M84 36 C96 32 110 33 120 38" fill="none" stroke="#c98d6a"/>
    <path d="M86 86 C76 96 62 102 50 100 C44 99 44 92 50 90 C60 87 70 82 76 76"/>
  </g>
  <path d="M30 27h8M26 44h8M30 61h8M38 78h7" stroke="#c98d6a" stroke-width="2" stroke-linecap="round"/>
  <path d="M132 16 L230 10 L230 100 L134 94 C128 70 128 40 132 16Z" fill="url(#rcheck)" stroke="#2a110d" stroke-width="2"/>
  <path d="M132 16 C127 40 127 70 134 94" fill="none" stroke="#2a110d" stroke-width="7" opacity=".45"/></svg>`;
export function slip(text, hand = false, film = null) {
  const s = $("#rasher"); if (!s) return;
  if (!text) { s.hidden = true; return; }
  s.hidden = false;
  s.classList.remove("dealt"); s.classList.toggle("pinned", hand);
  s.innerHTML = `<p class="said"><b>Rasher</b>${esc(text)}</p>`;
  s.classList.remove("slide"); void s.offsetWidth;
  if (hand && !RM) s.classList.add("slide");
}

// ---------- first visit: Rasher shows you round ----------
export function welcome({ steps, done, back }) {
  if (quiet()) { done && done(); return; }
  let i = 0; const y0 = scrollY;
  const box = document.createElement("div"); box.className = "rtour"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Rasher shows you round");
  document.body.append(box);
  const clear = () => document.querySelectorAll(".rspot").forEach(e => e.classList.remove("rspot"));
  function show() {
    clear();
    const st = steps[i]; st.before && st.before();
    const el = st.at ? $(st.at) : null;
    if (el) { el.classList.add("rspot"); if (getComputedStyle(el).position !== "fixed") scrollTo({ top: scrollY + el.getBoundingClientRect().top - 110, behavior: RM ? "auto" : "smooth" }); }
    box.innerHTML = `<div class="rcard">${HEAD}<p class="said"><b>Rasher</b>${esc(st.text)}</p>
      <div class="row">${st.action ? `<button class="tag hot" id="rAct">${esc(st.action.label)}</button>` : ""}<button class="tag ${st.action ? "" : "hot"}" id="rNext">${st.action ? (st.action.later || "Later") : i < steps.length - 1 ? "Go on" : "Grand"}</button>${i < steps.length - 1 && !st.action ? `<button class="tag" id="rSkip">Skip</button>` : ""}<span class="rcount">${i + 1}/${steps.length}</span></div></div>`;
    box.querySelector("#rNext").onclick = () => { i++; if (i >= steps.length) end(); else show(); };
    const act = box.querySelector("#rAct"); if (act) act.onclick = () => { end(); st.action.fn(); };
    const sk = box.querySelector("#rSkip"); if (sk) sk.onclick = end;
    box.querySelector("#rNext").focus();
  }
  function end() { clear(); box.remove(); prefs.set("welcomed", true); if (back) scrollTo({ top: y0, behavior: RM ? "auto" : "smooth" }); done && done(); }
  show();
}
