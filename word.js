/* Wordly web — the word page, recreated from the app (DetailScreen.kt,
   Markdown.kt, GlassTray.kt, Pronounce.kt, Stories.kt, MixUps.kt, Families.kt).
   Numbers are the app's: see the comments beside each piece. */
"use strict";

const Word = (() => {
  const { Spring, tween, ease, onFrame } = Motion;
  const overshoot = ease.overshoot(1.0);
  // The first screen's lines all start within maxStart, at ONE even pace: up
  // to `stagger` apart, closer when the screen holds more lines (a long entry
  // never bunches up at the bottom). Same rule as the app (Markdown.kt).
  const LINE = { stagger: 70, duration: 560, maxStart: 1500, rise: 14 };

  // ---- colours -------------------------------------------------------------
  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // The word's own colour, softened 42% towards white on the dark page (as is on the cream one).
  function accentOf(seed) {
    const [r, g, b] = rgbOf(PALETTE[((seed % 10) + 10) % 10][0]);
    const m = (c) => (Settings.isDark() ? Math.round(c + (255 - c) * 0.42) : c);
    return [m(r), m(g), m(b)];
  }

  // ---- the line-by-line reveal (Markdown.kt RevealingTextView) -------------
  // Each line of text fades up 14 px with a soft overshoot over 560 ms, one
  // line every 70 ms (start times capped at 1.2 s so long entries never crawl).
  // Table rows count as lines. Returns when the last line starts.
  const KEYS = Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    return { opacity: t, transform: `translate3d(0, ${((1 - overshoot(t)) * LINE.rise).toFixed(2)}px, 0)` };
  });
  function revealLines(root, startDelay = 0) {
    // Each word goes in its own box so it can move, but the spaces stay
    // OUTSIDE the boxes: the text wraps exactly as plain text would, so the
    // page looks the same during and after the reveal (the boxes stay).
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest("table") || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const t of texts) {
      const frag = document.createDocumentFragment();
      for (const tok of t.nodeValue.split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); continue; }
        const s = document.createElement("span");
        s.className = "rv";
        s.textContent = tok;
        frag.appendChild(s);
      }
      t.replaceWith(frag);
    }
    // Group the pieces into the lines the reader sees. As in the app (where a
    // paragraph gap is itself an empty line of the text), moving on to a new
    // block — paragraph, heading, list, quote — adds one extra beat.
    const units = [...root.querySelectorAll(".rv, tr")];
    const blockOf = (u) => { let n = u; while (n.parentElement && n.parentElement !== root) n = n.parentElement; return n; };
    let line = -1, lastTop = null, lastBlock = null;
    const lineOf = [], tops = [];
    for (const u of units) {
      const top = Math.round(u.getBoundingClientRect().top);
      tops.push(top);
      const block = blockOf(u);
      if (lastBlock !== null && block !== lastBlock) line += 1;          // the gap line
      if (u.tagName === "TR" || lastTop === null || Math.abs(top - lastTop) > 3 || block !== lastBlock) line += 1;
      lastTop = top; lastBlock = block;
      lineOf.push(line);
    }
    const lines = line + 1;
    // Further down than this: off screen until long after the cascade ends.
    // Measured from the top of the text, not the screen — while the page
    // slides in (e.g. from the home cards) it can still be off screen itself.
    const rootTop = root.getBoundingClientRect().top;
    const below = rootTop + innerHeight + 240;
    // How many lines fit on the first screen (where the text starts, kept
    // sensible while a page slides in) → one even beat for all of them.
    const room = innerHeight - Math.min(Math.max(rootTop, 0), innerHeight / 2);
    let onScreen = 0;
    units.forEach((u, i) => { if (tops[i] - rootTop < room) onScreen = Math.max(onScreen, lineOf[i] + 1); });
    const beat = onScreen > 1 ? Math.min(LINE.stagger, LINE.maxStart / (onScreen - 1)) : LINE.stagger;
    const delayOf = (i) => startDelay + Math.min(lineOf[i] * beat, LINE.maxStart);
    units.forEach((u, i) => {
      if (tops[i] > below) return;
      u.animate(KEYS, { duration: LINE.duration, delay: delayOf(i), fill: "backwards" });
    });
    // What isn't a word — list bullets and numbers, a quote's bar, a divider —
    // stays hidden (class "rvh", see word.css) until the first line it belongs
    // to (for a divider: the line after it) starts to rise. Only the marks
    // themselves are hidden, never the element, so the words' own rise is
    // untouched (Safari mishandles words rising inside a fading parent).
    for (const el of root.querySelectorAll("li, blockquote, hr")) {
      const i = el.tagName === "HR"
        ? units.findIndex((u) => el.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING)
        : units.findIndex((u) => el.contains(u));
      if (i < 0 || tops[i] > below) continue;
      el.classList.add("rvh");
      setTimeout(() => el.classList.remove("rvh"), delayOf(i) + 60);
    }
    return startDelay + Math.min(Math.max(0, lines - 1) * beat, LINE.maxStart);
  }
  // One element rising like a line of text (cards that follow the text).
  function riseAt(el, delay) {
    el.animate(KEYS, { duration: LINE.duration, delay: Math.max(0, delay), fill: "backwards" });
  }

  // ---- speech + the sound bars (Pronounce.kt EqualizerBars) ---------------
  const speech = { preparing: false, speaking: false, listeners: new Set() };
  function setSpeech(p, s) { speech.preparing = p; speech.speaking = s; speech.listeners.forEach((f) => f()); }
  function speak(word) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    const v = speechSynthesis.getVoices().find((x) => x.lang === "en-US" && x.localService) ||
      speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith("en"));
    if (v) u.voice = v;
    u.onstart = () => setSpeech(false, true);
    u.onend = u.onerror = () => setSpeech(false, false);
    setSpeech(true, false);
    speechSynthesis.speak(u);
  }
  function equalizer(svg) {
    const bars = [...svg.querySelectorAll("rect")];
    const REST = [0.55, 0.9, 0.45, 0.72];
    const H = 22;
    const draw = (heights, alpha) => bars.forEach((b, i) => {
      const h = H * heights[i];
      b.setAttribute("y", ((H - h) / 2).toFixed(2));
      b.setAttribute("height", h.toFixed(2));
      b.setAttribute("opacity", alpha);
    });
    draw(REST, 1);
    let stop = null;
    const fos = ease.fastOutSlowIn;
    const update = () => {
      if (!speech.preparing && !speech.speaking) { stop && stop(); stop = null; draw(REST, 1); return; }
      if (stop) return;
      const t0 = performance.now();
      stop = onFrame((now) => {
        const t = now - t0;
        if (speech.speaking) {
          // Each bar 0.30 ↔ 1 over 360 + i·110 ms, reversing (FastOutSlowIn).
          draw(bars.map((_, i) => {
            const d = 360 + i * 110, k = (t / d) % 2, p = k < 1 ? k : 2 - k;
            return 0.30 + 0.70 * fos(p);
          }), 1);
        } else {
          // A loading wave: 900 ms, each bar a fifth of a turn behind.
          const w = (t % 900) / 900;
          draw(bars.map((_, i) => 0.32 + 0.55 * (0.5 + 0.5 * Math.sin((w - i * 0.2) * 2 * Math.PI))), 0.8);
        }
      });
    };
    speech.listeners.add(update);
    return () => speech.listeners.delete(update);
  }

  // ---- the glass tray (GlassTray.kt) ---------------------------------------
  const BACK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19.2 12H4.8M10.8 5.76L4.56 12l6.24 6.24"/></svg>`;
  const EQ = `<svg width="22" height="22" viewBox="0 0 22 22">${[0, 1, 2, 3].map((i) => {
    const gap = 22 * 0.13, w = (22 - gap * 3) / 4;
    return `<rect x="${(i * (w + gap)).toFixed(2)}" width="${w.toFixed(2)}" rx="${(w / 2).toFixed(2)}" fill="currentColor"/>`;
  }).join("")}</svg>`;
  // The saved gold (a deeper amber on the light glass) and the tray's ink.
  const GOLD = "var(--saved)";
  const glassRgb = () => (Settings.isDark() ? ["255,203,107", "255,255,255"] : ["199,136,26", "38,40,46"]);

  function tray(entry, onBack, seed) {
    const el = document.createElement("div");
    el.className = "tray2";
    const saved = () => isSaved(entry.id);
    el.innerHTML = `<canvas class="fx"></canvas><div class="glass">
      <button class="slot" data-press="tray" data-k="back" aria-label="Back">${BACK}</button>
      <button class="slot" data-press="tray" data-k="listen" aria-label="Hear the word">${EQ}</button>
      <button class="slot" data-press="tray" data-k="font" aria-label="Font settings"><span class="aa"><span class="A">A</span><span class="a">a</span></span></button>
      <button class="slot" data-press="tray" data-k="mark" aria-label="Save word"><span class="mk">${saved() ? ICONS.ic_bookmark_filled : ICONS.ic_bookmark_outline}</span></button>
      <button class="slot" data-press="tray" data-k="share" aria-label="Share this word"><span class="sh" style="display:block;width:21px;height:21px">${ICONS.ic_share}</span></button>
    </div>`;
    const mk = el.querySelector(".mk");
    mk.style.cssText = `display:block;width:24px;height:24px;color:${saved() ? GOLD : "var(--tray-ink)"}`;
    el.querySelector(".sh svg").style.cssText = "width:21px;height:21px";
    mk.querySelector("svg").style.cssText = "width:24px;height:24px";
    const stopEq = equalizer(el.querySelector('[data-k="listen"] svg'));

    // Appears with spring(0.6, 300): rises 64 dp, grows from 0.82, fades in.
    new Spring(0, { damping: 0.6, stiffness: 300, onUpdate: (a) => {
      el.style.opacity = Math.min(1, Math.max(0, a));
      el.style.transform = `translateX(-50%) translate3d(0, ${((1 - a) * 64).toFixed(1)}px, 0) scale(${(0.82 + 0.18 * a).toFixed(4)})`;
    } }).to(1);

    // Effects layer: ripple rings and the save burst, drawn past the pill's edge.
    const canvas = el.querySelector(".fx");
    const ctx = canvas.getContext("2d");
    const fx = [];
    let fxStop = null;
    function paint() {
      const r = canvas.getBoundingClientRect();
      const d = devicePixelRatio || 1;
      if (canvas.width !== Math.round(r.width * d)) { canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); }
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, r.width, r.height);
      const now = performance.now();
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i];
        const t = Math.min(1, (now - f.t0) / f.dur);
        if (t >= 1) { fx.splice(i, 1); continue; }
        f.draw(ctx, f.x - r.left, f.y - r.top, f.ease(t));
      }
      if (!fx.length) { fxStop && fxStop(); fxStop = null; ctx.clearRect(0, 0, r.width, r.height); }
    }
    function addFx(target, dur, easing, draw) {
      const b = target.getBoundingClientRect();
      fx.push({ x: b.left + b.width / 2, y: b.top + b.height / 2, t0: performance.now(), dur, ease: easing, draw });
      if (!fxStop) fxStop = onFrame(() => { paint(); });
    }
    // Tap ripple (480 ms, LinearOutSlowIn): a soft disc and a ring swelling out.
    const ripple = (c, x, y, t) => {
      const W = glassRgb()[1];
      const out = 1 - (1 - t) * (1 - t);
      c.fillStyle = `rgba(${W},${0.10 * (1 - t)})`;
      c.beginPath(); c.arc(x, y, 16 + 10 * out, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(${W},${0.55 * (1 - t)})`;
      c.lineWidth = 1.6 * (1 - t) + 0.4;
      c.beginPath(); c.arc(x, y, 16 + 18 * out, 0, Math.PI * 2); c.stroke();
    };
    // Save splash (820 ms): a gold ring, then two rings of gold/white dots.
    const burst = (c, x, y, t) => {
      const [G, W] = glassRgb();
      const out = 1 - (1 - t) ** 3;
      const rt = Math.min(1, t / 0.7), rout = 1 - (1 - rt) * (1 - rt);
      c.strokeStyle = `rgba(${G},${(1 - rt) * 0.9})`;
      c.lineWidth = 3 * (1 - rt) + 0.5;
      c.beginPath(); c.arc(x, y, 12 + 22 * rout, 0, Math.PI * 2); c.stroke();
      const fade = t < 0.55 ? 1 : (1 - t) / 0.45;
      for (let i = 0; i < 16; i++) {
        const outer = i % 2 === 0;
        const a = ((i * 22.5) - 90 + (outer ? 0 : 11.25)) * Math.PI / 180;
        const reach = outer ? 40 : 27;
        const dd = 10 + (reach - 10) * out;
        const rr = (outer ? 4.2 : 3.0) * (1 - 0.55 * out);
        c.fillStyle = (i % 4 === 0 || i % 4 === 3) ? `rgba(${G},${fade})` : `rgba(${W},${fade})`;
        c.beginPath(); c.arc(x + Math.cos(a) * dd, y + Math.sin(a) * dd, rr, 0, Math.PI * 2); c.fill();
      }
    };

    // Each button: ripple + its own gesture (kicked to 1, spring(0.42, 380) back).
    function kick(apply) {
      const s = new Spring(1, { damping: 0.42, stiffness: 380, onUpdate: apply });
      apply(1);
      s.to(0);
    }
    el.querySelector(".glass").addEventListener("click", (ev) => {
      const b = ev.target.closest(".slot");
      if (!b) return;
      addFx(b, 480, ease.linearOutSlowIn, ripple);
      if (navigator.vibrate) navigator.vibrate(8);
      const k = b.dataset.k;
      if (k === "back") {
        const svg = b.querySelector("svg");
        kick((v) => { svg.style.transform = `translateX(${(-6 * v).toFixed(2)}px)`; });
        setTimeout(onBack, 170);
      } else if (k === "listen") {
        speak(entry.word);
      } else if (k === "font") {
        const A = b.querySelector(".A"), a = b.querySelector(".a");
        kick((v) => { A.style.transform = `scale(${(1 + 0.22 * v).toFixed(4)})`; a.style.transform = `translateY(${(-4 * Math.max(0, v)).toFixed(2)}px)`; });
        setTimeout(() => go("#/settings/font"), 170);
      } else if (k === "share") {
        const svg = b.querySelector(".sh");
        kick((v) => { svg.style.transform = `translate(${(2 * v).toFixed(2)}px, ${(-2 * v).toFixed(2)}px) rotate(${(-24 * v).toFixed(2)}deg)`; });
        setTimeout(() => Menu.shareWord(entry, seed), 200);
      } else if (k === "mark") {
        // A word already kept (Saved or any list) opens the "My lists" sheet;
        // otherwise the tap saves it, with the gold pop and the saved note.
        if (Lists.keptAnywhere(entry.id)) {
          Lists.saveSheet(entry, () => refreshMark());
          return;
        }
        const on = toggleSaved(entry.id);
        // Crossfade to the filled gold mark (200 ms) with a springy pop.
        mk.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 200 });
        mk.innerHTML = on ? ICONS.ic_bookmark_filled : ICONS.ic_bookmark_outline;
        mk.querySelector("svg").style.cssText = "width:24px;height:24px";
        mk.style.color = on ? GOLD : "var(--tray-ink)";
        if (on) {
          new Spring(0.55, { damping: 0.36, stiffness: 520, onUpdate: (v) => { mk.style.transform = `scale(${v.toFixed(4)})`; } }).to(1);
          addFx(b, 820, ease.linearOutSlowIn, burst);
          savedNote(entry);
        }
      }
    });
    function refreshMark() {
      const on = Lists.keptAnywhere(entry.id);
      mk.innerHTML = on ? ICONS.ic_bookmark_filled : ICONS.ic_bookmark_outline;
      mk.querySelector("svg").style.cssText = "width:24px;height:24px";
      mk.style.color = on ? GOLD : "var(--tray-ink)";
    }
    el.refreshMark = refreshMark;
    el.cleanup = () => stopEq();
    refreshMark();
    return el;
  }

  // "Saved · Add to list · View" above the tray for 4 s.
  let noteTimer = null;
  function savedNote(entry) {
    document.querySelector(".savednote")?.remove();
    const n = document.createElement("div");
    n.className = "savednote";
    n.innerHTML = `<span>Saved</span><a href="#/lists/saved" data-add>Add to list</a><a href="#/lists/saved">View</a>`;
    n.querySelector("[data-add]").addEventListener("click", (e) => {
      e.preventDefault();
      n.remove();
      const t = document.querySelector(".tray2");
      Lists.saveSheet(entry, () => t && t.refreshMark && t.refreshMark());
    });
    document.body.appendChild(n);
    n.animate([{ opacity: 0, transform: "translateX(-50%) translateY(50%)" }, { opacity: 1, transform: "translateX(-50%) translateY(0)" }],
      { duration: 300, easing: "cubic-bezier(.4,0,.2,1)" });
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      const a = n.animate([{ opacity: 1, transform: "translateX(-50%) translateY(0)" }, { opacity: 0, transform: "translateX(-50%) translateY(50%)" }],
        { duration: 250, easing: "cubic-bezier(.4,0,.2,1)" });
      a.onfinish = () => n.remove();
    }, 4000);
  }

  // ---- the cards between the opening and the sections ----------------------
  function storyCard(story) {
    return `<div class="wcard"><div class="hd"><span class="disc">${icon("ic_col_scroll")}</span><span class="kk">STORY BEHIND THE WORD</span></div>
      <div class="story">${esc(story)}</div></div>`;
  }
  function mixCard(sets, id) {
    if (!sets.length) return "";
    return `<div class="wcard mix"><div class="hd"><span class="disc">${icon("ic_col_notequal")}</span><span class="kk">DON'T MIX IT UP</span></div>
      ${sets.map((s) => `<div class="set">${[...s.items].sort((a, b) => (a[0] === id ? -1 : b[0] === id ? 1 : 0)).map(([eid, meaning]) => {
        const o = data.byId.get(eid); if (!o) return "";
        const cur = eid === id;
        return `<${cur ? "div" : "a"} class="mrow ${cur ? "cur" : ""}" ${cur ? "" : `href="#/word/${eid}"`}><div class="top"><b>${esc(o.word)}</b><i>${pos(o.type)}</i>${cur ? "" : `<span class="go">›</span>`}</div>
          <div class="m">${esc(meaning)}</div></${cur ? "div" : "a"}>`; }).join("")}
        ${s.tip ? `<div class="tip">${esc(s.tip)}</div>` : ""}</div>`).join("")}</div>`;
  }
  function familyCards(fams, id) {
    return fams.map((f) => {
      const forms = String(f.forms || f.id).split("|").map((x) => x.trim().toLowerCase()).filter(Boolean);
      const withRoot = (w) => {
        const lw = w.toLowerCase();
        const part = forms.find((p) => lw.includes(p));
        if (!part) return esc(lw);
        const at = lw.indexOf(part);
        return esc(lw.slice(0, at)) + `<b>${esc(lw.slice(at, at + part.length))}</b>` + esc(lw.slice(at + part.length));
      };
      const sibs = f.items.filter((x) => x !== id).map((x) => data.byId.get(x)).filter(Boolean).slice(0, 4);
      return `<div class="wcard fam"><div class="hd"><span class="disc">${icon("ic_col_root")}</span><div><div class="kk">WORD FAMILY</div>
          <div class="root"><b>${esc(f.root)}</b>  ·  <i>${esc(f.meaning)}</i></div></div></div>
        <div class="blurb">${esc(f.blurb || "")}</div>
        ${sibs.length ? `<div class="sibs">${sibs.map((s) => `<a class="sib" data-press="0.92" href="#/word/${s.id}">${withRoot(s.word)}</a>`).join("")}</div>` : ""}
        <a class="all" href="#/family/${f.id}">See the whole family  →</a></div>`;
    }).join("");
  }

  // ---- the page ------------------------------------------------------------
  const CHEV = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;

  async function render(view, id, seed, { wotd = false, returning = false } = {}) {
    const e = data.byId.get(id);
    if (!e) return notFound();
    seed = seed ?? randomSeed();
    const animate = !returning;
    // The app has every definition on the phone, so its page opens all at
    // once: header, text and tray together. Here the text may still be on its
    // way, so the page waits for it (up to 1.5 s on a slow connection) before
    // it starts opening; the old page stays until then.
    const defP = definition(id).catch(() => null);
    const exP = extras().catch(() => null);
    await Promise.race([Promise.all([defP, exP]), new Promise((r) => setTimeout(r, 1500))]);
    addRecent(id);
    const acc = accentOf(seed);
    const accHex = `rgb(${acc.join(",")})`;
    view.style.cssText += `;--acc:${accHex};--acc-rgb:${acc.join(",")};--acc08:rgba(${acc},.08);--acc16:rgba(${acc},.16);--acc18:rgba(${acc},.18);--acc22:rgba(${acc},.22);--acc30:rgba(${acc},.30)`;
    // The strip behind the iPhone's clock takes the header's own colour (its
    // top edge: the soft stop easing into the mid one), so the header reaches the top.
    view.dataset.top = lerpHex(PALETTE[((seed % 10) + 10) % 10][0], PALETTE[((seed % 10) + 10) % 10][1], 0.3);
    const labelH = wotd ? 24 : 20;
    view.innerHTML = `<div class="wp">
      <header class="wp-head sheen" style="background:${gradient(seed)}"><div class="in">
        <div class="fold f-label" style="height:${labelH}px"><div class="label">${wotd ? "WORD OF THE DAY" : ""}</div></div>
        <div><span class="word" role="button" aria-label="Hear the word">${esc(e.word)}</span></div>
        <div class="fold f-pos" style="height:30px"><div class="pos">${pos(e.type)}</div></div>
        <div class="tail"></div></div></header>
      <div class="wp-body"><div class="top-space"></div><div class="body-in"><div class="loading">…</div></div></div></div>`;
    const head = view.querySelector(".wp-head");
    const body = view.querySelector(".wp-body");
    const wordEl = view.querySelector(".word");
    const fLabel = view.querySelector(".f-label"), fPos = view.querySelector(".f-pos"), tail = view.querySelector(".tail");
    const fullH = head.offsetHeight;
    body.style.paddingTop = fullH + "px";

    // Header entrance: spring(0.5, 150) — fades in while growing from 0.955.
    if (animate) {
      head.style.opacity = "0";
      new Spring(0, { damping: 0.5, stiffness: 150, onUpdate: (v) => {
        head.style.opacity = Math.min(1, Math.max(0, v));
        head.style.transform = `scale(${(0.955 + 0.045 * Math.min(1.3, Math.max(0, v))).toFixed(4)})`;
      } }).to(1).then(() => { head.style.transform = ""; });
    }

    // The fold: label + part-of-speech rows close, the word scales to 72%,
    // the bottom gap goes 18 → 8 — all exactly at the finger's pace.
    const dist = labelH + 30 + 10;
    let pop = 1;
    const fold = () => {
      const c = Math.min(1, Math.max(0, scrollY / dist));
      fLabel.style.height = `${labelH * (1 - c)}px`;
      fPos.style.height = `${30 * (1 - c)}px`;
      for (const f of [fLabel, fPos]) { const k = f.firstElementChild; k.style.opacity = 1 - c; k.style.transform = `translateY(${(-8 * c).toFixed(2)}px)`; }
      tail.style.height = `${18 - 10 * c}px`;
      wordEl.style.transform = `scale(${((1 - 0.28 * c) * pop).toFixed(4)})`;
    };
    let foldQueued = false;            // one fold per frame, however many scroll events
    const onScroll = () => { if (!foldQueued) { foldQueued = true; requestAnimationFrame(() => { foldQueued = false; fold(); }); } };
    addEventListener("scroll", onScroll, { passive: true });
    fold();

    // Tap the word to hear it: a tick, and a springy pop from 0.9.
    wordEl.addEventListener("click", () => {
      speak(e.word);
      if (navigator.vibrate) navigator.vibrate(8);
      new Spring(0.9, { damping: 0.4, stiffness: 420, onUpdate: (v) => { pop = v; fold(); } }).to(1);
    });

    const t = tray(e, () => history.back(), seed);
    view.appendChild(t);
    view.cleanup = () => { removeEventListener("scroll", onScroll); t.cleanup(); document.querySelector(".savednote")?.remove(); };

    const def = await defP;
    const bodyIn = view.querySelector(".body-in");
    if (!bodyIn) return;
    if (!def) { bodyIn.innerHTML = `<div class="empty">Couldn't load this word. Check your connection and try again.</div>`; return; }
    const [intro, sections] = def;
    const ex = (await exP) || { stories: {}, mixups: [], families: [] };
    const story = ex.stories[id];
    const mixes = ex.mixups.filter((m) => m.items.some(([eid]) => eid === id));
    const fams = ex.families.filter((f) => f.items.includes(id));
    const hasAfter = story || mixes.length || fams.length;
    bodyIn.innerHTML = `${intro ? `<div class="dprose intro">${intro}</div><div style="height:${(Settings.paraGap() + 18).toFixed(1)}px"></div>` : ""}
      ${hasAfter ? `<div class="after">${story ? storyCard(story) : ""}${mixCard(mixes, id)}${familyCards(fams, id)}</div><div style="height:22px"></div>` : ""}
      <div class="secs">${sections.map(([h], i) => `<div class="sec2" data-i="${i}"><div class="shd" data-press="0.975"><span class="abar"></span>
        <span class="title">${esc(h)}</span><span class="chev">${CHEV}</span></div><div class="body"></div></div>`).join("")}</div>
      <div class="dfoot"><div class="orn"><i></i><b></b><i></i></div><br>
        <span class="holder"><span class="ring"></span><span class="bnc" style="display:inline-block"><span class="pill" data-press="0.95">${icon("ic_shuffle")}Surprise me</span></span></span></div>
      <div class="wp-clear"></div>`;

    // The cascade: the opening's lines, then the cards, then each section card.
    if (animate) {
      const introEl = bodyIn.querySelector(".intro");
      const last = introEl ? revealLines(introEl, 0) : -LINE.stagger;
      const after = bodyIn.querySelector(".after");
      if (after) riseAt(after, last);
      bodyIn.querySelectorAll(".sec2").forEach((s, i) => riseAt(s, last + (i + 1) * LINE.stagger));
    }

    // Sections: tap to open (gliding up under the header) or close.
    bodyIn.querySelectorAll(".sec2").forEach((sec) => {
      const card = sec.querySelector(".shd");
      const openS = new Spring(0, { damping: 0.72, stiffness: 260, onUpdate: (v) => sec.style.setProperty("--open", v.toFixed(4)) });
      sec.openSpring = openS;
      card.addEventListener("click", () => toggle(sec, sections[Number(sec.dataset.i)][1]));
    });
    const EMPH = "cubic-bezier(0.2, 0, 0, 1)";          // ease.emphasized
    // Everything laid out after `sec` on the page (later sections, the footer):
    // drawn `from` px away from its new place, gliding back to it.
    function slideFollowers(sec, from, duration) {
      const els = [];
      for (let n = sec; n && n !== bodyIn; n = n.parentElement) {
        for (let s = n.nextElementSibling; s; s = s.nextElementSibling) els.push(s);
      }
      for (const el of els) {
        if (/absolute|fixed/.test(getComputedStyle(el).position)) continue;   // placed on its own: unaffected
        el.animate([{ transform: `translate3d(0, ${from}px, 0)` }, { transform: "translate3d(0, 0, 0)" }], { duration, easing: EMPH });
      }
    }
    function closeSilently(sec) {
      const b = sec.querySelector(".body");
      b.getAnimations().forEach((a) => a.cancel());
      b.style.height = "0px"; b.style.overflow = ""; b.innerHTML = "";
      sec.classList.remove("open");
      sec.openSpring.snap(0);
    }
    function toggle(sec, html) {
      const b = sec.querySelector(".body");
      if (sec.classList.contains("open")) {
        // Close: fold 300 ms (emphasized) and fade 200 ms.
        sec.classList.remove("open");
        sec.openSpring.to(0);
        const h = b.offsetHeight;
        const prose = b.firstElementChild;
        // The page takes its closed layout at once; what's below slides up into
        // place and the text is wiped away from the bottom — both on the
        // browser's animation engine, no layout work per frame.
        b.style.height = "0px"; b.style.overflow = "visible";
        slideFollowers(sec, h, 300);
        if (prose) {
          prose.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
          prose.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }], { duration: 300, easing: EMPH, fill: "forwards" })
            .onfinish = () => { if (!sec.classList.contains("open")) { b.innerHTML = ""; b.style.overflow = ""; } };
        }
        return;
      }
      // Only one open at a time: others close at once, the view held still.
      bodyIn.querySelectorAll(".sec2.open").forEach((o) => {
        const above = o.getBoundingClientRect().top < sec.getBoundingClientRect().top;
        const h = o.querySelector(".body").offsetHeight;
        closeSilently(o);
        if (above) scrollTo(0, scrollY - h);
      });
      sec.classList.add("open");
      sec.openSpring.to(1);
      b.innerHTML = `<div class="dprose">${html}</div>`;
      const full = b.firstElementChild.offsetHeight;
      // Glide the card to 14 px under the (folded) header on the emphasized
      // curve: 300 + 0.4·travel ms, between 340 and 580.
      const collapsedHead = fullH - dist;
      const targetY = scrollY + sec.getBoundingClientRect().top - collapsedHead - 14;
      const foldLeft = Math.max(0, dist - scrollY);
      const travel = Math.abs(targetY - scrollY) + foldLeft;
      const glide = travel < 6 ? 0 : Math.min(580, Math.max(340, 300 + travel * 0.4));
      const unfold = Math.max(glide, 320);
      document.querySelector(".wp").style.minHeight = `${targetY + innerHeight + full}px`;
      // Safari's own smooth scroll (on the compositor) rather than a scripted one.
      if (glide) scrollTo({ top: targetY, behavior: "smooth" });
      // The section takes its full height at once; what's below slides down
      // from where it was and the text is uncovered from the top as it goes.
      b.style.height = "auto"; b.style.overflow = "";
      slideFollowers(sec, -full, unfold);
      b.firstElementChild.animate([{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: unfold, easing: EMPH });
      b.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: unfold * 0.6 });
      revealLines(b.firstElementChild, Math.round(glide * 0.7));
    }

    // "Surprise me": shows after the text (1.3 s, 500 ms fade); a tap spins the
    // shuffle mark, ripples a ring out of the pill and bounces it, then opens a
    // random word 430 ms later.
    const foot = bodyIn.querySelector(".dfoot");
    if (animate) foot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1300, fill: "backwards" });
    const pill = foot.querySelector(".pill"), ring = foot.querySelector(".ring"), bnc = foot.querySelector(".bnc");
    let busy = false;
    pill.addEventListener("click", () => {
      if (busy) return;
      busy = true;
      if (navigator.vibrate) navigator.vibrate(8);
      const ic = pill.querySelector(".ico");
      tween({ duration: 620, easing: ease.emphasized, update: (k) => { ic.style.transform = `rotate(${(360 * k).toFixed(1)}deg)`; } });
      const w = pill.offsetWidth, h = pill.offsetHeight;
      tween({ duration: 560, easing: ease.linearOutSlowIn, update: (k) => {
        const grow = 18 * k;
        ring.style.opacity = k > 0.001 && k < 0.999 ? 1 - k : 0;
        ring.style.transform = `scale(${1 + 2 * grow / w}, ${1 + 2 * grow / h})`;
        pill.style.background = `rgba(${acc},${0.13 + 0.12 * (1 - k)})`;
      }, done: () => { pill.style.background = ""; } });
      new Spring(0.9, { damping: 0.38, stiffness: 420, onUpdate: (v) => { bnc.style.transform = `scale(${v.toFixed(4)})`; } }).to(1);
      setTimeout(() => go("#/random"), 430);
    });
  }

  return { render, speak };
})();
