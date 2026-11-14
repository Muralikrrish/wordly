/* Wordly web — the daily review (ReviewScreen.kt, UserDataDb review table).
   Words the reader searched for, saved, listed or looked up from another app
   come back at growing gaps (tomorrow, then 3, 7, 16, 35, 90 days) until they
   stick. Kept by word and type (localStorage "review"), so it survives data
   updates that renumber the words. */
const Review = (() => {
  const GAPS = [3, 7, 16, 35, 90];
  const SESSION = 20;
  const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  const all = () => store.get("review", {});           // {"word|type": {w, t, s, d, a}}
  const keyOf = (w, t) => w.toLowerCase() + "|" + t;

  function add(e) {
    if (!e || e.quick || Quick.isQuick?.(e.id)) return;
    const r = all(), k = keyOf(e.word, e.type);
    if (r[k]) return;
    r[k] = { w: e.word, t: e.type, s: 0, d: today() + 1, a: Date.now() };
    store.set("review", r);
  }
  const addId = (id) => add(data.byId.get(id));
  const due = () => Object.values(all()).filter((x) => x.d != null && x.d <= today()).sort((a, b) => a.d - b.d || a.a - b.a);
  const dueCount = () => due().length;
  function nextDay() {
    const t = today(), ds = Object.values(all()).map((x) => x.d).filter((d) => d != null && d > t);
    return ds.length ? Math.min(...ds) : null;
  }
  function answer(item, knew) {
    const r = all(), k = keyOf(item.w, item.t), x = r[k];
    if (!x) return;
    if (!knew) { x.s = 0; x.d = today() + 1; }
    else if (x.s >= GAPS.length) { x.s += 1; x.d = null; }
    else { x.d = today() + GAPS[x.s]; x.s += 1; }
    store.set("review", r);
  }
  function drop(item) { const r = all(); delete r[keyOf(item.w, item.t)]; store.set("review", r); }
  const entryOf = (x) => (data.byNorm.get(x.w.toLowerCase()) || []).find((e) => e.type === x.t);

  // Java's String.hashCode, so a word gets the same card colour as on Android.
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; }

  // Home: "6 words to review", never in the Word of the Day's colour family.
  function banner(wotdSeed) {
    const n = dueCount();
    if (!n) return "";
    const pool = [...Array(10).keys()].filter((i) => family(i) !== family(wotdSeed));
    const seed = pool[today() % pool.length];
    return `<a class="banner rvban sheen" data-press="0.98" data-r href="#/review" style="background:${gradient(seed)}">
      <span class="rvtx"><span class="kick">TODAY'S REVIEW</span><h3>${n === 1 ? "1 word to review" : `${n} words to review`}</h3>
      <span class="sub">A minute now keeps them for good.</span></span><span class="rvgo">Start</span></a>`;
  }

  function nextLine(day) {
    if (day == null) return "";
    const d = day - today(), date = new Date(day * 86400000);
    const opts = d <= 6 ? { weekday: "long", timeZone: "UTC" } : { month: "long", day: "numeric", timeZone: "UTC" };
    return d === 1 ? "Your next review is tomorrow." : `Your next review is ${d <= 6 ? "on " : "on "}${date.toLocaleDateString("en-US", opts)}.`;
  }

  async function page(view) {
    const items = due().slice(0, SESSION);
    const cards = [];
    for (const x of items) {
      const e = entryOf(x);
      if (!e) { drop(x); continue; }        // no longer in the dictionary
      cards.push({ x, e });
    }
    const st = { i: 0, shown: false, knew: 0 };
    const prons = new Map();
    await Promise.all(cards.map(({ e }) => definition(e.id).then((d) => d && d[2] && prons.set(e.id, d[2])).catch(() => {})));
    const back = () => history.back();

    function done(title, body, filled) {
      return `<div class="rvdone"><span class="rvtick">${ICON_CHECK}</span><h2>${esc(title)}</h2><p>${body}</p>
        <button class="rvbtn ${filled ? "on" : ""}" data-press="0.96" data-a="home">Back to home</button></div>`;
    }
    function draw(animate) {
      let html;
      if (!cards.length) {
        const r = Object.values(all()), learned = r.filter((x) => x.d == null).length;
        html = done(r.length ? "Nothing to review today" : "Words come back here",
          esc("Words you search for, save, put in a list or look up from another app come back here: tomorrow, then after 3 days, a week, and longer, until they stick.")
          + (nextDay() != null ? `<br><br>${esc(nextLine(nextDay()))}` : "") + (learned ? `<br><br>Words learned so far: ${learned}.` : ""), false);
      } else if (st.i >= cards.length) {
        const miss = cards.length - st.knew;
        html = done("All done for today", esc(`You remembered ${st.knew} of ${cards.length}.`
          + (miss ? (miss === 1 ? " The one you missed comes back tomorrow." : " The ones you missed come back tomorrow.") : ""))
          + (nextDay() != null ? `<br><br>${esc(nextLine(nextDay()))}` : ""), true);
      } else {
        const { e } = cards[st.i];
        const seed = ((hash(e.word.toLowerCase()) % 10) + 10) % 10;
        const pron = prons.get(e.id);
        html = `<div class="rvs"><div class="rvof">${st.i + 1} of ${cards.length}</div>
          <div class="rvbar"><i style="width:${Math.max(2, (st.i / cards.length) * 100)}%"></i></div>
          <div class="rvcard"><div class="rvface sheen" style="background:${gradient(seed)}"><div class="kk">DO YOU REMEMBER?</div>
            <div class="w">${esc(e.word)}</div><div class="p">${pos(e.type)}</div></div>
          ${pron ? `<div class="sayit rvsay" role="button" aria-label="Hear the word">${Word.SPEAKER}<span class="sp">${Word.sayItHtml(pron)}</span></div>` : ""}
          ${st.shown ? `<div class="dprose rvmean">${esc(e.preview || "")}</div>
              <a class="rvfull" href="#/word/${e.id}">Open the full definition</a>
              <div class="rvrow"><button class="rvbtn" data-press="0.96" data-a="no">Not yet</button><button class="rvbtn on" data-press="0.96" data-a="yes">I knew it</button></div>`
            : `<p class="rvhint">Think of what it means, then check.</p><button class="rvbtn on wide" data-press="0.96" data-a="show">Show meaning</button>`}
          <button class="rvstop" data-a="stop">Stop reviewing this word</button></div></div>`;
      }
      body.innerHTML = html;
      const c = body.querySelector(".rvcard");
      if (c && animate) c.animate([{ opacity: 0, transform: "translate3d(30%,0,0)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "cubic-bezier(.4,0,.2,1)" });
      const m = body.querySelector(".rvmean");
      if (m && animate === "reveal") m.animate([{ opacity: 0, transform: "translate3d(0,10px,0)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" });
      body.querySelector(".rvsay")?.addEventListener("click", () => Word.speak(cards[st.i].e.word));
      body.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => {
        const a = b.dataset.a, cur = cards[st.i];
        if (navigator.vibrate) navigator.vibrate(8);
        if (a === "home") return back();
        if (a === "show") { st.shown = true; return draw("reveal"); }
        if (a === "yes" || a === "no") { answer(cur.x, a === "yes"); if (a === "yes") st.knew++; st.i++; st.shown = false; return draw(true); }
        if (a === "stop") { drop(cur.x); cards.splice(st.i, 1); st.shown = false; return draw(true); }
      }));
    }
    view.innerHTML = Settings.subBar("Review") + `<div class="rvbody"></div>`;
    Settings.wireBack(view);
    const body = view.querySelector(".rvbody");
    draw(false);
  }

  const ICON_CHECK = `<svg viewBox="0 0 24 24" width="40" height="40"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor"/></svg>`;
  return { add, addId, dueCount, banner, page };
})();
