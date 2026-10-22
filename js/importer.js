// Reads a Letterboxd export zip and looks every film up on TMDB, reusing anything already cached.
import * as store from "./store.js?v=q9";
import * as tmdb from "./tmdb.js?v=q9";

function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = [];
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export async function readZip(file) {
  const zip = await window.JSZip.loadAsync(file);
  const find = name => Object.values(zip.files).find(f => !f.dir && f.name.split("/").pop() === name && !/(^|\/)(deleted|orphaned)\//.test(f.name));
  const read = async name => { const f = find(name); return f ? parseCSV(await f.async("string")) : null; };
  const watchlist = await read("watchlist.csv");
  const watched = await read("watched.csv");
  if (!watchlist && !watched) throw new Error("That zip doesn't look like a Letterboxd export. It needs watchlist.csv or watched.csv inside.");
  const ratings = (await read("ratings.csv")) || [];
  const diary = (await read("diary.csv")) || [];
  const profileCsv = (await read("profile.csv")) || [];
  const key = r => `${r.Name}|${r.Year}`;
  return {
    importedAt: new Date().toISOString(),
    username: profileCsv[0]?.Username || "",
    watchlist: (watchlist || []).map(r => ({ key: key(r), added: r.Date, uri: r["Letterboxd URI"] })),
    watched: (watched || []).map(r => ({ key: key(r), date: r.Date, uri: r["Letterboxd URI"] })),
    ratings: Object.fromEntries(ratings.map(r => [key(r), parseFloat(r.Rating)])),
    diary: diary.map(r => ({ key: key(r), date: r["Watched Date"] || r.Date, rating: parseFloat(r.Rating) || null, rewatch: r.Rewatch === "Yes" })),
  };
}

// Look up every film in the profile. onProgress(done, total, phase)
export async function enrich(apiKey, profile, onProgress) {
  const films = (await store.get("films")) || {};
  const keys = [...new Set([...profile.watchlist, ...profile.watched].map(x => x.key).concat(profile.diary.map(d => d.key)))];
  const todo = keys.filter(k => !(k in films));
  let sinceSave = 0;
  await tmdb.pool(todo, 10, async k => {
    const i = k.lastIndexOf("|");
    const name = k.slice(0, i), year = k.slice(i + 1);
    const id = await tmdb.match(apiKey, name, year);
    films[k] = id ? await tmdb.details(apiKey, id) : null;
    if (++sinceSave >= 100) { sinceSave = 0; await store.set("films", films); }
  }, (d, t) => onProgress && onProgress(d, t, "shelves"));
  await store.set("films", films);
  return films;
}

// Fetch details for recommendation candidates (films not in the profile), cached by TMDB id.
export async function enrichIds(apiKey, ids, onProgress) {
  const extra = (await store.get("extra")) || {};
  const todo = ids.filter(id => !(id in extra));
  await tmdb.pool(todo, 10, async id => { extra[id] = await tmdb.details(apiKey, id); }, (d, t) => onProgress && onProgress(d, t, "recs"));
  await store.set("extra", extra);
  return extra;
}
