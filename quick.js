/* Wordly web — quick definitions (Open English WordNet, CC BY 4.0) for the
   words Wordly doesn't explain yet: the web side of the app's quick.db
   (data/DictionaryDb.kt). Wordly's own words always win: the quick files only
   hold words the dictionary lacks.

   data/q/i/<xx>.json   [[id, word, type, preview], ...] by the word's first two
                        letters, fetched while the reader types
   data/q/w/<n>.json    {id: [word, type, preview, html]}, 100 ids per file
   data/q/forms.json    [[form, base, type], ...] irregular forms (ran → run)

   Quick entries join data.byId (ids from 10,000,000), so word pages, lists and
   the look-up card treat them like any other word. Ones the reader has opened
   are remembered (localStorage "quickSeen") so Recent and Saved can show them
   straight after a reload. */
"use strict";

const Quick = (() => {
  const BASE = 10_000_000;
  const CHUNK = 100;
  const shards = new Map();       // key → Promise
  const loaded = new Set();       // keys whose words are in byNorm
  const byNorm = new Map();       // norm → [quick entries]
  const rowsOf = new Map();       // key → that file's entries in A–Z order
  const defs = new Map();         // chunk → Promise
  let forms = null;               // Promise<Map form → [[base, type]]>

  const isQuick = (id) => id >= BASE;
  /** The search file a word lives in (tools/build_web.py shard_key). */
  const key = (norm) => (Array.from(norm.slice(0, 2)).map((c) => (/[a-z0-9]/.test(c) ? c : "_")).join("") + "__").slice(0, 2);

  function add(id, word, type, preview) {
    const old = data.byId.get(id);
    if (old) return old;
    const e = { id, word, type, preview, f: 0, norm: word.toLowerCase(), quick: true };
    data.byId.set(id, e);
    if (!byNorm.has(e.norm)) byNorm.set(e.norm, []);
    if (!byNorm.get(e.norm).some((x) => x.id === id)) byNorm.get(e.norm).push(e);
    return e;
  }

  /** Loads the search file for words starting like [norm]. */
  function shard(norm) {
    const k = key(norm);
    if (!shards.has(k)) {
      shards.set(k, json(`data/q/i/${k}.json`)
        .then((rows) => {
          const list = rows.map(([id, w, t, p]) => add(id, w, t, p));
          list.sort((a, b) => (a.norm < b.norm ? -1 : a.norm > b.norm ? 1 : a.type.localeCompare(b.type)));
          rowsOf.set(k, list);
          loaded.add(k);
        })
        .catch(() => { shards.delete(k); loaded.add(k); }));   // no such file: no quick words there
    }
    return shards.get(k);
  }
  const ready = (norm) => loaded.has(key(norm));

  /** Quick words spelt exactly [norm] (empty until its file is loaded). */
  const exact = (norm) => byNorm.get(norm) || [];

  /** Quick words starting with [q], in A–Z order, from the loaded file. */
  function startingWith(q, limit) {
    if (q.length < 2) return [];                 // one letter: Wordly's own words are plenty
    const out = [];
    for (const e of rowsOf.get(key(q)) || []) {
      if (e.norm !== q && e.norm.startsWith(q)) { out.push(e); if (out.length >= limit) break; }
    }
    return out;
  }

  let formsMap = null;
  function loadForms() {
    forms ??= json("data/q/forms.json").then((rows) => {
      const m = new Map();
      for (const [f, b, t] of rows) { if (!m.has(f)) m.set(f, []); m.get(f).push([b, t]); }
      return (formsMap = m);
    }).catch(() => (formsMap = new Map()));
    return forms;
  }

  /** Fetches what a search for [norm] needs: its search file, the irregular
      forms and the files of an irregular form's words. True when something
      new arrived (the results should be drawn again). */
  async function prepare(norm) {
    norm = norm.trim().toLowerCase();
    if (!norm) return false;
    const before = ready(norm) && formsMap;
    await Promise.all([shard(norm), loadForms()]);
    const missing = (formsMap.get(norm) || []).filter(([b]) => !ready(b));
    await Promise.all(missing.map(([b]) => shard(b)));
    return !before || missing.length > 0;
  }

  /** The words an irregular form belongs to, matching part of speech first:
      "went" → go (verb) before go (noun). Needs forms + the bases' files. */
  async function irregular(w) {
    const m = await loadForms();
    const bases = m.get(w) || [];
    if (!bases.length) return [];
    await Promise.all(bases.map(([b]) => shard(b)));
    return irregularNow(w);
  }
  function irregularNow(w) {
    const bases = (formsMap && formsMap.get(w)) || [];
    if (!bases.length) return [];
    const types = new Set(bases.map(([, t]) => t));
    const seen = new Set(), out = [];
    for (const [b] of bases) {
      for (const e of [...(data.byNorm.get(b) || []), ...exact(b)]) if (!seen.has(e.id) && seen.add(e.id)) out.push(e);
    }
    return out.sort((a, b) => (types.has(a.type) ? 0 : 1) - (types.has(b.type) ? 0 : 1));
  }

  /** A quick word's definition: [html, []] like data/w files, plus its entry. */
  async function definition(id) {
    const n = Math.floor((id - BASE) / CHUNK);
    if (!defs.has(n)) defs.set(n, json(`data/q/w/${n}.json`).catch((err) => { defs.delete(n); throw err; }));
    const row = (await defs.get(n))[id];
    if (!row) return undefined;
    const [w, t, p, html] = row;
    add(id, w, t, p);
    return [html, []];
  }
  /** Makes sure a quick word is known (opening #/word/<id> straight away). */
  async function entry(id) {
    if (!data.byId.has(id)) await definition(id).catch(() => null);
    return data.byId.get(id);
  }

  // ---- remembered quick words (for Recent / Saved after a reload) ---------
  const SEEN = "quickSeen";
  function remember(e) {
    if (!e || !e.quick) return;
    const m = store.get(SEEN, {});
    m[e.id] = [e.word, e.type, e.preview];
    const ids = Object.keys(m);
    if (ids.length > 600) for (const k of ids.slice(0, ids.length - 600)) delete m[k];
    store.set(SEEN, m);
  }
  function restore() {
    const m = store.get(SEEN, {});
    for (const [id, [w, t, p]] of Object.entries(m)) add(Number(id), w, t, p);
  }

  /** The look-up card's short form of a quick word: its first three meanings
      with their examples (Similar / Opposite / Related only in Read more). */
  function short(html) {
    const box = document.createElement("div");
    box.innerHTML = html;
    const paras = [...box.children].filter((p) => !/^(Similar|Opposite|Related):/.test(p.textContent.trim()));
    return paras.slice(0, 3).map((p) => p.outerHTML).join("");
  }

  return { BASE, isQuick, key, shard, ready, prepare, exact, startingWith, irregular, irregularNow, loadForms,
    definition, entry, remember, restore, short };
})();
