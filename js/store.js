// Small IndexedDB key-value store plus localStorage settings. Everything stays on this device.
const DB_NAME = "take-one";
let dbp = null;
// Some browsers won't let a site store anything (private windows, in-app browsers, strict privacy settings).
// Then the shop still opens and works for the visit; it just can't keep anything afterwards.
const mem = new Map();
export let saving = true;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    let r; try { r = indexedDB.open(DB_NAME, 1); } catch (e) { return rej(e); }
    const t = setTimeout(() => rej(new Error("storage timed out")), 4000);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => { clearTimeout(t); res(r.result); };
    r.onerror = () => { clearTimeout(t); rej(r.error); };
    r.onblocked = () => { clearTimeout(t); rej(new Error("storage blocked")); };
  }).catch(() => { saving = false; return null; });
  return dbp;
}
export async function get(key) {
  const db = await open();
  if (!db) return mem.get(key);
  return new Promise((res, rej) => {
    const t = db.transaction("kv").objectStore("kv").get(key);
    t.onsuccess = () => res(t.result);
    t.onerror = () => rej(t.error);
  });
}
export async function set(key, val) {
  const db = await open();
  if (!db) { mem.set(key, val); return; }
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function clearAll() {
  const db = await open();
  if (!db) { mem.clear(); return; }
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export const prefs = {
  get(k, d) { try { const v = localStorage.getItem("t1:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("t1:" + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("t1:" + k); } catch {} },
};
