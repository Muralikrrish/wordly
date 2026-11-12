/* Wordly web — search, recreated from the app (SearchScreen.kt, Common.kt
   WordRow/EmptyState, text/Spelling.kt). Search lives on the home screen, as
   in the app: the hero folds away while the bar is in use, recent words show
   as chips when it is empty, results replace the home cards. */
"use strict";

const Search = (() => {
  const { Spring, tween, ease } = Motion;

  // ---- "Did you mean" (text/Spelling.kt, line for line) -------------------
  const spellingForm = (s) => s.trim().toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "").replace(/\s+/g, " ");
  let forms = null;
  function editDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    const n = a.length, m = b.length;
    let prev2 = new Array(m + 1).fill(0), prev = Array.from({ length: m + 1 }, (_, j) => j), cur = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > limit) return limit + 1;
      const t = prev2; prev2 = prev; prev = cur; cur = t;
    }
    return Math.min(prev[m], limit + 1);
  }
  function closestWords(query, max = 5) {
    forms ??= data.index.map((e) => spellingForm(e.word));
    const q = spellingForm(query);
    if (q.length < 3) return [];
    const limit = q.length <= 5 ? 1 : q.length <= 8 ? 2 : 3;
    const distance = new Map(), rank = new Map();
    for (const w of forms) {
      if (w.length < q.length - limit || distance.get(w) === 0) continue;
      let d = editDistance(q, w, limit);
      let r = d;
      // A word still being typed: compare with the word's own start.
      if (w.length > q.length) {
        for (let len = Math.max(1, q.length - 1); len <= Math.min(w.length - 1, q.length + limit); len++) {
          const p = editDistance(q, w.slice(0, len), limit);
          if (p < d) d = p;
          if (p + 0.5 < r) r = p + 0.5;
        }
      }
      if (d > limit) continue;
      if (w[0] !== q[0]) r += 0.3;
      r += Math.abs(w.length - q.length) * 0.01;
      if (d < (distance.get(w) ?? Infinity)) distance.set(w, d);
      if (r < (rank.get(w) ?? Infinity)) rank.set(w, r);
    }
    if (!distance.size) return [];
    const best = Math.min(...distance.values());
    const chosen = [...distance.keys()].filter((w) => distance.get(w) <= best + 1)
      .sort((a, b) => rank.get(a) - rank.get(b) || (a < b ? -1 : a > b ? 1 : 0)).slice(0, max);
    const order = new Map(chosen.map((w, i) => [w, i]));
    // Every entry of the chosen words (e.g. "humble" the adjective AND the verb).
    const idx = [];
    forms.forEach((f, i) => { if (order.has(f)) idx.push(i); });
    idx.sort((a, b) => order.get(forms[a]) - order.get(forms[b]));
    return idx.map((i) => data.index[i]);
  }

  // ---- icons -----------------------------------------------------------------
  const LENS = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
  const BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19.2 12H4.8M10.8 5.76L4.56 12l6.24 6.24"/></svg>`;
  const CLEAR = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  const HISTORY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`;
  const CHEVRON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`;

  function box(q = "") {
    return `<div class="s3"><label class="sbar">
        <button class="lead" type="button" aria-label="Search"><span class="halo"></span><span class="lens">${LENS}</span><span class="back">${BACK}</span></button>
        <input id="q" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Search" value="${esc(q)}">
        <button class="clr" type="button" aria-label="Clear">${CLEAR}</button>
      </label></div>
      <div class="chips-wrap"><div class="chips-in"></div></div>
      <div class="results"></div>`;
  }

  // A row of results ("Did you mean" too): the typed letters stand out.
  function resultRow(e, q) {
    let word = esc(e.word);
    const at = q ? e.word.toLowerCase().indexOf(q.trim().toLowerCase()) : -1;
    if (at >= 0) {
      const n = q.trim().length;
      word = `<span class="dim">${esc(e.word.slice(0, at))}<b>${esc(e.word.slice(at, at + n))}</b>${esc(e.word.slice(at + n))}</span>`;
    }
    return `<div class="rrow"><a class="rlink" href="#/word/${e.id}"><div class="wrow"><div><span class="w">${word}</span><span class="t">${pos(e.type)}</span></div>
      <div class="g">${esc(e.preview || "")}</div></div></a><div class="rdiv"></div></div>`;
  }

  // The friendly empty screen (Common.kt EmptyState): rises in on
  // spring(0.75, 180); the icon floats ±3 px on a 2.6 s breath.
  function emptyState(title, message, top = 36) {
    return `<div class="empty2" style="padding-top:${top}px"><span class="disc"><span class="float">${LENS}</span></span>
      <div class="t">${esc(title)}</div><div class="m">${esc(message)}</div></div>`;
  }

  /* Wires the search bar inside a home view. `hero` folds away while the bar
     is in use; `body` (the home cards) hides while there are results. */
  function attach(view, { hero, body, query = "", focus = false }) {
    const input = view.querySelector("#q");
    const lead = view.querySelector(".lead"), lens = lead.querySelector(".lens"), back = lead.querySelector(".back"), halo = lead.querySelector(".halo");
    const clr = view.querySelector(".clr");
    const chipsWrap = view.querySelector(".chips-wrap"), chipsIn = view.querySelector(".chips-in");
    const out = view.querySelector(".results");
    let focused = false;
    let pushed = false;

    // Lens ⇄ back arrow: spring(0.68, 420) — the lens spins away and shrinks,
    // the arrow spins in and grows.
    const morph = new Spring(0, { damping: 0.68, stiffness: 420, onUpdate: (p) => {
      lens.style.opacity = Math.min(1, Math.max(0, 1 - p * 1.4));
      lens.style.transform = `rotate(${-90 * p}deg) scale(${1 - 0.5 * Math.min(1, Math.max(0, p))})`;
      back.style.opacity = Math.min(1, Math.max(0, (p - 0.15) / 0.85));
      back.style.transform = `rotate(${90 * (1 - p)}deg) scale(${0.5 + 0.5 * p})`;
    } });
    morph.snap(0);
    // The tap circle: grows in under the finger (spring 0.85, 700), then fades.
    const haloS = new Spring(0, { damping: 0.85, stiffness: 700, onUpdate: (a) => {
      halo.style.opacity = (0.13 * a).toFixed(3);
      halo.style.transform = `scale(${0.72 + 0.28 * a})`;
    } });
    haloS.snap(0);
    lead.addEventListener("pointerdown", () => haloS.to(1));
    const haloOff = () => haloS.to(0);
    lead.addEventListener("pointerup", haloOff); lead.addEventListener("pointercancel", haloOff); lead.addEventListener("pointerleave", haloOff);

    // ✕: springs in with the first letter (0.55, 520 from 0.4); out 180 ms.
    let clrShown = false;
    const clrS = new Spring(0, { damping: 0.55, stiffness: 520, onUpdate: (v) => {
      clr.style.transform = `scale(${(0.4 + 0.6 * v).toFixed(4)}) rotate(${clr.spin || 0}deg)`;
    } });
    function showClear(on) {
      if (on === clrShown) return;
      clrShown = on;
      clr.style.pointerEvents = on ? "auto" : "none";
      if (on) {
        clr.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, fill: "forwards" });
        clrS.snap(0); clrS.to(1);
      } else {
        clr.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
        tween({ duration: 180, update: (k) => { clr.style.transform = `scale(${(1 - 0.6 * k).toFixed(4)})`; } });
      }
    }
    clr.style.opacity = "0";
    clr.style.pointerEvents = "none";

    // The hero folds while the bar is in use: 360 ms FastOutSlowIn, fading in
    // 200 ms; it returns in 360 ms, fading back over 360 ms.
    let heroOpen = true;
    // The hero's natural height (its content minus the 26 dp pull-up).
    const heroH = () => hero.firstElementChild.nextElementSibling.offsetHeight - 26;
    // Everything after `el` on this screen, drawn `from` px away from its new
    // place and gliding back (browser animation engine: no layout per frame).
    const FOSI = "cubic-bezier(0.4, 0, 0.2, 1)";
    function slideAfter(el, from, duration) {
      for (let n = el; n && n !== view; n = n.parentElement) {
        for (let s = n.nextElementSibling; s; s = s.nextElementSibling) {
          if (/absolute|fixed/.test(getComputedStyle(s).position)) continue;   // placed on its own: unaffected
          s.animate([{ transform: `translate3d(0, ${from}px, 0)` }, { transform: "translate3d(0, 0, 0)" }], { duration, easing: FOSI });
        }
      }
    }
    function setHero(open) {
      if (open === heroOpen) return;
      heroOpen = open;
      const from = hero.offsetHeight;
      // The hero takes its new height at once; the bar and all below glide there.
      hero.style.height = open ? "" : "0px";
      hero.style.overflow = open ? "" : "visible";
      const to = hero.offsetHeight;
      slideAfter(hero, from - to, 360);
      const a = hero.animate([{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }], { duration: open ? 360 : 200, fill: "forwards" });
      if (!open) a.onfinish = () => { if (!heroOpen) hero.style.overflow = "hidden"; };
    }

    // Recent chips: under the bar while it is focused and empty (expand 300 /
    // shrink 220). Each chip rises in, 30 + 35·i ms apart (from the 13th on,
    // together), up to four lines.
    let chipsOpen = false;
    function setChips(open) {
      const rec = recent().map((r) => data.byId.get(r.id)).filter(Boolean).slice(0, 24);
      open = open && rec.length > 0;
      if (open === chipsOpen) return;
      chipsOpen = open;
      if (open) {
        chipsIn.innerHTML = `<div class="rhead"><span>RECENT SEARCHES</span><a class="seeall" data-press="0.92" href="#/lists/recent">See all<span class="chev">${CHEVRON}</span></a></div>
          <div class="chipflow">${rec.map((e) => `<a class="rchip" data-press="0.94" href="#/word/${e.id}"><span class="clock">${HISTORY}</span>${esc(e.word)}</a>`).join("")}</div>`;
        // Keep to four lines.
        const flow = chipsIn.querySelector(".chipflow");
        const tops = [...new Set([...flow.children].map((c) => c.offsetTop))].sort((a, b) => a - b);
        if (tops.length > 4) [...flow.children].forEach((c) => { if (c.offsetTop > tops[3]) c.remove(); });
        [...flow.children].forEach((c, i) => c.animate(
          [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 520, delay: 30 + Math.min(i, 12) * 35, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards" }));
        chipsWrap.getAnimations().forEach((a) => a.cancel());
        chipsWrap.style.overflow = "";
        const h = chipsIn.offsetHeight;
        chipsWrap.style.height = "auto";                    // full height at once…
        slideAfter(chipsWrap, -h, 300);                     // …the results glide down to make room
        chipsWrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        const see = chipsIn.querySelector(".seeall .chev");
        const nudge = new Spring(0, { damping: 0.5, stiffness: 600, onUpdate: (v) => { see.style.transform = `translateX(${(3 * v).toFixed(2)}px)`; } });
        see.parentElement.addEventListener("pointerdown", () => nudge.to(1));
        see.parentElement.addEventListener("pointerup", () => nudge.to(0));
        see.parentElement.addEventListener("pointerleave", () => nudge.to(0));
      } else {
        const h = chipsWrap.offsetHeight;
        chipsWrap.style.height = "0px"; chipsWrap.style.overflow = "visible";   // fades where it was
        slideAfter(chipsWrap, h, 220);
        chipsWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).onfinish = () => {
          if (!chipsOpen) { chipsWrap.style.overflow = ""; chipsWrap.getAnimations().forEach((a) => a.cancel()); }
        };
      }
    }
    chipsWrap.style.height = "0px";

    function render() {
      const q = input.value;
      const active = focused || q.trim().length > 0;
      morph.to(active ? 1 : 0);
      setHero(!active);
      showClear(q.length > 0);
      setChips(focused && !q.trim());
      if (!q.trim()) { out.innerHTML = ""; body.hidden = false; return; }
      body.hidden = true;
      // Quick (WordNet) words arrive in small files while typing: draw again
      // once this query's file is in. Until then, an empty result waits.
      const qn = q.trim().toLowerCase();
      const waiting = !Quick.ready(qn);
      Quick.prepare(qn).then((fresh) => { if (fresh && input.value === q) render(); });
      const found = search(q);
      if (!found.length && waiting) { out.innerHTML = ""; return; }
      if (found.length) { out.innerHTML = found.map((e) => resultRow(e, q)).join("") + `<div style="height:24px"></div>`; return; }
      const near = closestWords(q);
      if (near.length) {
        out.innerHTML = `<div class="dym"><div class="nx">No exact match for “${esc(q.trim())}”.</div><div class="k">DID YOU MEAN</div></div>` +
          near.map((e) => resultRow(e, null)).join("") + `<div style="height:24px"></div>`;
        // Suggestions rise in, 40 + 45·i ms apart (entrance(): 520 ms, 22 px).
        out.querySelectorAll(".rrow").forEach((r, i) => r.animate(
          [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 520, delay: 40 + i * 45, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards" }));
        return;
      }
      out.innerHTML = emptyState("No matches", `Nothing found for “${q.trim()}”. Check the spelling, or try just the first few letters.`);
      const e = out.querySelector(".empty2");
      new Spring(0, { damping: 0.75, stiffness: 180, onUpdate: (v) => {
        e.style.opacity = Math.min(1, Math.max(0, v)); e.style.transform = `translateY(${((1 - v) * 24).toFixed(1)}px)`;
      } }).to(1);
    }

    // Searching takes a step in history, so the phone's Back (or an iPhone's
    // swipe) clears it — exactly what Back does in the app.
    function enterSearch() {
      if (!pushed) { history.pushState({ ...(history.state || {}), s: 1 }, ""); pushed = true; }
    }
    function leave() {
      input.value = "";
      input.blur();
      focused = false;
      render();
    }
    const onPop = () => { if (pushed && !(history.state && history.state.s)) { pushed = false; leave(); } };
    addEventListener("popstate", onPop);

    input.addEventListener("focus", () => { focused = true; enterSearch(); render(); });
    input.addEventListener("blur", () => { focused = false; setTimeout(render, 0); });
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });

    // The lead button: the lens starts a search; the back arrow darts left
    // (90 ms, then spring 0.5/520) and leaves the search 110 ms later.
    lead.addEventListener("click", () => {
      halo.animate([{ opacity: 0.13 }, { opacity: 0 }], { duration: 380, easing: "cubic-bezier(.4,0,.2,1)" });
      if (morph.target === 1) {
        if (navigator.vibrate) navigator.vibrate(8);
        const s = new Spring(0, { damping: 0.5, stiffness: 520, onUpdate: (v) => { lead.style.transform = `translateX(${(-5 * v).toFixed(2)}px)`; } });
        tween({ duration: 90, easing: ease.fastOutSlowIn, update: (k) => { lead.style.transform = `translateX(${(-5 * k).toFixed(2)}px)`; },
          done: () => { s.snap(1); s.to(0); } });
        setTimeout(() => { if (pushed) history.back(); else leave(); }, 110);
      } else {
        input.focus();
      }
    });
    // ✕ clears the text (keyboard stays), with a quarter spin.
    clr.addEventListener("pointerdown", (e) => e.preventDefault());
    clr.addEventListener("click", () => {
      if (navigator.vibrate) navigator.vibrate(8);
      tween({ duration: 300, easing: ease.fastOutSlowIn, update: (k) => { clr.spin = 90 * k; } });
      input.value = "";
      input.focus();
      render();
    });

    // Opening a word from the lists: put the keyboard away first.
    out.addEventListener("click", (e) => {
      const a = e.target.closest("a.rlink");
      if (!a || document.activeElement !== input) return;
      e.preventDefault();
      input.blur();
      setTimeout(() => go(a.getAttribute("href")), 200);
    });

    view.cleanupSearch = () => removeEventListener("popstate", onPop);
    if (query) { input.value = query; enterSearch(); render(); }
    if (focus) input.focus();
  }

  return { box, attach, closestWords, spellingForm };
})();
