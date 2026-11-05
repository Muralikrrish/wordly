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
  data.index = rows.map(([id, word, type, preview, f]) => ({ id, word, type, preview, f, norm: word.toLowerCase() }));
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

function challengeBanner() {
  const day = epochDay();
  const seed = challengeSeed(day);
  const mid = PALETTE[seed][1];
  const date = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `<a class="banner sheen" data-press="0.98" href="#/quiz" style="background:${gradient(seed)}">
    <div class="top"><span class="bolt"><svg viewBox="0 0 24 24" fill="#fff"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/></svg></span>
      <span class="kick">DAILY CHALLENGE</span><span class="day">${esc(date)}</span></div>
    <h3>Name the word</h3>
    <div class="sub">Read the meaning, type the word. Fewer hints, more points.</div>
    <div class="pips">${"<i></i>".repeat(10)}</div>
    <div class="row"><span class="cardpill" style="color:${mid}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Play now</span>
      <span class="open">Open<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span></div>
  </a>`;
}

async function home(view) {
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
    <div class="hero" id="hero">${bgIcons()}
      <span class="logo-disc">${LOGO}</span><br><span class="wm">Wordly</span></div>
    ${searchBox("")}
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
      <div data-r>${challengeBanner()}</div>
      ${recents.length ? `<div class="home-head" data-r style="padding-bottom:2px"><span class="wm semi">Recent searches</span></div>
        <div class="hrows">${recents.map((e) => `<div class="hrow-wrap" data-r><a class="hrow" href="#/word/${e.id}">${wordRow(e)}</a></div>`).join("")}</div>` : ""}
      <div class="home-bottom"></div>
    </div>`;
  view.querySelectorAll(".wm").forEach(Motion.syncFlow);
  view.querySelectorAll("[data-r]").forEach((el) => tracker.add(el));
  view.querySelector("#menu").onclick = () => go("#/lists/saved");
  wireSearch(view);
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
  $view.innerHTML = searchBox(q);
  const { input, show } = wireSearch();
  show();
  input.focus();
}

// The word page lives in word.js (stage 2).
function wordPage(id, seed, opts) {
  return Word.render($view, id, seed, opts);
}
const speak = (w) => Word.speak(w);

async function sectionPage(group) {
  const cols = (await collections()).filter((c) => c.group === group);
  const [blurb] = SECTIONS[group] || [""];
  $view.innerHTML = topBar(group) + `<div class="note">${esc(blurb)}</div>
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
  $view.innerHTML = topBar("") + `<div class="col-head fade" style="background:${gradient(seed)}">
      <div class="grp">${esc(c.group || "")}</div><h2>${esc(c.title)}</h2><p>${esc(c.blurb || "")}</p></div>
    <div class="chips">${SORTS.map((s) => `<button class="chip" data-s="${s}">${s === "Shuffle" ? "⚄ " : ""}${s}</button>`).join("")}</div>
    <div class="rows" id="list"></div>`;
  document.querySelectorAll(".chip").forEach((ch) => (ch.onclick = () => { sort = ch.dataset.s; render(); }));
  render();
}

async function familiesPage() {
  const { families } = await extras();
  const themes = [...new Set(families.map((f) => f.theme))];
  $view.innerHTML = topBar("Word families") + `<div class="note">Learn one Greek or Latin root and you can work out a whole family of words.</div>` +
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
  $view.innerHTML = topBar("My lists") + `<div class="chips">${tabs.map(([k, label]) =>
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
    $view.innerHTML = topBar("") + `<div class="note fade" style="font:600 22px/1.3 Outfit,sans-serif;color:var(--ink)">
        “${esc(picked)}” isn't in Wordly yet${pills.length ? (related ? ", but these are:" : ". Did you mean:") : "."}</div>
      <div class="pills">${pills.map((e) => `<a class="pill" href="#/word/${e.id}">${esc(e.word)}<small>${pos(e.type)}</small></a>`).join("")}</div>
      <div class="actions"><button class="btn" id="wish">${on ? "On Wishlist ✓" : "Add to Wishlist"}</button>
        <a class="btn filled" href="#/search/${encodeURIComponent(picked)}">Search Wordly</a></div>`;
    document.getElementById("wish").onclick = () => { toggleWish(picked); render(); };
  };
  render();
}

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
  const st = history.state;
  if (st && typeof st.i === "number") {
    returning = st.i < navIndex;
    navIndex = st.i;
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
  if (old) { old.cleanup && old.cleanup(); old.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id")); }
  tracker && tracker.dispose();
  tracker = new Motion.RevealTracker({ firstDelay: firstRoute ? 0 : 250, returning });
  $view = newView();
  $app.appendChild($view);

  switch (parts[0]) {
    case "word": await wordPage(Number(parts[1]), params.has("c") ? Number(params.get("c")) : undefined,
      { wotd: params.has("w"), returning }); break;
    case "search": await searchPage(parts.slice(1).join("/")); break;
    case "look": lookPage(parts.slice(1).join("/")); break;
    case "section": await sectionPage(parts[1]); break;
    case "collection": await collectionPage(parts[1]); break;
    case "families": await familiesPage(); break;
    case "family": await familyPage(parts[1]); break;
    case "lists": listsPage(parts[1] || "saved"); break;
    default: await home($view);
  }

  const transitionKind = kind === "word" ? "toWord" : currentKind === "word" ? "fromWord" : "fade";
  if (firstRoute) {
    // First screen: the splash lifts away and the cards rise as it goes.
    document.getElementById("splash") && Motion.liftSplash();
    old && old.remove();
  } else {
    Motion.transition(old, $view, transitionKind);
  }
  scrollTo(0, returning ? scrolls.get(key) || 0 : 0);
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

// Offline: keep the app and every word already read on this device.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
