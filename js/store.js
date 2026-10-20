// Small IndexedDB key-value store plus localStorage settings. Everything stays on this device.
const DB_NAME = "take-one";
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
export async function get(key) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction("kv").objectStore("kv").get(key);
    t.onsuccess = () => res(t.result);
    t.onerror = () => rej(t.error);
  });
}
export async function set(key, val) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function clearAll() {
  const db = await open();
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
