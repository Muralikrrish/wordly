/* Wordly web — the Word Challenge, recreated from the app (data/Quiz.kt,
   QuizController.kt, ui/QuizScreens.kt, ui/QuizWords.kt, ui/ResultCard.kt).
   Same questions (the clue-ladder bank), the same Daily Challenge ten for
   each date (QuizPlan.daily with Kotlin's own seeded shuffles), the same
   spaced review, streak and scoring; numbers beside each piece are the app's. */
"use strict";

const Quiz = (() => {
  const { Spring, tween, ease } = Motion;
  const RIGHT = "var(--right)", WRONG = "var(--wrong)";               // rightInk / wrongInk
  const FLAME_TOP = "#FFC94F", FLAME_MID = "#FF8A3D", FLAME_BASE = "#E5484D";
  const RECALL_MISS = 9, LADDER_HINTS = 2;
  const ROUND = 10, PRACTICE_ROUND = 5, PRACTICE_ROUNDS = 4, DAILY_HARD = 5;
  const INTERVALS = [0, 2, 7, 14, 30, 60], MASTERED = 4, LOG_DAYS = 30;
  const EPOCH = Date.UTC(2026, 9, 1) / 86400000;            // Daily Challenge #1
  const isCorrect = (pick) => pick != null && pick >= 0 && pick <= LADDER_HINTS;
  const ladderPoints = (pick) => ({ 0: 3, 1: 2, 2: 1 }[pick] ?? 0);
  const dailyNumber = (day) => Math.max(1, day - EPOCH + 1);
  const today = () => epochDay();

  const ARROW = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>`;
  const CLOSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  const CHECK = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
  const PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const DOWN = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
  const BACKARROW = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`;
  const ic = (name, size) => `<span class="ico" style="width:${size}px;height:${size}px">${ICONS[name] || ""}</span>`;

  // ---- the bank (QuizBank): one clue-ladder question per clue ---------------
  let bank = null, byId = new Map();
  const famOf = (w) => { let s = w.toLowerCase(); if (s.startsWith("a ")) s = s.slice(2); if (s.startsWith("the ")) s = s.slice(4); return s.slice(0, 5); };
  async function loadBank() {
    if (bank) return bank;
    const rows = await json("data/quiz.json");
    bank = [];
    for (const [eid, clue, gre] of rows) {
      const e = data.byId.get(eid);
      if (!e) continue;
      const text = e.word.toLowerCase();
      bank.push({ id: `w:${text}:${e.type}`, eid, word: e.word, type: e.type, clue, level: gre ? 2 : 1, text, fam: famOf(e.word) });
    }
    byId = new Map(bank.map((q) => [q.id, q]));
    return bank;
  }
  const clashes = (a, b) => a.fam === b.fam || a.text === b.text;

  // ---- Kotlin's shuffled(Random(seed)) --------------------------------------
  function shuffledSeeded(list, seed) {
    const r = kotlinRandom(BigInt(seed)), a = [...list];
    for (let i = a.length - 1; i >= 1; i--) { const j = r.nextInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function shuffled(list) {
    const a = [...list];
    for (let i = a.length - 1; i >= 1; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---- the reader's history (QuizStore), kept on this device ----------------
  let st = null;
  const S = () => (st ??= Object.assign({ progress: {}, daily: {}, log: {}, best: 0, draft: null, prac: null, pd: null }, store.get("quiz", {})));
  const save = () => store.set("quiz", st);
  const progressOf = (id) => { const p = S().progress[id]; return p ? { box: p[0], due: p[1], last: p[2], right: p[3], wrong: p[4], lastPick: p[5] } : null; };
  function record(id, correct, day, pick) {
    const pr = S().progress;
    const p = pr[id] || [0, day, day, 0, 0, -1];
    p[5] = pick;
    if (correct) { p[3]++; p[0] = p[0] === 0 ? 2 : Math.min(p[0] + 1, INTERVALS.length - 1); }
    else { p[4]++; p[0] = 1; }
    p[1] = day + INTERVALS[p[0]];
    p[2] = day;
    pr[id] = p; save();
  }
  const dailyResult = (day) => { const r = S().daily[day]; return r ? { ...r, score: [...r.pattern].filter((c) => c === "1").length } : null; };
  const dailyDraft = (day) => (S().draft && S().draft.day === day ? S().draft.picks : []);
  const dailyDraftIds = (day) => (S().draft && S().draft.day === day ? S().draft.ids : []);
  function finishDaily(day, picks, pattern, ids) {
    S().daily[day] = { picks, pattern, ids };
    st.best = Math.max(st.best, streak(day));
    st.draft = null; save();
  }
  function streak(day) {
    const d = S().daily; let x = d[day] ? day : day - 1, n = 0;
    while (d[x]) { n++; x--; }
    return n;
  }
  const playedOn = (day) => !!S().daily[day];
  function logAnswer(day, kind, id, pick) {
    const log = S().log;
    (log[day] ??= {});
    (log[day][kind] ??= []).push([id, pick]);
    for (const k of Object.keys(log)) if (Number(k) < day - LOG_DAYS) delete log[k];
    save();
  }
  const practiceLog = (day) => (S().log[day] && S().log[day].p) || [];
  function answersOn(day) {
    const l = S().log[day];
    const daily = (l && l.d) || (S().daily[day] ? S().daily[day].ids.map((id, i) => [id, S().daily[day].picks[i]]) : []);
    return [...daily, ...practiceLog(day)];
  }
  const answerDays = () => [...new Set([...Object.keys(S().log).filter((d) => Object.values(S().log[d]).some((a) => a.length)),
    ...Object.keys(S().daily)].map(Number))].sort((a, b) => b - a);
  const practiceRounds = (day) => (S().prac && S().prac.day === day ? S().prac.rounds : 0);
  const countPracticeRound = (day) => { S().prac = { day, rounds: practiceRounds(day) + 1 }; save(); };
  const practiceDraft = (day) => (S().pd && S().pd.day === day && S().pd.ids.length ? S().pd : null);
  const savePracticeDraft = (day, ids, picks) => { S().pd = { day, ids, picks }; save(); };
  const clearPracticeDraft = () => { S().pd = null; save(); };

  // ---- which questions a round asks (QuizPlan) ------------------------------
  function pick(candidates, size, levelCap = {}) {
    const picked = [];
    for (const capped of [true, false]) {
      for (const q of candidates) {
        if (picked.length === size) return picked;
        if (picked.includes(q) || picked.some((p) => clashes(p, q))) continue;
        if (capped && picked.filter((p) => p.level === q.level).length >= (levelCap[q.level] ?? size)) continue;
        picked.push(q);
      }
    }
    return picked;
  }
  function planDaily(day) {
    if (!bank.length) return [];
    const sorted = [...bank].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const order = shuffledSeeded(sorted, 20261001);
    const number = dailyNumber(day) - 1;
    const window = (pool, perDay) => {
      if (!pool.length) return [];
      const start = (number * perDay) % pool.length;
      return pool.map((_, k) => pool[(start + k) % pool.length]);
    };
    const hard = window(order.filter((q) => q.level >= 2), DAILY_HARD);
    const easy = window(order.filter((q) => q.level < 2), ROUND - DAILY_HARD);
    return shuffledSeeded(pick([...hard, ...easy], ROUND, { 2: DAILY_HARD, 1: ROUND - DAILY_HARD }), day);
  }
  function planPractice(day, favoured, exclude) {
    const pool = bank.filter((q) => !exclude.has(q.id));
    const P = (q) => progressOf(q.id);
    const due = pool.filter((q) => { const p = P(q); return p && p.due <= day && p.last < day; }).sort((a, b) => P(a).due - P(b).due);
    const fresh = shuffled(pool.filter((q) => !P(q))).sort((a, b) => favoured.has(b.text) - favoured.has(a.text));
    const rest = shuffled(pool.filter((q) => { const p = P(q); return p && p.due > day && p.last < day; }))
      .sort((a, b) => P(a).box - P(b).box || P(a).due - P(b).due);
    return shuffled(pick([...due, ...fresh, ...rest], PRACTICE_ROUND));
  }
  const dueCount = (day) => bank.filter((q) => { const p = progressOf(q.id); return p && p.due <= day && p.last < day; }).length;

  // ---- rounds (QuizController) ----------------------------------------------
  const MODE_DAILY = "daily", MODE_RETAKE = "retake", MODE_PRACTICE = "practice", MODE_PREVIEW = "preview", MODE_PRETAKE = "pretake";
  const sessions = {};
  let active = null;
  const session = () => (active ? sessions[active] : null);
  function newSession(mode, day, number, questions, { picks = [], finished = false, review = false } = {}) {
    const s = { mode, day, number, questions, picks: [...picks], finished, review, clues: {}, typed: {},
      celebrateStreak: false, justFinished: false, scroll: 0 };
    s.index = review ? 0 : Math.min(picks.length, Math.max(0, questions.length - 1));
    return s;
  }
  const answeredNow = (s) => s.picks.length > s.index;
  const scoreOf = (s) => s.picks.filter((p) => isCorrect(p)).length;
  const pointsOf = (s) => s.picks.reduce((n, p) => n + ladderPoints(p), 0);
  const isRight = (s, i) => (i < s.picks.length ? isCorrect(s.picks[i]) : null);
  const patternOf = (s) => s.questions.map((_, i) => (isRight(s, i) ? "1" : "0")).join("");

  function practiceToday(day) {
    return practiceLog(day).map(([id, p]) => [byId.get(id), p]).filter(([q, p]) => q && (isCorrect(p) || p === RECALL_MISS));
  }
  function dailyQuestions(day) {
    const r = dailyResult(day);
    const dealt = r && r.ids.length ? r.ids : dailyDraftIds(day);
    if (dealt.length) {
      const qs = dealt.map((id) => byId.get(id)).filter(Boolean);
      if (qs.length === dealt.length) return qs;
    }
    return planDaily(day);
  }
  function practiceRound(day) {
    const p = sessions[MODE_PRACTICE];
    if (p && p.day === day) return p.finished || p.picks.length >= p.questions.length ? null : [p.picks.length, p.questions.length];
    const d = practiceDraft(day);
    return d && d.picks.length < d.ids.length ? [d.picks.length, d.ids.length] : null;
  }
  function summarize() {
    const day = today();
    for (const k of Object.keys(sessions)) if (sessions[k].day !== day) delete sessions[k];
    const r = dailyResult(day);
    const pt = practiceToday(day);
    const all = answersOn(day).filter(([id]) => byId.has(id));
    return {
      ready: !!bank, total: bank ? bank.length : 0, today: day, dailyNumber: dailyNumber(day), dailyResult: r,
      dailyAnswered: sessions[MODE_DAILY] ? sessions[MODE_DAILY].picks.length : dailyDraft(day).length,
      streak: streak(day), bestStreak: S().best,
      week: [6, 5, 4, 3, 2, 1, 0].map((k) => playedOn(day - k)),
      due: bank ? dueCount(day) : 0,
      dailySize: r ? r.pattern.length : dailyDraftIds(day).length || ROUND,
      practiceLeft: Math.max(0, PRACTICE_ROUNDS - practiceRounds(day)),
      practiceAnswered: pt.length, practiceRight: pt.filter(([, p]) => isCorrect(p)).length,
      todayAnswered: all.length, todayRight: all.filter(([id, p]) => isCorrect(p)).length,
      todayMastered: [...new Set(answersOn(day).map(([id]) => id))].filter((id) => (progressOf(id)?.box ?? 0) >= MASTERED).length,
      practiceRound: bank ? practiceRound(day) : null,
      // The Daily Challenge's next question, for the card's preview (only its
      // clue and letter boxes are drawn).
      next: !r && bank ? (dailyQuestions(day)[sessions[MODE_DAILY] ? sessions[MODE_DAILY].picks.length : dailyDraft(day).length] || null) : null,
    };
  }
  function openDaily() {
    const day = today();
    let cur = sessions[MODE_DAILY];
    if (!cur || cur.day !== day || cur.review) {
      const done = dailyResult(day), qs = dailyQuestions(day);
      const picks = done ? done.picks : dailyDraft(day);
      cur = newSession(MODE_DAILY, day, dailyNumber(day), qs, { picks: picks.length <= qs.length ? picks : [], finished: !!done });
    }
    if (!cur.questions.length) return false;
    sessions[MODE_DAILY] = cur; active = MODE_DAILY; return true;
  }
  function retakeDaily() {
    const day = today();
    if (!dailyResult(day)) return false;
    const qs = dailyQuestions(day);
    if (!qs.length) return false;
    sessions[MODE_RETAKE] = newSession(MODE_RETAKE, day, dailyNumber(day), qs); active = MODE_RETAKE; return true;
  }
  function reviewDaily() {
    const day = today(), done = dailyResult(day);
    if (!done) return openDaily();
    const qs = dailyQuestions(day);
    if (!qs.length) return false;
    if (done.picks.length !== qs.length) return openDaily();
    sessions[MODE_DAILY] = newSession(MODE_DAILY, day, dailyNumber(day), qs, { picks: done.picks, review: true });
    active = MODE_DAILY; return true;
  }
  function reviewPractice() {
    const done = practiceToday(today());
    if (!done.length) return false;
    sessions[MODE_PREVIEW] = newSession(MODE_PREVIEW, today(), 0, done.map((d) => d[0]), { picks: done.map((d) => d[1]), review: true });
    active = MODE_PREVIEW; return true;
  }
  function retakePractice() {
    const done = practiceToday(today());
    if (!done.length) return false;
    sessions[MODE_PRETAKE] = newSession(MODE_PRETAKE, today(), 0, done.map((d) => d[0])); active = MODE_PRETAKE; return true;
  }
  // Words the reader has looked up, saved or listed come first in Practice.
  function favoured() {
    const ids = [...recent(), ...saved()].map((r) => r.id);
    for (const arr of Object.values(store.get("listItems", {}))) for (const r of arr) ids.push(r.id);
    return new Set(ids.map((id) => data.byId.get(id)).filter(Boolean).map((e) => e.word.toLowerCase()));
  }
  function openPractice() {
    const day = today(), p = sessions[MODE_PRACTICE];
    if (p && p.day === day && !p.finished && p.picks.length < p.questions.length) { active = MODE_PRACTICE; return true; }
    const d = practiceDraft(day);
    if (d && d.picks.length < d.ids.length) {
      const qs = d.ids.map((id) => byId.get(id)).filter(Boolean);
      if (qs.length === d.ids.length) { sessions[MODE_PRACTICE] = newSession(MODE_PRACTICE, day, 0, qs, { picks: d.picks }); active = MODE_PRACTICE; return true; }
      clearPracticeDraft();
    }
    return newPracticeRound();
  }
  const practiceDone = () => practiceRounds(today()) >= PRACTICE_ROUNDS;
  const dailyExclude = (day) => new Set(dailyResult(day) ? [] : planDaily(day).map((q) => q.id));
  const practiceEmpty = () => planPractice(today(), new Set(), dailyExclude(today())).length === 0;
  function newPracticeRound() {
    const day = today();
    if (practiceDone()) return false;
    const qs = planPractice(day, favoured(), dailyExclude(day));
    if (!qs.length) { delete sessions[MODE_PRACTICE]; active = null; return false; }
    countPracticeRound(day);
    savePracticeDraft(day, qs.map((q) => q.id), []);
    sessions[MODE_PRACTICE] = newSession(MODE_PRACTICE, day, 0, qs); active = MODE_PRACTICE; return true;
  }
  function answer(option) {
    const s = session();
    if (!s || answeredNow(s) || s.finished) return;
    const q = s.questions[s.index];
    s.picks.push(option);
    if (s.mode === MODE_RETAKE || s.mode === MODE_PRETAKE) return;
    // Solved with at most one hint counts as known; more hints (or a miss) bring it back sooner.
    record(q.id, option >= 0 && option <= 1, today(), option);
    logAnswer(today(), s.mode === MODE_DAILY ? "d" : "p", q.id, option);
    if (s.mode === MODE_DAILY) {
      const ids = s.questions.map((x) => x.id);
      if (s.picks.length === s.questions.length) { finishDaily(s.day, [...s.picks], patternOf(s), ids); s.celebrateStreak = true; }
      else { S().draft = { day: s.day, picks: [...s.picks], ids }; save(); }
    }
    if (s.mode === MODE_PRACTICE) {
      if (s.picks.length >= s.questions.length) clearPracticeDraft();
      else savePracticeDraft(s.day, s.questions.map((x) => x.id), [...s.picks]);
    }
  }

  // ---- shared pieces ----------------------------------------------------------
  // Modifier.entrance: fades in while rising 22 px, 520 ms FastOutSlowIn.
  const entrance = (el, delay = 0) => el && el.animate([{ opacity: 0, transform: "translate3d(0,22px,0)" }, { opacity: 1, transform: "none" }],
    { duration: 520, delay, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards" });
  const headline = (score, total) => { const r = score / total; return r >= 1 ? "Flawless!" : r >= 0.8 ? "Superb!" : r >= 0.6 ? "Nicely done" : r >= 0.4 ? "Good effort" : "Keep going"; };
  const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const numberWord = (n) => NUMBERS[n] || String(n);
  const roundsLeft = (n) => (n === 1 ? "1 round left today" : `${n} rounds left today`);
  function untilMidnight() {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.floor((next - now) / 60000), h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  const dayLabel = (day, fmt) => new Date(day * 86400000).toLocaleDateString(undefined, { timeZone: "UTC", ...fmt });
  const shortDate = (day) => dayLabel(day, { weekday: "short", month: "short", day: "numeric" });
  // The Daily card's ten numbered tiles (shown instead of the pips when the
  // Word Challenge page has room): right, missed, next, or still to come.
  const dtiles = (count, pattern, answered, mid) => `<div class="dtiles">${Array.from({ length: count }, (_, i) => {
    const done = pattern ? i < pattern.length : i < answered, ok = pattern && pattern[i] === "1", missed = pattern && pattern[i] === "0";
    const next = !pattern && i === answered;
    return `<span class="dt${missed ? " miss" : done ? " done" : ""}${next ? " next" : ""}" style="--mid:${mid}">${ok ? CHECK : missed ? CLOSE : i + 1}</span>`;
  }).join("")}</div>`;
  // The Daily card's taste of the game (ClueTeaser): "CLUE 3 OF 10", the next
  // question's meaning and its letter boxes, on a frosted panel.
  const teaser = (sum) => sum.next ? `<div class="dteaser"><div class="tk">WORD ${sum.dailyAnswered + 1} OF ${sum.dailySize}</div>
    <div class="tc">“${esc(sum.next.clue)}”</div><div class="tb">${[...sum.next.text].map((c) => (c === " " ? '<i class="sp"></i>' : "<i></i>")).join("")}</div></div>` : "";
  // Both forms are drawn; the page shows the tiles when the card is roomy.
  const dpips = (count, pattern, answered, mid) => `<div class="dthin">${pips(count, pattern, answered, 8)}</div>${dtiles(count, pattern, answered, mid)}`;
  const pips = (count, pattern, answered, h, wrongAlpha = 0.22) => `<div class="qpips" style="--h:${h}px">${Array.from({ length: count }, (_, i) => {
    const on = pattern != null ? pattern[i] === "1" : i < answered;
    return `<i style="background:${on ? "#fff" : `rgba(255,255,255,${wrongAlpha})`}"></i>`;
  }).join("")}</div>`;
  const cardPill = (label, ink, filled, { icon = null, play = false, act } = {}) =>
    `<button class="cpill ${filled ? "on" : ""} ${icon || play ? "ic" : ""}" data-press="0.93" data-act="${act}" style="${filled ? `color:${ink}` : ""}">
      ${play ? `<span class="pi">${PLAY}</span>` : icon ? ic(icon, 17) : ""}${esc(label)}</button>`;

  // The streak flame (Flame): two-tone, flickering and swaying, with a soft glow.
  const FLAME_OUTER = "M12 1.5c.6 2.9 2.4 4.9 4.1 6.8 1.7 1.9 3.4 3.9 3.4 7 0 4.1-3.4 7.2-7.5 7.2S4.5 19.4 4.5 15.3c0-2.4 1-4.3 2.4-5.8.2 1.6 1 2.9 2.3 3.5-.4-4.4 1.1-8.4 2.8-11.5z";
  const FLAME_INNER = "M12.2 11.2c.5 1.7 1.6 2.8 2.4 3.9.7.9 1.1 1.7 1.1 2.8 0 2.1-1.6 3.6-3.7 3.6s-3.7-1.5-3.7-3.6c0-1.1.4-2 1.1-2.8.2.8.7 1.4 1.4 1.7-.2-2 .4-3.9 1.4-5.6z";
  let flameN = 0;
  function flame(lit, size) {
    const k = ++flameN;
    if (!lit) return `<svg class="flame" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${FLAME_OUTER}" fill="rgba(var(--muted-rgb),.30)"/></svg>`;
    return `<svg class="flame lit" width="${size}" height="${size}" viewBox="0 0 24 24" overflow="visible"><defs>
      <radialGradient id="fg${k}" cx="12" cy="14.88" r="14.88" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${FLAME_MID}" stop-opacity=".30"/><stop offset="1" stop-color="${FLAME_MID}" stop-opacity="0"/></radialGradient>
      <linearGradient id="fo${k}" x1="0" y1="1.5" x2="0" y2="22.5" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${FLAME_TOP}"/><stop offset=".5" stop-color="${FLAME_MID}"/><stop offset="1" stop-color="${FLAME_BASE}"/></linearGradient>
      <linearGradient id="fi${k}" x1="0" y1="11" x2="0" y2="22.5" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFF6CF"/><stop offset="1" stop-color="#FFD66E"/></linearGradient></defs>
      <circle cx="12" cy="14.88" r="14.88" fill="url(#fg${k})"/>
      <g class="fsway"><path d="${FLAME_OUTER}" fill="url(#fo${k})"/><path class="fin" d="${FLAME_INNER}" fill="url(#fi${k})"/></g></svg>`;
  }
  // One clock for every lit flame on screen: 1.6 s per phase turn, read per frame.
  let flameLoop = null;
  function startFlames() {
    if (flameLoop) return;
    flameLoop = Motion.onFrame((now) => {
      const flames = document.querySelectorAll(".flame.lit");
      if (!flames.length) { flameLoop = null; return false; }
      const p = ((now % 1600) / 1600) * 2 * Math.PI;
      const rot = 2.6 * Math.sin(p * 2), sx = 1 + 0.02 * Math.sin(p * 3), sy = 1 + 0.05 * Math.sin(p) + 0.025 * Math.sin(p * 3);
      const inner = 1 + 0.06 * Math.sin(p * 2 + 1);
      for (const f of flames) {
        f.querySelector(".fsway").setAttribute("transform", `translate(12 22.5) rotate(${rot.toFixed(3)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-12 -22.5)`);
        f.querySelector(".fin").setAttribute("transform", `translate(12 22.5) scale(1 ${inner.toFixed(4)}) translate(-12 -22.5)`);
      }
    });
  }
  const streakChip = (n, onGradient) => `<span class="schip ${onGradient ? "grad" : ""}">${flame(true, 16)}<b>${n}</b></span>`;

  function toast(text) {
    document.querySelectorAll(".qtoast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "qtoast"; t.textContent = text;
    document.body.appendChild(t);
    t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: "both" });
    setTimeout(() => t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "both" }).finished.then(() => t.remove()), 2000);
  }

  // ---- the hidden answer field ------------------------------------------------
  // One plain text field for every question, kept outside the pages, so a tap
  // (Play, Next question) can raise the iPhone keyboard straight away: no
  // capitals, no autocorrect, no suggestions, never offered to password managers.
  let kb = null;
  function field() {
    if (kb) return kb;
    kb = document.createElement("input");
    kb.className = "qkb";
    Object.assign(kb, { type: "text", autocomplete: "off", spellcheck: false, enterKeyHint: "done" });
    kb.setAttribute("autocorrect", "off"); kb.setAttribute("autocapitalize", "none");
    kb.setAttribute("aria-label", "Your answer"); kb.setAttribute("data-1p-ignore", ""); kb.setAttribute("data-lpignore", "true");
    document.body.appendChild(kb);
    return kb;
  }
  const raiseKeyboard = () => { const f = field(); f.value = ""; f.focus({ preventScroll: true }); };

  // ---- the home banner (ChallengeBanner) --------------------------------------
  function banner() {
    const sum = summarize();
    const seed = challengeSeed(sum.today), mid = PALETTE[seed][1];
    const r = sum.dailyResult;
    return `<a class="banner sheen" data-press="0.98" href="#/quiz" style="background:${gradient(seed)}">
      <div class="top"><span class="bolt">${ic("ic_challenge", 18)}</span>
        <span class="kick">DAILY CHALLENGE</span></div>
      ${r ? `<div class="bscore"><b>${r.score}</b><span class="of"> / ${sum.dailySize}</span><span class="hl">${headline(r.score, sum.dailySize)}</span></div>`
        : `<h3>${sum.dailyAnswered > 0 ? `${sum.dailyAnswered} of ${sum.dailySize} done` : "Guess today's word"}</h3>`}
      <div class="sub">${r ? `Next challenge in ${untilMidnight()}` : sum.dailyAnswered > 0 ? "Your answers are saved. Pick up where you left off." : "Guess the word from its meaning, with a hint or two if needed."}</div>
      ${pips(sum.dailySize, r ? r.pattern : null, r ? r.pattern.length : sum.dailyAnswered, 7)}
      <div class="row">${r ? `${cardPill("Review", mid, true, { act: "review" })}<button class="rpill" data-press="0.9" data-act="retake" aria-label="Retake">${ic("ic_retake", 18)}</button>`
        : cardPill(sum.dailyAnswered > 0 ? "Resume" : "Play now", mid, true, { play: true, act: "play" })}
        <span style="flex:1"></span>${sum.streak > 0 ? streakChip(sum.streak, true) + '<span style="width:8px"></span>' : ""}
        <span class="open" data-press="0.92">Open${ARROW}</span></div></a>`;
  }
  function wireBanner(view) {
    startFlames();
    view.querySelectorAll(".banner [data-act]").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      play(b.dataset.act);
    }));
  }
  // Starts a round from a tap (so the keyboard can open with it) and shows it.
  async function play(what) {
    if (!what.includes("review")) raiseKeyboard();     // still inside the tap
    await loadBank();
    const ok = { play: openDaily, review: reviewDaily, retake: retakeDaily, "practice-play": openPractice,
      "practice-review": reviewPractice, "practice-retake": retakePractice }[what]();
    const s = session();
    if (ok === false || !s) { kb && kb.blur(); return; }
    if (s.finished || s.review || answeredNow(s)) kb && kb.blur();
    go("#/quiz/play");
  }

  // ---- the Word Challenge page (QuizHubScreen) -------------------------------
  async function hubPage(view) {
    await loadBank();
    const sum = summarize();
    view.innerHTML = `<div class="subbar"><button class="icon-btn" data-back aria-label="Back">${BACKARROW}</button><h1>Word Challenge</h1></div>
      <div class="qhub">${sum.total === 0 ? `<div class="empty"><h2>No questions yet</h2>The challenge questions will arrive with the next update.</div>` : `
        <div class="qfirst">${streakCard(sum)}<div style="height:14px"></div>${dailyCard(sum)}<div style="height:14px"></div>${statsRow(sum)}</div>
        <div style="height:26px"></div>${practiceCard(sum)}<div style="height:26px"></div>${howItWorks()}`}</div>`;
    view.querySelector("[data-back]").onclick = () => history.back();
    if (!sum.total) return;
    // The first screenful ends exactly at "See your words": spare height goes
    // INTO the Daily card (its content centred, a big faint bolt in the
    // corner), never as gaps between cards, so Practice is never half shown.
    const first = view.querySelector(".qfirst"), daily = view.querySelector(".qdaily");
    const fit = () => {
      daily.style.minHeight = ""; daily.classList.remove("roomy");
      const room = innerHeight - view.querySelector(".subbar").offsetHeight - 16 - (first.offsetHeight - daily.offsetHeight);
      const extra = room - daily.offsetHeight;
      if (extra > 0) daily.style.minHeight = room + "px";
      daily.classList.toggle("roomy", extra > 100);
    };
    fit(); addEventListener("resize", fit);
    view.cleanup = () => removeEventListener("resize", fit);
    [".qstreak", ".qdaily", ".qstats", ".qpractice", ".qhow"].forEach((c, i) => entrance(view.querySelector(c), [0, 70, 140, 200, 260][i]));
    startFlames();
    view.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const a = b.dataset.act;
      if (a === "share") return shareResult(sum.dailyNumber, sum.dailyResult.pattern, sum.streak);
      if (a.startsWith("words")) return go(`#/quiz/words?tab=${a.slice(5) || 0}`);
      if (a === "practice-play") {
        if (sum.practiceRound) return play(a);
        if (sum.practiceLeft === 0) return toast("That's today's practice. New rounds tomorrow!");
        if (practiceEmpty()) return toast("All caught up! More reviews come due tomorrow.");
      }
      play(a);
    }));
  }
  function streakCard(sum) {
    const done = !!sum.dailyResult;
    const week = sum.week.map((played, i) => {
      const day = sum.today - (6 - i), isToday = i === 6;
      return `<div class="wday"><span class="wring ${isToday ? (played ? "today" : "today wait") : ""}"><span class="wdot ${played ? "on" : ""}">${played ? CHECK : ""}</span></span>
        <span class="wl ${isToday ? "t" : ""}">${isToday ? "Today" : esc(dayLabel(day, { weekday: "narrow" }))}</span></div>`;
    }).join("");
    return `<div class="qstreak"><div class="srow"><span class="sdisc ${sum.streak > 0 ? "lit" : ""}">${flame(sum.streak > 0, 34)}</span>
      <div class="smid"><div><b class="sn">${sum.streak}</b><span class="sdays">day streak</span></div>
        <div class="ssub">${sum.streak === 0 && sum.bestStreak > 0 ? "Play today to start a new one" : sum.streak === 0 ? "Play today to start one" : done ? "See you tomorrow!" : "Play today to keep it going"}</div></div>
      ${sum.bestStreak > 0 ? `<div class="sbest"><b>${sum.bestStreak}</b><span>BEST</span></div>` : ""}</div>
      <div class="week">${week}</div></div>`;
  }
  function dailyCard(sum) {
    const seed = challengeSeed(sum.today), mid = PALETTE[seed][1], r = sum.dailyResult;
    let body;
    if (r) {
      body = `<div class="dscore"><b>${r.score}</b><span class="of"> / ${sum.dailySize}</span><span class="hl">${headline(r.score, sum.dailySize)}</span></div>
        <div style="height:10px"></div>${dpips(r.pattern.length, r.pattern, r.pattern.length, mid)}<div style="height:16px"></div>
        <div class="prow">${cardPill("Share", mid, true, { icon: "ic_share", act: "share" })}${cardPill("Review answers", mid, false, { act: "review" })}</div>
        <div style="height:12px"></div><div class="hair"></div><div style="height:2px"></div>
        <div class="nrow"><span>Next challenge in ${untilMidnight()}</span><button class="tlink" data-press="0.92" data-act="retake">${ic("ic_retake", 16)}Retake</button></div>`;
    } else if (sum.dailyAnswered > 0) {
      body = `<div class="big">${sum.dailyAnswered} of ${sum.dailySize} done</div><div class="dsub">Your answers are saved. Pick up right where you left off.</div>
        <div style="height:18px"></div>${sum.next ? `<div class="dthin">${pips(sum.dailySize, null, sum.dailyAnswered, 8)}</div>${teaser(sum)}` : dpips(sum.dailySize, null, sum.dailyAnswered, mid)}<div style="height:20px"></div>
        <div class="prow">${cardPill("Resume", mid, true, { play: true, act: "play" })}</div>`;
    } else {
      body = `<div class="big">Guess today's word</div><div class="dsub">Guess the word from its meaning, with a hint or two if needed.</div>
        <div style="height:18px"></div>${sum.next ? `<div class="dthin">${pips(sum.dailySize, null, 0, 8)}</div>${teaser(sum)}` : dpips(sum.dailySize, null, 0, mid)}<div style="height:20px"></div>
        <div class="prow">${cardPill("Play", mid, true, { play: true, act: "play" })}<span class="aside">About 5 minutes</span></div>`;
    }
    return `<div class="qdaily qgcard sheen" data-press="0.98" data-act="play" style="background:${gradient(seed)}">
      <div class="ghead"><span class="gk">DAILY CHALLENGE</span><span class="gd">${esc(shortDate(sum.today))}</span></div><div class="dbody"><div style="height:18px"></div>${body}</div></div>`;
  }
  // Palette.practice(day): a new hue daily, never the challenge's family nor the Word of the Day's.
  function practiceSeed(day) {
    const avoid = new Set([family(day), family(challengeSeed(day))]);
    let choices = [...Array(10).keys()].filter((i) => !avoid.has(family(i)));
    if (!choices.length) choices = [...Array(10).keys()];
    return choices[kotlinRandom(BigInt(day) * 6151n + 29n).nextInt(choices.length)];
  }
  function practiceCard(sum) {
    const seed = practiceSeed(sum.today), mid = PALETTE[seed][1];
    const round = sum.practiceRound, total = PRACTICE_ROUNDS;
    const used = Math.min(total, Math.max(0, total - sum.practiceLeft));
    const head = round && round[0] === 0 ? "Your round<br>is ready." : round ? `${round[0]} of ${round[1]} done`
      : sum.practiceLeft === 0 ? "That's today's<br>practice done." : sum.due > 0 ? `${sum.due} ${sum.due === 1 ? "word is" : "words are"}<br>due for review.`
      : "Five quick questions,<br>at your own pace.";
    const sub = round && round[0] === 0 ? `${numberWord(round[1]).replace(/^./, (c) => c.toUpperCase())} questions are waiting, and nothing is lost if you leave half-way.`
      : round ? "Your round is saved. Pick up right where you left off."
      : sum.practiceLeft === 0 ? `New rounds open in ${untilMidnight()}.` : "Rounds of five. Words you miss come back here until you know them.";
    return `<div class="qpractice qgcard sheen" data-press="0.98" data-act="practice-play" style="background:${gradient(seed)}">
      <div class="ghead">${ic("ic_practice", 18)}<span class="gk" style="margin-left:8px">PRACTICE</span>
        <span class="gd">${round ? `Round ${used} of ${total}` : sum.practiceLeft === 0 ? `All ${total} rounds done` : roundsLeft(sum.practiceLeft)}</span></div>
      <div style="height:18px"></div><div class="big2">${head}</div><div class="dsub">${esc(sub)}</div>
      ${round || sum.practiceLeft > 0 ? `<div style="height:18px"></div>${pips(round ? round[1] : total, null, round ? round[0] : used, 8)}<div style="height:20px"></div>
        <div class="prow">${cardPill(round ? "Resume" : used === 0 ? "Start a round" : "Next round", mid, true, { play: true, act: "practice-play" })}
        ${round ? "" : `<span class="aside">About 2 minutes</span>`}</div>` : ""}
      ${sum.practiceAnswered > 0 ? `<div style="height:18px"></div><div class="hair"></div><div style="height:12px"></div>
        <div class="ptoday">Today: ${sum.practiceRight} of ${sum.practiceAnswered} right</div><div style="height:12px"></div>
        <div class="prow">${cardPill("Review answers", mid, false, { act: "practice-review" })}${cardPill("Retake", mid, false, { icon: "ic_retake", act: "practice-retake" })}</div>` : ""}</div>`;
  }
  function statsRow(sum) {
    const acc = sum.todayAnswered === 0 ? "–" : `${Math.round((sum.todayRight * 100) / sum.todayAnswered)}%`;
    const tile = (v, l, tab) => `<button class="stile" data-press="0.92" data-act="words${tab}"><b>${v}</b><span>${l}</span></button>`;
    return `<div class="qstats" data-press="0.985" data-act="words0"><div class="tk">TODAY'S WORDS</div>
      <div class="trow">${tile(sum.todayAnswered, "Answered", 0)}<i></i>${tile(acc, "Accuracy", 1)}<i></i>${tile(sum.todayMastered, "Mastered", 3)}</div>
      <div class="hair2"></div><div class="see"><span>See your words</span>${ARROW}</div></div>`;
  }
  function howItWorks() {
    const steps = ["Read a meaning and type the word. Use a hint if you're stuck, but each one costs a point.",
      "See why each choice is right or wrong, then open any word to learn more.",
      "Questions you miss come back in Practice a few days later, until you've mastered them."];
    return `<div class="qhow"><div class="hk">HOW IT WORKS</div>${steps.map((s, i) => `<div class="hstep"><span class="hn">${i + 1}</span><span class="ht">${esc(s)}</span></div>`).join("")}</div>`;
  }

  // ---- the play screen (QuizPlayScreen) -----------------------------------------
  let playView = null;
  async function playPage(view, { returning } = {}) {
    await loadBank();
    const s = session();
    if (!s) { location.replace("#/quiz"); return; }
    playView = view;
    view.classList.add("qview");
    view.innerHTML = `<div class="qplay"></div>`;
    const root = view.querySelector(".qplay");
    // Fill exactly the visible area (it shrinks while the iPhone keyboard is up).
    const vv = window.visualViewport;
    const fit = () => { if (vv) { root.style.top = `${vv.offsetTop}px`; root.style.height = `${vv.height}px`; } };
    fit();
    vv && vv.addEventListener("resize", fit); vv && vv.addEventListener("scroll", fit);
    view.cleanup = () => { vv && vv.removeEventListener("resize", fit); vv && vv.removeEventListener("scroll", fit); kb && kb.blur(); detachInput(); if (session()) session().scroll = root.querySelector(".qpage")?.scrollTop || 0; };
    if (s.finished) root.appendChild(results(s));
    else root.appendChild(roundView(s, returning));
    startFlames();
  }
  // Round → results (and "Next round" → its first question): a 380 ms crossfade.
  function crossfade(build) {
    const root = playView && playView.querySelector(".qplay");
    if (!root) return;
    const old = root.firstElementChild, next = build();
    next.style.opacity = "0";
    root.appendChild(next);
    if (old) { old.style.position = "absolute"; old.style.inset = "0"; old.style.pointerEvents = "none";
      old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "cubic-bezier(.4,0,.2,1)" }).finished.then(() => old.remove()); setTimeout(() => old.isConnected && old.remove(), 600); }
    next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: "cubic-bezier(.4,0,.2,1)" }).finished.then(() => { next.style.opacity = ""; });
    setTimeout(() => { next.style.opacity = ""; }, 600);
    startFlames();
  }
  function leave() {
    const s = session();
    if (s && !s.finished && !s.review && s.picks.length) {
      const keeps = s.mode === MODE_DAILY || s.mode === MODE_PRACTICE;
      kb && kb.blur();
      Lists.prompt({ icon: null, mark: true, title: "Leave this round?",
        message: keeps ? "Your answers so far are saved, so you can pick up right where you left off." : "This replay isn't saved, so you'll start again from the first question.",
        stay: "Keep playing", goLabel: "Leave", onGo: () => exit() });
      return;
    }
    exit();
  }
  function exit() {
    const s = session();
    if (s) { s.celebrateStreak = false; s.justFinished = false; }
    kb && kb.blur();
    if (history.state && history.state.i > 1) history.back(); else location.replace("#/quiz");
  }
  const modeLabel = (s) => ({ daily: s.review ? "DAILY CHALLENGE  ·  REVIEW" : "DAILY CHALLENGE", retake: "DAILY CHALLENGE  ·  RETAKE",
    practice: "PRACTICE", preview: "TODAY'S PRACTICE  ·  REVIEW", pretake: "PRACTICE  ·  RETAKE" }[s.mode]);

  function roundView(s, returning) {
    const el = document.createElement("div");
    el.className = "qround";
    el.innerHTML = `<div class="qtop"><button class="icon-btn" aria-label="Close" data-close>${CLOSE}</button>
      <div class="segs">${s.questions.map(() => "<i></i>").join("")}</div><span class="qcount"></span></div>
      <div class="qstage"></div>
      <div class="qnext"><div class="qnrow"></div></div>`;
    el.querySelector("[data-close]").onclick = leave;
    const stage = el.querySelector(".qstage"), nextBar = el.querySelector(".qnext");
    const segs = [...el.querySelectorAll(".segs i")];
    const paintTop = () => {
      segs.forEach((g, i) => { const r = isRight(s, i); g.style.background = r === true ? RIGHT : r === false ? WRONG : i === s.index ? "rgba(var(--accent-rgb),.55)" : "rgba(var(--ink-rgb),.10)"; });
      el.querySelector(".qcount").textContent = `${s.index + 1}/${s.questions.length}`;
    };
    // The bar under an answered question: rises in on spring(0.8, 380), drops away in 200 ms.
    let barShown = false;
    const barY = new Spring(1, { damping: 0.8, stiffness: 380, onUpdate: (v) => { nextBar.style.transform = `translate3d(0, ${(v * 100).toFixed(2)}%, 0)`; } });
    const barA = new Spring(0, { damping: 1, stiffness: 400, onUpdate: (v) => { nextBar.style.opacity = Math.min(1, Math.max(0, v)); } });
    function setBar(show, instant) {
      if (show) {
        const last = s.index >= s.questions.length - 1;
        el.querySelector(".qnrow").innerHTML = `${s.review && s.index > 0 ? `<button class="bbtn quiet plain" data-press="0.96" data-prev>Previous</button>` : ""}
          <button class="bbtn quiet" data-press="0.96" data-next>${last ? "See results" : "Next question"}${ARROW}</button>`;
        el.querySelector("[data-next]").onclick = () => next();
        const pv = el.querySelector("[data-prev]");
        if (pv) pv.onclick = () => previous();
      }
      if (show === barShown && !instant) return;
      barShown = show;
      nextBar.style.pointerEvents = show ? "auto" : "none";   // the stylesheet keeps it "none" while hidden
      if (instant) { barY.snap(show ? 0 : 1); barA.snap(show ? 1 : 0); return; }
      if (show) { barY.to(0); barA.to(1); }
      else {
        barY.halt(); barA.halt();
        const y0 = barY.value, a0 = barA.value;
        tween({ duration: 200, easing: ease.fastOutSlowIn, update: (e) => barY.snap(y0 + (1 - y0) * e) });
        tween({ duration: 160, easing: ease.fastOutSlowIn, update: (e) => barA.snap(a0 * (1 - e)) });
      }
    }
    let page = null;
    function show(dir, instant) {
      const fresh = questionPage(s, s.index, { onAnswered: () => { paintTop(); setBar(true); } });
      stage.appendChild(fresh);
      const w = stage.clientWidth || innerWidth;
      if (page && dir) {
        const old = page;
        old.style.pointerEvents = "none";
        old.animate([{ transform: "translate3d(0,0,0)" }, { transform: `translate3d(${(-dir * w) / 4}px,0,0)` }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
        old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).finished.then(() => old.remove());
        setTimeout(() => old.isConnected && old.remove(), 500);
        fresh.animate([{ transform: `translate3d(${(dir * w) / 3}px,0,0)` }, { transform: "translate3d(0,0,0)" }], { duration: 420, easing: "cubic-bezier(.4,0,.2,1)" });
        fresh.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" });
      } else if (page) page.remove();
      page = fresh;
      paintTop();
      setBar(answeredNow(s), instant);
    }
    function next() {
      if (!answeredNow(s)) return;
      if (s.index < s.questions.length - 1) {
        s.index++;
        if (!answeredNow(s)) raiseKeyboard();          // in the tap, so the iPhone keyboard opens
        show(1);
      } else {
        s.finished = true;
        s.justFinished = !s.review;
        kb && kb.blur();
        crossfade(() => results(s));
      }
    }
    function previous() { if (s.index > 0) { s.index--; show(-1); } }
    show(0, true);
    if (returning && page) requestAnimationFrame(() => { page.scrollTop = s.scroll || 0; });
    else if (!answeredNow(s)) setTimeout(() => { if (session() === s && !answeredNow(s) && document.activeElement !== kb) raiseKeyboard(); }, 450);
    return el;
  }

  // One question: the meaning, the letter tiles, the hints, then the result card.
  function questionPage(s, idx, { onAnswered }) {
    const q = s.questions[idx];
    const pg = document.createElement("div");
    pg.className = "qpage";
    const pickNow = () => s.picks[idx];
    pg.innerHTML = `<div class="qin"><div style="height:10px"></div><div class="qk">${modeLabel(s)}</div><div style="height:4px"></div>
      <div class="qhint">Type the word that has this meaning.</div><div style="height:14px"></div>
      <div class="scard2"><div class="clue">“${esc(q.clue)}”</div><div class="capwrap"><span class="capsule">${esc(q.text)}</span></div></div>
      <div style="height:18px"></div><div class="rin"></div><div class="why"></div><div style="height:87px"></div></div>`;
    const capwrap = pg.querySelector(".capwrap"), why = pg.querySelector(".why");
    const answered = () => pickNow() != null;
    if (answered()) { capwrap.classList.add("on"); why.appendChild(ladderResult(q, pickNow())); }
    recallInput(s, idx, q, pg.querySelector(".rin"), (option) => {
      answer(option);
      if (navigator.vibrate) navigator.vibrate(isCorrect(option) ? 12 : [18, 70, 18]);
      kb && kb.blur();
      // The right word settles under the meaning: expand 320 + fade (100 ms in) + scale from 0.85 on spring(0.55, 420).
      capwrap.classList.add("on");
      const cap = capwrap.firstElementChild, h = capwrap.scrollHeight;
      capwrap.animate([{ height: "0px" }, { height: `${h}px` }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" });
      cap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 100, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards" });
      const sc = new Spring(0.85, { damping: 0.55, stiffness: 420, onUpdate: (v) => { cap.style.transform = `scale(${v.toFixed(4)})`; } });
      sc.to(1).then(() => { cap.style.transform = ""; });
      // The result card is laid out at once but stays hidden while the tiles show
      // the answer; after 600 ms it fades in (500) as the page glides to it (700).
      const card = ladderResult(q, option);
      card.style.opacity = "0";
      why.appendChild(card);
      onAnswered();
      setTimeout(() => {
        card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).finished.then(() => { card.style.opacity = ""; });
        const max = pg.scrollHeight - pg.clientHeight;
        const target = Math.min(max, Math.max(0, why.offsetTop - 8));
        const from = pg.scrollTop;
        if (target > from) tween({ duration: 700, easing: ease.fastOutSlowIn, update: (e) => { pg.scrollTop = from + (target - from) * e; } });
      }, 600);
    });
    return pg;
  }

  // The clue ladder's answer (RecallInput): one tile per letter, typed straight into.
  function tileRows(word, perRow) {
    const n = word.length;
    if (n <= perRow) return [[0, n]];
    const rowCount = Math.ceil(n / perRow), out = [];
    let start = 0;
    for (let r = rowCount; r >= 2; r--) {
      const left = n - start;
      let cut = start + Math.ceil(left / r);
      const hy = word.lastIndexOf("-", cut);
      if (hy >= start && hy + 1 - start <= perRow && cut - hy <= 3) cut = hy + 1;
      cut = Math.min(cut, start + perRow);
      out.push([start, cut]); start = cut;
    }
    out.push([start, n]);
    return out;
  }
  function revealedSlots(clues, n) {
    const set = new Set();
    if (clues >= 1) { for (let i = 0; i < n; i++) if (!set.has(i)) { set.add(i); break; } }
    if (clues >= 2) { for (let i = n - 1; i >= 0; i--) if (!set.has(i)) { set.add(i); break; } }
    return set;
  }
  function editDistance(a, b) {
    const d = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const cur = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    }
    return d[b.length];
  }
  function recallInput(s, idx, q, host, onPick) {
    const answer = q.text, n = answer.length, accept = [q.text];
    let typed = (s.typed[idx] || "");
    let almost = false, nearMissUsed = false;
    const clues = () => s.clues[idx] || 0;
    const revealed = () => revealedSlots(clues(), n);
    const free = () => [...Array(n).keys()].filter((i) => !revealed().has(i));
    const entry = () => { const f = free(), r = revealed(); return [...Array(n).keys()].map((i) => (r.has(i) ? answer[i] : typed[f.indexOf(i)] ?? null)); };
    const guess = () => entry().map((c) => c ?? " ").join("");
    const pick = () => s.picks[idx];
    const answered0 = pick() != null;
    if (!answered0) typed = "";
    function check() {
      if (entry().some((c) => c == null)) return;
      const g = guess();
      s.typed[idx] = g;
      const right = accept.includes(g);
      if (!right && !nearMissUsed && accept.some((a) => editDistance(a, g) === 1)) { nearMissUsed = true; almost = true; paint(); return; }
      onPick(right ? clues() : RECALL_MISS);
      paint();
    }
    function clue() {
      const before = entry();
      s.clues[idx] = clues() + 1;
      const nx = revealed();
      typed = [...Array(n).keys()].filter((i) => !nx.has(i)).map((i) => before[i]).filter((c) => c != null).join("");
      if (clues() === 1) almost = false;
      if (kb) kb.value = typed;
      paint();
    }
    const onInput = () => {
      if (pick() != null || session() !== s || s.index !== idx) return;
      typed = kb.value.toLowerCase().replace(/[^\p{L}'-]/gu, "").slice(0, free().length);
      if (kb.value !== typed) kb.value = typed;
      almost = false;
      paint();
    };
    const onKey = (e) => { if (e.key === "Enter" && session() === s && s.index === idx && pick() == null) { e.preventDefault(); check(); } };
    // Only the question on screen listens to the field.
    if (answered0) { /* a question answered already never takes typing */ }
    else {
      detachInput();
      field().addEventListener("input", onInput);
      kb.addEventListener("keydown", onKey);
      detachInput = () => { kb.removeEventListener("input", onInput); kb.removeEventListener("keydown", onKey); detachInput = () => {}; };
    }

    host.innerHTML = `<div class="tiles" data-tap></div><div class="tmsg"></div><div class="tpills"></div><div class="tpts"></div>`;
    const tilesEl = host.querySelector(".tiles");
    tilesEl.addEventListener("mousedown", (e) => e.preventDefault());
    tilesEl.addEventListener("click", () => { if (pick() == null) { kb.focus({ preventScroll: true }); kb.value = typed; } });
    function paint() {
      const answered = pick() != null, solved = answered && isCorrect(pick());
      const W = (host.clientWidth || Math.min(innerWidth, 640) - 40);
      const gap = n > 11 ? 4 : 6;
      const perRowMax = Math.max(14, Math.floor((W + gap) / (20 + gap)));
      const rows = tileRows(answer, perRowMax);
      const widest = Math.max(...rows.map(([a, b]) => b - a));
      const tile = Math.min(42, (W - gap * (widest - 1)) / widest);
      const rad = Math.min(9, tile * 0.32), fs = Math.min(20, Math.max(12, tile * 0.5));
      const e = entry(), f = free(), rv = revealed();
      const activeAt = !answered && f.length ? f[typed.length] : -1;
      tilesEl.style.gap = `${gap}px`;
      tilesEl.innerHTML = rows.map(([a, b]) => `<div class="trow2" style="gap:${gap}px">${Array.from({ length: b - a }, (_, k) => {
        const i = a + k, letter = answered ? answer[i] : e[i];
        const bg = solved ? "rgba(var(--right-rgb),.16)" : answered ? "rgba(var(--wrong-rgb),.14)" : "var(--surface)";
        const edge = solved ? "rgba(var(--right-rgb),.7)" : answered ? "rgba(var(--wrong-rgb),.6)" : i === activeAt ? "var(--accent)" : "rgba(var(--ink-rgb),.10)";
        const ink = solved ? RIGHT : answered ? WRONG : rv.has(i) ? "var(--accent)" : "var(--ink)";
        return `<span class="tile" style="width:${tile}px;height:${tile * 1.25}px;border-radius:${rad}px;background:${bg};box-shadow:inset 0 0 0 ${i === activeAt ? 1.5 : 1}px ${edge};color:${ink};font-size:${fs}px">${letter ? esc(letter) : ""}</span>`;
      }).join("")}</div>`).join("");
      const msg = host.querySelector(".tmsg");
      const typedWrong = answered && (s.typed[idx] || "").trim() && !accept.includes(s.typed[idx]);
      msg.innerHTML = !answered && almost ? `<div class="almost">Almost: check your spelling and try again.</div>`
        : typedWrong ? `<div class="youtyped">You typed “${esc(s.typed[idx])}”</div>` : "";
      const pills = host.querySelector(".tpills"), pts = host.querySelector(".tpts");
      if (answered) { pills.innerHTML = ""; pts.innerHTML = ""; return; }
      const c = clues();
      pills.innerHTML = `<button class="bpill" data-press="0.94" data-hint>${c === 0 ? "Show the first letter" : c === 1 ? "Show the last letter" : "Reveal the word"}</button>
        ${e.every((x) => x != null) ? `<button class="bpill" data-press="0.94" data-submit>Submit</button>` : ""}`;
      pills.querySelectorAll("button").forEach((b) => b.addEventListener("mousedown", (ev) => ev.preventDefault()));
      pills.querySelector("[data-hint]").onclick = () => {
        if (c >= LADDER_HINTS) { s.typed[idx] = ""; onPick(RECALL_MISS); paint(); } else { clue(); kb.focus({ preventScroll: true }); }
      };
      const sb = pills.querySelector("[data-submit]");
      if (sb) sb.onclick = () => check();
      const [now, after] = c === 0 ? ["Solve it now: 3 points", "After the first letter: 2 points"]
        : c === 1 ? ["Solve it now: 2 points", "After the last letter: 1 point"] : ["Solve it now: 1 point", "Reveal the word: no points"];
      pts.innerHTML = `<div>${now}</div><div>${after}</div>`;
    }
    paint();
    requestAnimationFrame(paint);              // once the page has its width
    // While the keyboard is up, keep the whole answer area just above it.
    const vv = window.visualViewport;
    if (vv) {
      let t = null;
      const lift = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const pg = host.closest(".qpage");
          if (!pg || !host.isConnected || pick() != null || document.activeElement !== kb) return;
          const over = host.getBoundingClientRect().bottom - pg.getBoundingClientRect().bottom;
          if (over > 0) { const from = pg.scrollTop; tween({ duration: 300, easing: ease.fastOutSlowIn, update: (e) => { pg.scrollTop = from + over * e; } }); }
        }, 220);
      };
      if (!answered0) {
        vv.addEventListener("resize", lift);
        const was = detachInput;
        detachInput = () => { was(); vv.removeEventListener("resize", lift); };
      }
    }
  }
  let detachInput = () => {};

  // After an answer (LadderResult): the points, the word with "Open", its opening passage.
  function ladderResult(q, p) {
    const pts = ladderPoints(p);
    const el = document.createElement("div");
    el.className = "lres";
    el.innerHTML = `<div class="lk" style="color:${isCorrect(p) ? RIGHT : WRONG}">${pts === 0 ? "NO POINTS" : pts === 1 ? "+1 POINT" : `+${pts} POINTS`}</div>
      <div class="lrow"><div class="lw"><b>${esc(q.word)}</b><i>${pos(q.type)}</i></div>${openPill()}</div><div class="lintro"></div>`;
    el.querySelector(".opill").onclick = () => openWord(q);
    definition(q.eid).then((d) => {
      if (d && d[0]) el.querySelector(".lintro").innerHTML = `<div class="dprose">${d[0]}</div>`;
    }).catch(() => {});
    return el;
  }
  const openPill = () => `<button class="opill" data-press="0.9">Open${ARROW}</button>`;
  function openWord(q) {
    const s = session();
    const pg = playView && playView.querySelector(".qpage");
    if (s && pg) s.scroll = pg.scrollTop;
    kb && kb.blur();
    go(`#/word/${q.eid}?c=${randomSeed()}`);
  }

  // ---- results (QuizResults) --------------------------------------------------------
  function results(s) {
    const sum = summarize();
    const total = s.questions.length, score = scoreOf(s), celebrate = s.justFinished;
    const el = document.createElement("div");
    el.className = "qres";
    const sentence = {
      daily: `You got ${score} of ${total} right in today's challenge.`,
      retake: `You got ${score} of ${total} right this time. Your score for today stays ${sum.dailyResult ? sum.dailyResult.score : score}/${total}, from your first attempt.`,
      practice: `You got ${score} of ${total} right. Missed ones come back in a few days.`,
      preview: `You got ${score} of ${total} right in today's practice. Missed ones come back in a few days.`,
      pretake: `You got ${score} of ${total} right this time. Today's practice score stays ${sum.practiceRight}/${sum.practiceAnswered}, from your first answers.`,
    }[s.mode];
    const title = { daily: "Daily Challenge", retake: "Daily Challenge  ·  Retake", practice: "Practice round", preview: "Today's practice", pretake: "Practice  ·  Retake" }[s.mode];
    let buttons = "";
    const more = s.mode === MODE_PRACTICE && !practiceDone() && !practiceEmpty();
    if (s.mode === MODE_DAILY) buttons = `<button class="bbtn plain" data-press="0.96" data-done>Done</button><button class="bbtn" data-press="0.96" data-share>Share${ARROW}</button>`;
    else if (s.mode === MODE_PRACTICE) buttons = `<button class="bbtn ${more ? "plain" : ""}" data-press="0.96" data-done>Done${more ? "" : ARROW}</button>${more ? `<button class="bbtn" data-press="0.96" data-more>Next round${ARROW}</button>` : ""}`;
    else buttons = `<button class="bbtn" data-press="0.96" data-done>Done${ARROW}</button>`;
    const daily = s.mode === MODE_DAILY || s.mode === MODE_RETAKE;
    el.innerHTML = `<div class="rscroll"><div class="rtop"><button class="icon-btn" aria-label="Close" data-close>${CLOSE}</button><span>${esc(title)}</span></div>
      <div class="rbody"><div style="height:12px"></div><div class="ring"><canvas></canvas><div class="rnum"><b>0</b><span>out of ${total}</span></div></div>
      <div style="height:20px"></div><div class="rhead">${headline(score, total)}</div><div style="height:6px"></div><div class="rsent">${esc(sentence)}</div>
      <div style="height:10px"></div><div class="rpts">${pointsOf(s)} of ${total * 3} points</div><div style="height:18px"></div>
      <div class="rdots">${patternOf(s).match(/.{1,10}/g).map((row) => `<div>${[...row].map((c) => `<i style="background:${c === "1" ? RIGHT : WRONG}"></i>`).join("")}</div>`).join("")}</div>
      ${s.mode === MODE_DAILY && sum.streak > 0 ? `<div style="height:20px"></div><div class="spill"><span class="sfl">${flame(true, 30)}</span><span class="sroll"><span>${s.celebrateStreak ? Math.max(0, sum.streak - 1) : sum.streak}-day streak</span></span></div>` : ""}
      <div style="height:26px"></div><div class="racts"><div class="rbtns">${buttons}</div>
        ${s.mode === MODE_PRACTICE ? `<div style="height:14px"></div><div class="rleft">${sum.practiceLeft === 0 ? `That's today's practice. More rounds in ${untilMidnight()}` : roundsLeft(sum.practiceLeft).replace(/^./, (c) => c.toUpperCase())}</div>`
          : `<div style="height:14px"></div><button class="tact" data-press="0.94" data-retake>${ic("ic_retake", 17)}${s.mode === MODE_DAILY ? "Retake for practice" : s.mode === MODE_PREVIEW ? "Retake these questions" : "Retake again"}</button>`}</div>
      <div style="height:28px"></div><div class="rwords"><div class="rwk">WORDS IN THIS ROUND</div>
        ${s.questions.map((q, i) => { const ok = isRight(s, i) === true; return `<button class="rw" data-press="0.98" data-i="${i}"><span class="rwi" style="background:${ok ? "rgba(var(--right-rgb),.16)" : "rgba(var(--wrong-rgb),.16)"};color:${ok ? RIGHT : WRONG}">${ok ? CHECK : CLOSE}</span>
          <span class="rww">${esc(q.word)}</span><span class="rwt">${pos(q.type)}</span><span class="rwa">${ARROW}</span></button>`; }).join("")}</div>
      <div style="height:28px"></div></div></div>${celebrate && score * 10 >= total * 7 ? `<canvas class="confetti"></canvas>` : ""}`;
    el.querySelector("[data-close]").onclick = leave;
    el.querySelector("[data-done]").onclick = exit;
    const sh = el.querySelector("[data-share]");
    if (sh) sh.onclick = () => shareResult(s.number, patternOf(s), summarize().streak);
    const mo = el.querySelector("[data-more]");
    if (mo) mo.onclick = () => { raiseKeyboard(); if (newPracticeRound()) crossfade(() => roundView(session())); else kb.blur(); };
    const rt = el.querySelector("[data-retake]");
    if (rt) rt.onclick = () => { raiseKeyboard(); if (daily ? retakeDaily() : retakePractice()) crossfade(() => roundView(session())); else kb.blur(); };
    el.querySelectorAll(".rw").forEach((b) => (b.onclick = () => openWord(s.questions[Number(b.dataset.i)])));
    // Entrances: everything after the ring rises in on its beat when just finished.
    const at = (sel, d) => entrance(el.querySelector(sel), d);
    at(".rhead", celebrate ? 900 : 0); at(".rsent", celebrate ? 980 : 0); at(".rpts", celebrate ? 1040 : 0); at(".racts", celebrate ? 1200 : 60);
    requestAnimationFrame(() => scoreRing(el.querySelector(".ring"), score, total, celebrate));
    if (celebrate) {
      el.querySelectorAll(".rdots i").forEach((d, i) => {
        const sp = new Spring(0, { damping: 0.45, stiffness: 500, onUpdate: (v) => { d.style.transform = `scale(${v.toFixed(4)})`; d.style.opacity = Math.min(1, Math.max(0, v)); } });
        sp.snap(0);
        setTimeout(() => sp.to(1).then(() => { d.style.transform = ""; d.style.opacity = ""; }), 700 + i * 70);
      });
      const cf = el.querySelector(".confetti");
      if (cf) requestAnimationFrame(() => confetti(cf));
    }
    const pill = el.querySelector(".spill");
    if (pill && s.celebrateStreak) {
      // The flame flares (1.35 → 1 on spring(0.35, 300)) as the count rolls up.
      setTimeout(() => {
        const roll = pill.querySelector(".sroll"), old = roll.firstElementChild;
        const nu = document.createElement("span"); nu.textContent = `${sum.streak}-day streak`;
        roll.appendChild(nu);
        old.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-100%)", opacity: 0 }], { duration: 300, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).finished.then(() => old.remove());
        nu.animate([{ transform: "translateY(100%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 300, easing: "cubic-bezier(.4,0,.2,1)" });
        const fl = pill.querySelector(".sfl");
        const sp = new Spring(1.35, { damping: 0.35, stiffness: 300, onUpdate: (v) => { fl.style.transform = `scale(${v.toFixed(4)})`; } });
        sp.snap(1.35); sp.to(1);
        s.celebrateStreak = false;
      }, 1500);
    }
    s.justFinished = false;
    return el;
  }
  // The score as a ring (ScoreRing): a soft track and a jewel-toned arc sweeping to the score.
  function scoreRing(box, score, total, animate) {
    const cv = box.querySelector("canvas"), num = box.querySelector(".rnum b");
    const dpr = devicePixelRatio || 1, size = 200;
    cv.width = cv.height = size * dpr;
    const ctx = cv.getContext("2d");
    const target = score / total;
    const arc = [0, 1, 2, 3, 4, 9, 0].map((i) => PALETTE[i][0]);
    const draw = (p) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const stroke = 16, r = (size - stroke) / 2, c = size / 2;
      ctx.lineWidth = stroke;
      ctx.strokeStyle = `rgba(${getComputedStyle(document.documentElement).getPropertyValue("--ink-rgb")},.08)`;
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
      const sweep = Math.PI * 2 * p;
      if (sweep > 0.5 * Math.PI / 180) {
        let style = arc[1];
        if (ctx.createConicGradient) {
          const g = ctx.createConicGradient(-Math.PI / 2, c, c);
          arc.forEach((col, i) => g.addColorStop(i / (arc.length - 1), col));
          style = g;
        }
        ctx.strokeStyle = style; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + sweep); ctx.stroke();
      }
      num.textContent = Math.round(p * total);
    };
    if (!animate) return draw(target);
    draw(0);
    tween({ duration: 1200, delay: 250, easing: ease.fastOutSlowIn, update: (e) => draw(target * e) });
  }
  // A one-off burst of confetti in the app's jewel tones, falling and fading.
  function confetti(cv) {
    const W = cv.clientWidth, H = cv.clientHeight, dpr = devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    const tones = [...PALETTE.map((p) => p[0]), FLAME_TOP, FLAME_MID, "#FFFFFF"];
    const R = Math.random;
    const bits = Array.from({ length: 110 }, () => ({ x0: 0.5 + (R() - 0.5) * 0.3, y0: 0.22 + R() * 0.06, vx: (R() - 0.5) * 1.1, vy: -0.55 - R() * 0.75,
      spin: (R() - 0.5) * 900, w: 5 + R() * 4, h: 9 + R() * 7, color: tones[Math.floor(R() * tones.length)] }));
    tween({ duration: 2800, delay: 1100, update: (_, p) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (p <= 0 || p >= 1) return;
      const time = p * 2.8, fade = p > 0.7 ? (1 - p) / 0.3 : 1;
      ctx.globalAlpha = fade;
      for (const b of bits) {
        const x = W * (b.x0 + b.vx * time * 0.55), y = H * (b.y0 + b.vy * time * 0.5 + 0.42 * time * time);
        ctx.save(); ctx.translate(x, y); ctx.rotate((b.spin * time * Math.PI) / 180);
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * (0.35 + 0.65 * Math.abs(Math.sin((b.spin * time) / 90))));
        ctx.restore();
      }
    }, done: () => cv.remove() });
  }

  // ---- the shareable result (ResultCard.kt) -------------------------------------
  const svgImage = (svg) => new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.includes("xmlns") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'));
  });
  async function resultCard(number, pattern, streakN) {
    await Promise.all(["400 32px Outfit", "600 32px Outfit", "700 32px Outfit"].map((f) => document.fonts.load(f).catch(() => {})));
    const w = 1080, h = 1350, pad = 96;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const c = cv.getContext("2d");
    const day = today(), seed = challengeSeed(day);
    const lg = c.createLinearGradient(0, 0, w, h);
    shading(seed).forEach(([s, col]) => lg.addColorStop(s, col));
    c.fillStyle = lg; c.fillRect(0, 0, w, h);
    const rg = c.createRadialGradient(w * 0.22, h * 0.16, 0, w * 0.22, h * 0.16, w * 0.95);
    rg.addColorStop(0, "rgba(255,255,255,0.141)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = rg; c.fillRect(0, 0, w, h);
    const text = (t, x, y, font, alpha = 1, spacing = 0, align = "left") => {
      c.font = font; c.globalAlpha = alpha; c.fillStyle = "#fff"; c.textAlign = align;
      if ("letterSpacing" in c) c.letterSpacing = `${spacing}px`;
      c.fillText(t, x, y); c.globalAlpha = 1;
      if ("letterSpacing" in c) c.letterSpacing = "0px";
    };
    let y = pad + 30;
    text("DAILY CHALLENGE", pad, y + 34, "600 34px Outfit", 0.8, 34 * 0.16);
    y += 60;
    text(new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }), pad, y + 32, "400 32px Outfit", 0.7);
    const headerBottom = y + 52, logoSize = 76, footerTop = h - pad - logoSize;
    const score = [...pattern].filter((x) => x === "1").length, n = pattern.length, gap = 18;
    const tile = Math.min(132, (w - 2 * pad - gap * (n - 1)) / n);
    const blockH = 78 + 30 + 176 + 70 + tile + (streakN > 0 ? 124 : 0);
    y = headerBottom + (footerTop - headerBottom - blockH) / 2;
    text(headline(score, n), pad, y + 62, "600 66px Outfit");
    y += 108;
    c.font = "700 236px Outfit";
    const sw = c.measureText(String(score)).width;
    text(String(score), pad - 10, y + 176, "700 236px Outfit");
    text(` / ${n}`, pad - 10 + sw, y + 176, "600 76px Outfit", 0.72);
    y += 246;
    for (let i = 0; i < n; i++) {
      const x = pad + i * (tile + gap);
      c.beginPath(); c.roundRect ? c.roundRect(x, y, tile, tile, 16) : c.rect(x, y, tile, tile);
      c.fillStyle = pattern[i] === "1" ? "#fff" : "rgba(255,255,255,0.22)"; c.fill();
      if (pattern[i] !== "1") {
        const m = tile * 0.32;
        c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 5; c.lineCap = "round";
        c.beginPath(); c.moveTo(x + m, y + m); c.lineTo(x + tile - m, y + tile - m); c.moveTo(x + tile - m, y + m); c.lineTo(x + m, y + tile - m); c.stroke();
      }
    }
    y += tile + 60;
    if (streakN > 0) {
      const fl = await svgImage(ICONS.ic_flame.replace(/currentColor/g, "#FFB45C"));
      if (fl) c.drawImage(fl, pad - 6, y, 64, 64);
      text(`${streakN}-day streak`, pad + 70, y + 50, "600 46px Outfit");
    }
    const logo = await svgImage(LOGO);
    if (logo) c.drawImage(logo, pad, footerTop, logoSize, logoSize);
    const bx = pad + logoSize + 22;
    text("Wordly", bx, footerTop + logoSize * 0.5, "700 46px Outfit", 1, -0.92);
    text("Vocabulary Builder", bx, footerTop + logoSize * 0.5 + 38, "400 28px Outfit", 0.72);
    text("Can you beat it?", w - pad, footerTop + logoSize * 0.62, "600 30px Outfit", 0.8, 0, "right");
    const tiles = [...pattern].map((x) => (x === "1" ? "🟩" : "🟥")).join("");
    const message = `Wordly Daily Challenge, ${new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })}: ${score}/${n}\n${tiles}`
      + (streakN > 1 ? `\n🔥 ${streakN}-day streak` : "") + "\nCan you beat it?";
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    return { blob, message, name: `wordly-daily-${number}.png` };
  }
  // The result card in the share preview sheet (ResultShare).
  const shareResult = (number, pattern, streakN) => Menu.preview("Share “Daily Challenge”", resultCard(number, pattern, streakN));

  // ---- "Your words" (QuizWordsScreen) -------------------------------------------------
  const TABS = ["All", "Missed", "Learning", "Mastered"];
  const STATUS_COLOR = [WRONG, "var(--accent)", RIGHT];
  let wordsDay = null, wordsOpen = null;
  const statusOf = (box) => (box <= 1 ? 0 : box >= MASTERED ? 2 : 1);
  function wordStatsOn(day) {
    const last = new Map();
    for (const [id, p] of answersOn(day)) { last.delete(id); last.set(id, p); }
    return [...last.entries()].reverse().map(([id, p]) => {
      const q = byId.get(id), pr = progressOf(id);
      return q && pr ? { q, ...pr, pick: p, status: statusOf(pr.box) } : null;
    }).filter(Boolean);
  }
  const dueIn = (due, day) => { const d = due - day; return d <= 0 ? "ready to review" : d === 1 ? "back tomorrow" : `back in ${d} days`; };
  async function wordsPage(view, tab) {
    await loadBank();
    let sel = Math.max(0, Math.min(3, Number(tab) || 0));
    const day0 = today();
    const days = answerDays().slice(0, LOG_DAYS);
    const day = days.includes(wordsDay) ? wordsDay : days[0] ?? day0;
    view.innerHTML = `<div class="subbar"><button class="icon-btn" data-back aria-label="Back">${BACKARROW}</button><h1>Your words</h1></div><div class="qwords"></div>`;
    view.querySelector("[data-back]").onclick = () => history.back();
    const host = view.querySelector(".qwords");
    if (!days.length) {
      host.innerHTML = `<div class="empty"><h2>No words yet</h2>Words you answer in the Daily Challenge and Practice gather here, day by day, with how well you know each one.</div>`;
      return;
    }
    const stats = wordStatsOn(day).map((x, i) => [x, i]).sort((a, b) => a[0].status - b[0].status || a[1] - b[1]).map((x) => x[0]);
    const all = answersOn(day).filter(([id]) => byId.has(id));
    const answers = all.length, correct = all.filter(([, p]) => isCorrect(p)).length;
    const counts = [0, 1, 2].map((k) => stats.filter((x) => x.status === k).length);
    host.innerHTML = `<div class="dstrip">${days.map((d) => `<button class="dchip ${d === day ? "on" : ""}" data-day="${d}">${d === day0 ? "Today" : d === day0 - 1 ? "Yesterday" : esc(shortDate(d))}</button>`).join("")}</div>
      <div class="ov"><div class="ovtop"><b>${stats.length}</b><span class="ovw">${stats.length === 1 ? "word" : "words"}</span>
        ${answers ? `<div class="ovr"><b>${Math.round((correct * 100) / answers)}% right</b><span>${answers} ${answers === 1 ? "answer" : "answers"}</span></div>` : ""}</div>
        <div class="ovbar"><div class="ovfill">${counts.map((n, k) => (n ? `<i style="flex:${n};background:${STATUS_COLOR[k]}"></i>` : "")).join("")}</div></div>
        <div class="ovkey">${counts.map((n, k) => `<span><i style="background:${STATUS_COLOR[k]}"></i>${TABS[k + 1]} ${n}</span>`).join("")}</div></div>
      <div class="wtabs"><span class="wpill"></span>${TABS.map((t, i) => `<button data-tab="${i}" aria-label="${t}, ${i === 0 ? stats.length : counts[i - 1]}">${t}</button>`).join("")}</div>
      <div class="wlist"></div>`;
    host.querySelectorAll(".dchip").forEach((b) => (b.onclick = () => { wordsDay = Number(b.dataset.day); wordsOpen = null; wordsPage(view, sel); }));
    entrance(host.querySelector(".dstrip"), 0); entrance(host.querySelector(".ov"), 30); entrance(host.querySelector(".wtabs"), 60);
    tween({ duration: 800, delay: 150, easing: ease.fastOutSlowIn, update: (e) => { host.querySelector(".ovfill").style.transform = `scaleX(${e})`; } });
    const pillEl = host.querySelector(".wpill");
    const slide = new Spring(sel, { damping: 0.8, stiffness: 500, onUpdate: (v) => { pillEl.style.transform = `translateX(${(v * 100).toFixed(3)}%)`; } });
    slide.snap(sel);
    const tabs = [...host.querySelectorAll(".wtabs button")];
    const list = host.querySelector(".wlist");
    function fill(animate) {
      tabs.forEach((b, i) => b.classList.toggle("on", i === sel));
      const shown = sel === 0 ? stats : stats.filter((x) => x.status === sel - 1);
      if (!shown.length) {
        list.innerHTML = `<div class="wnone">${sel === 1 ? "Nothing missed right now. Nicely done!" : sel === 2 ? "No words in progress. Words you get right move here until they're mastered."
          : "Nothing mastered yet. Get a word right a few times, days and weeks apart, and it lands here."}</div>`;
        return;
      }
      list.innerHTML = shown.map((x) => wordRow(x, day0)).join("");
      list.querySelectorAll(".wrow2").forEach((r, i) => {
        if (animate) entrance(r, Math.min(i, 8) * 30);
        r.querySelector(".wrhead").onclick = () => toggle(r);
        r.querySelector(".opill").onclick = (e) => { e.stopPropagation(); go(`#/word/${byId.get(r.dataset.id).eid}?c=${randomSeed()}`); };
        if (r.dataset.id === wordsOpen) { r.classList.add("open"); r.querySelector(".wbody").style.height = "auto"; }
      });
    }
    function toggle(r) {
      const opening = !r.classList.contains("open");
      list.querySelectorAll(".wrow2.open").forEach((o) => o !== r && collapse(o));
      if (opening) {
        wordsOpen = r.dataset.id; r.classList.add("open");
        const b = r.querySelector(".wbody"), h = b.scrollHeight;
        b.animate([{ height: "0px" }, { height: `${h}px` }], { duration: 320, easing: "cubic-bezier(.4,0,.2,1)" }).finished.then(() => { b.style.height = "auto"; });
        b.style.height = `${h}px`;
        b.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 80, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards" });
        // Opening a word low on the screen glides it up so all of it shows.
        setTimeout(() => {
          const rect = r.getBoundingClientRect(), over = rect.bottom - innerHeight + 24;
          const by = rect.height > innerHeight || rect.top < 0 ? rect.top : over > 0 ? over : 0;
          if (by) { const from = scrollY; tween({ duration: 220, easing: ease.emphasized, update: (e) => scrollTo(0, from + by * e) }); }
        }, 150 + 320);
      } else { wordsOpen = null; collapse(r); }
    }
    function collapse(r) {
      r.classList.remove("open");
      const b = r.querySelector(".wbody"), h = b.offsetHeight;
      b.style.height = "0px";
      b.animate([{ height: `${h}px` }, { height: "0px" }], { duration: 260, easing: "cubic-bezier(.4,0,.2,1)" });
      b.firstElementChild.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "cubic-bezier(.4,0,.2,1)" });
    }
    tabs.forEach((b, i) => (b.onclick = () => { if (i === sel) return; sel = i; wordsOpen = null; slide.to(i); history.replaceState(history.state, "", `#/quiz/words?tab=${i}`); fill(true); }));
    fill(true);
  }
  function wordRow(x, day) {
    const tint = STATUS_COLOR[x.status], tries = x.right + x.wrong;
    const level = Math.min(4, Math.max(0, x.box - 1));
    const meter = [0, 1, 2, 3].map((i) => `<i style="height:${7 + i * 4}px;background:${i < level ? tint : "rgba(var(--ink-rgb),.14)"}"></i>`).join("");
    const line = x.status === 0 ? `Missed last time  ·  ${dueIn(x.due, day)}` : x.status === 1 ? `Right ${x.right} of ${tries} all time  ·  ${dueIn(x.due, day)}` : `Mastered  ·  right ${x.right} of ${tries} all time`;
    return `<div class="wrow2" data-id="${esc(x.q.id)}"><div class="wrhead"><span class="meter" style="--t:${tint}">${meter}</span>
      <div class="wrmid"><div><span class="ww">${esc(x.q.word)}</span><span class="wt">${pos(x.q.type)}</span></div><div class="wl2">${esc(line)}</div></div>
      <span class="chev">${DOWN}</span></div>
      <div class="wbody" style="height:0px"><div class="wbin"><div class="hair3"></div><div class="clue2">“${esc(x.q.clue)}”</div><span class="capsule">${esc(x.q.text)}</span>
        <div class="wfoot"><span>Read the full entry</span>${openPill()}</div></div></div></div>`;
  }

  return { banner, wireBanner, hubPage, playPage, wordsPage, loadBank, planDaily, shareResult };
})();
