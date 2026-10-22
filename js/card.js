// The membership card: every tape you take home gets a date stamp; checking it back in records how it was.
// Ten stamps fill a card; full cards stack up underneath as your rental history. Lives on this phone only.
import * as store from "./store.js?v=r2";

const SLOTS = 10, NIGHTS = 3, ASK_AFTER = 2 * 36e5;
let card = null;
const blank = () => ({ no: String(10000 + Math.floor(Math.random() * 89999)), since: new Date().toISOString(), stamps: [], old: [] });
export async function load() { if (!card) card = (await store.get("card")) || blank(); return card; }
const save = () => store.set("card", card);
const slim = m => { const { bd, comp, ot, ie, _rel, ...rest } = m; return rest; };

export const all = () => card ? [...card.old.flat(), ...card.stamps] : [];
export const out = () => card ? card.stamps.filter(s => !s.back) : [];
export const isOut = id => out().some(s => s.m.id === id);
export const overdue = s => !s.back && Date.now() > new Date(s.due).getTime();
export const lateFee = s => Math.max(0, Math.floor((Date.now() - new Date(s.due).getTime()) / 864e5) + 1) * 0.5;

function addStamp(st) {
  if (card.stamps.length >= SLOTS) { card.old.push(card.stamps); card.stamps = []; }
  card.stamps.push(st); return save();
}
// Take it home: stamped now, due back in three nights.
export async function take(m) {
  await load(); if (isOut(m.id)) return null;
  const now = new Date(), due = new Date(now.getTime() + NIGHTS * 864e5);
  const st = { id: now.getTime().toString(36), m: slim(m), out: now.toISOString(), due: due.toISOString(), back: null, verdict: null, asked: false, told: false };
  await addStamp(st); return st;
}
// Watched it already: stamped and checked in at once.
export async function logged(m, verdict) {
  await load();
  const open = out().find(s => s.m.id === m.id); if (open) return checkIn(open.id, verdict);
  const now = new Date().toISOString();
  await addStamp({ id: Date.now().toString(36), m: slim(m), out: now, due: now, back: now, verdict, asked: true, told: true });
}
export async function checkIn(id, verdict) {
  const s = card.stamps.find(x => x.id === id) || card.old.flat().find(x => x.id === id); if (!s) return;
  s.back = new Date().toISOString(); s.verdict = verdict; await save();
}
// Which tape Rasher should ask about now, if any. He asks once when it's been a while, and once more if it goes overdue.
export function due() {
  for (const s of out().sort((a, b) => a.out < b.out ? -1 : 1)) {
    if (overdue(s) && !s.told) return { s, late: true };
    if (!s.asked && Date.now() - new Date(s.out).getTime() > ASK_AFTER) return { s, late: false };
  }
  return null;
}
export async function asked(id, late) { const s = card.stamps.find(x => x.id === id); if (!s) return; s.asked = true; if (late) s.told = true; await save(); }

const ESC = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const day = iso => new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short" }).toUpperCase();
const MARK = { loved: "LOVED IT", liked: "LIKED IT", nope: "NOT FOR ME", skip: "NOT WATCHED" };
function stampHTML(s, i) {
  const late = overdue(s), state = s.back ? "back" : late ? "late" : "out";
  const tilt = ((s.id.charCodeAt(s.id.length - 1) % 7) - 3) * 2;
  const sub = s.back ? MARK[s.verdict] || "RETURNED" : late ? `OVERDUE · €${lateFee(s).toFixed(2)}` : `DUE ${day(s.due)}`;
  return `<button class="cstamp ${state}" data-stamp="${s.id}" style="--tilt:${tilt}deg" aria-label="${ESC(s.m.t)}, ${ESC(sub.toLowerCase())}">
    <span class="cdate">${day(s.out)}</span><span class="ctitle">${ESC(s.m.t)}</span><span class="csub">${sub}</span></button>`;
}
export function html(name) {
  if (!card) return "";
  const slots = [...card.stamps.map(stampHTML)];
  for (let i = card.stamps.length; i < SLOTS; i++) slots.push(`<span class="cstamp empty">${i + 1}</span>`);
  const cardNo = card.old.length + 1, since = new Date(card.since).toLocaleDateString("en-IE", { month: "short", year: "numeric" }).toUpperCase();
  return `<div class="mcard">
    <div class="mhead"><b>TAKE ONE VIDEO</b><span>MEMBERSHIP CARD${cardNo > 1 ? ` · NO. ${cardNo}` : ""}</span></div>
    <div class="mwho"><span>MEMBER <b>${ESC((name || "Guest").toUpperCase())}</b></span><span>NO. <b>${card.no}</b></span><span>SINCE <b>${since}</b></span></div>
    <div class="mgrid">${slots.join("")}</div>
    <p class="mfoot">Tapes due back in three nights. Be kind, rewind.</p>
  </div>
  ${card.old.length ? `<details class="mold"><summary>Old cards (${card.old.length}) · ${card.old.flat().length} rentals</summary><div class="mgrid">${card.old.slice().reverse().flat().map(stampHTML).join("")}</div></details>` : ""}`;
}
export const find = id => card && (card.stamps.find(x => x.id === id) || card.old.flat().find(x => x.id === id));
