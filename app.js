/* Wordly web — the same dictionary as the Android app, for iPhone (or any
   browser). One page; screens are picked by the address after "#":
     #/                     home            #/search/<q>     search
     #/word/<id>            a word          #/look/<text>    look up picked text
     #/section/<group>      a section       #/collection/<id>
     #/families, #/family/<id>              #/lists/<tab>    Saved / Recent / Wishlist
     #/quiz  (Word Challenge)  #/quiz/play  (a round)  #/quiz/words  (Your words)
     #/collections  #/settings[/font|/layout]  #/more  #/about  #/privacy
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
// Palette.shading: soft → mid (38–78%) → a stop 55% of the way from mid to deep.
const lerpHex = (a, b, t) => "#" + [1, 3, 5].map((k) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t)
  + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const shading = (i) => {
  const [soft, mid, deep] = PALETTE[((i % 10) + 10) % 10];
  return [[0, soft], [0.38, mid], [0.78, mid], [1, lerpHex(mid, deep, 0.55)]];
};
const gradient = (i) => `linear-gradient(135deg, ${shading(i).map(([s, c]) => `${c} ${s * 100}%`).join(", ")})`;
Settings.apply();            // the saved theme and reading settings (settings.js)
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
// One-time fresh start (Nov 2026): word ids change when idiom names are
// standardised, so Saved, Recent and the user's lists are cleared once.
if (!store.get("reset2026", false)) {
  for (const k of ["saved", "recent", "lists", "listItems", "quickSeen"]) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
  store.set("reset2026", true);
}
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
  Quick.remember(data.byId.get(id));
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
  data.index = rows.map(([id, word, type, preview, f]) => ({ id, word, type, preview, f, norm: word.toLowerCase(), lo: loose(word.toLowerCase()) }));
  for (const e of data.index) {
    data.byId.set(e.id, e);
    if (!data.byNorm.has(e.norm)) data.byNorm.set(e.norm, []);
    data.byNorm.get(e.norm).push(e);
  }
  Quick.restore();          // quick words opened before, for Recent / Saved
}
async function definition(id) {
  if (Quick.isQuick(id)) return Quick.definition(id);
  // One small file per word (tools/build_web.py d/<id>.json).
  if (!data.defs.has(id)) data.defs.set(id, json(`data/d/${id}.json`).then((d) => ({ [id]: d })).catch((err) => { data.defs.delete(id); throw err; }));
  const n = id;
  const chunk = await data.defs.get(n);
  return chunk[id];
}
const collections = async () => (data.cols ??= await json("data/collections.json"));
const extras = async () => (data.extras ??= await json("data/extras.json"));

// ---- search --------------------------------------------------------------
// The app's order (DictionaryDb.search): exact matches, then an irregular
// form's word ("went" → go), Wordly's words starting with the letters, quick
// (WordNet) words starting with them, then Wordly's words containing them.
// Quick words come from files fetched while typing (quick.js Quick.prepare).
// Hyphens, spaces and apostrophes don't matter ("soi disant" finds Soi-disant).
const loose = (s) => s.replace(/[-\s'’–]/g, "");
function search(q, limit = 60) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const lq = loose(q), useLoose = lq.length >= 3;
  const exact = [], starts = [], contains = [];
  for (const e of data.index) {
    if (e.norm === q || (useLoose && e.lo === lq)) exact.push(e);
    else if (e.norm.startsWith(q) || (useLoose && e.lo.startsWith(lq))) starts.push(e);
    else if (e.norm.includes(q)) contains.push(e);
  }
  const seen = new Set();
  return [...exact, ...Quick.exact(q), ...Quick.irregularNow(q), ...starts, ...Quick.startingWith(q, limit), ...contains]
    .filter((e) => !seen.has(e.id) && seen.add(e.id)).slice(0, limit);
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
// Wordly's word first, else a quick (WordNet) one — DictionaryDb.entriesFor.
const entriesFor = (norm) => data.byNorm.get(norm) || (Quick.exact(norm).length ? Quick.exact(norm) : null);
/** Fetches the quick files lookUp may need (call before it). */
const prepareLookUp = (text) => {
  const w = text.trim().toLowerCase();
  return Promise.all([...baseForms(w).map(([f]) => Quick.shard(f)), Quick.prepare(w)]);
};
function lookUp(text) {
  const w = text.trim().toLowerCase();
  for (const [form, same] of baseForms(w)) {
    const hits = entriesFor(form);
    if (hits) return { entries: hits, missing: same ? null : text.trim() };
  }
  // An irregular form ("ran", "mice") is the same word as its base.
  const irregular = Quick.irregularNow(w);
  if (irregular.length) return { entries: irregular, missing: null };
  // Written with or without a hyphen or space ("soi disant", "wellbeing").
  const lw = loose(w);
  const spaced = lw.length >= 3 ? data.index.filter((e) => e.lo === lw) : [];
  if (spaced.length) return { entries: spaced, missing: null };
  return { entries: [], missing: text.trim() };
}
// What a sharing app adds around the words (same as Android's sharedWords):
// Kindle sends “stubborn,” + a blank line + “— Never Lie by Freida McFadden https://…”
// → “stubborn,”. Links and “— Title by Author” lines go; the first line stays.
function sharedWords(text) {
  const lines = text.replace(/https?:\/\/\S+/g, ' ').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !/^(—|–|- )/.test(l));
  const first = lines[0] || "";
  const q = first.match(/^["“”'‘’«](.+)["“”'‘’»][,.;:!?]*$/);
  return q ? q[1] : first;
}
const tidy = (raw) => sharedWords(raw).replace(/[’‘]/g, "'").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
  .replace(/\s+/g, " ").slice(0, 60).replace(/^./, (c) => c.toUpperCase());

// ---- word of the day (same pick as the app) -------------------------------
function wordOfTheDay() {
  // DictionaryDb.featurableIds(); an older cached word list without the flag
  // falls back to single short words.
  let pool = data.index.filter((e) => e.f);
  if (!pool.length) pool = data.index.filter((e) => !e.word.includes(" ") && e.word.length <= 16);
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

// ---- the app's look: collection colours and icons (Collections.kt) -------
const COL_SEED = {
  gre: 1, ielts: 6, core: 9,
  virtues: 4, flaws: 7, rudeness: 0, villainy: 2, characters: 9, emotions: 5, law: 8, power: 3,
  money: 1, health: 6, mind: 4, science: 9, argument: 7, language: 0, logic: 2,
  per_art: 3, per_logic: 6, per_figures: 8, per_speeches: 1, per_winning: 5,
  eponyms: 5, foreign: 8, idioms: 1, phrasal: 0, confused: 4, second: 2, stories: 7,
  idm_body: 0, idm_animals: 5, idm_food: 3, idm_money: 8, idm_sea: 6, idm_war: 1, idm_nature: 9,
  idm_games: 4, idm_secrets: 2, idm_talk: 7, idm_friends: 5, idm_work: 0, idm_time: 8, idm_trouble: 3, idm_success: 1,
};
const COL_ICON = {
  gre: "ic_col_gre", ielts: "ic_col_exam", core: "ic_col_book", virtues: "ic_col_star", flaws: "ic_col_warning",
  rudeness: "ic_col_crown", villainy: "ic_col_mask", characters: "ic_col_people", emotions: "ic_col_heart",
  law: "ic_col_scales", power: "ic_col_capitol", money: "ic_col_money", health: "ic_col_pulse", mind: "ic_col_head",
  science: "ic_col_flask", argument: "ic_col_chat", language: "ic_col_book", logic: "ic_col_bulb",
  eponyms: "ic_col_badge", foreign: "ic_col_globe", idioms: "ic_col_quote", confused: "ic_col_notequal",
  second: "ic_col_venn", stories: "ic_col_scroll", phrasal: "ic_col_book",
  per_art: "ic_col_chat", per_logic: "ic_col_warning", per_figures: "ic_col_quote", per_speeches: "ic_col_capitol",
  per_winning: "ic_col_people", idm_body: "ic_col_head", idm_money: "ic_col_money", idm_sea: "ic_col_globe",
  idm_war: "ic_col_warning", idm_games: "ic_col_badge", idm_secrets: "ic_col_mask", idm_talk: "ic_col_chat",
  idm_friends: "ic_col_people", idm_time: "ic_col_pulse", idm_success: "ic_col_star", idm_trouble: "ic_col_scales",
};
const colSeed = (id, fallback) => COL_SEED[id] ?? fallback;
const colIcon = (id) => COL_ICON[id] || (id.startsWith("fam_") ? "ic_col_root" : id.startsWith("idm_") ? "ic_col_quote" : "ic_collections");
// Section cards on the home page (SectionStyle in Collections.kt).
const SECTION = {
  "Exam prep": ["GRE, IELTS and TOEFL word lists", 1, "ic_col_exam"],
  "Topics": ["Words by subject, from law to emotions", 7, "ic_col_globe"],
  "Persuasion toolkit": ["The words of rhetoric and argument", 6, "ic_col_chat"],
  "Curiosities": ["Idioms, word stories, look-alikes and more", 4, "ic_col_star"],
  "Idioms by theme": ["Idioms sorted by what they're about", 9, "ic_col_quote"],
};
const OPEN_SECTION = "Exam prep";
const icon = (name, cls = "") => `<span class="ico ${cls}">${ICONS[name] || ""}</span>`;

// The app's ribbon "W" (res/drawable/ic_logo.xml).
const LOGO = `<svg viewBox="0 0 108 108" aria-hidden="true"><defs>
<linearGradient id="lg1" gradientUnits="userSpaceOnUse" x1="24.1" y1="32.55" x2="39.05" y2="75.45"><stop offset="0" stop-color="#56E3CF"/><stop offset="1" stop-color="#2FA7C9"/></linearGradient>
<linearGradient id="lg2" gradientUnits="userSpaceOnUse" x1="54" y1="42.95" x2="68.95" y2="75.45"><stop offset="0" stop-color="#B57CF5"/><stop offset="1" stop-color="#8A56E6"/></linearGradient>
<linearGradient id="lg3" gradientUnits="userSpaceOnUse" x1="39.05" y1="75.45" x2="54" y2="42.95"><stop offset="0" stop-color="#2B5FD9"/><stop offset="1" stop-color="#3D86EE"/></linearGradient>
<linearGradient id="lg4" gradientUnits="userSpaceOnUse" x1="68.95" y1="75.45" x2="83.9" y2="32.55"><stop offset="0" stop-color="#E0588F"/><stop offset="1" stop-color="#F57BA8"/></linearGradient>
</defs><g fill="none" stroke-width="14.3" stroke-linecap="round" transform="translate(54 54) scale(1.3) translate(-54 -54)">
<path d="M24.1 32.55L39.05 75.45" stroke="url(#lg1)"/><path d="M54 42.95L68.95 75.45" stroke="url(#lg2)"/>
<path d="M39.05 75.45L54 42.95" stroke="url(#lg3)"/><path d="M68.95 75.45L83.9 32.55" stroke="url(#lg4)"/></g></svg>`;

// ---- Kotlin's seeded Random (XorWow), so day-based colours match the app ----
function kotlinRandom(seedBig) {
  const s = BigInt.asIntN(64, BigInt(seedBig));
  let x = Number(BigInt.asIntN(32, s)), y = Number(BigInt.asIntN(32, s >> 32n)), z = 0, w = 0;
  let v = ~x, addend = ((x << 10) ^ (y >>> 4)) | 0;
  const nextInt = () => {
    let t = x;
    t = t ^ (t >>> 2);
    x = y; y = z; z = w;
    const v0 = v;
    w = v0;
    t = (t ^ (t << 1)) ^ v0 ^ (v0 << 4);
    v = t | 0;
    addend = (addend + 362437) | 0;
    return (t + addend) | 0;
  };
  for (let i = 0; i < 64; i++) nextInt();
  return {
    nextInt(until) {
      if ((until & -until) === until) {
        const bits = 31 - Math.clz32(until);
        return bits === 0 ? 0 : (nextInt() >>> (32 - bits));
      }
      let bits, val;
      // (Kotlin's Int arithmetic wraps at 32 bits; | 0 does the same here.)
      do { bits = nextInt() >>> 1; val = bits % until; } while (((bits - val + (until - 1)) | 0) < 0);
      return val;
    },
  };
}
const FAMILY = [0, 0, 3, 3, 1, 1, 4, 5, 2, 2];
const family = (i) => FAMILY[((i % 10) + 10) % 10];
// Palette.challenge(day): a fresh hue daily, never the Word of the Day's hue
// family that day, nor the same family as the day before.
function challengeSeed(day, depth = 1) {
  const avoid = new Set([family(day)]);
  if (depth > 0) avoid.add(family(challengeSeed(day - 1, depth - 1)));
  let choices = [...Array(10).keys()].filter((i) => !avoid.has(family(i)));
  if (!choices.length) choices = [...Array(10).keys()];
  return choices[kotlinRandom(BigInt(day) * 7919n + 17n).nextInt(choices.length)];
}
const epochDay = () => { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000); };

// ---- views and the router (screens change the way the app's do) ----------
let $view = null;
let tracker = null;           // the current page's RevealTracker
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let navIndex = 0;             // position in history, to tell back from forward
const scrolls = new Map();    // each screen's scroll, kept for coming back

function newView() {
  const v = document.createElement("div");
  v.className = "view";
  return v;
}

// ---- home (SearchScreen.kt) ----------------------------------------------
const BG_ICONS = ["ic_bg_book", "ic_bg_bulb", "ic_bg_atom", "ic_bg_quote", "ic_bg_globe", "ic_bg_quill",
  "ic_bg_cap", "ic_bg_search", "ic_bg_star", "ic_bg_bubble", "ic_bg_flask", "ic_bg_compass"];
const BG_COLORS = ["#B08D57", "#3E8E9E", "#7E6BB0", "#9E5A63", "#4E9E7A", "#C06A93", "#5A7FB0", "#C0913E"];
const BG_SLOTS = [[true, 0.10, 0.0], [true, 0.55, 1.3], [false, 0.06, 2.6], [false, 0.51, 3.9]];
function bgIcons() {
  // Two faint icons each side of the logo, drifting ±5 px; which icons and
  // colours is reshuffled every time home is shown (positions stay put).
  const pool = [...BG_ICONS].sort(() => Math.random() - 0.5);
  return `<div class="bg-icons">${BG_SLOTS.map(([left, y, phase], i) => {
    const color = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
    const delay = -(((phase / (2 * Math.PI)) % 1) * 11000);
    return `<span class="bg-icon" style="${left ? "left:20px" : "right:20px"};top:${(y * 100).toFixed(0)}%;color:${color};animation-delay:${delay.toFixed(0)}ms">${ICONS[pool[i]]}</span>`;
  }).join("")}</div>`;
}

function wordRow(e) {
  return `<div class="wrow"><div><span class="w">${esc(e.word)}</span><span class="t">${pos(e.type)}</span></div>
    <div class="g">${esc(e.preview || "")}</div></div>`;
}

function collectionCard(c, fallbackSeed) {
  return `<a class="ccard sheen soft" data-press href="#/collection/${c.id}" style="background:${gradient(colSeed(c.id, fallbackSeed))}">
    <h3>${esc(c.title)}</h3><p>${esc(c.blurb)}</p><span class="spacer"></span>
    <span class="badge2">${icon(colIcon(c.id))}</span></a>`;
}
const surpriseTile = () => `<a class="ccard quiet" data-press href="#/random"><h3>Surprise me</h3><p>A random word</p>
  <span class="spacer"></span><span class="badge2">${die()}</span></a>`;
const die = () => `<svg class="ico" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7">
  <rect x="1.4" y="1.4" width="17.2" height="17.2" rx="4.6"/><g fill="currentColor" stroke="none">
  <circle cx="6" cy="6" r="1.7"/><circle cx="14" cy="6" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="6" cy="14" r="1.7"/><circle cx="14" cy="14" r="1.7"/></g></svg>`;
function sectionCard(title, blurb, seed, iconName, href) {
  return `<a class="scard sheen soft" data-press href="${href}" style="background:${gradient(seed)}">
    <h3>${esc(title)}</h3><p>${esc(blurb)}</p><span class="badge2">${icon(iconName)}</span></a>`;
}

// The Daily Challenge banner lives in quiz.js (stage 5).

async function home(view, opts = {}) {
  const { entry, seed } = wordOfTheDay();
  const cols = await collections();
  const open = cols.filter((c) => c.group === OPEN_SECTION);
  const groups = [...new Set(cols.map((c) => c.group))].filter((g) => g !== OPEN_SECTION);
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const recents = recent().map((r) => data.byId.get(r.id)).filter(Boolean).slice(0, 5);
  const titleCls = entry.word.length <= 22 ? "" : entry.word.length <= 34 ? "m" : "s";
  const rows = [];
  for (let i = 0; i < open.length; i += 2) {
    const pair = open.slice(i, i + 2);
    rows.push(`<div class="crow" data-r>${pair.map((c, j) => collectionCard(c, i + j)).join("")}${pair.length === 1 ? surpriseTile() : ""}</div>`);
  }
  view.innerHTML = `
    <div class="home-menu"><button class="icon-btn" aria-label="Menu" id="menu">${ICON.menu}</button></div>
    <div class="hero" id="hero">${bgIcons()}<div class="hero-in">
      <span class="logo-disc">${LOGO}</span><br><span class="wm">Wordly</span></div></div>
    ${Search.box("")}
    <div id="home-body">
      <a class="wotd2" data-press data-r href="#/word/${entry.id}?c=${seed}&w=1">
        <div class="top sheen" style="background:${gradient(seed)}"><h2 class="${titleCls}">${esc(entry.word)}</h2>
          ${entry.preview ? `<p>${esc(entry.preview)}</p>` : ""}</div>
        <div class="bottom"><div class="label">WORD OF THE DAY</div><div class="date">${date}</div></div>
      </a>
      <div class="home-head" data-r><span class="wm semi">Word collections</span></div>
      <div style="height:12px"></div>
      <div class="cgrid">${rows.join("")}</div>
      ${open.length % 2 === 0 ? `<div class="cgrid" data-r>${surpriseTile()}</div>` : ""}
      <div class="glabel" data-r>More collections</div>
      <div data-r>${sectionCard("Word families", "Learn one Greek or Latin root, unlock a whole family of words", 3, "ic_col_root", "#/families")}</div>
      ${groups.map((g, i) => { const [blurb, s, ic] = SECTION[g] || ["Word collections", i, "ic_collections"];
        return `<div data-r>${sectionCard(g, blurb, s, ic, `#/section/${encodeURIComponent(g)}`)}</div>`; }).join("")}
      <div class="home-head" data-r><span class="wm semi">Vocabulary quiz</span></div>
      <div data-r>${Quiz.banner()}</div>
      ${recents.length ? `<div class="home-head" data-r style="padding-bottom:2px"><span class="wm semi">Recent searches</span></div>
        <div class="hrows">${recents.map((e) => `<div class="hrow-wrap" data-r><a class="hrow" href="#/word/${e.id}">${wordRow(e)}</a></div>`).join("")}</div>` : ""}
      <div class="home-bottom"></div>
    </div>`;
  view.querySelectorAll(".wm").forEach(Motion.syncFlow);
  view.querySelectorAll("[data-r]").forEach((el) => tracker.add(el));
  view.querySelector("#menu").onclick = () => Menu.open();
  Quiz.wireBanner(view);
  Search.attach(view, { hero: view.querySelector("#hero"), body: view.querySelector("#home-body"), ...opts });
}

// Search lives on the home screen (search.js, stage 3); a search link opens
// home with the search filled in.
function searchPage(q) {
  return home($view, { query: q, focus: false });
}

// The word page lives in word.js (stage 2).
async function wordPage(id, seed, opts) {
  if (Quick.isQuick(id)) await Quick.entry(id);     // a quick word opened from a link or a list
  return Word.render($view, id, seed, opts);
}
const speak = (w) => Word.speak(w);

// Collections, word families and My lists live in lists.js (stage 4).
const sectionPage = (group) => Lists.sectionPage($view, group);
const collectionPage = (id, opts) => Lists.collectionPage($view, id, opts);
const familiesPage = () => Lists.familiesPage($view);
const familyPage = (id, opts) => Lists.familyPage($view, id, opts);
const listsPage = (tab) => Lists.listsPage($view, tab);

// Every collection on one page (CollectionsScreen): exam prep, then "More
// collections" with Word families and each section; "Surprise me" fills the
// gap beside an odd last card, or runs full width at the end.
async function collectionsPage() {
  const cols = await collections();
  const open = cols.filter((c) => c.group === OPEN_SECTION);
  const groups = [...new Set(cols.map((c) => c.group))].filter((g) => g !== OPEN_SECTION);
  const rows = [];
  for (let i = 0; i < open.length; i += 2) {
    const pair = open.slice(i, i + 2);
    rows.push(`<div class="crow" data-r>${pair.map((c, j) => collectionCard(c, i + j)).join("")}${pair.length === 1 ? surpriseTile() : ""}</div>`);
  }
  $view.innerHTML = Settings.subBar("Collections") + `<div class="cintro" data-r>Explore words by exam, by topic, or just for the fun of it.</div>
    <div style="height:14px"></div><div class="cgrid">${rows.join("")}</div>
    <div class="glabel" data-r>More collections</div>
    <div data-r>${sectionCard("Word families", "Learn one Greek or Latin root, unlock a whole family of words", 3, "ic_col_root", "#/families")}</div>
    ${groups.map((g, i) => { const [blurb, s, ic] = SECTION[g] || ["Word collections", i, "ic_collections"];
      return `<div data-r>${sectionCard(g, blurb, s, ic, `#/section/${encodeURIComponent(g)}`)}</div>`; }).join("")}
    ${open.length % 2 === 0 ? `<div class="cgrid" data-r style="padding-top:2px">${surpriseTile()}</div>` : ""}<div style="height:32px"></div>`;
  Settings.wireBack($view);
  $view.querySelectorAll("[data-r]").forEach((el) => tracker.add(el));
}

// Look up text picked in another app (look.js, stage 7): the Android popup's card.
const lookPage = (raw) => Look.page($view, raw);

function notFound() {
  $view.innerHTML = topBar("") + `<div class="empty"><h2>Not found</h2><a class="btn filled" href="#/">Go home</a></div>`;
}

// ---- router --------------------------------------------------------------
let currentKind = null;       // "word" or "page": decides the transition
let currentKey = null;
let firstRoute = true;

async function route() {
  const [path, query] = location.hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query || "");

  // Back or forward? Each history entry remembers its place in the trail.
  let returning = false;
  let swiped = false;           // iPhone's swipe-back: Safari has animated it already
  const st = history.state;
  if (st && typeof st.i === "number") {
    returning = st.i < navIndex;
    navIndex = st.i;
    swiped = returning && IS_IOS && !(performance.now() - (window.__appBackAt || 0) < 1500);
  } else {
    navIndex += 1;
    history.replaceState({ i: navIndex }, "");
  }

  try {
    await loadIndex();
  } catch {
    $app.innerHTML = `<div class="empty"><h2>Can't reach Wordly</h2>Connect to the internet once so Wordly can download its words.</div>`;
    document.getElementById("splash")?.remove();
    return;
  }

  // Redirects (no screen of their own).
  if (parts[0] === "random") {
    let pool = data.index.filter((e) => e.f);
    if (!pool.length) pool = data.index.filter((e) => !e.word.includes(" ") && e.word.length <= 16);
    return location.replace(`#/word/${pool[Math.floor(Math.random() * pool.length)].id}`);
  }

  const key = path || "/";
  const kind = parts[0] === "word" ? "word" : "page";
  if (currentKey) scrolls.set(currentKey, scrollY);

  // The new screen is built in its own layer; the old one stays on top (fixed
  // where it was) while the two cross over, then leaves.
  const old = $view;
  if (old) { old.cleanup && old.cleanup(); old.cleanupSearch && old.cleanupSearch(); old.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id")); }
  tracker && tracker.dispose();
  tracker = new Motion.RevealTracker({ firstDelay: firstRoute ? 0 : 250, returning });
  $view = newView();
  $app.appendChild($view);

  switch (parts[0]) {
    case "word": await wordPage(Number(parts[1]), params.has("c") ? Number(params.get("c")) : undefined,
      { wotd: params.has("w"), returning }); break;
    case "search": await searchPage(parts.slice(1).join("/")); break;
    case "look": await lookPage(parts.slice(1).join("/")); break;
    case "section": await sectionPage(parts[1]); break;
    case "collection": await collectionPage(parts[1], { returning }); break;
    case "families": await familiesPage(); break;
    case "family": await familyPage(parts[1], { returning }); break;
    case "lists": listsPage(parts[1] || "saved"); break;
    case "collections": await collectionsPage(); break;
    case "settings": (parts[1] === "font" ? Settings.fontPage : parts[1] === "layout" ? Settings.layoutPage : Settings.settingsPage)($view); break;
    case "more": Menu.morePage($view); break;
    case "about": Menu.aboutPage($view); break;
    case "privacy": Menu.privacyPage($view); break;
    case "quiz": await (parts[1] === "play" ? Quiz.playPage($view, { returning })
      : parts[1] === "words" ? Quiz.wordsPage($view, params.get("tab")) : Quiz.hubPage($view)); break;
    default: await home($view);
  }

  const transitionKind = kind === "word" ? "toWord" : currentKind === "word" ? "fromWord" : "fade";
  if (firstRoute) {
    // First screen: the splash lifts away and the cards rise as it goes.
    document.getElementById("splash") && Motion.liftSplash();
    old && old.remove();
  } else if (swiped) {
    // Safari's swipe has just slid this page in from its snapshot: show it as
    // it is, without playing the app's own back transition on top.
    old && old.remove();
  } else {
    Motion.transition(old, $view, transitionKind);
  }
  Motion.restoreScroll(returning ? scrolls.get(key) || 0 : 0);
  Settings.topColor();
  tracker.open(performance.now());
  firstRoute = false;
  currentKind = kind;
  currentKey = key;
}
addEventListener("hashchange", route);
history.scrollRestoration = "manual";
// Support links like ".../?look=word" too (easier to build in Shortcuts).
const startLook = new URLSearchParams(location.search).get("look");
if (startLook) history.replaceState(null, "", location.pathname + "#/look/" + encodeURIComponent(startLook));
route();
// The extras (stories, families, mix-ups) a word page shows: fetched quietly
// soon after opening, so the first word tapped never waits for them.
setTimeout(() => { extras().catch(() => {}); }, 1800);

// A finger on a word starts fetching its definition before the tap even
// lands, so the page usually opens with its text ready.
addEventListener("pointerdown", (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#/word/"]');
  const m = a && a.getAttribute("href").match(/^#\/word\/(\d+)/);
  if (m && data.index) definition(Number(m[1])).catch(() => {});
}, { passive: true });

// iPhone Safari sometimes swallows the first tap on a link (it reads the tap
// as a "hover" while list rows are still fading in) and only a second tap
// opens it. A clean tap — finger lifted within half a second, moved under
// 10 px, page not scrolling — opens the link straight away instead.
{
  let t0 = null, lastScroll = 0;
  addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });
  addEventListener("touchstart", (e) => {
    const a = e.touches.length === 1 && e.target.closest && e.target.closest('a[href^="#/"]');
    t0 = a && performance.now() - lastScroll > 120
      ? { a, x: e.touches[0].clientX, y: e.touches[0].clientY, at: performance.now() } : null;
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (t0 && Math.hypot(e.touches[0].clientX - t0.x, e.touches[0].clientY - t0.y) > 10) t0 = null;
  }, { passive: true });
  addEventListener("touchend", (e) => {
    const t = t0; t0 = null;
    if (!t || performance.now() - t.at > 500 || !t.a.isConnected) return;
    e.preventDefault();                      // Safari's own (late) click won't follow
    t.a.click();                             // the link's usual click, its handlers included
  }, { passive: false });
}

// Offline: keep the app and every word already read on this device.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
// When the words themselves change (data/version.txt is new), the definition
// files kept on this phone are dropped, so every word is read fresh again.
fetch("data/version.txt", { cache: "no-cache" }).then((r) => (r.ok ? r.text() : null)).then(async (v) => {
  v = v && v.trim();
  if (!v) return;
  const had = store.get("dataVersion", null);
  if (had && had !== v && "caches" in window) { await caches.delete("wordly-data"); data.defs.clear(); }
  store.set("dataVersion", v);
}).catch(() => {});
