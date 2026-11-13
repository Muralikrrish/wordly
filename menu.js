/* Wordly web — the side menu, More, About, the privacy policy, and the share
   picture with its preview sheet, recreated from the app (MainActivity
   drawer, ui/MoreScreen.kt, AboutScreen.kt, SharePreview.kt, ShareCard.kt). */
"use strict";

const Menu = (() => {
  const { tween, ease } = Motion;
  const P = (d) => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${d}"/></svg>`;
  const I = {
    date: P("M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"),
    refresh: P("M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"),
    settings: P("M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"),
    info: P("M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"),
    star: P("M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"),
  };
  const ic = (svg, size = 24) => `<span class="ico" style="width:${size}px;height:${size}px">${svg}</span>`;
  const PLAY_LINK = "https://play.google.com/store/apps/details?id=com.murali.wordly";
  const WEB_LINK = () => location.origin + location.pathname;
  const VERSION = "1.7.0";
  const FEEDBACK_EMAIL = "muralidharan95.aero@gmail.com";

  // ---- the side menu (ModalNavigationDrawer) --------------------------------------
  // A 360 dp sheet in surfaceContainerHigh with rounded outer corners, over a 32%
  // scrim; it slides in and out over 256 ms and follows a finger dragging it.
  let drawer = null, scrim = null, openness = 0, anim = null;
  function build() {
    scrim = document.createElement("div"); scrim.className = "dscrim";
    drawer = document.createElement("nav"); drawer.className = "drawer"; drawer.setAttribute("aria-label", "Menu");
    const item = (key, label, icon, href) => `<a class="ditem" data-key="${key}" href="${href}">${icon}<span>${label}</span></a>`;
    drawer.innerHTML = `<div class="dhead"><span class="ddisc">${LOGO}</span><span class="wm dwm">Wordly</span></div>
      ${item("home", "Dictionary", `<span class="ico dlogo">${LOGO}</span>`, "#/")}
      ${item("wotd", "Word of the day", ic(I.date), "#wotd")}
      ${item("quiz", "Word challenge", ic(ICONS.ic_challenge), "#/quiz")}
      ${item("collections", "Collections", ic(ICONS.ic_collections), "#/collections")}
      ${item("families", "Word families", ic(ICONS.ic_col_root), "#/families")}
      <hr class="ddiv">
      ${item("recent", "Recent", ic(I.refresh), "#/lists/recent")}
      ${item("lists", "My lists", ic(ICONS.ic_bookmark_outline), "#/lists/saved")}
      <hr class="ddiv">
      ${item("settings", "Settings", ic(I.settings), "#/settings")}
      ${item("more", "More", ic(I.info), "#/more")}`;
    document.body.append(scrim, drawer);
    scrim.onclick = () => close();
    drawer.querySelectorAll(".ditem").forEach((a) => (a.onclick = (e) => {
      e.preventDefault();
      let href = a.getAttribute("href");
      if (href === "#wotd") { const { entry, seed } = wordOfTheDay(); href = `#/word/${entry.id}?c=${seed}&w=1`; }
      close();
      if (location.hash !== href) go(href);
    }));
    wireDrag();
  }
  const width = () => drawer.offsetWidth || 360;
  function paint(v) {
    openness = v;
    drawer.style.transform = `translate3d(${((v - 1) * 100).toFixed(3)}%,0,0)`;
    scrim.style.opacity = v;
    const shown = v > 0.001;
    drawer.style.visibility = shown ? "visible" : "hidden";
    scrim.style.pointerEvents = shown ? "auto" : "none";
    drawer.classList.toggle("flowing", shown);
  }
  function animateTo(target) {
    anim && anim.cancel();
    const from = openness;
    anim = tween({ duration: 256, easing: ease.fastOutSlowIn, update: (e) => paint(from + (target - from) * e) });
  }
  function selectedKey() {
    const h = location.hash.replace(/^#/, "");
    if (/^\/word\/.*[?&]w=1/.test(h)) return "wotd";
    const p = h.split("?")[0].split("/").filter(Boolean);
    if (!p.length || p[0] === "search") return "home";
    return { quiz: "quiz", collections: "collections", section: "collections", collection: "collections", families: "families", family: "families",
      lists: p[1] === "recent" ? "recent" : "lists", settings: "settings", more: "more", about: "more", privacy: "more", say: "more" }[p[0]] || "";
  }
  function open() {
    if (!drawer) build();
    const k = selectedKey();
    drawer.querySelectorAll(".ditem").forEach((a) => a.classList.toggle("on", a.dataset.key === k));
    Motion.syncFlow(drawer.querySelector(".wm"));
    animateTo(1);
  }
  function close() { if (drawer && openness > 0) animateTo(0); }
  const isOpen = () => openness > 0.5;
  // Dragging: from the screen's left edge to open (pages without a word open),
  // or the open sheet back to close; let go past halfway (or flick) to finish.
  function wireDrag() {
    let x0 = null, start = 0, lastX = 0, lastT = 0, vel = 0, active = false;
    addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const canOpen = !location.hash.startsWith("#/word/") && !location.hash.startsWith("#/quiz/play") && !document.querySelector(".sheetover, .pover");
      if (openness > 0.5 ? (e.target.closest(".drawer") || e.target === scrim) : (canOpen && e.clientX < 20)) {
        x0 = e.clientX; start = openness; lastX = e.clientX; lastT = e.timeStamp; vel = 0; active = false;
      }
    }, { passive: true });
    addEventListener("pointermove", (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      if (!active && Math.abs(dx) < 8) return;
      if (!active) { active = true; anim && anim.cancel(); drawer.querySelectorAll(".ditem").forEach((a) => (a.style.pointerEvents = "none")); }
      if (e.timeStamp > lastT) vel = (e.clientX - lastX) / (e.timeStamp - lastT);
      lastX = e.clientX; lastT = e.timeStamp;
      paint(Math.min(1, Math.max(0, start + dx / width())));
    }, { passive: true });
    const up = () => {
      if (x0 == null) return;
      x0 = null;
      drawer.querySelectorAll(".ditem").forEach((a) => (a.style.pointerEvents = ""));
      if (!active) return;
      animateTo(vel > 0.4 ? 1 : vel < -0.4 ? 0 : openness > 0.5 ? 1 : 0);
    };
    addEventListener("pointerup", up, { passive: true });
    addEventListener("pointercancel", up, { passive: true });
  }
  addEventListener("hashchange", () => { if (openness > 0 && !anim) paint(0); });

  // ---- More (MoreScreen) -----------------------------------------------------------
  function morePage(view) {
    const { tileHtml, wireTiles, subBar, wireBack } = Settings;
    view.innerHTML = subBar("More") + `<div class="sgroup" style="margin-top:12px">
      ${tileHtml({ title: "Pronunciation guide", subtitle: "How to read PEN-i-tuhns", icon: Word.SPEAKER.replace('class="spk"', 'class="spk" width="21" height="21"'), seed: 5, act: "say" })}</div>
      <div class="sgroup" style="margin-top:16px">
      ${tileHtml({ title: "Feedback", icon: ic(ICONS.ic_mail, 21), seed: 1, act: "feedback" })}
      ${tileHtml({ title: "Rate this app", icon: ic(I.star, 21), seed: 6, act: "rate" })}
      ${tileHtml({ title: "Share this app", icon: ic(ICONS.ic_share, 21), seed: 9, act: "share" })}
      ${tileHtml({ title: "About", icon: ic(I.info, 21), seed: 3, act: "about" })}</div>`;
    wireBack(view);
    wireTiles(view, (a) => {
      if (a === "about") return go("#/about");
      if (a === "say") return go("#/say");
      if (a === "rate") return void open_(PLAY_LINK);
      if (a === "share") {
        const text = `Check out Wordly, a dictionary and vocabulary builder that explains words clearly:\n${WEB_LINK()}`;
        if (navigator.share) navigator.share({ title: "Wordly: Vocabulary Builder", text }).catch(() => {});
        else navigator.clipboard?.writeText(text);
        return;
      }
      if (a === "feedback") {
        // Opens the reader's own email app with the app's feedback template.
        const ua = navigator.userAgent;
        const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : "Computer";
        const os = (ua.match(/OS (\d+[_\d]*)/) || ua.match(/Android [\d.]+/) || [""])[0].replace(/_/g, ".");
        const utc = new Date().toISOString().replace("T", " ").slice(0, 19);
        const body = `Please type your feedback above this line.\n\n---Please do not delete---\nApp: Wordly (web)\nApp Version: ${VERSION}\nDevice Type: ${device}\nOS Version: ${os}\nUTC Time: ${utc}\n`;
        location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`Wordly Dictionary App Feedback - ${device} (web)`)}&body=${encodeURIComponent(body)}`;
      }
    });
  }
  const open_ = (url) => window.open(url, "_blank", "noopener");

  // ---- About (AboutScreen) -------------------------------------------------------------
  function aboutPage(view) {
    view.innerHTML = Settings.subBar("About") + `<div class="about">
      <div style="height:28px"></div><span class="adisc">${LOGO}</span><div style="height:14px"></div>
      <span class="wm awm">Wordly</span><div class="aver">Version ${VERSION}</div><div style="height:22px"></div>
      <div class="atag">A treasury of words, always at hand.</div><div style="height:12px"></div>
      <div class="abody">Nearly 18,000 carefully chosen English words, phrases and idioms, each explained in clear, vivid language that makes its meaning stick — and short meanings for 125,000+ more. Every word you open is kept on your device, so Wordly is fast, private, and keeps working without the internet.</div><div class="abody" style="opacity:.75">Quick definitions for words Wordly doesn't explain yet come from Open English WordNet (globalwordnet.github.io), licensed under CC BY 4.0.</div>
      <div style="height:22px"></div><div class="aby">Made by Muralidharan</div><div style="height:18px"></div>
      <a class="apriv" href="#/privacy">Privacy policy</a><div style="height:32px"></div></div>`;
    Settings.wireBack(view);
    Motion.syncFlow(view.querySelector(".wm"));
  }
  // The policy, written for the web version (what it stores and where it comes from).
  const PRIVACY = [
    ["", "Wordly (\"the app\") is an English dictionary developed by Muralidharan. This page covers the web version of Wordly, the one you add to your home screen from the browser. In short: Wordly does not collect, store, or share any personal information."],
    ["Information we collect", "None. Wordly does not ask for your name, email address, location, contacts, or any account."],
    ["Where the words come from", "The web version downloads its words from the website it lives on (GitHub Pages), and keeps each part on your device the first time it is needed, so words you have opened work offline afterwards. Like any website, the host may record basic technical details of each download (such as your IP address and browser type) in its own logs; Wordly itself never sees or uses them."],
    ["Data stored on your device", "Your activity within the app — such as your saved words and lists, recent searches, Word Challenge progress and your settings — is stored only in your browser on this device. It is never sent to the developer or to anyone else. Clearing this website's data in your browser settings removes it."],
    ["Feedback", "If you choose the \"Feedback\" option, your own email app opens a pre-filled message addressed to the developer, with basic technical details (the app version, your device type and system version). Nothing is sent unless you personally choose to send the email."],
    ["Third-party services", "Wordly does not use any third-party analytics, advertising, or tracking services."],
    ["Children's privacy", "Because Wordly collects no data at all, it is suitable for users of all ages."],
    ["Changes to this policy", "If this policy changes in the future, this page will be updated with a new \"last updated\" date."],
    ["Contact", `For any questions about this policy, contact: ${FEEDBACK_EMAIL}`],
  ];
  function privacyPage(view) {
    view.innerHTML = Settings.subBar("Privacy policy") + `<div class="priv"><div class="pupd">Last updated: 5 November 2026</div>
      ${PRIVACY.map(([h, b]) => `${h ? `<h3>${esc(h)}</h3>` : `<div style="height:12px"></div>`}<p>${esc(b)}</p>`).join("")}<div style="height:36px"></div></div>`;
    Settings.wireBack(view);
  }

  // ---- Pronunciation guide (SayGuideScreen) ---------------------------------------------
  // [spelled, as in, a Wordly word that has it, its say-it spelling] — tap a row to hear it.
  const VOWELS = [["a", "as in cat", "Abstract", "AB-strakt"], ["ay", "as in say", "Vindicate", "VIN-di-kayt"],
    ["ah", "as in father", "Facade", "fuh-SAHD"], ["o", "as in hot", "Jocular", "JOK-yuh-lur"], ["aw", "as in law", "Laud", "LAWD"],
    ["e", "as in bed", "Penitence", "PEN-i-tuhns"], ["ee", "as in see", "Serene", "suh-REEN"], ["i", "as in sit", "Ephemeral", "i-FEM-uh-ruhl"],
    ["y", "as in fly", "Indict", "in-DYT"], ["eye", "the same sound, on its own", "Irony", "EYE-ruh-nee"], ["oh", "as in go", "Morose", "muh-ROHS"],
    ["oo", "as in food", "Lucid", "LOO-sid"], ["uu", "as in book", "Pulpit", "PUUL-pit"], ["uh", "as in cup, and the soft sound in about", "Hyperbole", "hy-PUR-buh-lee"],
    ["ow", "as in cow", "Renown", "ri-NOWN"], ["oy", "as in boy", "Turmoil", "TUR-moyl"], ["yoo", "as in cute", "Mutiny", "MYOO-tn-ee"]];
  const R_VOWELS = [["ur", "as in her", "Colonel", "KUR-nuhl"], ["ar", "as in car", "Larceny", "LAR-suh-nee"], ["or", "as in for", "Ornate", "or-NAYT"],
    ["air", "as in care", "Nefarious", "ni-FAIR-ee-uhs"], ["eer", "as in here", "Austere", "aw-STEER"]];
  const CONSONANTS = [["g", "always hard, as in go", "Gregarious", "gri-GAIR-ee-uhs"], ["j", "as in jam, and a soft g", "Gist", "JIST"],
    ["k", "as in kite, and a hard c", "Chaos", "KAY-os"], ["s", "always as in see", "Lucid", "LOO-sid"], ["z", "as in zoo, and an s that buzzes", "Raze", "RAYZ"],
    ["ch", "as in chin", "Chide", "CHYD"], ["sh", "as in shoe", "Chicanery", "shi-KAY-nuh-ree"], ["zh", "as in the middle of measure", "Genre", "ZHAHN-ruh"],
    ["th", "as in think", "Ethos", "EE-thos"], ["ng", "as in sing", "Harangue", "huh-RANG"], ["y", "before a vowel, as in yes", "Lanyard", "LAN-yurd"],
    ["kw", "as in queen", "Quixotic", "kwik-SOT-ik"], ["ks", "as in box", "Taxonomy", "tak-SON-uh-mee"]];
  const RULES = [["The hyphens split a word into its beats.", "PEN · i · tuhns is three beats."],
    ["The beat in capitals is the one you say loudest.", "PEN-i-tuhns, not pen-I-tuhns."],
    ["Each sound is always spelled the same way.", "Learn the sounds below once, and you can read every word. The sounds are American English."]];
  const NOTES = [["A beat with no vowel", "A lone l or n, as in MET-l (mettle) or LAYD-n (laden), is a quick beat you say with almost no vowel, like the end of little or kitten."],
    ["Same spelling, different sound", "Some words change with their job. Intimate is IN-tuh-mit when it describes something and IN-tuh-mayt when it means to hint. Each one shows its own."],
    ["Two ways to say it", "A few words are said two ways, shown with “or”: Peaked is PEEKT (pointed) or PEE-kid (looking pale and unwell)."],
    ["Words and phrases", "Single words get a pronunciation. Idioms and longer phrases are made of everyday words, so they don't need one."]];
  function sayGuidePage(view) {
    const card = (rows) => `<div class="sgcard">${rows.map(([s, as, w, p]) => `<div class="sgrow" role="button" data-w="${esc(w)}" aria-label="Hear ${esc(w)}">
      <span class="sgchip">${esc(s)}</span><span class="sgtx"><span class="sgas">${esc(as)}</span><span class="sgex"><span class="sgw">${esc(w)}</span><span class="sayt">${Word.sayItHtml(p)}</span></span></span>${Word.SPEAKER}</div>`).join("")}</div>`;
    view.innerHTML = Settings.subBar("Pronunciation guide") + `<div class="sg">
      <div class="sghero"><p>Every word starts with how to say it, spelled the way it sounds. Tap it to hear the word.</p>
        <div class="sgline" role="button" data-w="Penitence" aria-label="Hear Penitence">${Word.SPEAKER}<span class="sayt">${Word.sayItHtml("PEN-i-tuhns")}</span></div><small>Penitence</small></div>
      <h3>Three simple rules</h3>${RULES.map(([t, b], i) => `<div class="sgrule"><span class="sgn">${i + 1}</span><span><b>${esc(t)}</b><small>${esc(b)}</small></span></div>`).join("")}
      <h3>Vowel sounds</h3>${card(VOWELS)}<h3>Vowels with an r</h3>${card(R_VOWELS)}
      <h3>Consonants worth knowing</h3><p class="sgp">Most consonants sound just as they look. These are the ones to know:</p>${card(CONSONANTS)}
      <h3>Good to know</h3>${NOTES.map(([t, b]) => `<div class="sgnote"><b>${esc(t)}</b><p>${esc(b)}</p></div>`).join("")}<div style="height:40px"></div></div>`;
    Settings.wireBack(view);
    // Only the row just tapped shows its waves moving.
    let playing = null;
    const show = () => view.querySelectorAll("[data-w]").forEach((el) => el.classList.toggle("talk", el === playing && (Word.speech.preparing || Word.speech.speaking)));
    Word.speech.listeners.add(show);
    view.cleanup = () => Word.speech.listeners.delete(show);
    view.querySelectorAll("[data-w]").forEach((el) => el.addEventListener("click", () => {
      playing = el;
      Word.speak(el.dataset.w);
      if (navigator.vibrate) navigator.vibrate(8);
    }));
  }

  // ---- the share picture's preview (SharePreviewSheet) -----------------------------------
  // The sheet rises with the exact picture (a breathing spinner while it is
  // drawn, then a 320 ms crossfade), and two pills: Close and Share.
  function preview(title, making) {
    const { el, sheet, close } = Settings.sheet(`<div class="shp"><div class="shpt">${esc(title)}</div>
      <div class="shpimg" style="aspect-ratio:0.8"><span class="shpspin"></span></div>
      <div class="pbtns shpb"><button class="pbtn" data-press="0.94" data-a="close">Close</button>
        <button class="pbtn on" data-press="0.94" data-a="share" disabled>${ic(ICONS.ic_share, 18)}Share</button></div></div>`);
    let card = null;
    const box = el.querySelector(".shpimg"), go_ = el.querySelector('[data-a="share"]');
    el.querySelector('[data-a="close"]').onclick = () => close();
    making.then((c) => {
      card = c;
      const img = new Image();
      img.alt = title;
      img.src = URL.createObjectURL(c.blob);
      img.onload = () => {
        box.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        box.appendChild(img);
        img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
        box.querySelector(".shpspin")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: "forwards" });
      };
      go_.disabled = false;
    }).catch(() => close());
    go_.onclick = async () => {
      if (!card) return;
      const file = new File([card.blob], card.name, { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: card.message });
        else if (navigator.share) await navigator.share({ text: card.message });
        else { const a = document.createElement("a"); a.href = URL.createObjectURL(card.blob); a.download = card.name; a.click(); }
        close();
      } catch { /* the reader closed the share sheet */ }
    };
  }

  // ---- a word's share picture (ShareCard.kt renderWordCard) ---------------------------------
  const CARD_W = 1080, MIN_H = 1350, MAX_H = 1920, PAD = 96, SIZES = [44, 41, 38, 35], LINE = 1.12;
  const LIT = "'RF-literata', Georgia, serif";
  // The top passage as blocks (shareExcerpt): tables left out, a lone bold
  // title line kept with the paragraph after it, at most `max` blocks.
  function excerpt(introHtml, max) {
    const doc = new DOMParser().parseFromString(`<div>${introHtml}</div>`, "text/html").body.firstChild;
    const blocks = [...doc.children].filter((b) => !b.classList.contains("table") && b.tagName !== "TABLE");
    const merged = [];
    let title = null;
    for (const b of blocks) {
      const lone = b.tagName === "P" && b.children.length === 1 && b.firstElementChild.tagName === "STRONG" && b.textContent.trim() === b.firstElementChild.textContent.trim();
      if (lone) { title = b; continue; }
      merged.push(title ? [title, b] : [b]); title = null;
    }
    return { groups: merged.slice(0, max), truncated: merged.length > max };
  }
  // Lays rich text out in lines: [{runs:[{text,font,x}], y}] within `width`.
  function layoutBlocks(ctx, groups, size, width) {
    const lh = size * 1.485 * LINE, gap = size * 0.55, ops = [];
    let y = 0, first = true;
    const fontOf = (b, i, s = size) => `${i ? "italic " : ""}${b ? 600 : 400} ${s}px ${LIT}`;
    function runsOf(node, b, i, out) {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) out.push({ text: n.textContent.replace(/\s+/g, " "), b, i });
        else if (n.nodeName === "BR") out.push({ br: true });
        else if (/^(UL|OL)$/.test(n.nodeName)) continue;
        else runsOf(n, b || /^(STRONG|B|H\d)$/.test(n.nodeName), i || /^(EM|I)$/.test(n.nodeName), out);
      }
      return out;
    }
    function para(runs, x0, s = size) {
      const w = width - x0;
      let line = [], lx = 0;
      const flush = () => { ops.push({ y, runs: line }); y += lh * (s / size); line = []; lx = 0; };
      for (const r of runs) {
        if (r.br) { flush(); continue; }
        ctx.font = fontOf(r.b, r.i, s);
        for (const tok of r.text.split(/(\s+)/)) {
          if (!tok) continue;
          if (/^\s+$/.test(tok)) { if (lx > 0) lx += ctx.measureText(" ").width; continue; }
          const tw = ctx.measureText(tok).width;
          if (lx > 0 && lx + tw > w) flush();
          line.push({ text: tok, font: fontOf(r.b, r.i, s), x: x0 + lx });
          lx += tw;
        }
      }
      if (line.length) flush();
    }
    function block(el, x0) {
      if (!first) y += gap; first = false;
      if (/^H\d$/.test(el.tagName)) return para(runsOf(el, true, false, []), x0);
      if (el.tagName === "HR") { ops.push({ y: y + lh / 2, rule: true, x: x0 }); y += lh; return; }
      if (el.tagName === "BLOCKQUOTE") {
        const top = y; let inner = true;
        for (const c of el.children) { if (!inner) y += gap; inner = false; para(runsOf(c, false, false, []), x0 + size * 0.9); }
        ops.push({ bar: true, x: x0, y: top, h: y - top }); return;
      }
      if (el.tagName === "UL" || el.tagName === "OL") return list(el, x0);
      para(runsOf(el, false, false, []), x0);
    }
    function list(el, x0) {
      let n = 0;
      for (const li of el.children) {
        n++;
        const mark = el.tagName === "OL" ? `${n}.` : "•";
        ops.push({ y, runs: [{ text: mark, font: fontOf(false, false), x: x0 }] });
        para(runsOf(li, false, false, []), x0 + size * 1.25);
        for (const sub of li.children) if (/^(UL|OL)$/.test(sub.tagName)) list(sub, x0 + size * 1.25);
      }
    }
    for (const g of groups) for (const el of g) block(el, 0);
    return { ops, height: y, ascent: size * 1.177 };
  }
  async function wordCard(entry, seed) {
    await Promise.all(["400 40px Outfit", "600 40px Outfit", "700 40px Outfit", `400 40px ${LIT}`, `600 40px ${LIT}`, `italic 400 40px ${LIT}`].map((f) => document.fonts.load(f).catch(() => {})));
    const def = await definition(entry.id);
    const intro = def ? def[0] : `<p>${esc(entry.preview || "")}</p>`;
    const inner = CARD_W - 2 * PAD;
    const cv = document.createElement("canvas"); cv.width = CARD_W;
    const c = cv.getContext("2d");
    // The word: as large as fits (no word broken), up to two lines.
    const tagH = 34 * 1.26;
    let wsize = 72, wlines = [entry.word];
    for (const sz of [150, 132, 116, 102, 90, 80, 72]) {
      c.font = `600 ${sz}px Outfit`;
      const toks = entry.word.split(" ");
      if (toks.some((t) => c.measureText(t).width > inner)) continue;
      const lines = []; let cur = "";
      for (const t of toks) { const tryL = cur ? cur + " " + t : t; if (cur && c.measureText(tryL).width > inner) { lines.push(cur); cur = t; } else cur = tryL; }
      lines.push(cur);
      if (lines.length <= 2) { wsize = sz; wlines = lines; break; }
    }
    const wordLH = wsize * 1.26 * 1.05;
    const headerH = PAD + 20 + tagH + 30 + wordLH * wlines.length + 40 + 6 + 46;
    const logoSize = 76, footerH = 76 + logoSize + PAD, hintH = 34 + 30 * 1.26;
    let text = null, cut = false, tsize = SIZES[0];
    search: for (let n = 4; n >= 1; n--) {
      const ex = excerpt(intro, n);
      for (const sz of SIZES) {
        const l = layoutBlocks(c, ex.groups, sz, inner);
        if (headerH + l.height + (ex.truncated ? hintH : 0) + footerH <= MAX_H) { text = l; cut = ex.truncated; tsize = sz; break search; }
      }
    }
    if (!text) {
      const ex = excerpt(intro, 1); tsize = SIZES[SIZES.length - 1];
      text = layoutBlocks(c, ex.groups, tsize, inner);
      const room = MAX_H - headerH - hintH - footerH, lh = tsize * 1.485 * LINE;
      const keep = Math.max(1, Math.floor(room / lh));
      text.ops = text.ops.filter((o) => o.y < keep * lh); text.height = keep * lh; cut = true;
    }
    const h = Math.round(Math.min(MAX_H, Math.max(MIN_H, headerH + text.height + (cut ? hintH : 0) + footerH)));
    cv.height = h;
    // Background: the word's own colour, shaded like its page, with a soft glow.
    const lg = c.createLinearGradient(0, 0, CARD_W, h);
    shading(seed).forEach(([s, col]) => lg.addColorStop(s, col));
    c.fillStyle = lg; c.fillRect(0, 0, CARD_W, h);
    const rg = c.createRadialGradient(CARD_W * 0.22, 1350 * 0.16, 0, CARD_W * 0.22, 1350 * 0.16, CARD_W * 0.95);
    rg.addColorStop(0, "rgba(255,255,255,0.141)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = rg; c.fillRect(0, 0, CARD_W, h);
    const text_ = (t, x, y, font, alpha = 1, spacing = 0) => {
      c.font = font; c.globalAlpha = alpha; c.fillStyle = "#fff"; c.textAlign = "left";
      if ("letterSpacing" in c) c.letterSpacing = `${spacing}px`;
      c.fillText(t, x, y); c.globalAlpha = 1; if ("letterSpacing" in c) c.letterSpacing = "0px";
    };
    let y = PAD + 20 + 34;
    text_(pos(entry.type).toUpperCase(), PAD, y, "600 34px Outfit", 0.78, 34 * 0.16);
    y += 34 * 0.26 + 30;
    wlines.forEach((l, i) => text_(l, PAD, y + wsize + i * wordLH, `600 ${wsize}px Outfit`));
    y += wordLH * wlines.length + 40;
    c.globalAlpha = 130 / 255; c.fillStyle = "#fff";
    c.beginPath(); c.roundRect ? c.roundRect(PAD, y, 84, 6, 3) : c.rect(PAD, y, 84, 6); c.fill(); c.globalAlpha = 1;
    y += 52;
    for (const o of text.ops) {
      if (o.bar) { c.fillStyle = "rgba(255,255,255,.45)"; c.fillRect(PAD + o.x, y + o.y, 5, o.h); continue; }
      if (o.rule) { c.fillStyle = "rgba(255,255,255,.3)"; c.fillRect(PAD + o.x, y + o.y, inner, 2); continue; }
      for (const r of o.runs) text_(r.text, PAD + r.x, y + o.y + text.ascent, r.font, 0.95);
    }
    y += text.height;
    if (cut) text_("Read the full entry in Wordly", PAD, y + 34 + 30, "400 30px Outfit", 0.72);
    const footerTop = h - PAD - logoSize;
    const logo = await new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(LOGO.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')); });
    if (logo) c.drawImage(logo, PAD, footerTop, logoSize, logoSize);
    const bx = PAD + logoSize + 22;
    text_("Wordly", bx, footerTop + logoSize * 0.5, "700 46px Outfit", 1, -0.92);
    text_("Vocabulary Builder", bx, footerTop + logoSize * 0.5 + 38, "400 28px Outfit", 0.72);
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    const slug = entry.word.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "word";
    return { blob, name: `wordly-${slug}.png`, message: `${entry.word} — from Wordly: Vocabulary Builder\n${WEB_LINK()}#/word/${entry.id}` };
  }
  const shareWord = (entry, seed) => preview(`Share “${entry.word}”`, wordCard(entry, seed));

  return { open, close, isOpen, morePage, aboutPage, privacyPage, sayGuidePage, preview, shareWord };
})();
