/* Wordly web — find a word by its meaning (DictionaryDb.searchMeaning).
   "someone who talks too much" → Loquacity, Talkative, Garrulous…
   The index (tools/build_web.py meaning_data) is stemmed by tools/porter.py,
   which matches SQLite's porter tokenizer; stem() below is the same code —
   change all three together. Ranking: BM25 (short text ×2), favouring words
   that match more of what was typed, as on Android. */
const Meaning = (() => {
  const STOP = new Set(("a an the of to in on at for by with from as is are was were be been being am do does did done " +
    "who whom whose which that this these those what when where why how it its someone something somebody anyone anything " +
    "person people thing things one ones way ways very really too much many more most some any all just so such than then " +
    "there here into out up about over under not no or and but if your you my me i he she they them his her their our we us " +
    "can could would should will shall may might must have has had having get gets got make makes made word words mean means " +
    "meaning describe describes describing used use uses using kind type sort feeling feel lot lots").split(" "));

  const tokens = (t) => t.toLowerCase().match(/[a-z0-9]+/g) || [];
  function terms(text) {
    const out = [];
    for (const t of tokens(text)) if (!STOP.has(t) && !out.includes(t)) out.push(t);
    return out.slice(0, 8);
  }

  // ---- Porter (1980), as tools/porter.py --------------------------------------
  const cons = (w, i) => {
    const c = w[i];
    if ("aeiou".includes(c)) return false;
    if (c === "y") return i === 0 || !cons(w, i - 1);
    return true;
  };
  function m(w) {
    let n = 0, i = 0;
    const L = w.length;
    while (i < L && cons(w, i)) i++;
    while (i < L) {
      while (i < L && !cons(w, i)) i++;
      if (i >= L) break;
      n++;
      while (i < L && cons(w, i)) i++;
    }
    return n;
  }
  const vowelIn = (w) => { for (let i = 0; i < w.length; i++) if (!cons(w, i)) return true; return false; };
  const doubleC = (w) => w.length >= 2 && w[w.length - 1] === w[w.length - 2] && cons(w, w.length - 1);
  const cvc = (w) => {
    const L = w.length;
    if (L < 3) return false;
    if (!cons(w, L - 1) || cons(w, L - 2) || !cons(w, L - 3)) return false;
    return !"wxy".includes(w[L - 1]);
  };
  const STEP2 = [["ational", "ate"], ["tional", "tion"], ["enci", "ence"], ["anci", "ance"], ["izer", "ize"],
    ["bli", "ble"], ["alli", "al"], ["entli", "ent"], ["eli", "e"], ["ousli", "ous"], ["ization", "ize"],
    ["ation", "ate"], ["ator", "ate"], ["alism", "al"], ["iveness", "ive"], ["fulness", "ful"],
    ["ousness", "ous"], ["aliti", "al"], ["iviti", "ive"], ["biliti", "ble"], ["logi", "log"]];
  const STEP3 = [["icate", "ic"], ["ative", ""], ["alize", "al"], ["iciti", "ic"], ["ical", "ic"], ["ful", ""], ["ness", ""]];
  const STEP4 = ["al", "ance", "ence", "er", "ic", "able", "ible", "ant", "ement", "ment", "ent", "ion", "ou",
    "ism", "ate", "iti", "ous", "ive", "ize"];
  function step(w, list) {
    for (const [suf, rep] of list) {
      if (w.endsWith(suf)) {
        const s = w.slice(0, w.length - suf.length);
        return m(s) > 0 ? s + rep : w;
      }
    }
    return w;
  }
  function stem(w) {
    if (/[0-9]/.test(w)) return w;
    if (w.length > 20) return w.slice(0, 10) + w.slice(-10);
    if (w.length <= 2) return w;
    if (w.endsWith("sses")) w = w.slice(0, -2);
    else if (w.endsWith("ies")) w = w.slice(0, -2);
    else if (w.endsWith("ss")) { /* keep */ }
    else if (w.endsWith("s")) w = w.slice(0, -1);
    let flag = false;
    if (w.endsWith("eed")) { if (m(w.slice(0, -3)) > 0) w = w.slice(0, -1); }
    else if (w.endsWith("ed") && vowelIn(w.slice(0, -2))) { w = w.slice(0, -2); flag = true; }
    else if (w.endsWith("ing") && vowelIn(w.slice(0, -3))) { w = w.slice(0, -3); flag = true; }
    if (flag) {
      if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) w += "e";
      else if (doubleC(w) && !"lsz".includes(w[w.length - 1])) w = w.slice(0, -1);
      else if (m(w) === 1 && cvc(w)) w += "e";
    }
    if (w.endsWith("y") && vowelIn(w.slice(0, -1))) w = w.slice(0, -1) + "i";
    w = step(w, STEP2);
    w = step(w, STEP3);
    for (const suf of STEP4) {
      if (w.endsWith(suf)) {
        const s = w.slice(0, w.length - suf.length);
        if (suf === "ion") { if (m(s) > 1 && (s.endsWith("s") || s.endsWith("t"))) w = s; }
        else if (m(s) > 1) w = s;
        break;
      }
    }
    if (w.endsWith("e")) {
      const s = w.slice(0, -1);
      if (m(s) > 1 || (m(s) === 1 && !cvc(s))) w = s;
    }
    if (m(w) > 1 && doubleC(w) && w.endsWith("l")) w = w.slice(0, -1);
    return w;
  }

  // ---- the index, fetched on first use --------------------------------------
  let docs = null;
  const shards = new Map();
  async function loadDocs() {
    if (docs) return docs;
    const [ids, lens, avg] = await json("data/m/docs.json");
    const len = new Map();
    ids.forEach((id, k) => len.set(id, [lens[2 * k], lens[2 * k + 1]]));
    docs = { n: ids.length, len, avg };
    return docs;
  }
  async function postings(st) {
    const k = st.slice(0, 2);
    if (!shards.has(k)) shards.set(k, json(`data/m/${k}.json`).catch(() => ({})));
    return (await shards.get(k))[st] || [];
  }

  /** Words (index rows) whose meaning matches [text], best first. */
  async function search(text, limit = 10) {
    const ts = terms(text);
    if (!ts.length) return [];
    const d = await loadDocs();
    const lists = await Promise.all(ts.map((t) => postings(stem(t))));
    const score = new Map(), covered = new Map();
    lists.forEach((p, ti) => {
      const df = [0, 0];
      for (let x = 0; x < p.length; x += 3) { if (p[x + 1]) df[0]++; if (p[x + 2]) df[1]++; }
      for (let x = 0; x < p.length; x += 3) {
        const id = p[x], l = d.len.get(id);
        let s = 0;
        for (let j = 0; j < 2; j++) {
          const tf = p[x + 1 + j];
          if (!tf) continue;
          const idf = Math.log((d.n - df[j] + 0.5) / (df[j] + 0.5) + 1);
          s += (j === 0 ? 2 : 1) * idf * tf * 2.2 / (tf + 1.2 * (0.5 + 0.5 * l[j] / Math.max(d.avg[j], 1)));
        }
        score.set(id, (score.get(id) || 0) + s);
        covered.set(id, (covered.get(id) || 0) + 1);
      }
    });
    const ranked = [...score.entries()].map(([id, s]) => { const c = covered.get(id) / ts.length; return [s * c * c, id]; })
      .sort((a, b) => b[0] - a[0]).slice(0, limit * 2);
    return ranked.map(([, id]) => data.byId.get(id)).filter((e) => e && !ts.includes(e.word.toLowerCase())).slice(0, limit);
  }

  return { search, stem, terms };
})();
