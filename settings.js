/* Wordly web — Settings, recreated from the app (ui/SettingsScreen.kt,
   FontSettingsScreen.kt, LayoutSettingsScreen.kt, SpacingScale.kt,
   FontChoice.kt, Theme.kt, Palette.kt). The reader's typeface, text size and
   spacing, margins, light/dark and the five colour themes, kept on this
   device and applied to every page through CSS variables. */
"use strict";

const Settings = (() => {
  // ---- the reading typefaces (FontChoice): name, file, serif, Normal size /
  // line / paragraph, a real italic, and the face's natural line height
  // ((hhea ascent − descent) / units per em, read from the font files). ----
  const FONTS = [
    ["LITERATA", "Literata", "literata", true, 17.5, 1.00, 0.4, true, 1.485],
    ["MERRIWEATHER", "Merriweather", "merriweather", true, 16.5, 1.25, 0.4, true, 1.257],
    ["OUTFIT", "Outfit", "outfit", false, 19, 1.15, 0.5, false, 1.26],
    ["FRAUNCES", "Fraunces", "fraunces", true, 17, 1.15, 0.5, true, 1.233],
    ["LORA", "Lora", "lora", true, 18, 1.125, 0.5, true, 1.28],
    ["PLAYFAIR", "Playfair Display", "playfair", true, 18.5, 1.125, 0.5, true, 1.333],
    ["INTER", "Inter", "inter", false, 16.5, 1.25, 0.5, true, 1.21],
    ["DM_SANS", "DM Sans", "dm_sans", false, 17.5, 1.10, 0.5, true, 1.302],
    ["POPPINS", "Poppins", "poppins", false, 16.5, 1.10, 0.5, true, 1.4],
    ["MANROPE", "Manrope", "manrope", false, 17, 1.15, 0.5, false, 1.366],
    ["ALEGREYA", "Alegreya", "alegreya", true, 19, 1.05, 0.5, true, 1.361],
    ["PLUS_JAKARTA", "Plus Jakarta Sans", "jakarta", false, 16.5, 1.20, 0.5, true, 1.26],
    ["HANKEN", "Hanken Grotesk", "hanken", false, 19, 1.10, 0.5, true, 1.303],
  ].map(([id, name, file, serif, size, line, para, italic, lh]) => ({ id, name, file, serif, size, line, para, italic, lh,
    family: `'RF-${file}', ${serif ? "Georgia, serif" : "system-ui, sans-serif"}`,
    sizeSteps: [size - 2, size - 1, size, size + 1, size + 2],
    lineSteps: [line - 0.1, line - 0.05, line, line + 0.05, line + 0.1],
    paraSteps: [para - 0.2, para - 0.1, para, para + 0.1, para + 0.2] }));
  const fontOf = (id) => FONTS.find((f) => f.id === id) || FONTS[0];
  const STEP_NAMES = ["Extra small", "Small", "Normal", "Large", "Extra large"];
  const WORD = [0, 0.5, 1.0, 1.5, 2.0], LETTER = [0, 0.01, 0.02, 0.03, 0.04], MARGIN = [12, 16, 20, 24, 28];
  const nearestIndex = (v, steps) => steps.reduce((b, s, i) => (Math.abs(s - v) < Math.abs(steps[b] - v) ? i : b), 0);

  // Each face's four weights, loaded only when first used.
  (() => {
    const css = FONTS.map((f) => [["regular", 400, "normal"], ...(f.italic ? [["italic", 400, "italic"]] : []), ["semibold", 600, "normal"], ["bold", 700, "normal"]]
      .map(([w, weight, style]) => `@font-face{font-family:"RF-${f.file}";src:url(fonts/${f.file}_${w}.ttf);font-weight:${weight};font-style:${style};font-display:swap}`).join("")).join("");
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  })();

  // ---- the colour themes (AppTheme): accent, paper, surfaceVariant, container; light and dark ----
  const THEMES = [
    ["CLASSIC", "Classic", "#8E1F24", "#D28A8D", "#F5EFE5", "#181613", "#EAE2D5", "#272521", "#EFE8DC", "#201E1B"],
    ["OCEAN", "Ocean", "#23617F", "#93C2D8", "#F3F0E8", "#13171B", "#E6E3DA", "#222A30", "#ECE8DF", "#1B2227"],
    ["SUNSET", "Sunset", "#B35226", "#E8A98A", "#F6EFE4", "#191512", "#EDE1D1", "#2C2620", "#F1E7D9", "#221C18"],
    ["ORCHID", "Orchid", "#6B4C99", "#C7B0E6", "#F4F0EA", "#17151D", "#E7E1E0", "#292334", "#EDE8E4", "#1F1B29"],
    ["FOREST", "Forest", "#3C6B49", "#A5CBAD", "#F2F0E6", "#141915", "#E4E4D8", "#232C25", "#EBEADF", "#1C231D"],
  ].map(([id, name, accentLight, accentDark, bgLight, bgDark, varLight, varDark, contLight, contDark]) =>
    ({ id, name, accentLight, accentDark, bgLight, bgDark, varLight, varDark, contLight, contDark }));
  const themeOf = (id) => THEMES.find((t) => t.id === id) || THEMES[1];
  // The card gradients: the jewel tones on dark, re-toned for the cream paper.
  const DARK_PALETTE = [
    ["#3D7178", "#2E565C", "#1F3C42"], ["#3F6A94", "#305274", "#213953"], ["#5F5790", "#48426E", "#322D4E"], ["#78517F", "#5B3D61", "#3E2A43"],
    ["#8F5468", "#6D3F50", "#492A38"], ["#95584A", "#714338", "#4C2D26"], ["#9C6A3D", "#77502E", "#503620"], ["#857240", "#665830", "#463D22"],
    ["#66703F", "#4E5631", "#363C22"], ["#457259", "#355744", "#243C30"]];
  const LIGHT_PALETTE = [
    ["#4E7F7B", "#3E6865", "#30514F"], ["#4F7196", "#405C7C", "#324862"], ["#6F6694", "#5A527A", "#45405F"], ["#86628C", "#6D4F73", "#543D59"],
    ["#A15F68", "#874B55", "#6A3A43"], ["#A5644D", "#8A5140", "#6B3F32"], ["#A06A36", "#86572B", "#6A4421"], ["#887438", "#70602E", "#574A24"],
    ["#6A7D4C", "#56673D", "#43512F"], ["#5A7D6B", "#4A6858", "#3A5245"]];
  const WM_DARK = ["#6CC0B7", "#5CC3D0", "#72B5E0", "#7FA3EA", "#8E95E6", "#A99BEA", "#A08CDC", "#C28ACF", "#D986BF", "#E596AE", "#E19A8A", "#EBB08F", "#DDAA73", "#D7BE6E", "#B9C877", "#86C9A0", "#5FC0A0"];
  const WM_LIGHT = ["#2E8A82", "#2B8A9C", "#2F7FB0", "#3A6FC0", "#5559B8", "#6A5CC0", "#7654B0", "#8E4F9E", "#A04A8C", "#B0587E", "#B8594A", "#B8683F", "#B07633", "#9C8126", "#6E8A2E", "#3C8F62", "#2A8B72"];
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
  const mix = (a, b, t) => "#" + [1, 3, 5].map((k) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, "0")).join("");

  // ---- the saved settings ------------------------------------------------------
  const KEY = "settings";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  let s = Object.assign({ font: "LITERATA", perFont: {}, word: 0, letter: 0, margin: 16, mode: "SYSTEM", theme: "OCEAN" }, read());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
  const font = () => fontOf(s.font);
  const perFont = (k) => { const f = font(), v = (s.perFont[f.id] || {})[k]; const steps = f[k + "Steps"]; return v == null ? f[k] : steps[nearestIndex(v, steps)]; };
  const reading = () => ({ font: font(), size: perFont("size"), line: perFont("line"), para: perFont("para"), word: s.word, letter: s.letter, margin: s.margin });
  const media = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (s.mode === "DARK" ? true : s.mode === "LIGHT" ? false : media.matches);

  function apply() {
    const dark = isDark(), t = themeOf(s.theme), r = reading(), root = document.documentElement.style;
    const c = dark
      ? { bg: t.bgDark, surface: t.contDark, container: t.varDark, ink: "#ECE8DF", muted: "#B3ADA2", accent: t.accentDark, onAccent: t.bgDark, outline: "#57534B",
        right: "#74C99E", wrong: "#EB8F86", err: "#F2B8B5", onErr: "#601410" }
      : { bg: t.bgLight, surface: t.contLight, container: t.varLight, ink: "#1C1B18", muted: "#57534B", accent: t.accentLight, onAccent: "#FFFFFF", outline: "#C9C3B6",
        right: "#2E8659", wrong: "#B4473F", err: "#B3261E", onErr: "#FFFFFF" };
    const vars = {
      "--bg": c.bg, "--surface": c.surface, "--container": c.container, "--ink": c.ink, "--muted": c.muted, "--accent": c.accent, "--on-accent": c.onAccent,
      "--outline": c.outline, "--right": c.right, "--wrong": c.wrong, "--err": c.err, "--on-err": c.onErr,
      "--ink-rgb": rgb(c.ink), "--accent-rgb": rgb(c.accent), "--muted-rgb": rgb(c.muted), "--bg-rgb": rgb(c.bg), "--right-rgb": rgb(c.right), "--wrong-rgb": rgb(c.wrong),
      // The tray's glass: smoky with white icons on dark, warm milk with dark icons on cream.
      "--glass": dark ? "rgba(35,38,47,.37)" : "rgba(250,246,238,.72)", "--glass-edge": dark ? "rgba(255,255,255,.22)" : "rgba(28,27,24,.10)",
      "--glass-shadow": dark ? ".45" : ".16", "--tray-ink": dark ? "#fff" : "#26282E", "--saved": dark ? "#FFCB6B" : "#C7881A",
      "--wm": `linear-gradient(90deg, ${[...(dark ? WM_DARK : WM_LIGHT), (dark ? WM_DARK : WM_LIGHT)[0]].join(", ")})`,
      "--read-font": r.font.family, "--read-size": `${r.size}px`, "--read-lh": (r.font.lh * r.line).toFixed(4), "--read-para": `${(r.size * r.para).toFixed(2)}px`,
      "--read-word": `${r.word}px`, "--read-letter": `${r.letter}em`, "--read-margin": `${r.margin}px`,
      // A section card's title: one size step below the text (FontChoice steps).
      "--read-title": `${r.font.sizeSteps[Math.max(0, nearestIndex(r.size, r.font.sizeSteps) - 1)]}px`,
    };
    for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c.bg);
    if (typeof PALETTE !== "undefined") PALETTE.splice(0, 10, ...(dark ? DARK_PALETTE : LIGHT_PALETTE).map((x) => [...x]));
  }
  // A theme change crossfades every colour, like the app's 350 ms Crossfade.
  function retheme() {
    const html = document.documentElement;
    html.classList.add("theming");
    apply();
    clearTimeout(retheme.t);
    retheme.t = setTimeout(() => html.classList.remove("theming"), 420);
  }
  media.addEventListener("change", () => { if (s.mode === "SYSTEM") retheme(); });
  const paraGap = () => { const r = reading(); return r.size * r.para; };

  // ---- shared pieces -------------------------------------------------------------
  const BACKARROW = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`;
  const CHEVRON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>`;
  const CHECK = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
  const DROP = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>`;
  const REFRESH = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
  const subBar = (title) => `<div class="subbar"><button class="icon-btn" data-back aria-label="Back">${BACKARROW}</button><h1>${esc(title)}</h1></div>`;
  const wireBack = (view) => view.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => history.back()));
  const entrance = (el, delay = 0) => el && el.animate([{ opacity: 0, transform: "translate3d(0,22px,0)" }, { opacity: 1, transform: "none" }],
    { duration: 520, delay, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards" });
  const sectionLabel = (t) => `<div class="slabel">${esc(t)}</div>`;
  const vibrate = () => navigator.vibrate && navigator.vibrate(8);

  // A settings row as its own soft card (SettingsItem): a gradient icon tile,
  // title and subtitle, a chevron. It rises in on its beat; under the finger
  // the card dips 2.5%, brightens a touch and the chevron nudges forward.
  function tileHtml({ title, subtitle, icon, seed, act }) {
    const [a, b] = PALETTE[seed];
    return `<button class="sitem" data-act="${act}"><span class="stile2" style="background:linear-gradient(135deg, ${a}, ${b})">${icon}</span>
      <span class="stx"><b>${esc(title)}</b>${subtitle ? `<small>${esc(subtitle)}</small>` : ""}</span><span class="schev">${CHEVRON}</span></button>`;
  }
  function wireTiles(root, onAct) {
    root.querySelectorAll(".sitem").forEach((el, i) => {
      entrance(el, 40 + i * 55);
      const chev = el.querySelector(".schev");
      const sp = new Motion.Spring(0, { damping: 0.6, stiffness: 700, onUpdate: (p) => {
        el.style.transform = p ? `scale(${(1 - 0.025 * p).toFixed(4)})` : "";
        el.style.setProperty("--press", p.toFixed(3));
        chev.style.transform = `translateX(${(3 * p).toFixed(2)}px)`;
        chev.style.opacity = (0.55 + 0.35 * p).toFixed(3);
      } });
      sp.snap(0);
      el.addEventListener("pointerdown", () => sp.to(1));
      for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, () => sp.to(0));
      el.onclick = () => onAct(el.dataset.act);
    });
  }

  // A bottom sheet (ModalBottomSheet): the grab bar, rises from below over a 32% scrim.
  function sheet(html, { onClose } = {}) {
    const o = document.createElement("div");
    o.className = "sheetover";
    o.innerHTML = `<div class="sheet tall"><i class="grab"></i>${html}</div>`;
    document.body.appendChild(o);
    const sh = o.querySelector(".sheet");
    o.animate([{ background: "rgba(0,0,0,0)" }, { background: "rgba(0,0,0,.32)" }], { duration: 250, fill: "forwards" });
    sh.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: 350, easing: "cubic-bezier(.2,0,0,1)" });
    let closing = false;
    const close = (then) => {
      if (closing) return; closing = true;
      sh.animate([{ transform: getComputedStyle(sh).transform === "none" ? "translateY(0)" : getComputedStyle(sh).transform }, { transform: "translateY(100%)" }], { duration: 250, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
      o.animate([{ background: "rgba(0,0,0,.32)" }, { background: "rgba(0,0,0,0)" }], { duration: 250, fill: "forwards" }).onfinish = () => { o.remove(); onClose && onClose(); then && then(); };
    };
    o.addEventListener("click", (e) => { if (e.target === o) close(); });
    // Leaving the page (Back) takes the sheet away with it.
    const onHash = () => { removeEventListener("hashchange", onHash); if (o.isConnected) { o.remove(); onClose && onClose(); } };
    addEventListener("hashchange", onHash);
    // Swipe the sheet down to close it.
    let y0 = null, dy = 0;
    const grab = o.querySelector(".grab");
    sh.addEventListener("pointerdown", (e) => { if (e.target === grab || e.clientY - sh.getBoundingClientRect().top < 44 || sh.scrollTop <= 0 && e.target.closest(".sheet") === sh && e.pointerType === "touch") { y0 = e.clientY; dy = 0; } });
    addEventListener("pointermove", (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); if (dy > 6) sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
    const up = () => { if (y0 == null) return; y0 = null; if (dy > 90) close(); else if (dy) { sh.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 220, easing: "cubic-bezier(.2,0,0,1)" }); sh.style.transform = ""; } };
    addEventListener("pointerup", up); addEventListener("pointercancel", up);
    return { el: o, sheet: sh, close };
  }

  // ---- the stepped slider (SteppedSlider) ----------------------------------------
  // Five named steps on a slim track: the filled part runs to a white knob that
  // springs from step to step (0.72, 420), swells while held (0.6, 600); the
  // step's name slides in its chip; tap to jump, or drag with a tick per step.
  const KNOB = 11, TRACK = 12;
  function glyph(kind, more) {
    const c = "currentColor";
    if (kind === "size") return `<span class="gA" style="font-size:${more ? 21 : 13}px">A</span>`;
    if (kind === "letter") return `<span class="gA" style="font-size:13px;letter-spacing:${more ? 3 : -0.5}px">ab</span>`;
    const line = (y, x0 = 0, x1 = 22) => `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`;
    let g = "";
    if (kind === "line") { const gap = more ? 7 : 3.5; for (let k = -1; k <= 1; k++) g += line(11 + k * gap, 3, 19); }
    else if (kind === "para") { const inner = 3, block = more ? 8 : 4, top = 11 - (inner * 2 + block) / 2;
      g = line(top, 2, 20) + line(top + inner, 2, 15) + line(top + inner + block, 2, 20) + line(top + inner * 2 + block, 2, 15); }
    else if (kind === "word") { const gap = more ? 7 : 2.5, w = (22 - gap) / 2 - 1, x0 = (22 - (w * 2 + gap)) / 2;
      g = `<line x1="${x0}" y1="11" x2="${x0 + w}" y2="11" stroke="${c}" stroke-width="3" stroke-linecap="round"/><line x1="${x0 + w + gap}" y1="11" x2="${x0 + 2 * w + gap}" y2="11" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`; }
    else if (kind === "margin") { const inset = more ? 6 : 3; g = `<rect x="3" y="1" width="16" height="20" rx="2.5" fill="none" stroke="${c}" stroke-width="1.5"/>`;
      for (let k = -1; k <= 1; k++) g += line(11 + k * 4, 3 + inset, 19 - inset); }
    return `<svg width="22" height="22" viewBox="0 0 22 22">${g}</svg>`;
  }
  function slider(host, { title, steps, value, kind, onChange }) {
    let index = nearestIndex(value, steps);
    host.innerHTML = `<div class="slrow"><span class="sltitle">${esc(title)}</span><span class="chip2"><span class="chipin">${STEP_NAMES[index]}</span></span></div>
      <div class="sltrack"><span class="glyph">${glyph(kind, false)}</span><canvas aria-label="${esc(title)}" role="slider"></canvas><span class="glyph">${glyph(kind, true)}</span></div>`;
    const cv = host.querySelector("canvas"), chip = host.querySelector(".chip2");
    cv.setAttribute("aria-valuetext", STEP_NAMES[index]);
    const n = steps.length;
    let hold = 0, dragging = false;
    const colors = () => { const cs = getComputedStyle(document.documentElement); return { accent: cs.getPropertyValue("--accent").trim(), onAccent: cs.getPropertyValue("--on-accent").trim(), ink: cs.getPropertyValue("--ink-rgb").trim() }; };
    function draw(p) {
      const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = 24;
      if (!W) return;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = H * dpr; }
      const c = cv.getContext("2d"), col = colors();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      const cy = H / 2, half = TRACK / 2, span = W - 2 * KNOB, x = KNOB + p * span;
      const rr = (x0, w) => { c.beginPath(); c.roundRect ? c.roundRect(x0, cy - half, w, half * 2, half) : c.rect(x0, cy - half, w, half * 2); c.fill(); };
      c.fillStyle = `rgba(${col.ink},.10)`; rr(0, W);
      const g = c.createLinearGradient(0, 0, Math.max(1, x), 0);
      g.addColorStop(0, col.accent + "8C"); g.addColorStop(1, col.accent);
      c.fillStyle = col.accent.length === 7 ? g : col.accent; rr(0, x + half);
      for (let k = 0; k < n; k++) {
        const cx = KNOB + (span * k) / (n - 1);
        c.fillStyle = cx <= x ? (col.onAccent.length === 7 ? col.onAccent + "99" : col.onAccent) : `rgba(${col.ink},.30)`;
        c.beginPath(); c.arc(cx, cy, 1.8, 0, Math.PI * 2); c.fill();
      }
      const kr = KNOB - 1 + 1.5 * hold;
      c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.arc(x, cy + 1.2, kr + 0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(x, cy, kr, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.accent; c.beginPath(); c.arc(x, cy, kr * (0.3 + 0.08 * hold), 0, Math.PI * 2); c.fill();
    }
    const pos = new Motion.Spring(index / (n - 1), { damping: 0.72, stiffness: 420, onUpdate: (v) => draw(v) });
    const held = new Motion.Spring(0, { damping: 0.6, stiffness: 600, onUpdate: (v) => { hold = v; draw(pos.value); } });
    pos.snap(index / (n - 1));
    requestAnimationFrame(() => draw(pos.value));
    function setChip(i, up) {
      const old = chip.querySelector(".chipin"), nu = document.createElement("span");
      nu.className = "chipin"; nu.textContent = STEP_NAMES[i];
      chip.appendChild(nu);
      old.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${up ? -100 : 100}%)`, opacity: 0 }], { duration: 180, fill: "forwards", easing: "cubic-bezier(.4,0,.2,1)" }).finished.then(() => old.remove());
      nu.animate([{ transform: `translateY(${up ? 100 : -100}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.4,0,.2,1)" });
      cv.setAttribute("aria-valuetext", STEP_NAMES[i]);
    }
    function pickIndex(i) {
      if (i === index) return;
      const up = i > index;
      index = i; vibrate(); setChip(i, up); onChange(steps[i]);
    }
    const frac = (x) => { const r = cv.getBoundingClientRect(); return Math.min(1, Math.max(0, (x - r.left - KNOB) / (r.width - 2 * KNOB))); };
    let downX = null;
    cv.addEventListener("pointerdown", (e) => { downX = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (downX == null) return;
      if (!dragging && Math.abs(e.clientX - downX) > 6) { dragging = true; held.to(1); }
      if (dragging) { const f = frac(e.clientX); pos.snap(f); pickIndex(Math.round(f * (n - 1))); }
    });
    const end = (e) => {
      if (downX == null) return;
      if (!dragging && e.type === "pointerup") pickIndex(Math.round(frac(e.clientX) * (n - 1)));
      downX = null; dragging = false; held.to(0);
      pos.to(index / (n - 1));
    };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    return { set(v) { const i = nearestIndex(v, steps); if (i !== index) { setChip(i, i > index); index = i; } pos.to(i / (n - 1)); }, redraw: () => draw(pos.value) };
  }

  // ---- Settings (SettingsScreen) --------------------------------------------------
  function settingsPage(view) {
    view.innerHTML = subBar("Settings") + `<div class="sgroup" style="margin-top:12px">
      ${tileHtml({ title: "Font", subtitle: "Typeface, text size, and spacing", seed: 2, act: "font", icon: `<span class="fmark" style="font-family:${font().family}">Aa</span>` })}
      ${tileHtml({ title: "Layout", subtitle: "Theme and reading margins", seed: 4, act: "layout", icon: `<span class="ico" style="width:22px;height:22px">${ICONS.ic_palette}</span>` })}</div>`;
    wireBack(view);
    wireTiles(view, (a) => go(`#/settings/${a}`));
  }

  // ---- Font (FontSettingsScreen) ---------------------------------------------------
  const SAMPLE = "<p>The <strong>quick</strong> brown fox jumps over the <em>lazy</em> dog, showing bold and italics.</p><p>A second paragraph shows the paragraph gap at your chosen setting.</p>";
  function fontPage(view) {
    view.innerHTML = subBar("Font") + `<div class="spage">
      ${sectionLabel("Typeface")}<button class="tfpick"><span class="tfdisc"><span>Aa</span></span><span class="tfmid"><b></b><small></small></span><span class="tfdrop">${DROP}</span></button>
      ${sectionLabel("Text size")}<div data-s="size"></div>
      ${sectionLabel("Preview")}<div class="fprev"><div class="dprose">${SAMPLE}</div></div>
      ${sectionLabel("Spacing")}<div data-s="line"></div><div style="height:22px"></div><div data-s="para"></div><div style="height:22px"></div>
      <div data-s="word"></div><div style="height:22px"></div><div data-s="letter"></div><div style="height:30px"></div>
      <div class="rwrap"><button class="restore" data-press="0.95"><span class="rico">${REFRESH}</span><span class="rlab"><span>Restore default font settings</span></span></button></div>
      <div style="height:40px"></div></div>`;
    wireBack(view);
    const pickBtn = view.querySelector(".tfpick");
    const paintPick = () => {
      const f = font();
      pickBtn.querySelector(".tfdisc span").style.fontFamily = f.family;
      const b = pickBtn.querySelector("b"); b.textContent = f.name; b.style.fontFamily = f.family;
      pickBtn.querySelector("small").textContent = f.serif ? "Serif" : "Sans serif";
    };
    paintPick();
    const sliders = {};
    const perFontSet = (k, v) => { (s.perFont[font().id] ??= {})[k] = v; save(); apply(); };
    const mk = (k, title, kind, steps, value, set) => (sliders[k] = slider(view.querySelector(`[data-s="${k}"]`), { title, kind, steps, value, onChange: set }));
    const build = () => {
      const f = font(), r = reading();
      mk("size", "Size", "size", f.sizeSteps, r.size, (v) => perFontSet("size", v));
      mk("line", "Line spacing", "line", f.lineSteps, r.line, (v) => perFontSet("line", v));
      mk("para", "Paragraph spacing", "para", f.paraSteps, r.para, (v) => perFontSet("para", v));
      mk("word", "Word spacing", "word", WORD, s.word, (v) => { s.word = v; save(); apply(); });
      mk("letter", "Letter spacing", "letter", LETTER, s.letter, (v) => { s.letter = v; save(); apply(); });
    };
    build();
    // The preview card speaks with the page's own text (margins aside).
    view.querySelector(".fprev .dprose").style.padding = "0";
    pickBtn.onclick = () => typefaceSheet(() => { paintPick(); build(); });
    // Restore: a light tick, the arrow spins back a full turn (650 ms) while the
    // sliders glide home; the label turns to "Restored" with a check, then back.
    const rb = view.querySelector(".restore");
    let busy = false;
    rb.onclick = () => {
      vibrate();
      s.perFont[font().id] = {}; s.word = 0; s.letter = 0; save(); apply();
      const r = reading();
      sliders.size.set(r.size); sliders.line.set(r.line); sliders.para.set(r.para); sliders.word.set(0); sliders.letter.set(0);
      if (busy) return; busy = true;
      const ic = rb.querySelector(".rico svg");
      ic.animate([{ transform: "scaleX(-1) rotate(0deg)" }, { transform: "scaleX(-1) rotate(-360deg)" }], { duration: 650, easing: "cubic-bezier(.4,0,.2,1)" });
      const swap = (label, icon) => {
        const lab = rb.querySelector(".rlab"), old = lab.firstElementChild, nu = document.createElement("span");
        nu.textContent = label; lab.appendChild(nu);
        old.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-50%)" }], { duration: 160, fill: "forwards" }).finished.then(() => old.remove());
        nu.animate([{ opacity: 0, transform: "translateY(50%)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 220 });
        const ri = rb.querySelector(".rico");
        ri.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        ri.innerHTML = icon;
      };
      setTimeout(() => swap("Restored", CHECK), 0);
      setTimeout(() => { swap("Restore default font settings", REFRESH); busy = false; }, 650 + 1300);
    };
  }
  // The typeface picker: serif faces, then sans serif, each row in its own face.
  function typefaceSheet(after) {
    const row = (f) => `<button class="tfrow ${f.id === s.font ? "on" : ""}" data-f="${f.id}"><span class="tfx"><b style="font-family:${f.family}">${esc(f.name)}</b>
      <small style="font-family:${f.family}">The quick brown fox jumps over the lazy dog</small></span>${f.id === s.font ? `<span class="tfck">${CHECK}</span>` : ""}</button>`;
    const { el, close } = sheet(`<div class="sht2">Reading typeface</div><div class="tflist">
      <div class="tfg">SERIF</div>${FONTS.filter((f) => f.serif).map(row).join("")}
      <div class="tfg">SANS SERIF</div>${FONTS.filter((f) => !f.serif).map(row).join("")}<div style="height:24px"></div></div>`);
    el.querySelectorAll(".tfrow").forEach((b) => (b.onclick = () => { s.font = b.dataset.f; save(); apply(); vibrate(); close(); after && after(); }));
  }

  // ---- Layout (LayoutSettingsScreen) -------------------------------------------------
  function layoutPage(view) {
    const modes = [["LIGHT", "Light"], ["DARK", "Dark"], ["SYSTEM", "System"]];
    const swatch = (t) => `linear-gradient(135deg, ${mix(t.accentLight, "#707070", 0.32)}, ${mix(t.accentDark, "#707070", 0.32)})`;
    view.innerHTML = subBar("Layout") + `<div class="spage">
      ${sectionLabel("Theme")}<div class="seg tseg">${modes.map(([m, l]) => `<button data-m="${m}" class="${s.mode === m ? "on" : ""}"><span class="ck">${s.mode === m ? CHECK : ""}</span>${l}</button>`).join("")}</div>
      ${sectionLabel("Color")}<div class="swrow">${THEMES.map((t) => `<button class="sw" data-t="${t.id}"><span class="swc ${s.theme === t.id ? "on" : ""}" style="background:${swatch(t)}">${s.theme === t.id ? CHECK : ""}</span><span class="swl">${t.name}</span></button>`).join("")}</div>
      ${sectionLabel("Margins")}<div data-s="margin"></div>
      ${sectionLabel("Preview")}<div class="mprev"><p style="font-family:${font().family}">This is how a definition sits inside its margins — narrower margins fit more text per line, wider margins read like a book.</p></div>
      <div style="height:40px"></div></div>`;
    wireBack(view);
    const seg = view.querySelector(".tseg");
    seg.querySelectorAll("button").forEach((b) => (b.onclick = () => {
      if (s.mode === b.dataset.m) return;
      s.mode = b.dataset.m; save(); vibrate(); retheme();
      seg.querySelectorAll("button").forEach((x) => { const on = x.dataset.m === s.mode; x.classList.toggle("on", on); x.querySelector(".ck").innerHTML = on ? CHECK : ""; });
      margin.redraw();
    }));
    view.querySelectorAll(".sw").forEach((b) => (b.onclick = () => {
      if (s.theme === b.dataset.t) return;
      s.theme = b.dataset.t; save(); vibrate(); retheme();
      view.querySelectorAll(".sw").forEach((x) => { const on = x.dataset.t === s.theme; const c = x.querySelector(".swc"); c.classList.toggle("on", on); c.innerHTML = on ? CHECK : ""; });
      setTimeout(() => margin.redraw(), 400);
    }));
    const prev = view.querySelector(".mprev p");
    prev.style.padding = `0 ${s.margin}px`;
    const margin = slider(view.querySelector('[data-s="margin"]'), { title: "Reading margins", kind: "margin", steps: MARGIN, value: s.margin,
      onChange: (v) => { s.margin = v; save(); apply(); prev.style.padding = `0 ${v}px`; } });
  }

  return { apply, isDark, reading, paraGap, font, fontOf, FONTS, settingsPage, fontPage, layoutPage, sheet, tileHtml, wireTiles, subBar, wireBack, entrance };
})();
