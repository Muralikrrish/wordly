/* Wordly web — the same dictionary as the Android app, for iPhone (or any
   browser). One page; screens are picked by the address after "#":
     #/                     home            #/search/<q>     search
     #/word/<id>            a word          #/look/<text>    look up picked text
     #/section/<group>      a section       #/collection/<id>
     #/families, #/family/<id>              #/lists/<tab>    Saved / Recent / Wishlist
   Data comes from data/ (built by tools/build_web.py); definitions load in
   small files only when a word is opened. Saved words etc. stay on this device. */
"use strict";

const $app = document.getElementById("app");

// ---- colours (the app's ten card gradients) ------------------------------
const PALETTE = [
  ["#3D7178", "#2E565C", "#1F3C42"], ["#3F6A94", "#305274", "#213953"],
  ["#5F5790", "#48426E", "#322D4E"], ["#78517F", "#5B3D61", "#3E2A43"],
  ["#8F5468", "#6D3F50", "#492A38"], ["#95584A", "#714338", "#4C2D26"],
  ["#9C6A3D", "#77502E", "#503620"], ["#857240", "#665830", "#463D22"],
  ["#66703F", "#4E5631", "#363C22"], ["#457259", "#355744", "#243C30"],
];
const gradient = (i) => {
  const [soft, mid, deep] = PALETTE[((i % 10) + 10) % 10];
  return `linear-gradient(135deg, ${soft} 0%, ${mid} 38%, ${mid} 78%, ${deep} 100%)`;
};
const randomSeed = () => Math.floor(Math.random() * 10);
const POS = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", prep: "preposition",
  conj: "conjunction", intj: "interjection", idm: "idiom", phr: "phrasal verb",
  exp: "expression", term: "term", slang: "slang" };
const pos = (t) => POS[t] || t;

// ---- tiny helpers --------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const go = (hash) => { location.hash = hash; };
const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>',
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  markOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

// ---- this device's own lists (Saved, Recent, Wishlist) -------------------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const saved = () => store.get("saved", []);            // [{id, ts}]
const recent = () => store.get("recent", []);          // [{id, ts}]
const wishlist = () => store.get("wishlist", []);      // [{word, ts}]
const isSaved = (id) => saved().some((r) => r.id === id);
function toggleSaved(id) {
  const now = saved().filter((r) => r.id !== id);
  if (now.length === saved().length) now.unshift({ id, ts: Date.now() });
  store.set("saved", now);
  return now.some((r) => r.id === id);
}
function addRecent(id) {
  store.set("recent", [{ id, ts: Date.now() }, ...recent().filter((r) => r.id !== id)].slice(0, 25));
}
const onWishlist = (w) => wishlist().some((r) => r.word.toLowerCase() === w.toLowerCase());
function toggleWish(w) {
  const now = wishlist().filter((r) => r.word.toLowerCase() !== w.toLowerCase());
  if (now.length === wishlist().length) now.unshift({ word: w, ts: Date.now() });
  store.set("wishlist", now);
  return onWishlist(w);
}

// ---- data ------------------------------------------------------------------
const data = { index: null, byId: new Map(), byNorm: new Map(), defs: new Map(), cols: null, extras: null };
async function json(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}
async function loadIndex() {
  if (data.index) return;
  const rows = await json("data/index.json");
  data.index = rows.map(([id, word, type, preview]) => ({ id, word, type, preview, norm: word.toLowerCase() }));
  for (const e of data.index) {
    data.byId.set(e.id, e);
    if (!data.byNorm.has(e.norm)) data.byNorm.set(e.norm, []);
    data.byNorm.get(e.norm).push(e);
  }
}
async function definition(id) {
  const n = Math.floor(id / 100);
  if (!data.defs.has(n)) data.defs.set(n, json(`data/defs/${n}.json`));
  const chunk = await data.defs.get(n);
  return chunk[id];
}
const collections = async () => (data.cols ??= await json("data/collections.json"));
const extras = async () => (data.extras ??= await json("data/extras.json"));

// ---- search --------------------------------------------------------------
function search(q, limit = 60) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const starts = [], contains = [];
  for (const e of data.index) {
    if (e.norm.startsWith(q)) starts.push(e);
    else if (e.norm.includes(q)) contains.push(e);
  }
  return [...starts, ...contains].slice(0, limit);
}
// "Did you mean": the headwords fewest letter-edits away (single words only).
function closest(q, max = 5) {
  q = q.trim().toLowerCase();
  const cap = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
  const found = [];
  for (const e of data.index) {
    if (Math.abs(e.norm.length - q.length) > cap || e.norm.includes(" ")) continue;
    const d = editDistance(q, e.norm, cap);
    if (d <= cap) found.push([d, e]);
  }
  return found.sort((a, b) => a[0] - b[0]).slice(0, max).map((x) => x[1]);
}
function editDistance(a, b, cap) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

// ---- looking up a picked word (same rules as the Android card) ----------
// Plain forms of a word, each flagged when it's only an inflection (same word).
function baseForms(w) {
  const out = [[w, true]];
  const undouble = (s) => (s.length >= 3 && s.at(-1) === s.at(-2) && !"aeiouls".includes(s.at(-1)) ? s.slice(0, -1) : null);
  const drop = (suffix, same, ...ends) => {
    if (!w.endsWith(suffix) || w.length <= suffix.length + 1) return;
    const stem = w.slice(0, -suffix.length);
    for (const e of ends) out.push([stem + e, same]);
    const u = undouble(stem);
    if (u) out.push([u, same]);
  };
  if (w.endsWith("'s")) out.push([w.slice(0, -2), true]);
  drop("ies", true, "y"); drop("es", true, ""); if (!w.endsWith("ss")) drop("s", true, "");
  drop("ied", true, "y"); drop("ed", true, "", "e"); drop("ing", true, "", "e");
  drop("ier", false, "y"); drop("er", false, "", "e"); drop("iest", false, "y"); drop("est", false, "", "e");
  drop("ically", false, "ic"); drop("ily", false, "y"); drop("ly", false, "", "le");
  const seen = new Set();
  return out.filter(([f]) => f.length >= 2 && !seen.has(f) && seen.add(f));
}
const ENDINGS = ["ization", "isation", "fulness", "iveness", "ousness", "ically", "ation", "ition", "ments",
  "ively", "ously", "ness", "ment", "ance", "ence", "able", "ible", "less", "ally", "ical", "ious", "ity", "ous",
  "ive", "ism", "ist", "ize", "ise", "ify", "ful", "ing", "ion", "ly", "ic", "al", "er", "or", "ed", "es", "s", "y", "e"];
function relatedTo(w, limit = 6) {
  if (w.length < 5 || w.includes(" ")) return [];
  const end = ENDINGS.find((e) => w.endsWith(e) && w.length - e.length >= 4);
  let stem = end ? w.slice(0, -end.length) : w.slice(0, -1);
  while (stem.length >= 4) {
    const hits = data.index.filter((e) => e.norm.startsWith(stem) && e.norm !== w && !e.norm.includes(" "))
      .sort((a, b) => Math.abs(a.word.length - w.length) - Math.abs(b.word.length - w.length));
    if (hits.length) return hits.slice(0, limit);
    stem = stem.slice(0, -1);
    if (stem.length < w.length - 5) break;
  }
  return [];
}
function lookUp(text) {
  const w = text.trim().toLowerCase();
  for (const [form, same] of baseForms(w)) {
    const hits = data.byNorm.get(form);
    if (hits) return { entries: hits, missing: same ? null : text.trim() };
  }
  return { entries: [], missing: text.trim() };
}
const tidy = (raw) => raw.replace(/[’‘]/g, "'").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
  .replace(/\s+/g, " ").slice(0, 60).replace(/^./, (c) => c.toUpperCase());

// ---- word of the day (same pick as the app) -------------------------------
function wordOfTheDay() {
  const pool = data.index.filter((e) => !e.word.includes(" ") && e.word.length <= 16);
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const i = (((day * 1103515245 + 12345) % pool.length) + pool.length) % pool.length;
  return { entry: pool[i], seed: ((day % 10) + 10) % 10 };
}

// ---- screens -------------------------------------------------------------
const SECTIONS = {
  "Topics": ["Words by subject, from law to emotions", 7, "◎"],
  "Persuasion toolkit": ["The words of rhetoric and argument", 6, "❝"],
  "Curiosities": ["Idioms, word stories, look-alikes and more", 4, "✦"],
  "Idioms by theme": ["Idioms sorted by what they're about", 9, "❞"],
};
const COLOR = { gre: 1, ielts: 6, core: 9 };
const GLYPH = { gre: "🎓︎", ielts: "✓", core: "Aa" };

function row(e) {
  return `<a class="row" href="#/word/${e.id}"><span class="w">${esc(e.word)}</span><span class="t">${pos(e.type)}</span>
    <div class="p">${esc(e.preview || "")}</div></a>`;
}
function topBar(title, back = true) {
  return `<div class="bar">${back ? `<button class="icon-btn" onclick="history.back()" aria-label="Back">${ICON.back}</button>` : ""}<h1>${esc(title)}</h1></div>`;
}

async function home() {
  const { entry, seed } = wordOfTheDay();
  const cols = await collections();
  const exam = cols.filter((c) => c.group === "Exam prep");
  const groups = [...new Set(cols.map((c) => c.group))].filter((g) => g !== "Exam prep");
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const recents = recent().map((r) => data.byId.get(r.id)).filter(Boolean).slice(0, 5);
  $app.innerHTML = `
    <div class="hero fade"><img src="icon-512.png" alt=""><div class="wordmark">Wordly</div></div>
    ${searchBox("")}
    <a class="wotd fade" href="#/word/${entry.id}?c=${seed}">
      <div class="top" style="background:${gradient(seed)}"><h2>${esc(entry.word)}</h2><p>${esc(entry.preview || "")}</p></div>
      <div class="bottom"><div class="label">WORD OF THE DAY</div><div class="date">${date}</div></div>
    </a>
    <div class="section-title">Word collections</div>
    <div class="grid fade">
      ${exam.map((c) => `<a class="card" style="background:${gradient(COLOR[c.id] ?? 3)}" href="#/collection/${c.id}">
        <h3>${esc(c.title)}</h3><p>${esc(c.blurb)}</p><span class="badge">${GLYPH[c.id] || "•"}</span></a>`).join("")}
      ${exam.length % 2 ? `<a class="card quiet" href="#/random"><h3>Surprise me</h3><p>A random word</p><span class="badge">⚄</span></a>` : ""}
    </div>
    <div class="group-label">More collections</div>
    <div class="grid fade">
      <a class="card wide" style="background:${gradient(3)}" href="#/families"><h3>Word families</h3>
        <p>Learn one Greek or Latin root, unlock a whole family of words</p><span class="badge">❦</span></a>
      ${groups.map((g, i) => { const [blurb, s, glyph] = SECTIONS[g] || ["Word collections", i, "•"];
        return `<a class="card wide" style="background:${gradient(s)}" href="#/section/${encodeURIComponent(g)}">
          <h3>${esc(g)}</h3><p>${esc(blurb)}</p><span class="badge">${glyph}</span></a>`; }).join("")}
      ${exam.length % 2 ? "" : `<a class="card quiet wide" href="#/random"><h3>Surprise me</h3><p>A random word to explore</p><span class="badge">⚄</span></a>`}
    </div>
    <div class="section-title">My lists</div>
    <div class="grid">
      <a class="card quiet" href="#/lists/saved"><h3>Saved words</h3><p>${saved().length ? "Words you've kept" : "Tap the bookmark on any word"}</p></a>
      <a class="card quiet" href="#/lists/wishlist"><h3>Wishlist</h3><p>Words you'd like Wordly to have</p></a>
    </div>
    ${recents.length ? `<div class="section-title">Recent searches</div><div class="rows">${recents.map(row).join("")}</div>` : ""}`;
  wireSearch();
}

function searchBox(q) {
  return `<div class="search"><label>${ICON.search}<input id="q" type="search" enterkeyhint="search" autocomplete="off"
    autocapitalize="off" spellcheck="false" placeholder="Search" value="${esc(q)}"></label></div><div id="results"></div>`;
}
function wireSearch() {
  const input = document.getElementById("q");
  const out = document.getElementById("results");
  const show = () => {
    const q = input.value;
    history.replaceState(null, "", q.trim() ? "#/search/" + encodeURIComponent(q) : "#/");
    if (!q.trim()) { out.innerHTML = ""; document.querySelectorAll(".home-only").forEach((n) => (n.hidden = false)); return; }
    const found = search(q);
    if (found.length) { out.innerHTML = `<div class="rows">${found.map(row).join("")}</div>`; return; }
    const near = closest(q);
    out.innerHTML = `<div class="note">No exact match for “${esc(q)}”.</div>` +
      (near.length ? `<div class="kicker">Did you mean</div><div class="rows">${near.map(row).join("")}</div>` : "");
  };
  input.addEventListener("input", show);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  return { input, show };
}
async function searchPage(q) {
  $app.innerHTML = searchBox(q);
  const { input, show } = wireSearch();
  show();
  input.focus();
}

async function wordPage(id, seed) {
  const e = data.byId.get(id);
  if (!e) return notFound();
  seed ??= randomSeed();
  addRecent(id);
  $app.innerHTML = `<div class="word-page"><div class="word-head" style="background:${gradient(seed)}">
      <h1>${esc(e.word)}</h1><div class="pos">${pos(e.type)}</div></div>
      <div id="body"><div class="loading">Loading…</div></div></div>
    <div class="tray">
      <button class="icon-btn" onclick="history.back()" aria-label="Back">${ICON.back}</button>
      <button class="icon-btn" id="say" aria-label="Pronounce">${ICON.speak}</button>
      <button class="icon-btn ${isSaved(id) ? "on" : ""}" id="mark" aria-label="Save">${isSaved(id) ? ICON.markOn : ICON.mark}</button>
      <button class="icon-btn" id="share" aria-label="Share">${ICON.share}</button>
    </div>`;
  scrollTo(0, 0);
  document.getElementById("say").onclick = () => speak(e.word);
  document.getElementById("mark").onclick = (ev) => {
    const on = toggleSaved(id);
    ev.currentTarget.classList.toggle("on", on);
    ev.currentTarget.innerHTML = on ? ICON.markOn : ICON.mark;
  };
  document.getElementById("share").onclick = () => {
    const text = `${e.word} (${pos(e.type)}): ${e.preview || ""}`;
    if (navigator.share) navigator.share({ title: e.word, text, url: location.href }).catch(() => {});
    else navigator.clipboard?.writeText(text);
  };
  let def;
  try { def = await definition(id); } catch { def = null; }
  const body = document.getElementById("body");
  if (!body) return;
  if (!def) { body.innerHTML = `<div class="empty">Couldn't load this word. Check your connection and try again.</div>`; return; }
  const [intro, sections] = def;
  const accent = PALETTE[seed][0];
  const ex = await extras();
  const story = ex.stories[id];
  const mix = ex.mixups.filter((m) => m.items.some(([eid]) => eid === id));
  body.innerHTML = `<div class="prose fade">${intro}</div>
    ${story ? `<div class="extra"><div class="lbl">The story behind the word</div><p>${esc(story)}</p></div>` : ""}
    ${mix.map((m) => `<div class="extra"><div class="lbl">Don't mix it up</div><div class="mix">${m.items.map(([eid, meaning]) => {
      const o = data.byId.get(eid); return o ? `<a href="#/word/${eid}"><b>${esc(o.word)}</b> <span>${esc(meaning)}</span></a>` : ""; }).join("")}</div>
      ${m.tip ? `<p style="margin-top:10px;font-size:15px">${esc(m.tip)}</p>` : ""}</div>`).join("")}
    ${sections.map(([h, b]) => `<details class="sec" style="--sec-accent:${accent}"><summary><span>${esc(h)}</span><i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></i></summary><div class="prose">${b}</div></details>`).join("")}`;
}
function speak(word) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-GB";
  const v = speechSynthesis.getVoices().find((x) => x.lang === "en-GB");
  if (v) u.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

async function sectionPage(group) {
  const cols = (await collections()).filter((c) => c.group === group);
  const [blurb] = SECTIONS[group] || [""];
  $app.innerHTML = topBar(group) + `<div class="note">${esc(blurb)}</div>
    <div class="grid fade">${cols.map((c, i) => `<a class="card" style="background:${gradient(i * 3 + 1)}" href="#/collection/${c.id}">
      <h3>${esc(c.title)}</h3><p>${esc(c.blurb)}</p></a>`).join("")}</div>`;
}

const SORTS = ["Shuffle", "A–Z", "Z–A"];
async function collectionPage(id, items, head) {
  let c = head;
  if (!c) {
    c = (await collections()).find((x) => x.id === id);
    if (!c) return notFound();
  }
  const list = (items || c.items).map((i) => data.byId.get(i)).filter(Boolean);
  const seed = COLOR[c.id] ?? (c.id.length * 7) % 10;
  let sort = "Shuffle";
  const render = () => {
    const shown = sort === "Shuffle" ? [...list].sort(() => Math.random() - 0.5)
      : [...list].sort((a, b) => a.norm.localeCompare(b.norm)) [sort === "Z–A" ? "reverse" : "slice"]();
    document.getElementById("list").innerHTML = shown.map(row).join("");
    document.querySelectorAll(".chip").forEach((ch) => ch.classList.toggle("on", ch.dataset.s === sort));
  };
  $app.innerHTML = topBar("") + `<div class="col-head fade" style="background:${gradient(seed)}">
      <div class="grp">${esc(c.group || "")}</div><h2>${esc(c.title)}</h2><p>${esc(c.blurb || "")}</p></div>
    <div class="chips">${SORTS.map((s) => `<button class="chip" data-s="${s}">${s === "Shuffle" ? "⚄ " : ""}${s}</button>`).join("")}</div>
    <div class="rows" id="list"></div>`;
  document.querySelectorAll(".chip").forEach((ch) => (ch.onclick = () => { sort = ch.dataset.s; render(); }));
  render();
}

async function familiesPage() {
  const { families } = await extras();
  const themes = [...new Set(families.map((f) => f.theme))];
  $app.innerHTML = topBar("Word families") + `<div class="note">Learn one Greek or Latin root and you can work out a whole family of words.</div>` +
    themes.map((t) => `<div class="group-label">${esc(t)}</div><div class="grid">${families.filter((f) => f.theme === t)
      .map((f, i) => `<a class="card" style="background:${gradient(i * 3 + 2)}" href="#/family/${f.id}">
        <h3>${esc(f.root.split("·")[0].trim())}</h3><p>${esc(f.meaning)}</p></a>`).join("")}</div>`).join("");
}
async function familyPage(id) {
  const f = (await extras()).families.find((x) => x.id === id);
  if (!f) return notFound();
  collectionPage(null, f.items, { id: "fam_" + f.id, title: f.root, blurb: `${f.meaning} · ${f.origin}. ${f.blurb || ""}`, group: "Word family" });
}

function listsPage(tab) {
  const tabs = [["saved", "Saved words"], ["recent", "Recent"], ["wishlist", "Wishlist"]];
  let body;
  if (tab === "wishlist") {
    const w = wishlist();
    body = w.length ? `<div class="actions"><span class="note" style="padding:0">Words you'd like Wordly to have.</span>
        <button class="btn" id="copy">Copy all</button></div>
      <div class="rows">${w.map((r) => `<div class="row" style="display:flex;align-items:center"><span class="w" style="flex:1">${esc(r.word)}</span>
        <button class="btn" data-w="${esc(r.word)}" aria-label="Remove">✕</button></div>`).join("")}</div>`
      : `<div class="empty"><h2>Your Wishlist is empty</h2>Look up a word Wordly doesn't have yet, and tap “Add to Wishlist”.</div>`;
  } else {
    const rows = (tab === "recent" ? recent() : saved()).map((r) => data.byId.get(r.id)).filter(Boolean);
    body = rows.length ? `<div class="rows">${rows.map(row).join("")}</div>`
      : `<div class="empty"><h2>${tab === "recent" ? "Nothing yet" : "No saved words yet"}</h2>${tab === "recent" ? "Words you open show up here." : "Tap the bookmark on any word to keep it here."}</div>`;
  }
  $app.innerHTML = topBar("My lists") + `<div class="chips">${tabs.map(([k, label]) =>
    `<a class="chip ${k === tab ? "on" : ""}" href="#/lists/${k}">${label}</a>`).join("")}</div>${body}`;
  document.getElementById("copy")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(wishlist().map((r) => r.word).join("\n"));
    document.getElementById("copy").textContent = "Copied ✓";
  });
  document.querySelectorAll("[data-w]").forEach((b) => (b.onclick = () => { toggleWish(b.dataset.w); listsPage("wishlist"); }));
}

// Look up text picked in another app (the iPhone Share shortcut opens this).
function lookPage(raw) {
  const picked = tidy(raw);
  if (!picked) return go("#/");
  const { entries, missing } = lookUp(picked);
  if (!missing && entries.length) return location.replace(`#/word/${entries[0].id}`);
  const near = [...entries, ...relatedTo(picked.toLowerCase())];
  const related = near.length > 0;
  const list = related ? near : closest(picked);
  const seen = new Set();
  const pills = list.filter((e) => !seen.has(e.id) && seen.add(e.id));
  const render = () => {
    const on = onWishlist(picked);
    $app.innerHTML = topBar("") + `<div class="note fade" style="font:600 22px/1.3 Outfit,sans-serif;color:var(--ink)">
        “${esc(picked)}” isn't in Wordly yet${pills.length ? (related ? ", but these are:" : ". Did you mean:") : "."}</div>
      <div class="pills">${pills.map((e) => `<a class="pill" href="#/word/${e.id}">${esc(e.word)}<small>${pos(e.type)}</small></a>`).join("")}</div>
      <div class="actions"><button class="btn" id="wish">${on ? "On Wishlist ✓" : "Add to Wishlist"}</button>
        <a class="btn filled" href="#/search/${encodeURIComponent(picked)}">Search Wordly</a></div>`;
    document.getElementById("wish").onclick = () => { toggleWish(picked); render(); };
  };
  render();
}

function notFound() {
  $app.innerHTML = topBar("") + `<div class="empty"><h2>Not found</h2><a class="btn filled" href="#/">Go home</a></div>`;
}

// ---- router --------------------------------------------------------------
async function route() {
  const [path, query] = location.hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query || "");
  try {
    await loadIndex();
  } catch {
    $app.innerHTML = `<div class="empty"><h2>Can't reach Wordly</h2>Connect to the internet once so Wordly can download its words.</div>`;
    return;
  }
  switch (parts[0]) {
    case "word": return wordPage(Number(parts[1]), params.has("c") ? Number(params.get("c")) : undefined);
    case "search": return searchPage(parts.slice(1).join("/"));
    case "look": return lookPage(parts.slice(1).join("/"));
    case "section": return sectionPage(parts[1]);
    case "collection": return collectionPage(parts[1]);
    case "families": return familiesPage();
    case "family": return familyPage(parts[1]);
    case "lists": return listsPage(parts[1] || "saved");
    case "random": {
      const pool = data.index.filter((e) => !e.word.includes(" "));
      return location.replace(`#/word/${pool[Math.floor(Math.random() * pool.length)].id}`);
    }
    default: return home();
  }
}
addEventListener("hashchange", route);
// Support links like ".../?look=word" too (easier to build in Shortcuts).
const startLook = new URLSearchParams(location.search).get("look");
if (startLook) history.replaceState(null, "", location.pathname + "#/look/" + encodeURIComponent(startLook));
$app.innerHTML = `<div class="loading">Loading Wordly…</div>`;
route();

// Offline: keep the app and every word already read on this device.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
