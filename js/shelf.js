// My Shelf: your all-time favourites, face-out like closet picks. Up to ten, in your order, each with one short note.
// Lives on this phone, and travels with your shop when you share it.
import * as store from "./store.js?v=r2";

export const MAX = 10;
let list = null;
const slim = m => { const { bd, comp, ot, ie, _rel, kw, ...rest } = m; return rest; };
export async function load() { if (!list) list = (await store.get("shelf")) || []; return list; }
export const items = () => list || [];
export const has = id => items().some(x => x.m.id === id);
const save = () => store.set("shelf", list);
export async function add(m) { await load(); if (has(m.id) || list.length >= MAX) return false; list.push({ m: slim(m), note: "" }); await save(); return true; }
export async function remove(id) { list = items().filter(x => x.m.id !== id); await save(); }
export async function move(id, d) {
  const i = items().findIndex(x => x.m.id === id), j = i + d; if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]]; await save();
}
export async function note(id, text) { const x = items().find(x => x.m.id === id); if (!x) return; x.note = text.trim().slice(0, 80); await save(); }
// What travels in a shared shop: just enough to draw the boxes.
export const forShare = () => items().map(x => ({ m: { id: x.m.id, t: x.m.t, y: x.m.y, p: x.m.p, dir: (x.m.dir || []).slice(0, 2), g: (x.m.g || []).slice(0, 3), rt: x.m.rt, l: x.m.l, vc: x.m.vc, va: x.m.va, c: x.m.c, cast: (x.m.cast || []).slice(0, 5), tag: x.m.tag, ov: x.m.ov }, note: x.note }));
