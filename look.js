/* Wordly web — the look-up card (LookupActivity.kt LookupSheet): what the
   iPhone Share-sheet Shortcut opens with the picked text (#/look/<text> or
   ?look=<text>). The same card as Android's text-menu popup: the word on its
   colour, noun / verb chips, the preview, Read more, Open in Wordly — or, for
   a word Wordly lacks, its relatives (or near spellings) as pills, Add to
   Wishlist and Open Wordly. */
"use strict";

const Look = (() => {
  const BACK = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`;

  function page(view, raw) {
    const picked = tidy(raw || "");
    const { entries, missing } = picked ? lookUp(picked) : { entries: [], missing: "" };
    // Only the word itself (or a plain form: "parties") opens straight away;
    // otherwise the nearest words are offered to pick from.
    let nearby = [], related = true;
    if (missing) {
      nearby = [...entries, ...relatedTo(picked.toLowerCase())];
      if (!nearby.length) { related = false; nearby = Search.closestWords(picked); }
      const seen = new Set(); nearby = nearby.filter((e) => !seen.has(e.id) && seen.add(e.id));
    }
    const st = { list: missing ? [] : entries, chosen: null, shown: 0, more: null, seed: randomSeed() };
    view.classList.add("lookview");
    view.innerHTML = `<div class="lkscrim"></div><div class="lkcard"></div>`;
    const card = view.querySelector(".lkcard"), scrim = view.querySelector(".lkscrim");
    // In: the card rises half its height (280 ms) and fades in (200); the scrim dims to 32%.
    card.animate([{ transform: "translateY(50%)" }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(.4,0,.2,1)" });
    card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "cubic-bezier(.4,0,.2,1)" });
    scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    scrim.onclick = () => {
      card.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(50%)", opacity: 0 }], { duration: 200, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
      scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      setTimeout(() => location.replace("#/"), 220);
    };
    const btn = (label, cls, act) => `<button class="lkbtn ${cls}" data-a="${act}">${esc(label)}</button>`;
    const wantRow = (word, openLabel, openAct) =>
      `<div class="lkrow">${btn(onWishlist(word) ? "On Wishlist ✓" : "Add to Wishlist", "", "wish")}<span style="flex:1"></span>${btn(openLabel, "on", openAct)}</div>`;
    const backLink = (act) => `<button class="lkback" data-a="${act}">${BACK}<span>Back</span></button>`;

    function render() {
      const list = st.chosen || st.list;
      if (!list.length) {
        card.innerHTML = nearby.length
          ? `<div class="lknf"><div class="lkk">WORDLY</div><div class="lkq">“${esc(picked)}” isn't in Wordly yet${related ? ", but these are:" : ". Did you mean:"}</div>
             <div class="lkpills">${nearby.map((e) => `<button class="lkpill" data-id="${e.id}"><b>${esc(e.word)}</b><small>${pos(e.type)}</small></button>`).join("")}</div>
             <div class="lkpad">${wantRow(picked, "Open Wordly", "search")}</div></div>`
          : `<div class="lknf solo"><div class="lkk">WORDLY</div><div class="lkq big">${picked ? `“${esc(picked)}” isn't in Wordly yet.` : "Select a word to look it up."}</div>
             ${picked ? `<div style="height:8px"></div>${wantRow(picked, "Open Wordly", "search")}` : ""}</div>`;
      } else {
        const e = list[Math.min(st.shown, list.length - 1)];
        const more = st.more === e.id;
        const want = st.chosen ? missing : null;
        card.innerHTML = `<div class="lkhead" style="background:${gradient(st.seed)}"><div class="lkk w">WORDLY</div><div class="lkw">${esc(e.word)}</div><div class="lkt">${pos(e.type)}</div></div>
          ${list.length > 1 ? `<div class="lkchips">${list.map((x, i) => `<button class="lkchip ${i === st.shown ? "on" : ""}" data-i="${i}">${pos(x.type)}</button>`).join("")}</div>` : ""}
          <div class="lkmean ${more ? "more" : ""}">${more ? `<div class="dprose lkprose"></div>` : `<div class="lkprev">${esc(e.preview || "")}</div>
            ${want ? `<button class="lkmore" data-a="more">Read more</button>` : ""}`}</div>
          ${want ? `<div class="lkacts">${wantRow(want, "Open in Wordly", "open")}</div>`
            : `<div class="lkacts lkrow">${!more ? btn("Read more", "", "more") : backLink("less")}<span style="flex:1"></span>${btn("Open in Wordly", "on", "open")}</div>`}
          ${more && want ? backLink("less") : !more && st.chosen ? backLink("matches") : ""}`;
        if (more) definition(e.id).then((d) => { const p = card.querySelector(".lkprose"); if (p) p.innerHTML = (d && d[0]) || `<p>${esc(e.preview || "")}</p>`; });
      }
      wire(list);
    }
    function wire(list) {
      card.querySelectorAll(".lkpill").forEach((b) => (b.onclick = () => {
        const e = data.byId.get(Number(b.dataset.id));
        st.chosen = data.byNorm.get(e.norm) || [e];
        st.shown = Math.max(0, st.chosen.findIndex((x) => x.id === e.id));
        render();
      }));
      card.querySelectorAll(".lkchip").forEach((b) => (b.onclick = () => { st.shown = Number(b.dataset.i); st.more = null; render(); }));
      card.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
        const a = b.dataset.a, e = list[Math.min(st.shown, list.length - 1)];
        if (a === "wish") { toggleWish(b.closest(".lknf") ? picked : missing || picked); render(); }
        else if (a === "more") { st.more = e.id; render(); }
        else if (a === "less") { st.more = null; render(); }
        else if (a === "matches") { st.chosen = null; st.shown = 0; render(); }
        else if (a === "open") go(`#/word/${e.id}?c=${st.seed}`);
        else if (a === "search") go(`#/search/${encodeURIComponent(picked)}`);
      }));
    }
    render();
  }
  return { page };
})();
