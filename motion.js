/* Wordly web — the app's motion, recreated. Every number here comes from the
   Android app (ui/Anim.kt, Sheen.kt, HomeBackground.kt, Common.kt Wordmark,
   MainActivity splash + page transitions), so the web moves the same way:
   real springs (Compose dampingRatio/stiffness, mass 1), the shared vertical
   reveal, the press dip, the sheen, the flowing wordmark and the drifting
   home icons. All motion runs on transform/opacity only, so it stays smooth. */
"use strict";

// Every in-app Back (tray arrow, bar arrows, quiz…) goes through history.back();
// noting when lets the router tell it from iPhone's own swipe-back, which has
// already animated the page in by itself (see app.js route).
{
  const back = history.back.bind(history);
  history.back = () => { window.__appBackAt = performance.now(); back(); };
}

const Motion = (() => {
  const dpr = () => 1; // CSS px already equal the app's dp on phones

  // ---- easing curves ----------------------------------------------------
  const bezier = (x1, y1, x2, y2) => {
    // Cubic-bezier easing (same maths as Android PathInterpolator).
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-6) break;
        const d = dsx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      return sy(t);
    };
  };
  const ease = {
    linear: (t) => t,
    fastOutSlowIn: bezier(0.4, 0, 0.2, 1),
    linearOutSlowIn: bezier(0, 0, 0.2, 1),
    emphasized: bezier(0.2, 0, 0, 1),          // EmphasizedEasing / SectionGlideEasing
    splash: bezier(0.22, 0, 0, 1),             // the splash exit's PathInterpolator
    // Android OvershootInterpolator(tension)
    overshoot: (tension = 1) => (t) => { t -= 1; return t * t * ((tension + 1) * t + tension) + 1; },
  };

  // ---- one shared frame loop -------------------------------------------
  const jobs = new Set();
  let running = false;
  function loop(now) {
    for (const job of [...jobs]) if (job(now) === false) jobs.delete(job);
    if (jobs.size) requestAnimationFrame(loop); else running = false;
  }
  function onFrame(job) {
    jobs.add(job);
    if (!running) { running = true; requestAnimationFrame(loop); }
    return () => jobs.delete(job);
  }

  // A timed animation: calls update(easedProgress) every frame for `duration` ms.
  function tween({ duration, delay = 0, easing = ease.linear, update, done }) {
    let start = null, cancelled = false;
    const stop = onFrame((now) => {
      if (cancelled) return false;
      if (start === null) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      if (now >= start) update(easing(t), t);
      if (t >= 1) { done && done(); return false; }
    });
    return { cancel() { cancelled = true; stop(); } };
  }

  // A spring (Compose's spring(): dampingRatio, stiffness, mass 1). Keeps its
  // velocity when retargeted, like Animatable, so presses feel continuous.
  class Spring {
    constructor(value, { damping = 1, stiffness = 1500, onUpdate } = {}) {
      this.value = value; this.velocity = 0; this.target = value;
      this.damping = damping; this.stiffness = stiffness; this.onUpdate = onUpdate;
      this.stop = null;
    }
    snap(v) { this.halt(); this.value = this.target = v; this.velocity = 0; this.onUpdate && this.onUpdate(v); return this; }
    halt() { if (this.stop) { this.stop(); this.stop = null; } }
    to(target, opts = {}) {
      if (opts.damping) this.damping = opts.damping;
      if (opts.stiffness) this.stiffness = opts.stiffness;
      this.target = target;
      this.halt();
      let last = null;
      return new Promise((resolve) => {
        this.stop = onFrame((now) => {
          const dt = last === null ? 1 / 60 : Math.min(0.064, (now - last) / 1000);
          last = now;
          // Integrate in small sub-steps (semi-implicit Euler) for stability.
          const steps = Math.ceil(dt / 0.004);
          const h = dt / steps;
          const w0 = Math.sqrt(this.stiffness);
          for (let i = 0; i < steps; i++) {
            const x = this.value - this.target;
            const a = -this.stiffness * x - 2 * this.damping * w0 * this.velocity;
            this.velocity += a * h;
            this.value += this.velocity * h;
          }
          const settled = Math.abs(this.value - this.target) < 0.0005 && Math.abs(this.velocity) < 0.005;
          if (settled) { this.value = this.target; this.velocity = 0; }
          this.onUpdate && this.onUpdate(this.value);
          if (settled) { this.stop = null; resolve(); return false; }
        });
      });
    }
  }

  // ---- THE shared vertical reveal (Anim.kt) ------------------------------
  const REVEAL = { stagger: 70, duration: 560, rise: 14 };
  const overshoot1 = ease.overshoot(1.0);
  function revealStyle(el, t) {
    el.style.opacity = Math.min(1, Math.max(0, t));
    el.style.transform = `translate3d(0, ${((1 - overshoot1(t)) * REVEAL.rise).toFixed(2)}px, 0)`;
  }
  // Run by the browser's own animation engine (Web Animations), not a
  // per-frame script: on iPhone it keeps going smoothly while the page is busy.
  const REVEAL_KEYS = Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    return { opacity: t, transform: `translate3d(0, ${((1 - overshoot1(t)) * REVEAL.rise).toFixed(2)}px, 0)` };
  });
  function revealNow(el, delay = 0, duration = REVEAL.duration) {
    el.style.opacity = ""; el.style.transform = "";
    const a = el.animate(REVEAL_KEYS, { duration, delay, fill: "backwards" });
    return a.finished.then(() => {}, () => {});
  }

  // Scroll direction, shared by every tracker: "scrolling down" means the page
  // moved towards its end within the last 120 ms.
  let lastY = 0, downAt = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    if (y > lastY) downAt = performance.now();
    lastY = y;
  }, { passive: true });
  const scrollingDown = () => performance.now() - downAt < 120;
  // Put a page back where the reader left it, without that jump counting as
  // "scrolling down" (which would make its rows rise in again on returning).
  function restoreScroll(y) { lastY = y; downAt = 0; scrollTo(0, y); lastY = scrollY; }

  /* Decides when items rise in (RevealTracker): everything on screen when the
     page first opens (a cascade from `openedAt`), then — after that — each item
     that comes in from below while the reader scrolls DOWN, in the quick form.
     Items seen again while scrolling up, or on returning to a page, just show. */
  class RevealTracker {
    constructor({ firstDelay = 0, returning = false } = {}) {
      this.openedAt = 0;          // 0 = not opened yet: items wait
      this.firstDelay = firstDelay;
      this.returning = returning;
      this.lastStart = 0;
      this.waiting = [];
      this.io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { this.io.unobserve(e.target); this.place(e.target); }
      }, { rootMargin: "0px 0px -2% 0px" });
    }
    open(at = performance.now()) {
      this.openedAt = at;
      const w = this.waiting; this.waiting = [];
      w.forEach((fn) => fn());
    }
    wantsReveal() {
      const now = performance.now();
      if (this.returning) return scrollingDown() && now - this.openedAt > 0;
      return this.openedAt === 0 || now - this.openedAt < 900 || scrollingDown();
    }
    claim() {
      const now = performance.now();
      const inOpening = now - this.openedAt < 900;
      const quick = !inOpening || this.returning;
      const stagger = quick ? 30 : REVEAL.stagger;
      const first = quick ? 0 : this.firstDelay;
      const cap = quick ? 150 : 560;
      const earliest = Math.max(now, inOpening ? this.openedAt + first : now);
      const start = Math.min(Math.max(earliest, this.lastStart + stagger), earliest + cap);
      this.lastStart = start;
      return start - now;
    }
    add(el) {
      if (!el) return el;
      el.style.opacity = "0";
      this.io.observe(el);
      return el;
    }
    place(el) {
      if (!this.wantsReveal()) { el.style.opacity = ""; el.style.transform = ""; return; }
      const go = () => revealNow(el, Math.max(0, this.claim()));
      if (this.openedAt === 0) { revealStyle(el, 0); this.waiting.push(go); } else go();
    }
    dispose() { this.io.disconnect(); }
  }

  // ---- press dip (pressScale) --------------------------------------------
  // Any element with data-press dips to its value (default 0.97) while held and
  // springs back on release: spring(0.55, 620) — tray buttons use 0.82 (0.45, 650).
  const pressSprings = new WeakMap();
  function pressSpring(el) {
    let s = pressSprings.get(el);
    if (!s) {
      const tray = el.dataset.press === "tray";
      s = new Spring(1, { damping: tray ? 0.45 : 0.55, stiffness: tray ? 650 : 620,
        onUpdate: (v) => { el.style.transform = v === 1 ? "" : `scale(${v.toFixed(4)})`; } });
      s.low = tray ? 0.82 : Number(el.dataset.press) || 0.97;
      pressSprings.set(el, s);
    }
    return s;
  }
  let pressed = null;
  addEventListener("pointerdown", (e) => {
    const el = e.target.closest && e.target.closest("[data-press]");
    if (!el) return;
    pressed = el;
    const s = pressSpring(el);
    s.to(s.low);
  }, { passive: true });
  const release = () => { if (pressed) { pressSpring(pressed).to(1); pressed = null; } };
  addEventListener("pointerup", release, { passive: true });
  addEventListener("pointercancel", release, { passive: true });
  addEventListener("scroll", release, { passive: true });

  // ---- the wordmark's shared clock ---------------------------------------
  // One clock for every flowing wordmark (17 s per turn), so they all flow in
  // step and none restarts when it reappears: each starts mid-flow.
  const FLOW_MS = 17000;
  function syncFlow(el) {
    el.style.animationDelay = `${-(performance.timeOrigin + performance.now()) % FLOW_MS}ms`;
    return el;
  }

  // ---- page transitions (MainActivity AnimatedContent) -------------------
  // `kind`: "toWord" (fade 220 in / 200 out), "fromWord" (home scales up from
  // 0.98 while the word shrinks to 0.92, fades and slides down), else fade 220/180.
  function transition(oldNode, newNode, kind) {
    // Safety net: whatever happens to the frames (a throttled or hidden page),
    // the old screen is gone and the new one fully shown shortly after.
    setTimeout(() => {
      if (oldNode && oldNode.isConnected) oldNode.remove();
      newNode.style.opacity = ""; newNode.style.transform = "";
    }, 600);
    if (oldNode) {
      const y = scrollY;
      oldNode.style.position = "fixed";
      oldNode.style.top = `${-y}px`;
      oldNode.style.left = "0"; oldNode.style.right = "0";
      oldNode.style.zIndex = "30";
      oldNode.style.pointerEvents = "none";
      const h = innerHeight;
      // The old screen leaves on the browser's animation engine (off the main thread).
      if (kind === "fromWord") {
        oldNode.style.transformOrigin = `50% ${y + h / 2}px`;
        oldNode.animate([{ transform: "translate3d(0, 0, 0) scale(1)" }, { transform: `translate3d(0, ${(h / 12).toFixed(1)}px, 0) scale(0.92)` }],
          { duration: 340, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" });
        oldNode.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" }).onfinish = () => oldNode.remove();
      } else {
        oldNode.animate([{ opacity: 1 }, { opacity: 0 }], { duration: kind === "toWord" ? 200 : 180, fill: "forwards" }).onfinish = () => oldNode.remove();
      }
    }
    if (kind === "fromWord") {
      newNode.style.opacity = "0";
      tween({ duration: 340, easing: ease.fastOutSlowIn, update: (e) => {
        newNode.style.transform = `scale(${(0.98 + 0.02 * e).toFixed(4)})`;
      }, done: () => { newNode.style.transform = ""; } });
      tween({ duration: 260, update: (e) => { newNode.style.opacity = e; }, done: () => { newNode.style.opacity = ""; } });
    } else {
      newNode.style.opacity = "0";
      tween({ duration: 220, update: (e) => { newNode.style.opacity = e; }, done: () => { newNode.style.opacity = ""; } });
    }
  }

  // ---- splash exit (MainActivity) ----------------------------------------
  // The splash mark glides up toward the home logo (−32% of the screen),
  // shrinks to half and fades late, while the splash itself fades: 650 ms on
  // PathInterpolator(.22, 0, 0, 1). Resolves when the home should start rising.
  function liftSplash() {
    const splash = document.getElementById("splash");
    if (!splash) return Promise.resolve();
    const icon = splash.querySelector(".splash-icon");
    const rise = -innerHeight * 0.32;
    // Keyframes 1 → 1 → 0 over the run (ObjectAnimator with three values).
    const late = (e) => (e < 0.5 ? 1 : 1 - (e - 0.5) * 2);
    tween({ duration: 650, update: (_, t) => {
      const e = ease.splash(t);
      icon.style.transform = `translate3d(0, ${(rise * e).toFixed(1)}px, 0) scale(${(1 - 0.5 * e).toFixed(4)})`;
      icon.style.opacity = late(e);
      splash.style.opacity = late(e);
    }, done: () => splash.remove() });
    return Promise.resolve();
  }

  return { ease, tween, Spring, onFrame, REVEAL, revealNow, revealStyle, RevealTracker, syncFlow, transition, liftSplash, bezier, restoreScroll };
})();
