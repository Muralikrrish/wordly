/* Wordly web — collections, word families and My lists, recreated from the
   app (Collections.kt, Families.kt, WordListScreens.kt, WordLists.kt,
   ExitPrompt.kt). Numbers beside each piece are the app's. */
"use strict";

const Lists = (() => {
  const { Spring, tween, ease } = Motion;
  const overshoot = ease.overshoot(1.0);
  const RISE = Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    return { opacity: t, transform: `translate3d(0, ${((1 - overshoot(t)) * 14).toFixed(2)}px, 0)` };
  });
  const rise = (el, delay) => el.animate(RISE, { duration: 560, delay: Math.max(0, delay), fill: "backwards" });
  const ADD = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
  const EDIT = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
  const MORE = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;
  const CHECK = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
  const BACKARROW = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`;
  const SEARCH = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
  const CLOSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

  // The plain top bar of a sub-page (Common.kt SubScreen): back + title.
  const subBar = (title, actions = "") => `<div class="subbar"><button class="icon-btn" data-back aria-label="Back">${BACKARROW}</button>
    <h1>${esc(title)}</h1>${actions}</div>`;
  function wireBack(view) { view.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => history.back())); }

  // ---- this device's lists -------------------------------------------------
  const L = {
    lists: () => store.get("lists", []),                 // [{id, name, created}]
    items: () => store.get("listItems", {}),             // {listId: [{id, ts}]}
    save(lists, items) { if (lists) store.set("lists", lists); if (items) store.set("listItems", items); },
    in(listId, id) { return (L.items()[listId] || []).some((r) => r.id === id); },
    count(listId) { return (L.items()[listId] || []).length; },
    holding(id) { const it = L.items(); return L.lists().filter((l) => (it[l.id] || []).some((r) => r.id === id)).map((l) => l.id); },
    toggle(listId, id) {
      const it = L.items(); const arr = it[listId] || [];
      const has = arr.some((r) => r.id === id);
      it[listId] = has ? arr.filter((r) => r.id !== id) : [{ id, ts: Date.now() }, ...arr];
      L.save(null, it); return !has;
    },
    create(name, withId) {
      const lists = L.lists(); const id = lists.reduce((m, l) => Math.max(m, l.id), 0) + 1;
      lists.push({ id, name: name.trim(), created: Date.now() }); L.save(lists);
      if (withId != null) L.toggle(id, withId);
      return id;
    },
    rename(id, name) { L.save(L.lists().map((l) => (l.id === id ? { ...l, name: name.trim() } : l))); },
    remove(id) { const it = L.items(); delete it[id]; L.save(L.lists().filter((l) => l.id !== id), it); },
  };
  const LIST_NAME_MAX = 40;
  function nameProblem(name, except = null) {
    const n = name.trim();
    if (!n) return "Give your list a name";
    if (n.length > LIST_NAME_MAX) return `Keep it under ${LIST_NAME_MAX} letters`;
    if (n.toLowerCase() === "saved words" || L.lists().some((l) => l.id !== except && l.name.toLowerCase() === n.toLowerCase()))
      return `You already have a list called “${n}”`;
    return null;
  }
  // A list's colour (WordLists.kt listColor): Saved words = the accent; a list
  // = its palette hue's soft stop; the Wishlist a fixed hue.
  const SAVED = 0, WISH = -2;
  const listColor = (id) => (id === SAVED ? "#93C2D8" : PALETTE[((id === WISH ? 5 : id * 3) % 10 + 10) % 10][0]);
  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const onFill = (hex) => (lum(hex) > 0.45 ? "#14171C" : "#fff");
  const wordCount = (n) => (n === 1 ? "1 word" : `${n} words`);

  // ---- collection pages ------------------------------------------------------
  const DIE = (size) => `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="1.4" y="1.4" width="17.2" height="17.2" rx="4.6"/><g fill="currentColor" stroke="none"><circle cx="6" cy="6" r="1.7"/><circle cx="14" cy="6" r="1.7"/><circle cx="10" cy="10" r="1.7"/><circle cx="6" cy="14" r="1.7"/><circle cx="14" cy="14" r="1.7"/></g></svg>`;
  let sortChoice = "Shuffle";

  function collectionRow(e, root) {
    let w = esc(e.word);
    if (root) {
      const at = e.word.toLowerCase().indexOf(root);
      if (at >= 0) w = `<span class="dim">${esc(e.word.slice(0, at))}<b>${esc(e.word.slice(at, at + root.length))}</b>${esc(e.word.slice(at + root.length))}</span>`;
    }
    return `<div class="crow2"><a class="clink" href="#/word/${e.id}"><div class="wrow"><div><span class="w">${w}</span><span class="t">${pos(e.type)}</span></div>
      <div class="g g3">${esc(e.preview || "")}</div></div></a><div class="cdiv"></div></div>`;
  }

  async function collection(view, c, { seed, icon: iconName, family = null, returning = false }) {
    const list = c.items.map((i) => data.byId.get(i)).filter(Boolean).sort((a, b) => a.norm.localeCompare(b.norm) || a.type.localeCompare(b.type));
    const forms = family ? String(family.forms || family.id).split("|").map((x) => x.trim().toLowerCase()).filter(Boolean) : [];
    const rootIn = (w) => forms.find((f) => w.toLowerCase().includes(f));
    let sort = c.keepOrder ? "A–Z" : (returning ? sortChoice : "Shuffle");
    let shuffled = null;
    view.innerHTML = `${subBar("")}
      <div class="chead sheen" style="background:${gradient(seed)}">
        <div class="ctop"><span class="cbadge">${icon(iconName)}</span><span class="cgrp">${esc(c.group.toUpperCase())}</span></div>
        <h2>${esc(c.title)}</h2><p>${esc(c.blurb || "")}</p>
        <button class="cshuf" data-press="0.94">${DIE(17)}<span>Surprise me</span></button>
      </div>
      ${!c.keepOrder && list.length > 1 ? `<div class="sortbar">${["Shuffle", "A–Z", "Z–A"].map((s) => `<button class="spill" data-s="${s}" data-press="0.94">${s === "Shuffle" ? `<span class="die">${DIE(14)}</span>` : ""}${s}</button>`).join("")}</div>` : ""}
      <div class="clist"></div><div style="height:40px"></div>`;
    wireBack(view);
    const head = view.querySelector(".chead");
    if (!returning) {
      head.style.opacity = "0";
      new Spring(0, { damping: 0.5, stiffness: 150, onUpdate: (e) => {
        head.style.opacity = Math.min(1, Math.max(0, e));
        head.style.transform = `scale(${(0.955 + 0.045 * Math.min(1.3, Math.max(0, e))).toFixed(4)})`;
      } }).to(1);
      const bar = view.querySelector(".sortbar");
      if (bar) rise(bar, 0);
    }
    // "Surprise me": one of its words, preferring ones not opened yet.
    view.querySelector(".cshuf").onclick = () => {
      const seen = new Set(recent().map((r) => r.id));
      const fresh = list.filter((e) => !seen.has(e.id));
      const pool = fresh.length ? fresh : list;
      go(`#/word/${pool[Math.floor(Math.random() * pool.length)].id}`);
    };
    const out = view.querySelector(".clist");
    function render(animate) {
      let rows = sort === "A–Z" ? list : sort === "Z–A" ? [...list].reverse() : (shuffled ??= [...list].sort(() => Math.random() - 0.5));
      if (c.keepOrder) rows = c.items.map((i) => data.byId.get(i)).filter(Boolean);
      const lettered = !c.keepOrder && rows.length >= 40 && sort !== "Shuffle";
      let html = "", letter = null;
      rows.forEach((e) => {
        if (lettered) {
          const ch = e.word.normalize("NFD")[0];
          const L1 = /\p{L}/u.test(ch) ? ch.toUpperCase() : "#";
          if (L1 !== letter) { letter = L1; html += `<div class="lhead">${esc(letter)}</div>`; }
        }
        html += collectionRow(e, family ? rootIn(e.word) : null);
      });
      out.innerHTML = html;
      view.querySelectorAll(".spill").forEach((p) => p.classList.toggle("on", p.dataset.s === sort));
      // A fresh list rises in, row by row (70 ms apart, starts capped at 1.2 s).
      if (animate) [...out.children].slice(0, 40).forEach((r, i) => rise(r, Math.min((i + 1) * 70, 1200)));
    }
    view.querySelectorAll(".spill").forEach((p) => p.addEventListener("click", () => {
      const s = p.dataset.s;
      if (s === "Shuffle") {
        // Every Shuffle tap answers: the die rolls a turn (520 ms), the pill bounces.
        const die = p.querySelector(".die");
        tween({ duration: 520, update: (k) => { die.style.transform = `rotate(${360 * k}deg)`; } });
        new Spring(0.88, { damping: 0.4, stiffness: 500, onUpdate: (v) => { p.style.transform = `scale(${v.toFixed(4)})`; } }).to(1);
        shuffled = null;
      } else if (s === sort) return;
      sort = s; sortChoice = s;
      if (scrollY > out.offsetTop - 120) scrollTo(0, out.offsetTop - 120);
      render(true);
    }));
    render(!returning);
  }

  async function collectionPage(view, id, opts) {
    const cols = await collections();
    const i = cols.findIndex((x) => x.id === id);
    if (i < 0) return notFound();
    const c = cols[i];
    return collection(view, c, { seed: colSeed(c.id, i), icon: colIcon(c.id), ...opts });
  }

  // A section's page (CollectionGroupScreen): its collections as cards.
  async function sectionPage(view, group) {
    const cols = (await collections()).filter((c) => c.group === group);
    const [blurb] = SECTION[group] || [""];
    const rows = [];
    for (let i = 0; i < cols.length; i += 2) {
      const pair = cols.slice(i, i + 2);
      rows.push(`<div class="crow" data-r>${pair.map((c, j) => collectionCard(c, i + j)).join("")}${pair.length === 1 ? "<span></span>" : ""}</div>`);
    }
    view.innerHTML = `${subBar(group)}<div class="pintro" data-r>${esc(blurb)}</div><div class="cgrid">${rows.join("")}</div><div style="height:32px"></div>`;
    wireBack(view);
    view.querySelectorAll("[data-r]").forEach((el) => tracker.add(el));
  }

  // ---- word families (Families.kt) ------------------------------------------
  const famSeed = (fams, id) => ((Math.max(0, fams.findIndex((f) => f.id === id)) * 3) % 10);
  let famQuery = "";
  async function familiesPage(view) {
    const { families } = await extras();
    view.innerHTML = `${subBar("Word families")}
      <div class="fsearch"><span class="ico">${SEARCH}</span><input id="fq" placeholder="Search a root" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(famQuery)}"><button class="fclr" aria-label="Clear search">${CLOSE}</button></div>
      <div class="famlist"></div><div style="height:32px"></div>`;
    wireBack(view);
    const input = view.querySelector("#fq"), list = view.querySelector(".famlist"), clr = view.querySelector(".fclr");
    function render(first) {
      const q = famQuery.trim().toLowerCase().replace(/^-/, "");
      const shown = q ? families.filter((f) => String(f.forms || f.id).split("|").some((x) => x.trim().toLowerCase().includes(q))) : families;
      clr.style.visibility = famQuery ? "visible" : "hidden";
      let html = q ? "" : `<div class="pintro" data-r style="padding-top:8px">Learn one Greek or Latin root and you can work out a whole family of words. Pick a root to meet its family.</div>`;
      if (q && !shown.length) html += `<div class="pintro" style="padding-top:18px">No root matches “${esc(famQuery.trim())}”. Try the start of a root, like spect, phil or chron.</div>`;
      const themes = [...new Set(shown.map((f) => f.theme))];
      for (const t of themes) {
        html += `<div class="glabel" data-r style="padding:18px 22px 9px">${esc(t)}</div>`;
        const fs = shown.filter((f) => f.theme === t);
        for (let i = 0; i < fs.length; i += 2) {
          html += `<div class="crow" data-r style="padding:0 20px">${fs.slice(i, i + 2).map((f) => `<a class="famcard" data-press href="#/family/${f.id}" style="background:${gradient(famSeed(families, f.id))}">
            <b>${esc(f.root)}</b><i>${esc(f.meaning)}</i><span class="sp"></span><small>${esc(String(f.examples || "").split("|").map((x) => x.trim().toLowerCase()).filter(Boolean).join(" · "))}</small></a>`).join("")}${fs.length - i === 1 ? "<span></span>" : ""}</div>`;
        }
      }
      list.innerHTML = html;
      if (first) list.querySelectorAll("[data-r]").forEach((el) => tracker.add(el));
    }
    input.addEventListener("input", () => { famQuery = input.value; render(false); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
    clr.onclick = () => { famQuery = ""; input.value = ""; render(false); };
    render(true);
  }
  async function familyPage(view, id, opts) {
    const { families } = await extras();
    const f = families.find((x) => x.id === id);
    if (!f) return notFound();
    return collection(view, { id: "fam_" + f.id, title: f.root, blurb: f.blurb || f.meaning, group: `Word family · ${f.origin}`, keepOrder: false, items: f.items },
      { seed: famSeed(families, f.id), icon: "ic_col_root", family: f, ...opts });
  }

  // ---- prompts (ExitPrompt.kt ConfirmPrompt, WordLists.kt name card) ---------
  // A card that springs up (0.72, 320) over the dimmed, softly blurred page.
  function prompt({ icon: ic, mark = false, title, message, field = null, initial = "", stay, goLabel, danger = false, onGo }) {
    const o = document.createElement("div");
    o.className = "pover";
    o.innerHTML = `<div class="pcard" role="dialog" aria-label="${esc(title)}">
      ${mark ? `<span class="pmark"><span class="pmd">${LOGO}</span></span>` : ic ? `<span class="pdisc">${ic}</span>` : ""}<div class="pt">${esc(title)}</div><div class="pm">${esc(message)}</div>
      ${field ? `<input class="pfield" maxlength="${LIST_NAME_MAX + 5}" placeholder="e.g. Words for my essay" value="${esc(initial)}" autocapitalize="sentences" enterkeyhint="done"><div class="perr"></div>` : ""}
      <div class="pbtns"><button class="pbtn" data-press="0.94" data-a="stay">${esc(stay)}</button><button class="pbtn on ${danger ? "danger" : ""}" data-press="0.94" data-a="go">${esc(goLabel)}</button></div></div>`;
    document.body.appendChild(o);
    const card = o.querySelector(".pcard");
    const prog = new Spring(0, { damping: 0.72, stiffness: 320, onUpdate: (t) => {
      o.style.setProperty("--dim", (0.45 * Math.min(1, Math.max(0, t))).toFixed(3));
      card.style.opacity = Math.min(1, Math.max(0, t));
      card.style.transform = `translateY(${((1 - t) * 28).toFixed(1)}px) scale(${(0.86 + 0.14 * t).toFixed(4)})`;
    } });
    prog.snap(0); prog.to(1);
    const input = o.querySelector(".pfield"), err = o.querySelector(".perr");
    let tried = false;
    const close = () => { tween({ duration: 180, update: (k) => prog.onUpdate(1 - k), done: () => o.remove() }); };
    const check = () => {
      if (!input) return true;
      const p = field(input.value);
      const show = (tried || input.value.trim()) ? p : null;
      err.textContent = show || ""; err.classList.toggle("on", !!show);
      return !p;
    };
    const submit = () => { tried = true; if (check()) { close(); onGo(input ? input.value : null); } };
    o.addEventListener("click", (e) => { if (e.target === o) close(); });
    o.querySelector('[data-a="stay"]').onclick = close;
    o.querySelector('[data-a="go"]').onclick = submit;
    if (input) {
      input.addEventListener("input", check);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
      setTimeout(() => input.focus(), 60);
    }
  }
  const askNewList = (withId, after) => prompt({ icon: ADD, title: "New list", message: "Name it after a topic, a book, an exam — anything you like.",
    field: (n) => nameProblem(n), stay: "Cancel", goLabel: "Create", onGo: (n) => { const id = L.create(n, withId); after && after(id); } });

  // ---- My lists (WordListScreens.kt SavedScreen) ----------------------------
  let listId = SAVED;
  let newestFirst = null;   // read on first use (store is defined by app.js)
  let lastRemoved = null;   // {row, source, index, stamp}

  function rowsOf(id) {
    if (newestFirst === null) newestFirst = store.get("savedNewestFirst", true);
    const src = id === SAVED ? saved() : (L.items()[id] || []);
    const rows = src.map((r) => ({ ...r, e: data.byId.get(r.id) })).filter((r) => r.e);
    return newestFirst ? rows.sort((a, b) => b.ts - a.ts) : rows.sort((a, b) => a.e.word.toLowerCase().localeCompare(b.e.word.toLowerCase()));
  }
  function removeRow(source, id) {
    if (source === SAVED) {
      const all = saved(); const index = all.findIndex((r) => r.id === id);
      lastRemoved = { row: all[index], source, index, stamp: Date.now() };
      store.set("saved", all.filter((r) => r.id !== id));
    } else if (source === "recent") {
      const all = recent(); const index = all.findIndex((r) => r.id === id);
      lastRemoved = { row: all[index], source, index, stamp: Date.now() };
      store.set("recent", all.filter((r) => r.id !== id));
    } else {
      const it = L.items(); const all = it[source] || []; const index = all.findIndex((r) => r.id === id);
      lastRemoved = { row: all[index], source, index, stamp: Date.now() };
      it[source] = all.filter((r) => r.id !== id); L.save(null, it);
    }
  }
  function undo() {
    const r = lastRemoved; if (!r) return;
    lastRemoved = null;
    const put = (arr) => { arr.splice(Math.min(r.index, arr.length), 0, r.row); return arr; };
    if (r.source === SAVED) store.set("saved", put(saved()));
    else if (r.source === "recent") store.set("recent", put(recent()));
    else { const it = L.items(); it[r.source] = put(it[r.source] || []); L.save(null, it); }
  }

  // Swipe a row left past 35% to remove it (with Undo for 4.5 s).
  function swipeable(rowEl, onRemove) {
    const fg = rowEl.querySelector(".sfg");
    let x0 = 0, y0 = 0, dx = 0, dragging = false, decided = false;
    fg.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; dx = 0; dragging = true; decided = false; });
    fg.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!decided) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; decided = true; if (Math.abs(my) > Math.abs(mx) || mx > 0) { dragging = false; return; } fg.setPointerCapture(e.pointerId); }
      dx = Math.min(0, mx);
      fg.style.transform = `translateX(${dx}px)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      const w = rowEl.offsetWidth;
      if (-dx > w * 0.35) {
        tween({ duration: 220, easing: ease.fastOutSlowIn, update: (k) => { fg.style.transform = `translateX(${dx - (w + dx) * k}px)`; },
          done: () => { const h = rowEl.offsetHeight; tween({ duration: 220, easing: ease.fastOutSlowIn, update: (k) => { rowEl.style.height = `${h * (1 - k)}px`; }, done: onRemove }); } });
      } else if (dx) {
        const from = dx;
        tween({ duration: 220, easing: ease.fastOutSlowIn, update: (k) => { fg.style.transform = `translateX(${from * (1 - k)}px)`; } });
      }
    };
    fg.addEventListener("pointerup", end); fg.addEventListener("pointercancel", end);
    fg.addEventListener("click", (e) => { if (Math.abs(dx) > 6) e.preventDefault(); });
  }
  const swipeRow = (e) => `<div class="srow" data-id="${e.id}"><div class="sbg"><span class="trash">${ICONS.ic_trash}</span></div>
    <a class="sfg" href="#/word/${e.id}"><div class="wrow"><div><span class="w">${esc(e.word)}</span><span class="t">${pos(e.type)}</span></div>
    <div class="g g3">${esc(e.preview || "")}</div></div><div class="sdiv"></div></a></div>`;

  // The Undo pill: slides up from the bottom; a bar counts down 4.5 s.
  function undoPill(host, word, onUndo) {
    host.querySelector(".undo")?.remove();
    const u = document.createElement("div");
    u.className = "undo";
    u.innerHTML = `<span>“${esc(word)}” removed</span><button>Undo</button><i class="cd"></i>`;
    host.appendChild(u);
    u.animate([{ transform: "translate(-50%, 100%)", opacity: 0 }, { transform: "translate(-50%, 0)", opacity: 1 }], { duration: 300, easing: "cubic-bezier(.4,0,.2,1)" });
    const bar = u.querySelector(".cd");
    const t = tween({ duration: 4500, update: (k) => { bar.style.transform = `scaleX(${1 - k})`; }, done: () => leave() });
    function leave() { const a = u.animate([{ transform: "translate(-50%, 0)", opacity: 1 }, { transform: "translate(-50%, 100%)", opacity: 0 }], { duration: 250, easing: "cubic-bezier(.4,0,.2,1)" }); a.onfinish = () => u.remove(); }
    u.querySelector("button").onclick = () => { t.cancel(); u.remove(); onUndo(); };
  }

  function listsPage(view, tab) {
    if (tab === "recent") return recentPage(view);
    if (tab === "wishlist") listId = WISH;
    else if (tab && /^\d+$/.test(tab)) listId = Number(tab);
    else if (tab === "saved") listId = SAVED;
    const own = L.lists().find((l) => l.id === listId);
    view.innerHTML = `${subBar("My lists", `<span class="lmenu-slot">${own ? `<button class="icon-btn" id="lmenu" aria-label="List options">${MORE}</button>` : ""}</span>`)}
      <div class="lchips"></div><div class="lpage"></div>`;
    wireBack(view);
    const chips = view.querySelector(".lchips"), page = view.querySelector(".lpage");
    const order = () => [SAVED, ...(wishlist().length ? [WISH] : []), ...L.lists().map((l) => l.id)];
    function chip(id, label, count, icon) {
      const col = listColor(id), sel = id === listId;
      return `<button class="lchip ${sel ? "on" : ""}" data-l="${id}" data-press="0.93" style="--c:${col};--on:${onFill(col)}">
        ${icon ? `<span class="ci">${icon}</span>` : `<i class="dot"></i>`}<span class="ln">${esc(label)}</span><span class="lc">${count}</span></button>`;
    }
    function drawChips() {
      chips.innerHTML = chip(SAVED, "Saved words", saved().length, ICONS.ic_bookmark_outline) +
        (wishlist().length ? chip(WISH, "Wishlist", wishlist().length) : "") +
        L.lists().map((l) => chip(l.id, l.name, L.count(l.id))).join("") +
        `<button class="lnew" data-press="0.93"><span class="ci">${ADD}</span>New list</button>`;
      chips.querySelectorAll(".lchip").forEach((b) => (b.onclick = () => select(Number(b.dataset.l))));
      chips.querySelector(".lnew").onclick = () => askNewList(null, (id) => { listId = id; listsPage(view, String(id)); });
      const on = chips.querySelector(".lchip.on");
      if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
    }
    function drawPage() {
      if (newestFirst === null) newestFirst = store.get("savedNewestFirst", true);
      if (listId === WISH) return drawWish();
      const rows = rowsOf(listId);
      const name = listId === SAVED ? "Saved words" : (own ? own.name : "");
      if (!rows.length) {
        page.innerHTML = Search_empty(listId === SAVED ? "No saved words yet" : `Nothing in “${name}” yet`,
          listId === SAVED ? "Tap the bookmark on any word to keep it here for later." : `Open any word, tap its bookmark and pick “${name}” to add it here.`);
        return;
      }
      page.innerHTML = `<div class="seg"><button data-n="1" class="${newestFirst ? "on" : ""}">${newestFirst ? `<span class="ck">${CHECK}</span>` : ""}Newest</button><button data-n="0" class="${newestFirst ? "" : "on"}">${newestFirst ? "" : `<span class="ck">${CHECK}</span>`}Alphabetical</button></div>
        <div class="srows">${rows.map((r) => swipeRow(r.e)).join("")}</div><div class="shint">Swipe a word to the left to remove it</div><div style="height:96px"></div>`;
      page.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { newestFirst = b.dataset.n === "1"; store.set("savedNewestFirst", newestFirst); drawPage(); }));
      page.querySelectorAll(".srow").forEach((r) => swipeable(r, () => {
        const e = data.byId.get(Number(r.dataset.id));
        const src = listId;
        removeRow(src, e.id);
        drawChips(); drawPage();
        undoPill(view, e.word, () => { undo(); drawChips(); drawPage(); });
      }));
    }
    function drawWish() {
      const w = wishlist();
      page.innerHTML = `<div class="wishtop"><span>Words you'd like Wordly to have.</span><button class="copyall">Copy all</button></div>
        ${w.map((r) => `<div class="wishrow"><span class="ww">${esc(r.word)}</span><span class="wd">${new Date(r.ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          <button class="wx" data-w="${esc(r.word)}" aria-label="Remove ${esc(r.word)}">✕</button></div>`).join("")}<div style="height:96px"></div>`;
      page.querySelector(".copyall").onclick = (e) => { navigator.clipboard?.writeText(w.map((r) => r.word).join("\n")); e.target.textContent = `Copied ${w.length} words`; };
      page.querySelectorAll(".wx").forEach((b) => (b.onclick = () => { toggleWish(b.dataset.w); if (!wishlist().length) listId = SAVED; drawChips(); drawPage(); }));
    }
    // Switching lists slides the words across (320 ms, a fifth of the width),
    // in the direction of the chip that was picked.
    function select(id) {
      if (id === listId) return;
      const ord = order(); const forward = ord.indexOf(id) >= ord.indexOf(listId);
      listId = id;
      history.replaceState(history.state, "", `#/lists/${id === WISH ? "wishlist" : id === SAVED ? "saved" : id}`);
      const w = page.offsetWidth / 5 * (forward ? 1 : -1);
      const old = page.cloneNode(true);
      old.className = "lpage lold";
      page.parentNode.insertBefore(old, page);
      old.style.top = `${page.offsetTop}px`;
      old.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-w}px)`, opacity: 0 }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" }).onfinish = () => old.remove();
      old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
      drawChips(); drawPage();
      const menu = view.querySelector(".lmenu-slot");
      const ownNow = L.lists().find((l) => l.id === listId);
      menu.innerHTML = ownNow ? `<button class="icon-btn" id="lmenu" aria-label="List options">${MORE}</button>` : "";
      wireMenu();
      page.animate([{ transform: `translateX(${w}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" });
      // The chosen chip pops (spring 0.5, 500 from 0.96).
      const c = chips.querySelector(".lchip.on");
      new Spring(0.96, { damping: 0.5, stiffness: 500, onUpdate: (v) => { c.style.transform = `scale(${v.toFixed(4)})`; } }).to(1);
    }
    function wireMenu() {
      const btn = view.querySelector("#lmenu");
      if (!btn) return;
      btn.onclick = () => {
        const l = L.lists().find((x) => x.id === listId);
        const m = document.createElement("div");
        m.className = "dmenu";
        m.innerHTML = `<button data-a="rename"><span class="mi">${EDIT}</span>Rename “${esc(l.name)}”</button><button data-a="delete" class="del"><span class="mi">${ICONS.ic_trash}</span>Delete list</button>`;
        document.body.appendChild(m);
        m.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "scale(1)" }], { duration: 160, easing: "cubic-bezier(.4,0,.2,1)" });
        const off = (e) => { if (!m.contains(e.target)) { m.remove(); removeEventListener("pointerdown", off, true); } };
        setTimeout(() => addEventListener("pointerdown", off, true), 0);
        m.querySelector('[data-a="rename"]').onclick = () => { m.remove(); prompt({ icon: EDIT, title: "Rename list", message: "Give this list a new name.", field: (n) => (n.trim() === l.name ? null : nameProblem(n, l.id)), initial: l.name, stay: "Cancel", goLabel: "Save", onGo: (n) => { L.rename(l.id, n); drawChips(); } }); };
        m.querySelector('[data-a="delete"]').onclick = () => { m.remove(); prompt({ title: `Delete “${l.name}”?`, message: "The list goes, but its words stay in the dictionary and in any other list or Saved words.", stay: "Keep", goLabel: "Delete", danger: true, onGo: () => { L.remove(l.id); listId = SAVED; listsPage(view, "saved"); } }); };
      };
    }
    drawChips(); drawPage(); wireMenu();
  }
  // The friendly empty screen with the bookmark.
  function Search_empty(title, message) {
    return `<div class="empty2" style="padding-top:48px"><span class="disc"><span class="float">${ICONS.ic_bookmark_outline}</span></span>
      <div class="t">${esc(title)}</div><div class="m">${esc(message)}</div><a class="eact" data-press="0.94" href="#/word/${wordOfTheDay().entry.id}?c=${wordOfTheDay().seed}&w=1">Explore today's word</a></div>`;
  }

  // ---- Recent (grouped Today / Yesterday / Earlier) --------------------------
  function recentPage(view) {
    const rows = recent().map((r) => ({ ...r, e: data.byId.get(r.id) })).filter((r) => r.e);
    view.innerHTML = `${subBar("Recent")}<div class="lpage"></div>`;
    wireBack(view);
    const page = view.querySelector(".lpage");
    if (!rows.length) {
      page.innerHTML = Search_empty("No recent words yet", "Words you look up will appear here, so you can find them again.").replace("padding-top:48px", "padding-top:72px");
      return;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const label = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); const n = Math.round((today - d) / 86400000); return n === 0 ? "Today" : n === 1 ? "Yesterday" : "Earlier"; };
    let html = "", last = null;
    for (const r of rows) { const l = label(r.ts); if (l !== last) { html += `<div class="dlabel">${l.toUpperCase()}</div>`; last = l; } html += swipeRow(r.e); }
    page.innerHTML = `<div class="srows">${html}</div><div class="shint">Swipe a word to the left to remove it</div><div style="height:96px"></div>`;
    page.querySelectorAll(".srow").forEach((r) => swipeable(r, () => {
      const e = data.byId.get(Number(r.dataset.id));
      removeRow("recent", e.id);
      recentPage(view);
      undoPill(view, e.word, () => { undo(); recentPage(view); });
    }));
  }

  // ---- the word's "My lists" sheet (WordLists.kt SaveToListSheet) ------------
  function saveSheet(entry, onChange) {
    const o = document.createElement("div");
    o.className = "sheetover";
    const rowsHtml = () => {
      const lists = L.lists();
      const row = (id, name, count, checked, iconHtml) => { const col = listColor(id);
        return `<button class="shrow" data-l="${id}"><span class="lb" style="background:${col}2e;color:${col}">${iconHtml || esc(name.trim().slice(0, 1).toUpperCase())}</span>
          <span class="nm"><b>${esc(name)}</b><small>${wordCount(count)}</small></span>
          <span class="ckd" style="--c:${col};--on:${onFill(col)}" data-on="${checked ? 1 : 0}"><i class="fillc"></i><span class="tick">${CHECK}</span></span></button>`; };
      return row(SAVED, "Saved words", saved().length, isSaved(entry.id), ICONS.ic_bookmark_outline) +
        lists.map((l) => row(l.id, l.name, L.count(l.id), L.in(l.id, entry.id))).join("") +
        `<div class="newwrap"><button class="shnew"><span class="nb">${ADD}</span>New list</button></div>`;
    };
    o.innerHTML = `<div class="sheet"><i class="grab"></i><div class="sht">My lists</div><div class="shlist">${rowsHtml()}</div>
      <div class="shbtns"><button class="pbtn" data-press="0.94" data-a="see">See lists</button><button class="pbtn on" data-press="0.94" data-a="done">Done</button></div></div>`;
    document.body.appendChild(o);
    const sheet = o.querySelector(".sheet");
    o.animate([{ background: "rgba(0,0,0,0)" }, { background: "rgba(0,0,0,.32)" }], { duration: 250, fill: "forwards" });
    sheet.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: 350, easing: "cubic-bezier(.2,0,0,1)" });
    const ticks = (root) => root.querySelectorAll(".ckd").forEach((c) => {
      // The tick: fills with the list's colour, the check springs in (0.45, 520).
      const s = new Spring(Number(c.dataset.on), { damping: 0.45, stiffness: 520, onUpdate: (p) => {
        c.querySelector(".fillc").style.transform = `scale(${Math.min(1, Math.max(0, p)).toFixed(4)})`;
        const t = c.querySelector(".tick"); t.style.transform = `scale(${Math.max(0, p).toFixed(4)})`; t.style.opacity = Math.min(1, Math.max(0, p));
      } });
      s.snap(Number(c.dataset.on));
      c.spring = s;
    });
    function wire() {
      const list = o.querySelector(".shlist");
      ticks(list);
      list.querySelectorAll(".shrow").forEach((b) => (b.onclick = () => {
        if (navigator.vibrate) navigator.vibrate(8);
        const id = Number(b.dataset.l);
        const on = id === SAVED ? toggleSaved(entry.id) : L.toggle(id, entry.id);
        const c = b.querySelector(".ckd");
        c.spring.to(on ? 1 : 0);
        b.querySelector("small").textContent = wordCount(id === SAVED ? saved().length : L.count(id));
        onChange && onChange();
      }));
      list.querySelector(".shnew").onclick = () => {
        const wrap = list.querySelector(".newwrap");
        wrap.innerHTML = `<div class="inl"><input class="pfield" maxlength="${LIST_NAME_MAX + 5}" placeholder="e.g. Words for my essay" autocapitalize="sentences" enterkeyhint="done"><div class="perr"></div>
          <div class="pbtns"><button class="pbtn" data-a="cancel">Cancel</button><button class="pbtn on" data-a="create">Create</button></div></div>`;
        o.querySelector(".shbtns").style.display = "none";
        const input = wrap.querySelector("input"), err = wrap.querySelector(".perr");
        let tried = false;
        const check = () => { const p = nameProblem(input.value); const show = (tried || input.value.trim()) ? p : null; err.textContent = show || ""; err.classList.toggle("on", !!show); return !p; };
        const create = () => { tried = true; if (!check()) return; L.create(input.value, entry.id); list.innerHTML = rowsHtml(); o.querySelector(".shbtns").style.display = ""; wire(); onChange && onChange(); };
        input.addEventListener("input", check);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") create(); });
        wrap.querySelector('[data-a="cancel"]').onclick = () => { list.innerHTML = rowsHtml(); o.querySelector(".shbtns").style.display = ""; wire(); };
        wrap.querySelector('[data-a="create"]').onclick = create;
        wrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        setTimeout(() => input.focus(), 50);
      };
    }
    wire();
    const close = (then) => {
      sheet.animate([{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], { duration: 250, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
      o.animate([{ background: "rgba(0,0,0,.32)" }, { background: "rgba(0,0,0,0)" }], { duration: 250, fill: "forwards" }).onfinish = () => { o.remove(); then && then(); };
    };
    o.addEventListener("click", (e) => { if (e.target === o) close(); });
    o.querySelector('[data-a="done"]').onclick = () => close();
    o.querySelector('[data-a="see"]').onclick = () => {
      const target = isSaved(entry.id) ? SAVED : (L.holding(entry.id)[0] ?? SAVED);
      close(() => go(`#/lists/${target === SAVED ? "saved" : target}`));
    };
  }
  const keptAnywhere = (id) => isSaved(id) || L.holding(id).length > 0;

  return { collectionPage, sectionPage, familiesPage, familyPage, listsPage, saveSheet, keptAnywhere, prompt };
})();
