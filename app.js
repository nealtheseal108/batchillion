(() => {
  const FAST = !!window.BH_FAST;            // test switch for the fuzz bot: instant throws, short clock
  const SECONDS = FAST ? 3 : 40;
  const ZONE = "America/New_York"; // the day flips at midnight Eastern for everyone
  const $ = (s) => document.querySelector(s);
  const stage = $("#stage");
  const API = window.BACKEND_URL || "";
  const T = window.TIERS, P = window.PROMPTS;

  // ---------- helpers ----------
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const yearsOf = (y) => (Array.isArray(y) ? y : String(y || "").split(/[\/, ]+/).map(Number).filter(Boolean));
  // Round types: "classes" asks by starting year; stat rounds list each prompt's answers with their own tiers.
  const ROUNDS = (window.ROUNDS || [{ id: "classes", title: "Players", prompts: P }]).map((r) => ({
    ...r, prompts: r.prompts.map((q) => ({ ...q, tierOf: q.tiers ? Object.fromEntries(Object.entries(q.tiers).map(([n, t]) => [norm(n), t])) : null,
      obOf: q.ob ? Object.fromEntries(Object.entries(q.ob).map(([n, v]) => [norm(n), v])) : null })),
  }));
  const setOf = (id) => ROUNDS.find((r) => r.id === id) || ROUNDS[0];
  const fits = (q, p) => (q.tierOf ? !!q.tierOf[p.key] : p.years.some(q.test));
  // Stat prompts set their own tiers (blended with what players typed, once there's enough of it: crowdTiers).
  const tierFor = (q, p, set, k, date) => {
    if (!q.tierOf) return p.tier;
    const c = set && date ? crowdTiers(set, date) : null;
    return (c && c[k] && c[k][p.key]) || q.tierOf[p.key];
  };
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  function toast(msg) {
    const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
  }
  // One prompt clock at a time; every screen change stops it.
  let activeTimer = null;
  const stopTimer = () => { clearInterval(activeTimer); activeTimer = null; };
  let nav = 0; // bumps on every screen change, so a slow async screen can tell it was replaced
  // Every card's content goes in an inner scroller, so on a short window the content scrolls inside the
  // card's padding instead of sliding under its border.
  const show = (html) => {
    stopTimer(); nav++; stage.innerHTML = html;
    const c = stage.querySelector(".card");
    if (c) { const w = document.createElement("div"); w.className = "card-scroll"; while (c.firstChild) w.appendChild(c.firstChild); c.appendChild(w); }
    fitField();
  };
  // Cards never scroll: the field gives up height instead. It keeps its 4:1 shape and shrinks just enough
  // for the card and footer to fit on one screen under the header.
  function fitField() {
    const wrap = $(".field-wrap"), field = $("#field"), card = $("#stage .card"), foot = $(".foot");
    if (!wrap || !field) return;
    const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]) || 0;
    const frame = wrap.offsetWidth - field.clientWidth;                    // padding + border, both sides
    const maxW = Math.min(1100, document.documentElement.clientWidth - px(document.body, "paddingLeft") * 2);
    const st = $("#stage");
    const used = px(wrap, "marginTop") + (card ? card.offsetHeight : 0) + px(st, "marginTop") + px(st, "marginBottom")
      + (foot ? foot.offsetHeight + px(foot, "marginTop") + px(foot, "marginBottom") : 0);
    const room = innerHeight - used - frame;                               // height left for the drawing
    const h = Math.max(36, Math.min((maxW - frame) / 4, room));
    wrap.style.width = Math.round(h * 4 + frame) + "px";
  }
  addEventListener("resize", () => fitField());
  if (window.ResizeObserver) new ResizeObserver(() => fitField()).observe(stage);
  if (document.fonts) document.fonts.ready.then(() => fitField());

  // ---------- day (Eastern time) ----------
  let skew = 0; // server clock minus device clock, so the day flips on the server's midnight
  const nowMs = () => Date.now() + skew;
  const etKey = (d = new Date(nowMs())) => {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
    const g = (t) => +f.find((p) => p.type === t).value;
    return `${g("year")}-${g("month")}-${g("day")}`;
  };
  const dayParts = (k) => k.split("-").map(Number);
  const dayIndex = (k) => { const [y, m, d] = dayParts(k); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const FIRST = dayIndex("2026-11-6"); // Batchillion #1
  let dayKey = etKey();
  const dayNum = () => Math.max(1, dayIndex(dayKey) - FIRST + 1);
  const paintDay = () => ($("#dayNum").innerHTML = `<span class="lg">BATCHILLION </span>#${dayNum()}`);   // phones show just "#N"
  paintDay();
  const practice = !API && new URLSearchParams(location.search).has("practice"); // local testing only

  // ---------- backend ----------
  let remote = { plays: [], appeals: [] }, online = !API;
  // Each round is its own row (oldest first). "done" = all 7 thrown; an open row is a round in progress.
  const normPlays = (list) => (Array.isArray(list) ? list : []).map((p, i) => ({
    ...p, row: p.row ?? i + 1, set: p.set || "classes", answers: Array.isArray(p.answers) ? p.answers : [], done: p.done ?? (Array.isArray(p.answers) && p.answers.length >= 7),
  }));
  async function pull(keepDay = false) {
    if (!API) { remote = { plays: normPlays(ls.get("bh:plays", [])), appeals: ls.get("bh:appeals", []) }; return true; }
    try {
      const r = await fetch(API, { cache: "no-store" }); const j = await r.json();
      if (!j.ok) throw 0;
      remote = { plays: normPlays(j.plays), appeals: Array.isArray(j.appeals) ? j.appeals : [], roster: Array.isArray(j.roster) ? j.roster : [] };
      if (typeof j.now === "number") skew = j.now - Date.now();
      if (!keepDay && j.today && j.today !== dayKey) { dayKey = j.today; paintDay(); } // the server's calendar wins
      return (online = true);
    } catch { return (online = false); }
  }
  async function post(body) {
    if (!API) return localPost(body);
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      return await r.json();
    } catch { return { ok: false, error: "couldn't reach the server", net: true }; }
  }
  // Local-only stand-in for backend/Code.gs, so the game runs before the backend is deployed.
  function localPost(b) {
    const accts = ls.get("bh:accounts", {}), name = String(b.player || "").trim();
    if (b.action === "register" || b.action === "signin") {
      if (norm(name).replace(/ /g, "").length < 2) return { ok: false, error: "use at least two letters in your name" };
      const a = accts[norm(name)];
      if (b.action === "register") {
        if (a) return { ok: false, error: "that name already has an account. sign in instead" };
        accts[norm(name)] = { name, pw: b.password || "" }; ls.set("bh:accounts", accts);
        return { ok: true, player: name, token: "local" };
      }
      if (!a) return { ok: false, error: "no account", noAccount: true };
      return a.pw === (b.password || "") ? { ok: true, player: a.name, token: "local" } : { ok: false, error: "wrong password" };
    }
    const plays = ls.get("bh:plays", []);
    if (b.action === "start") {   // reuse an open round for today, or open a new one
      const set = b.set || "classes";
      let open = plays.find((p) => p.date === b.date && norm(p.player) === norm(b.player) && !p.done && (p.set || "classes") === set);
      if (!open) { open = { row: plays.length + 1, date: b.date, player: b.player, set, answers: [], done: false }; plays.push(open); ls.set("bh:plays", plays); }
      return { ok: true, row: open.row, set, answers: open.answers };
    }
    if (b.action === "throw") {   // save the round so far; 7 answers closes it
      const r = plays.find((p) => p.row === b.row && norm(p.player) === norm(b.player));
      if (!r || r.done) return { ok: false, error: "that round is closed" };
      r.answers = (b.answers || []).slice(0, 7); r.done = r.answers.length >= 7; ls.set("bh:plays", plays);
      return { ok: true, done: r.done };
    }
    if (b.action === "appeal") {
      const ap = ls.get("bh:appeals", []);
      if (ap.some((a) => a.date === b.date && norm(a.player) === norm(b.player))) return { ok: false, error: "one appeal per day" };
      ap.push({ date: b.date, player: b.player, prompt: b.prompt, typed: b.typed, tier: "", year: "" }); ls.set("bh:appeals", ap);
      return { ok: true };
    }
    if (b.action === "login" || b.action === "rank") return { ok: false, error: "admin needs the backend deployed" };
    return { ok: false, error: "unknown" };
  }

  // ---------- roster (base + ranked appeals) ----------
  let people = [];
  const mk = (p, i) => ({ ...p, id: i, first: norm(p.full).split(" ")[0], key: norm(p.full) });
  function buildRoster() {
    const base = window.ROSTER.map(([full, tier, year, note], i) => mk({ full, tier, years: yearsOf(year), note }, i));
    people = base;
    // Players who only appear in the stats (not on the roster yet) can still be named in stat rounds.
    ROUNDS.forEach((r) => r.prompts.forEach((q) => Object.keys(q.tiers || {}).forEach((n) => {
      if (!people.some((p) => p.key === norm(n))) people.push(mk({ full: n, tier: "schooler", years: [], statsOnly: true }, people.length));
    })));
    // The public roster tab: approved appeals and names Neal added in the Sheet.
    (remote.roster || []).forEach((r) => {
      const k = norm(r.name);
      if (!k || !T[r.tier] || !yearsOf(r.year).length || people.some((p) => p.key === k)) return;
      people.push(mk({ full: String(r.name).trim(), tier: r.tier, years: yearsOf(r.year), viaRoster: true }, people.length));
    });
    remote.appeals.forEach((a) => {
      const k = norm(a.typed);
      if (!k || !a.tier || a.tier === "reject" || !T[a.tier] || !yearsOf(a.year).length) return;
      if (people.some((p) => p.key === k) || candidates(k).length) return; // a typo or nickname of someone already listed
      people.push(mk({ full: String(a.typed).trim().replace(/\b\w/g, (c) => c.toUpperCase()), tier: a.tier, years: yearsOf(a.year), viaAppeal: true }, people.length));
    });
  }
  const ALIAS = Object.fromEntries(Object.entries(window.ALIASES || {}).map(([a, c]) => [norm(a), norm(c)]));
  const exactOf = (text) => { const k = norm(text); if (!k) return undefined; const key = ALIAS[k] || k; return people.find((p) => p.key === key); };
  // Edit distance where swapping two neighboring letters counts as one typo ("gaivn" -> "gavin").
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    return d[a.length][b.length];
  }
  // Strict autocorrect, run only when the player presses enter on something that is not an exact
  // full name. It never completes partial words. It only fixes:
  //   - a complete first name ("luke" -> Luke Sellers), and
  //   - one typo (one wrong, missing, extra or swapped letter) in a first or full name of 4+ letters.
  // Whatever it picks is written into the box; the player presses enter again to throw.
  function candidates(text) {
    const q = norm(text), multi = q.includes(" ");
    if (!q) return [];
    const first = multi ? [] : people.filter((p) => p.first === q);
    if (first.length) return first;
    // Full names for teammates the roster lists by a first name ("Mitchell"), a last name ("Krause"),
    // or a first name plus an initial ("Ryan B"); and "D Wu" or a bare last name like "Mateer".
    const words = q.split(" "), qf = words[0], ql = words[words.length - 1];
    const fuller = people.filter((p) => {
      const pw = p.key.split(" "), pf = pw[0], pl = pw[pw.length - 1];
      if (multi && pw.length === 1) return p.key === qf || p.key === ql;                      // Mitchell O'Connor, Josh Krause
      if (multi && pw.length > 1 && pl.length === 1) return pf === qf && ql.startsWith(pl);   // Ryan Boldin -> Ryan B
      if (multi && pw.length > 1 && qf.length === 1) return pf.startsWith(qf) && pl === ql;   // D Wu -> Daniel Wu
      if (multi && pw.length > 1 && ql.length === 1) return pf === qf && pl.startsWith(ql);   // Andrew C -> Andrew Carneiro
      if (!multi && pw.length > 1 && q.length >= 3) return pl === q;                          // Mateer -> Brian Mateer
      return false;
    });
    if (fuller.length) return fuller;
    if (q.length < 4) return [];
    return people.filter((p) => lev(q, p.key) <= 1 || (!multi && p.first.length >= 4 && lev(q, p.first) <= 1));
  }
  const byValue = (x, y) => T[x.tier].pts - T[y.tier].pts || x.full.localeCompare(y.full);

  // ---------- crowd tiers ----------
  // Stat tiers start from the stats (q.ob: each answer's stat ranking; tiers capped by playing time). Once a stat sheet has had a day with 12+ different players, what people actually typed is blended in
  // half and half: a name few people think of drifts rarer, one everybody types drifts toward plankton.
  // A round played on day D only uses answers from days before D, so scores never move during a day and a
  // round keeps its score for good. Same tier rules as the stat sheets (ties share; one in a batchillion only
  // for a single lowest; at most 2 deep cuts; top quarter schooler) and the same fame cap.
  const CROWD_MIN_PLAYERS = 12, CROWD_W = 0.5, ORDER = ["plankton", "schooler", "rare", "deep", "krillion"];
  // Neal's split (11/7): top 20% plankton, next 40% schooler, next 25% rare, last 15% deep cut, cuts rounded
  // up; a single lowest answer is the one in a batchillion. Ties share the tier where their group starts.
  // Must match tools/sheetlib.py tiers() exactly (tools/crowd_port_test.js checks it).
  function tierize(vals) {
    const keys = Object.keys(vals), levels = [...new Set(keys.map((n) => vals[n]))].sort((a, b) => b - a);
    let groups = levels.map((v) => keys.filter((n) => vals[n] === v));
    const out = {};
    if (!groups.length) return out;
    if (groups.length === 1) { groups[0].forEach((n) => (out[n] = "plankton")); return out; }
    const kr = groups[groups.length - 1].length === 1 ? groups[groups.length - 1][0] : null;
    if (kr) groups = groups.slice(0, -1);
    const n = groups.reduce((a, g) => a + g.length, 0), up = (x) => Math.ceil(x - 1e-9);
    const c1 = up(0.2 * n), c2 = up(0.6 * n), c3 = up(0.85 * n);
    let seen = 0;
    groups.forEach((g) => { const t = seen < c1 ? "plankton" : seen < c2 ? "schooler" : seen < c3 ? "rare" : "deep"; g.forEach((x) => (out[x] = t)); seen += g.length; });
    if (kr) out[kr] = "krillion";
    return out;
  }
  // Playing-time fame cap (roster.js PT_CAP, from points played per game vs that game's average).
  const PT_CAP = Object.fromEntries(Object.entries(window.PT_CAP || {}).map(([n, c]) => [norm(n), c]));
  const capOf = (key) => PT_CAP[key] || "rare";
  function capTiers(tm, ob) {
    const out = {};
    Object.entries(tm).forEach(([n, t]) => { const c = capOf(n); out[n] = ORDER.indexOf(t) >= ORDER.indexOf(c) ? t : c; });
    if (!Object.values(out).includes("plankton")) {
      const ok = Object.keys(out).filter((n) => out[n] === "schooler" && capOf(n) === "plankton");
      if (ok.length) { const top = Math.max(...ok.map((n) => ob[n])); ok.forEach((n) => { if (ob[n] === top) out[n] = "plankton"; }); }
    }
    return out;
  }
  const crowdCache = new Map();
  function crowdTiers(set, date) {
    const R = setOf(set);
    if (!R || !R.prompts.some((q) => q.obOf)) return null;
    const key = `${set}|${date}|${remote.plays.length}|${people.length}`;
    if (crowdCache.has(key)) return crowdCache.get(key);
    const before = remote.plays.filter((pl) => (pl.set || "classes") === set && pl.answers.length >= R.prompts.length && dayIndex(pl.date) < dayIndex(date));
    const byDay = {};
    before.forEach((pl) => { (byDay[pl.date] = byDay[pl.date] || new Set()).add(norm(pl.player)); });
    const rounds = before.filter((pl) => byDay[pl.date].size >= CROWD_MIN_PLAYERS);
    let out = null;
    if (rounds.length) {
      out = R.prompts.map((q, k) => {
        if (!q.obOf) return null;
        const hits = {};
        rounds.forEach((pl) => { const a = pl.answers[k], p = a && exactOf(a.full || a.typed); if (p && q.tierOf[p.key]) hits[p.key] = (hits[p.key] || 0) + 1; });
        const top = Math.max(1, ...Object.values(hits));
        const vals = {};
        Object.keys(q.obOf).forEach((n) => { vals[n] = Math.round(((1 - CROWD_W) * q.obOf[n] + CROWD_W * ((hits[n] || 0) / top)) * 1000) / 1000; });
        return capTiers(tierize(vals), vals);
      });
    }
    crowdCache.set(key, out);
    return out;
  }

  // ---------- scoring ----------
  // One answer against today's roster (so ranked appeals apply retroactively).
  function score(ans, k, set, date = dayKey) {
    const prompt = setOf(set).prompts[k];
    if (!prompt || !ans || typeof ans !== "object") return { pts: 0, status: "no answer" };
    const p = exactOf(ans.full || ans.typed);
    if (!p) return { pts: 0, status: ans.reused ? `${ans.reused} was already used` : ans.typed ? "not on the list" : "no answer" };
    if (!fits(prompt, p)) return { pts: 0, person: p, status: prompt.tierOf ? `doesn't fit "${prompt.short}"` : `wrong class: started ${p.years.join(" or ")}` };
    const tier = tierFor(prompt, p, set, k, date);
    return { pts: T[tier].pts, tier, person: p };
  }
  // A round scored against everyone the player had already used. A teammate counts once per
  // player, ever, even when an appeal makes an old answer valid later.
  // Only Players rounds spend names for good. On a stat sheet a name counts once per round (so typing the
  // same teammate seven times isn't free points), and any name is fine again next round. Sheets I-IV
  // (legacyReuse) keep their old rule (any name, any number of times) so rounds played there keep their scores.
  // "retired" only hides a sheet from the picker; it still scores and keeps its leaderboard.
  const spends = (set) => (set || "classes") === "classes";
  const oncePerRound = (set) => !spends(set) && !setOf(set).legacyReuse;
  // Live stat sheets: only a player's first finished round on each sheet counts on its leaderboard; replays
  // are practice (the questions don't change and the answer explanations show the ranking).
  const firstOnly = (set) => oncePerRound(set);
  const isDone = (r) => r.done || r.answers.length >= P.length;
  const firstRowOf = (player, set) => { const r = history(player).rounds.filter((x) => (x.set || "classes") === set && isDone(x)).sort((a, b) => a.row - b.row)[0]; return r ? r.row : null; };
  function scoreRound(answers, used, set, date = dayKey) {
    const inRound = new Set();
    return (Array.isArray(answers) ? answers.slice(0, P.length) : []).map((a, k) => {
      const r = score(a, k, set, date);
      if (!r.person) return r;
      if (oncePerRound(set)) {
        if (inRound.has(r.person.key)) return { pts: 0, person: r.person, status: `${r.person.full} already counted this round` };
        inRound.add(r.person.key);
        return r;
      }
      if (!spends(set)) return r;   // legacy sheets I-IV: any name, any number of times
      if (used.has(r.person.key)) return { pts: 0, person: r.person, status: `${r.person.full} was already used` };
      used.add(r.person.key);
      return r;
    });
  }
  const sum = (rs) => rs.reduce((s, r) => s + r.pts, 0);
  // Every round this player has thrown, oldest first, with one running "used" set: a teammate counts
  // once per player, ever, so every round (any day) drains the pool. Empty claim rows are ignored.
  const playsOf = (player) => remote.plays.filter((pl) => norm(pl.player) === norm(player) && pl.answers.length).sort((a, b) => a.row - b.row);
  function history(player) {
    const used = new Set(), rounds = [];
    playsOf(player).forEach((pl) => { const before = new Set(used); rounds.push({ row: pl.row, set: pl.set, date: pl.date, done: pl.done, answers: pl.answers, before, results: scoreRound(pl.answers, used, pl.set, pl.date) }); });
    return { used, rounds };
  }
  // Teammates used before a given round: every earlier round, nothing from this one.
  const usedBefore = (player, row) => {
    const h = history(player), r = h.rounds.find((x) => x.row === row);
    return r ? new Set(r.before) : h.used;
  };
  const todayOf = (h) => {
    const rounds = h.rounds.filter((r) => r.date === dayKey);
    return { rounds, yards: rounds.reduce((s, r) => s + sum(r.results), 0) };
  };
  function streak(player) {
    const days = new Set(playsOf(player).map((p) => dayIndex(p.date)));
    let d = dayIndex(dayKey); if (!days.has(d)) d -= 1;
    let n = 0; while (days.has(d)) { n++; d--; }
    return n;
  }

  // ---------- field: a drive that scrolls between fixed end zones ----------
  // A regulation field is a 70-yard playing field between two 20-yard end zones. Points turn into
  // yards (100 pts = the full 70), each throw starts where the last one was caught, and the turf
  // scrolls under the disc so the end zones never move. Every 100 points is a goal.
  const FIELD = 70, YD = 1200 / 110, G0 = 20 * YD, G1 = G0 + FIELD * YD, MID = 150;
  // A real field: 70 yards between the goal lines, 20-yard end zones, a line every 10 yards marked
  // 10-60. A throw covers 0.7 yards per point, so 100 points crosses the whole 70 to the end zone.
  // The markers repeat every 70 yards as the turf scrolls with your throws.
  const PER_PT = FIELD / 100, LINE = 10;
  const yardsFor = (pts) => pts * PER_PT;
  const svgNS = "http://www.w3.org/2000/svg";
  const disc = $("#disc");
  let offset = 0, throws = [], lastY = MID, laneN = 0;
  const xAt = (abs) => G0 + (abs - offset) * YD;
  const nextLane = () => [70, 230, 110, 190, 150, 50, 250][laneN++ % 7];
  function arcOf(t) {
    const x1 = xAt(t.from), x2 = xAt(t.to), span = t.to - t.from;
    return { x1, y1: t.fy, x2, y2: t.ty, cx: (x1 + x2) / 2, cy: Math.max(Math.min(t.fy, t.ty) - 30 - span * 1.4, 30 - Math.sqrt((t.fy - 30) * (t.ty - 30))) }; // peak stays inside the field
  }
  function drawField() {
    let turf = "", lines = "";
    const small = matchMedia("(max-width: 520px)").matches, ly = small ? 48 : 26, room = small ? 6 : 3;
    for (let b = Math.floor(offset / LINE - 1e-6); b * LINE < offset + FIELD; b++) // a turf band every 10 yards
      turf += `<rect x="${xAt(b * LINE)}" y="0" width="${LINE * YD + 0.5}" height="300" class="${b % 2 ? "band-b" : "band-a"}"/>`;
    for (let n = Math.ceil(offset / LINE - 1e-6); n * LINE < offset + FIELD - 1e-6; n++) {
      const y = n * LINE;
      if (Math.abs(y - offset) < 1e-6) continue;
      const x = xAt(y), label = Math.round(y) % FIELD;      // 10-60, then the next 70 starts again
      lines += `<line x1="${x}" y1="0" x2="${x}" y2="300"/>` + (label && y <= offset + FIELD - room ? `<text x="${x + 6}" y="${ly}">${label}</text>` : "");
    }
    $("#turf").innerHTML = turf;
    $("#lines").innerHTML = lines;
    $("#trails").innerHTML = throws.map((t) => {
      const a = arcOf(t), d = `M${a.x1},${a.y1} Q${a.cx},${a.cy} ${a.x2},${a.y2}`;
      return `<path class="under" d="${d}"/><path d="${d}" stroke="${t.color}"/><circle cx="${a.x2}" cy="${a.y2}" r="10" fill="${t.color}"/>`;
    }).join("");
  }
  const ease = (k) => 1 - (1 - k) ** 3;
  const animate = (ms, fn) => new Promise((done) => {
    if (FAST) ms = 1;
    const t0 = performance.now();
    (function step(t) { const k = Math.min(1, (t - t0) / ms); fn(ease(k)); if (k < 1) requestAnimationFrame(step); else done(); })(t0);
  });
  function placeDisc(x, y) { disc.setAttribute("cx", x); disc.setAttribute("cy", y); }
  function flashGoal() {
    const ez = $("#ezFar"); ez.classList.remove("scored"); void ez.getBoundingClientRect(); ez.classList.add("scored");
  }
  // Throw from the current catch point, then scroll the turf so the catch becomes the new release.
  async function huck(pts, color, before) {
    const yds = yardsFor(pts), t = { from: offset, fy: lastY, to: offset + yds, ty: pts >= 100 ? MID : nextLane(), color };
    const a = arcOf(t);
    await animate(450 + yds * 12, (e) => placeDisc(
      (1 - e) ** 2 * a.x1 + 2 * (1 - e) * e * a.cx + e * e * a.x2,
      (1 - e) ** 2 * a.y1 + 2 * (1 - e) * e * a.cy + e * e * a.y2));
    throws.push(t); drawField();
    if (Math.floor((before + pts) / 100) > Math.floor(before / 100)) flashGoal();
    const from = offset;
    await animate(520, (e) => { offset = from + (t.to - from) * e; drawField(); placeDisc(xAt(t.to), t.ty); });
    lastY = t.ty;
  }
  function resetField(results = []) {
    offset = 0; throws = []; lastY = MID; laneN = 0;
    results.forEach((r) => {
      if (!r.pts) return;
      const t = { from: offset, fy: lastY, to: offset + yardsFor(r.pts), ty: r.pts >= 100 ? MID : nextLane(), color: T[r.tier].color };
      throws.push(t); offset = t.to; lastY = t.ty;
    });
    drawField(); placeDisc(G0, lastY);
    paintTally(sum(results));
  }
  function paintTally(pts) {
    $("#total").textContent = pts;
    const g = Math.floor(pts / 100);
    $("#goals").textContent = g ? `${g} goal${g > 1 ? "s" : ""}` : "";
  }
  (function brickMarks() { // fixed to the end zones, so they never scroll
    const g = $("#bricks");
    [G0 + 20 * YD, G1 - 20 * YD].forEach((x) => {
      const p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", `M${x - 8},${MID - 8} l16,16 M${x + 8},${MID - 8} l-16,16`); g.appendChild(p);
    });
  })();
  resetField();

  // ---------- nav ----------
  const legendHTML = Object.values(T).map((t) => `<div><b style="background:${t.color}"></b><span>${t.label} · ${t.pts}</span></div>`).join("");
  $("#legend").innerHTML = legendHTML;
  $("#howBtn").onclick = () => $("#how").showModal();
  $("#boardBtn").onclick = () => board();

  // ---------- session ----------
  let me = ls.get("bh:session", null); // {player, token}
  const draftKey = () => `bh:draft:${dayKey}:${norm(me.player)}`;
  const clockKey = () => `bh:clock:${dayKey}:${norm(me.player)}`;
  const signOut = () => { me = null; ls.del("bh:session"); auth(); };

  function auth(msg = "") {
    resetField();
    show(`
      <div class="card">
        <p class="kicker">BATCHILLION #${dayNum()}</p>
        <p class="prompt">Who's throwing?</p>
        <form id="af" class="stack" autocomplete="on">
          <input type="text" id="an" placeholder="your name" aria-label="your name" autocomplete="username" required maxlength="40">
          <input type="password" id="ap" placeholder="password (any, even blank)" aria-label="password" autocomplete="current-password">
          <div class="row">
            <button class="btn" type="submit" data-act="signin">sign in</button>
            <button class="btn ghost" type="submit" data-act="register">create account</button>
          </div>
        </form>
        <p class="hint" id="am" aria-live="polite">${esc(msg)}</p>
        <div class="legend">${legendHTML}</div>
      </div>`);
    $("#an").focus();
    $("#af").onsubmit = async (e) => {
      e.preventDefault();
      const act = e.submitter?.dataset.act || "signin", name = $("#an").value.trim();
      $("#am").textContent = act === "register" ? "creating account…" : "signing in…";
      const r = await post({ action: act, player: name, password: $("#ap").value });
      if (!r.ok && (r.noAccount || r.error === "no account")) {
        $("#am").innerHTML = `no account called ${esc(name)} yet. <button class="linkish" id="mk" type="button">create it</button>`;
        $("#mk").onclick = () => $("#af").requestSubmit(stage.querySelector('[data-act="register"]'));
        return;
      }
      if (!r.ok) { $("#am").textContent = r.error; return; }
      me = { player: r.player, token: r.token }; ls.set("bh:session", me);
      home();
    };
  }

  function offlineCard(retry) {
    show(`<div class="card"><p class="kicker">BATCHILLION #${dayNum()}</p><p class="prompt">Can't reach the field.</p>
      <p class="hint">The leaderboard server didn't answer, so the round can't start (it would forget who you've already used).</p>
      <div class="row"><button class="btn" id="retry" type="button">try again</button></div></div>`);
    $("#retry").onclick = retry;
  }

  async function home() {
    if (!me) return auth();
    if (!(await pull())) return offlineCard(home);
    buildRoster();
    const draft = practice ? null : ls.get(draftKey(), null);
    if (draft && draft.row) return play(draft.answers || [], draft.row, draft.set);   // a round in progress on this device
    resetField();
    const h = history(me.player), st = streak(me.player), today = todayOf(h);
    const left = people.filter((p) => !h.used.has(p.key)).length;
    show(`
      <div class="card">
        <p class="kicker">BATCHILLION #${dayNum()}${practice ? " · PRACTICE" : ""}${st ? ` · STREAK ${st}` : ""}</p>
        <p class="prompt">You're up, <em>${esc(me.player)}</em>. Pick a round. The rarer the pick, the deeper the huck.</p>
        <p class="hint">${today.rounds.length ? `Today: ${today.rounds.length} round${today.rounds.length > 1 ? "s" : ""}, ${today.yards} yards. ` : ""}Players: ${left ? `${left} teammate${left > 1 ? "s" : ""} left for you; a name you use there is gone for good.` : "you've used every teammate."} Stat sheets: any name, once per round.</p>
        <div class="picks">${openRounds().map((r, i) => `<button class="btn pick${i ? " ghost" : ""}" data-set="${r.id}" type="button" ${spends(r.id) && !left ? "disabled" : ""}><span>${esc(r.title)}${r.unlock ? ' <b class="new">new</b>' : ""}</span><small>${spends(r.id) ? "names are gone for good" : "a name counts once per round"}</small><small>max ${maxFor(r.id, h.used)} yds${firstOnly(r.id) && firstRowOf(me.player, r.id) ? " · replays are practice" : ""}</small></button>`).join("")}</div>
        <div class="row"><button class="linkish" id="out" type="button">not ${esc(me.player)}? sign out</button></div>
      </div>`);
    const first = stage.querySelector("[data-set]"); if (first) first.focus();
    stage.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => startRound(b, b.dataset.set)));
    $("#out").onclick = signOut;
  }

  // The most yards a round can still give this player: stat sheets take each prompt's best answer
  // (names can repeat); Players needs 7 different unused teammates, so it searches the best distinct picks.
  // Keeping each prompt's top 7 candidates is exact: 6 other prompts can take at most 6 of them.
  function maxFor(id, used) {
    const R = setOf(id), pts = (q, p) => T[tierFor(q, p, id, R.prompts.indexOf(q), dayKey)].pts;
    const C = R.prompts.map((q) => people.filter((p) => fits(q, p) && (!spends(id) || !used.has(p.key))).sort((a, b) => pts(q, b) - pts(q, a)).slice(0, 7));
    if (!spends(id) && !oncePerRound(id)) return C.reduce((s, c, k) => s + (c.length ? pts(R.prompts[k], c[0]) : 0), 0);
    const top = C.map((c, k) => (c.length ? pts(R.prompts[k], c[0]) : 0));
    let best = 0;
    const go = (k, taken, sum) => {
      if (k === C.length) { best = Math.max(best, sum); return; }
      if (sum + top.slice(k).reduce((a, b) => a + b, 0) <= best) return;
      let any = false;
      for (const p of C[k]) if (!taken.has(p.key)) { any = true; taken.add(p.key); go(k + 1, taken, sum + pts(R.prompts[k], p)); taken.delete(p.key); }
      if (!any) go(k + 1, taken, sum);
    };
    go(0, new Set(), 0);
    return best;
  }
  // Unlocked rounds. Retired sheets drop out of the picker but keep their leaderboards (rounds already
  // played on them still score against their original prompts).
  const unlocked = () => ROUNDS.filter((r) => !r.unlock || dayIndex(dayKey) >= dayIndex(r.unlock));
  const openRounds = () => unlocked().filter((r) => !r.retired);
  // Opens a round of the chosen type on the server (or picks up one left open), then plays it.
  async function startRound(btn, set = "classes") {
    if (setOf(set).retired) return home();
    if (practice) return play([], 0, set);
    if (btn) btn.disabled = true;
    // iOS only raises the keyboard for focus() inside the tap itself, so hold it with a stand-in box.
    const proxy = Object.assign(document.createElement("input"), { type: "text" });
    proxy.style.cssText = "position:fixed;top:0;left:0;opacity:0;height:0;font-size:16px";
    document.body.appendChild(proxy); proxy.focus();
    const r = await post({ action: "start", date: dayKey, player: me.player, token: me.token, set });
    if (!r.ok) {
      proxy.remove();
      if (r.error === "sign in again") return signOut();
      if (r.net) return offlineCard(home);
      toast(r.error); return home();
    }
    const st = { row: r.row, set: r.set || set, answers: Array.isArray(r.answers) ? r.answers : [] };
    ls.set(draftKey(), st); ls.del(clockKey());
    play(st.answers, st.row, st.set); proxy.remove();
  }

  // ---------- one prompt ----------
  function play(answers, row, set = "classes") {
    const R = setOf(set), PR = R.prompts;
    const i = answers.length;
    if (i >= PR.length) return submitRound(answers, row, set);
    const prior = practice || !spends(set) ? new Set() : usedBefore(me.player, row);
    const results = scoreRound(answers, new Set(prior), set);
    const used = spends(set) ? new Set(prior) : new Set();
    if (spends(set)) results.forEach((r) => r.person && used.add(r.person.key));
    else if (oncePerRound(set)) results.forEach((r) => r.person && r.pts && used.add(r.person.key));
    resetField(results);
    // The clock lives in storage, so reloading mid-prompt does not buy a fresh 40 seconds.
    let clock = practice ? null : ls.get(clockKey(), null);
    if (!clock || clock.i !== i || clock.row !== row) { clock = { row, i, t0: Date.now() }; if (!practice) ls.set(clockKey(), clock); }
    const LIMIT = SECONDS;   // 40s for every round type
    const deadline = clock.t0 + LIMIT * 1000;
    let locked = false, lastReject = "";
    // Stat sheets: a few guesses per prompt, more when fewer answers fit (a harder question):
    // 12 or fewer answers -> 5 guesses, 13-17 -> 4, 18+ -> 3. Players rounds keep unlimited tries.
    const nFit = PR[i].tierOf ? Object.keys(PR[i].tierOf).length : 0;
    const GUESSES = spends(set) ? Infinity : nFit <= 12 ? 5 : nFit <= 17 ? 4 : 3;
    const missKey = () => `${clockKey()}:misses:${row}:${i}`;
    let misses = practice ? 0 : ls.get(missKey(), 0);
    const left = people.filter((p) => fits(PR[i], p) && !used.has(p.key)).length;
    const firstRow = !practice && firstOnly(set) ? firstRowOf(me.player, set) : null;
    const replayRound = firstRow != null && firstRow !== row;
    show(`
      <div class="card">
        <p class="kicker">${spends(set) ? `PROMPT ${i + 1} / ${PR.length} · ${left} LEFT FOR YOU` : `${esc(R.title.toUpperCase())}${replayRound ? " · PRACTICE" : ""} · PROMPT ${i + 1} / ${PR.length} · ONE USE PER NAME`}</p>
        <p class="prompt">Name a BatCH teammate <em>${esc(PR[i].text)}</em></p>
        <div class="clock" id="clk"><span class="secs" id="secs">${LIMIT}</span><div class="timer" id="tm"><i></i></div></div>
        <form class="row" id="f" autocomplete="off">
          <input type="text" id="in" placeholder="name…" aria-label="teammate name" autocapitalize="words" autocorrect="off" spellcheck="false" maxlength="60">
          <button class="btn" type="submit">huck it</button>
        </form>
        <div class="hint" id="hint" aria-live="polite"></div>
        ${spends(set) ? `<p class="guesses">started before 2024? only teammates who played a sanctioned tournament count</p>` : ""}
        ${GUESSES < Infinity ? `<p class="guesses" id="gl">${GUESSES - misses} of ${GUESSES} guesses left</p>` : ""}
      </div>`);
    const input = $("#in"), hint = $("#hint");
    if (!left) hint.textContent = "nobody left in this class for you. try a name you know is missing (you can appeal it), or wait for the buzzer.";
    input.focus();
    // No hints while typing: autocorrect only happens when the player presses enter.
    input.oninput = () => { hint.textContent = ""; };

    function tick() {
      const bar = $("#tm i"); if (!bar) return stopTimer();
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      bar.style.width = `${(left / LIMIT) * 100}%`;
      $("#secs").textContent = left;
      $("#clk").classList.toggle("low", left <= 5);
      if (left <= 0) submit(true);
    }
    $("#f").onsubmit = (e) => { e.preventDefault(); submit(false); };
    stopTimer(); activeTimer = setInterval(tick, 250); tick();

    // Enter either catches or it doesn't. A miss clears the box and the clock keeps running;
    // only a catch (or the buzzer) ends the prompt.
    function drop(msg) {
      input.value = ""; hint.textContent = msg; input.focus();
      if (GUESSES === Infinity) return;
      misses++; if (!practice) ls.set(missKey(), misses);
      const gl = $("#gl"); if (gl) gl.textContent = `${Math.max(0, GUESSES - misses)} of ${GUESSES} guesses left`;
      if (misses >= GUESSES) { hint.textContent = `${msg} · out of guesses`; submit(true); }
    }
    if (misses >= GUESSES) setTimeout(() => submit(true), 0);   // reloaded after using every guess
    function submit(timedOut) {
      if (locked) return;
      const raw = input.value.trim(), ex = exactOf(raw);
      const catches = ex && !used.has(ex.key) && fits(PR[i], ex);
      if (!timedOut) {
        if (!raw) return;
        if (!ex) {
          // Several fits ("peter" -> Peter C, Peter D): correct to the least valuable one still
          // available. Anyone who wants the other has to type that full name themselves.
          const all = candidates(raw), c = all.filter((p) => !used.has(p.key)).sort(byValue);
          if (c.length) { input.value = c[0].full; hint.textContent = `autocorrected to ${c[0].full}. press enter again to huck it`; return; }
          if (all.length) return drop(`${all.map((p) => p.full).join(", ")}: already used. pick someone else`);
          lastReject = raw; // kept so it can be appealed after the round
          return drop(`"${raw}" isn't on the roster. try again`);
        }
        if (used.has(ex.key)) return drop(spends(set) ? `${ex.full} is already used in Players. ever. pick someone else` : `${ex.full} already counted this round. pick someone else`);
        if (!catches) return drop(PR[i].tierOf ? `${ex.full} doesn't fit this one. try again` : `${ex.full} didn't start ${PR[i].short}. try again`);
      }
      locked = true; stopTimer();
      const offRoster = raw && !ex && !candidates(raw).length;
      const ans = catches ? { typed: raw, full: ex.full } : { typed: offRoster ? raw : lastReject, full: null };
      if (!practice) ls.del(clockKey());
      reveal([...answers, ans], sum(results), row, set);
    }
  }

  // Each throw is saved on the server right away, so a teammate is spent the moment you name them,
  // even if you close the tab mid-round.
  function sendThrows(row, all) {
    if (practice || !row) return Promise.resolve({ ok: true });
    return post({ action: "throw", date: dayKey, player: me.player, token: me.token, row, answers: all });
  }
  // Why an answer landed in its tier, in plain sentences that stand on their own: what the person
  // actually did on this question, how that ranks, and which rule set the tier.
  function statSentence(q, name, v) {
    const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const pct = (x) => `${Math.round(x * 100)}%`;
    const every = (x) => (x > 0 ? `once every ${(1 / x).toFixed(1).replace(/\.0$/, "")}` : "never");
    let t = String(q.text || "").replace(/^who\s+/, "").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    const ctx = (rest) => rest.replace(/^\s+/, "").replace(/\s+$/, "");
    let m;
    const r2 = (x) => (+x).toFixed(2).replace(/\.?0+$/, "");
    // ratios and the Nov 7 question kinds first, so the generic count sentences below don't misread them
    if ((m = t.match(/^made more catches than completed throws(.*)$/))) return `${name} made ${r2(v)} catches for every completed throw${m[1]}`;
    if ((m = t.match(/^completed more throws than they caught(.*)$/))) return `${name} completed ${r2(v)} throws for every catch${m[1]}`;
    if ((m = t.match(/^played \d+ or more points on the same line as (.+)$/))) return `${name} played ${pl(v, "point", "points")} on the same line as ${m[1]}`;
    if ((m = t.match(/^was on the field with (.+?) for a break(.*)$/))) return `${name} was on the field with ${m[1]} for ${pl(v, "break", "breaks")}${m[2]}`;
    if ((m = t.match(/^caught BatCH's first goal of a game(.*)$/))) return `${name} caught BatCH's first goal in ${pl(v, "game", "games")}${m[1]}`;
    if ((m = t.match(/^threw the assist on BatCH's first goal of a game(.*)$/))) return `${name} threw the assist on BatCH's first goal in ${pl(v, "game", "games")}${m[1]}`;
    if ((m = t.match(/^played the last point of a game that started with the score tied(.*)$/))) return `${name} played ${pl(v, "game-deciding point", "game-deciding points")}${m[1]}`;
    if ((m = t.match(/^was on the field when BatCH caught a goal that tied the game(.*)$/))) return `${name} was on the field for ${pl(v, "game-tying goal", "game-tying goals")}${m[1]}`;
    if ((m = t.match(/^caught a goal that tied the game(.*)$/))) return `${name} caught ${pl(v, "game-tying goal", "game-tying goals")}${m[1]}`;
    if ((m = t.match(/^was on the field when BatCH caught a goal that broke a tie(.*)$/))) return `${name} was on the field for ${pl(v, "go-ahead goal", "go-ahead goals")}${m[1]}`;
    if ((m = t.match(/^played \d+ or more game-closing points(.*)$/))) return `${name} played ${pl(v, "game-closing point", "game-closing points")}${m[1]}`;
    if ((m = t.match(/^completed \d+ or more passes to one teammate(.*)$/))) return `${name} completed ${pl(v, "pass", "passes")} to their most-targeted teammate${m[1]}`;
    if ((m = t.match(/^completed passes to \d+ or more different teammates(.*)$/))) return `${name} completed passes to ${pl(v, "different teammate", "different teammates")}${m[1]}`;
    if ((m = t.match(/^caught passes from \d+ or more different teammates(.*)$/))) return `${name} caught passes from ${pl(v, "different teammate", "different teammates")}${m[1]}`;
    if ((m = t.match(/^threw assists to \d+ or more different teammates(.*)$/))) return `${name} threw assists to ${pl(v, "different teammate", "different teammates")}${m[1]}`;
    if ((m = t.match(/^played \d+ or more points in a row in one game(.*)$/))) return `${name} played ${pl(v, "point", "points")} in a row at their longest in one game${m[1]}`;
    if ((m = t.match(/^played both O points and D points in the same game, in \d+ or more games(.*)$/))) return `${name} played both O and D points in ${pl(v, "game", "games")}${m[1]}`;
    if ((m = t.match(/^threw a pull that hung 4 or more seconds(.*)$/))) return `${name} threw ${pl(v, "pull", "pulls")} that hung 4 or more seconds${m[1]}`;
    if ((m = t.match(/^threw the longest-hanging pull of a game(.*)$/))) return `${name} threw the longest pull in ${pl(v, "game", "games")}${m[1]}`;
    if ((m = t.match(/^caught a goal in a game BatCH (lost|won)(.*)$/))) return `${name} caught ${pl(v, "goal", "goals")} in games BatCH ${m[1]}${m[2]}`;
    if ((m = t.match(/^threw an assist in a game BatCH (lost|won)(.*)$/))) return `${name} threw ${pl(v, "assist", "assists")} in games BatCH ${m[1]}${m[2]}`;
    if ((m = t.match(/^got a D in a game BatCH (lost|won)(.*)$/))) return `${name} got ${pl(v, "D", "Ds")} in games BatCH ${m[1]}${m[2]}`;
    if ((m = t.match(/^completed \d+% or more of their throws(.*)$/))) return `${name} completed ${pct(v)} of their throws${m[1]}`;
    if ((m = t.match(/^caught \d+% or more of the passes thrown to them(.*)$/))) return `${name} caught ${pct(v)} of the passes thrown to them${m[1].replace(/, drops counted/, "")}`;
    if ((m = t.match(/^caught a goal on \d+% or more of their catches(.*)$/))) return `${name} caught a goal on ${pct(v)} of their catches${m[1]}`;
    if ((m = t.match(/^threw an assist on \d+% or more of their completed throws(.*)$/))) return `${name} threw an assist on ${pct(v)} of their completed throws${m[1]}`;
    if ((m = t.match(/^threw it away on \d+% or more of their throws(.*)$/))) return `${name} threw it away on ${pct(v)} of their throws${m[1]}`;
    if ((m = t.match(/^averaged at least one touch per (O|D) point they played(.*)$/))) return `${name} averaged ${(+v).toFixed(2)} touches per ${m[1]} point${m[2]}`;
    if ((m = t.match(/^got a D at least once every \d+ D points they played(.*)$/))) return `${name} got a D ${every(v)} D points they played${m[1]}`;
    if ((m = t.match(/^(caught the disc|caught a goal|touched the disc|got a D|threw an assist) at least once every \d+ (D |O )?points they played(.*)$/))) return `${name} ${m[1]} ${every(v)} ${m[2] || ""}points they played${m[3]}`;
    if ((m = t.match(/^touched the disc(?: \d+ or more times)?(.*)$/))) return `${name} touched the disc ${pl(v, "time", "times")}${m[1]}`;
    if ((m = t.match(/^caught the disc(?: \d+ or more times)?(.*)$/))) return `${name} caught the disc ${pl(v, "time", "times")}${m[1]}`;
    if ((m = t.match(/^(?:has )?made (?:\d+ or more )?catches(.*)$/))) return `${name} made ${pl(v, "catch", "catches")}${m[1]}`;
    if ((m = t.match(/^(?:has )?completed (?:\d+ or more throws|a throw)(.*)$/))) return `${name} completed ${pl(v, "throw", "throws")}${m[1]}`;
    if ((m = t.match(/^caught a pass from (.+)$/))) return `${name} caught ${pl(v, "pass", "passes")} from ${m[1]}`;
    if ((m = t.match(/^completed a pass to (.+)$/))) return `${name} completed ${pl(v, "pass", "passes")} to ${m[1]}`;
    if ((m = t.match(/^caught a goal from (.+)$/))) return `${name} caught ${pl(v, "goal", "goals")} from ${m[1]}`;
    if ((m = t.match(/^played (?:\d+ or more points )?in (.+)$/))) return `${name} played ${pl(v, "point", "points")} in ${m[1]}`;
    if ((m = t.match(/^(?:has )?caught (?:\d+ or more goals|a goal)(.*)$/))) return `${name} caught ${pl(v, "goal", "goals")}${m[1]}`;
    if ((m = t.match(/^(?:has )?(?:gotten (?:\d+ or more )?Ds|got a D)(?: \(blocks\))?(.*)$/))) return `${name} got ${pl(v, "D", "Ds")}${m[1]}`;
    if ((m = t.match(/^(?:has )?thrown (?:\d+ or more )?throwaways(.*)$/))) return `${name} threw ${pl(v, "throwaway", "throwaways")}${m[1]}`;
    if ((m = t.match(/^(?:has )?thrown (?:\d+ or more )?assists(.*)$/))) return `${name} threw ${pl(v, "assist", "assists")}${m[1]}`;
    if ((m = t.match(/^threw an assist(.*)$/))) return `${name} threw ${pl(v, "assist", "assists")}${m[1]}`;
    if ((m = t.match(/^dropped \d+% or more of the passes thrown to them(.*)$/))) return `${name} dropped ${pct(v)} of the passes thrown to them${m[1]}`;
    if ((m = t.match(/^(?:has )?dropped a pass(.*)$/))) return `${name} dropped ${pl(v, "pass", "passes")}${m[1]}`;
    if ((m = t.match(/^pulled(?: \d+ or more times)?(.*)$/))) return `${name} pulled ${pl(v, "time", "times")}${m[1]}`;
    if ((m = t.match(/^threw it away(?: \d+ or more times)?(.*)$/))) return `${name} threw it away ${pl(v, "time", "times")}${m[1]}`;
    return `${name}'s number on this question is ${q.ratio ? (+v).toFixed(2) : v}`;
  }
  function whyTier(set, k, person, tier, date) {
    const q = setOf(set).prompts[k], lbl = (t) => T[t].label, name = person && person.full;
    if (!q || !person || !tier) return "";
    if (!q.tierOf) return `${name} is ranked ${lbl(tier)} on the BatCH roster, by how many teammates would think of them.`;
    const vOf = q.v ? Object.fromEntries(Object.entries(q.v).map(([n, v]) => [norm(n), v])) : null;
    const n = Object.keys(q.tierOf).length;
    let out = "";
    if (vOf && vOf[person.key] != null) {
      const vals = Object.values(vOf), v = vOf[person.key];
      const more = vals.filter((x) => x > v).length, same = vals.filter((x) => x === v).length - 1, less = vals.filter((x) => x < v).length;
      const where = !more ? (same ? `tied for the most with ${same} other${same > 1 ? "s" : ""}` : "the most")
        : !less ? (same ? `tied for the fewest with ${same} other${same > 1 ? "s" : ""}` : "the fewest")
        : `${more + 1}${["th", "st", "nd", "rd"][((more + 1) % 100 >> 3 ^ 1) && (more + 1) % 10] || "th"} of ${n}`;
      out = `${statSentence(q, name, v)}: ${where}${!more || !less ? ` of the ${n} teammates who fit` : " teammates who fit"}.`;
    } else out = `${n} teammates fit this one.`;
    const raw = q.obOf ? tierize(q.obOf)[person.key] : null, c = capOf(person.key);
    const capped = raw && ORDER.indexOf(raw) < ORDER.indexOf(tier) && tier === c;
    if (capped) out += ` That alone would make them ${lbl(raw)}, but ${name} plays ${c === "rare" ? "fewer minutes than most" : "about average minutes"} this season, so the highest they can be is ${lbl(c)}.`;
    else if (tier === "krillion") out += vOf && Object.values(vOf).filter((x) => x === vOf[person.key]).length > 1
      ? ` Several teammates are tied for the fewest, and ${name} has played the most points of them this season, so ${name} is the one in a batchillion.`
      : " Nobody else is that low on this question, so one in a batchillion.";
    else if (q.obOf && q.obOf[person.key] != null) {
      // Spell out the ranking: where they sit, the spot ranges for each tier, and why not the next tier down.
      const ob = q.obOf, me = ob[person.key], all = Object.values(ob);
      const lows = all.filter((x) => x === Math.min(...all)).length, kr = lows === 1 && all.length > 1;
      const m = all.length - (kr ? 1 : 0), up = (x) => Math.ceil(x - 1e-9);
      const c1 = up(0.2 * m), c2 = up(0.6 * m), c3 = up(0.85 * m);
      const pos = all.filter((x) => x > me).length + 1, tied = all.filter((x) => x === me).length;
      const span = (a, b) => (a > b ? "" : a === b ? `${a}` : `${a}–${b}`);
      const ranges = [["plankton", 1, c1], ["schooler", c1 + 1, c2], ["rare", c2 + 1, c3], ["deep cut", c3 + 1, m]]
        .filter(([, a, b]) => a <= b).map(([t, a, b]) => `${span(a, b)} ${t}`).join(", ");
      const total = all.length;
      // Ratio questions rank by the stat plus points played, so the spot can differ from the stat's own order above.
      if (q.ratio) out += ` Tiers on this question rank everyone by the stat plus points played (doing it over more points counts for more), so ${name}'s spot can differ from the stat alone.`;
      out += tied > 1
        ? ` ${q.ratio ? "On that ranking" : "On this question's ranking"}, those ${tied} share spots ${pos}–${pos + tied - 1} of ${total}. Tied people share one tier, and their group starts at spot ${pos}.`
        : ` ${q.ratio ? "On that ranking" : "On this question's ranking"}, ${name} is spot ${pos} of ${total}.`;
      out += ` Spots ${ranges}${kr ? `, ${total} one in a batchillion` : ""}, so ${tied > 1 ? "they're all" : "that's"} ${lbl(tier)}.`;
      const nextDown = { plankton: ["schooler", c1 + 1], schooler: ["rare", c2 + 1], rare: ["deep cut", c3 + 1] }[tier];
      if (nextDown && nextDown[1] <= m) out += ` Not a ${nextDown[0]}, because ${tied > 1 ? "the group starts" : "they're"} before spot ${nextDown[1]}.`;
    } else out += ` That puts ${name} at ${lbl(tier)}.`;
    if (crowdTiers(set, date)) out += " Tiers here also lean on what players typed on earlier days.";
    return out;
  }

  async function reveal(all, before, row, set = "classes") {
    const k = all.length - 1, ans = all[k];
    if (!practice) { ls.set(draftKey(), { row, set, answers: all }); if (all.length < P.length) sendThrows(row, all); }
    const prior = practice ? new Set() : usedBefore(me.player, row);
    const r = scoreRound(all, new Set(prior), set)[k];
    const h = (stage.querySelector(".card") || stage).offsetHeight;   // keep the placeholder the size of the card it replaces
    show(`<div class="card" style="min-height:${h}px"><p class="kicker">PROMPT ${all.length} / ${P.length}</p><p class="prompt">${r.pts ? "up it goes…" : "turnover."}</p></div>`);
    const mine = nav;
    if (r.pts) await huck(r.pts, T[r.tier].color, before);
    if (nav !== mine) return; // the player moved on mid-throw
    paintTally(before + r.pts);
    const t = r.tier && T[r.tier];
    const cap = t ? (typeof t.caption === "function" ? t.caption() : t.caption) + (r.person.note ? ` · ${r.person.note}` : "") : "";
    const last = all.length === P.length;
    const goal = t && Math.floor((before + r.pts) / 100) > Math.floor(before / 100);
    show(`
      <div class="card result${t ? "" : " miss"}" role="status" style="--c:${t ? t.color : "var(--graphite)"}">
        <p class="kicker">PROMPT ${all.length} / ${P.length}${goal ? " · GOAL" : ""}</p>
        <p class="who">${esc(r.person ? r.person.full : ans.typed || ans.reused || "no answer")}</p>
        ${t ? `<span class="tier">${esc(t.label)}</span><p class="yds">${t.pts} <small>pts${t.pts >= 100 ? " · caught in the end zone" : ""}</small></p><p class="cap">${esc(cap)}</p><p class="why">${esc(whyTier(set, k, r.person, r.tier, dayKey))}</p>`
            : `<p class="yds">0 <small>pts</small></p><p class="cap">${esc(window.ZERO_CAPTION)}</p><p class="small">${esc(r.status)}${ans.typed && !r.person ? " · you can appeal one name at the end" : ""}</p>`}
        <div class="row"><button class="btn" id="next" type="button">${last ? "see how far you threw it" : "next throw"}</button></div>
      </div>`);
    $("#next").focus();
    $("#next").onclick = () => play(all, row, set);
  }

  async function submitRound(answers, row, set = "classes") {
    if (practice) return finish(0, answers, set);
    show(`<div class="card"><p class="kicker">BATCHILLION #${dayNum()}</p><p class="prompt">Sending your throws…</p></div>`);
    const r = await sendThrows(row, answers);
    if (r.ok || r.error === "that round is closed") {
      ls.del(draftKey()); ls.del(clockKey());
      if (!(await pull(true))) return offlineCard(home);
      buildRoster();
      return finish(row);
    }
    if (r.error === "sign in again") { me = null; ls.del("bh:session"); return auth("session expired. sign in again; your round is saved on this device and will send."); }
    // Keep the round on this device and let the player resend it. Nothing is lost.
    show(`<div class="card"><p class="kicker">BATCHILLION #${dayNum()}</p><p class="prompt">Your round didn't reach the server.</p>
      <p class="hint">${esc(r.error || "unknown error")}. It's saved on this device.</p>
      <div class="row"><button class="btn" id="resend" type="button">resend</button></div></div>`);
    $("#resend").onclick = () => submitRound(answers, row, set);
  }

  // ---------- recap + appeal ----------
  const VERDICTS = [ // the day's total, on the same 0-700 scale as krillion; lines by Neal
    [450, "the solution to every problem is to huck it and that's what you did"],
    [351, "easy golf"],
    [251, "nate 'mr. consistent' scofield type performance"],
    [151, "do you even come to practice?"],
    [0, "get in mitchell's car on the way to tournaments"],
  ];
  // Every finished round by every player (the leaderboard and the result card both read this).
  function allRounds() {
    const names = {}, list = [];
    remote.plays.forEach((pl) => { names[norm(pl.player)] = names[norm(pl.player)] || pl.player; });
    Object.values(names).forEach((name) => {
      const h = history(name);
      let nToday = 0;
      const seen = {};
      h.rounds.slice().sort((a, b) => a.row - b.row).forEach((r) => {
        const isToday = r.date === dayKey; if (isToday) nToday++;
        if (!(r.done || r.answers.length >= P.length)) return;
        const set = r.set || "classes", practiceRound = firstOnly(set) && seen[set];
        seen[set] = true;
        list.push({ name, row: r.row, set, yards: sum(r.results), date: r.date, isToday, nth: isToday ? nToday : 0, practice: !!practiceRound });
      });
    });
    return list;
  }

  // The result card: one screen, made to be screenshotted. Score, where it sits among today's
  // throws of the same round type, and each throw's flight up its own lane of a mini field.
  function scorecard({ tot, verdict, R, res, round, nth }) {
    const W = 320, H = 92, X = (v) => 10 + (Math.min(700, Math.max(0, v)) / 700) * (W - 20);
    let pool = [], scope = "today's";
    if (!practice && round.row) {
      const mine = allRounds().filter((r) => r.set === (round.set || "classes") && (!r.practice || (r.row === round.row && norm(r.name) === norm(me.player))));
      pool = mine.filter((r) => r.isToday);
      if (pool.length < 3) { pool = mine; scope = "all-time"; }
    }
    const others = pool.filter((r) => r.row !== round.row || norm(r.name) !== norm(me.player));
    const pct = others.length ? Math.round((others.filter((r) => r.yards < tot).length / others.length) * 100) : null;
    // A smoothed curve of the pool (a sum of bell curves, 30 yards wide), drawn only with 3+ rounds.
    let curve = "";
    if (pool.length) {
      const bins = Array(14).fill(0); pool.forEach((r) => bins[Math.min(13, Math.floor(r.yards / 50))]++);
      const bmax = Math.max(...bins), bw = (W - 20) / 14;
      curve += bins.map((c, i) => c ? `<rect class="sc-bar${tot >= i * 50 && (tot < i * 50 + 50 || (i === 13 && tot >= 650)) ? " me" : ""}" x="${(10 + i * bw + 1).toFixed(1)}" width="${(bw - 2).toFixed(1)}" y="${(H - 14 - (c / bmax) * (H - 30)).toFixed(1)}" height="${((c / bmax) * (H - 30)).toFixed(1)}"/>` : "").join("");
    }
    if (pool.length >= 3) {
      const ys = [];
      for (let v = 0; v <= 700; v += 7) ys.push([v, pool.reduce((a, r) => a + Math.exp(-(((v - r.yards) / 30) ** 2) / 2), 0)]);
      const top = Math.max(...ys.map(([, y]) => y)) || 1, Y = (y) => H - 14 - (y / top) * (H - 26);
      const pts = ys.map(([v, y]) => `${X(v).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
      curve += `<polyline class="sc-line" points="${pts}"/>`;
    }
    const ticks = [0, 100, 200, 300, 400, 500, 600, 700].map((v) => `<line class="sc-tick" x1="${X(v)}" x2="${X(v)}" y1="${H - 14}" y2="${H - 10}"/><text class="sc-tl" x="${X(v)}" y="${H - 1}">${v}</text>`).join("");
    const you = `<line class="sc-you" x1="${X(tot)}" x2="${X(tot)}" y1="10" y2="${H - 14}"/><circle class="sc-you-dot" cx="${X(tot)}" cy="10" r="3.5"/><text class="sc-you-t" x="${X(tot)}" y="7" text-anchor="${tot > 620 ? "end" : tot < 80 ? "start" : "middle"}">YOU</text>`;
    const place = others.filter((r) => r.yards > tot).length + 1, nth_ = (n) => n + (["th", "st", "nd", "rd"][(n % 100 >> 3 ^ 1) && n % 10] || "th");
    const replay = !practice && round.row && firstOnly(round.set || "classes") && firstRowOf(me.player, round.set || "classes") !== round.row;
    const rank = replay ? `practice round: only your first ${esc(R.title)} round counts on the leaderboard`
      : pct == null ? (practice ? "practice round" : `first ${esc(R.title)} round on the board`)
      : others.length < 9 ? `${nth_(place)} of ${others.length + 1} ${scope} ${esc(R.title)} rounds`
      : `longer than ${pct}% of ${scope} ${esc(R.title)} rounds`;
    // Huck log: 7 lanes on a mini field; a throw flies up its lane as far as its points (100 = the end zone).
    const FH = 150, FW = 320, lane = FW / 7, LY = (pts) => FH - 18 - (Math.min(100, pts) / 100) * (FH - 40);
    const lines = [0, 25, 50, 75, 100].map((v) => `<line class="hl-yd${v === 100 ? " ez" : ""}" x1="0" x2="${FW}" y1="${LY(v)}" y2="${LY(v)}"/>`).join("");
    const throws = res.map((r, k) => {
      const t = r.tier && T[r.tier], cx = lane * k + lane / 2, y = LY(r.pts), c = t ? t.color : "var(--graphite)";
      return `<line class="hl-path" x1="${cx}" x2="${cx}" y1="${FH - 18}" y2="${y}" style="stroke:${c}"/>
        <circle class="hl-disc" cx="${cx}" cy="${y}" r="6" style="fill:${c}"/>
        <text class="hl-pts" x="${cx}" y="${y - 10}">${r.pts}</text>
        <text class="hl-k" x="${cx}" y="${FH - 4}">${k + 1}</text>`;
    }).join("");
    const legend = [...new Set(res.filter((r) => r.tier).map((r) => r.tier))]
      .sort((a, b) => T[b].pts - T[a].pts).map((k) => `<span><i style="background:${T[k].color}"></i>${esc(T[k].label)}</span>`).join("");
    return `<section class="scorecard" aria-label="result card">
      <div class="sc-head"><span>BATCHILLION #${dayNum()}</span><span>${esc(R.title.toUpperCase())}${nth > 0 ? ` · ROUND ${nth}` : ""}</span></div>
      <div class="sc-score"><b>${tot}</b><span>yds</span></div>
      <p class="sc-verdict">${esc(verdict)}</p>
      <svg class="sc-dist" viewBox="0 0 ${W} ${H}" role="img" aria-label="${rank}">${curve}<line class="sc-axis" x1="${X(0)}" x2="${X(700)}" y1="${H - 14}" y2="${H - 14}"/>${ticks}${you}</svg>
      <p class="sc-rank">${rank}</p>
      <div class="sc-logh"><span>HUCK LOG</span><span>farther = rarer</span></div>
      <svg class="sc-log" viewBox="0 0 ${FW} ${FH}" role="img" aria-label="your seven throws">${lines}${throws}</svg>
      ${legend ? `<div class="sc-legend">${legend}</div>` : ""}
      <div class="sc-foot">${esc((location.host + location.pathname).replace(/\/$/, ""))}</div>
    </section>`;
  }

  const SQUARES = { debris: "🟤", plankton: "⬜", clever: "🟫", schooler: "🟦", rare: "🟥", deep: "🟪", krillion: "🟨" };

  function finish(row, practiceAnswers = null, practiceSet = "classes") {
    const h = practiceAnswers ? null : history(me.player);
    const round = practiceAnswers ? { set: practiceSet, answers: practiceAnswers, results: scoreRound(practiceAnswers, new Set(), practiceSet) }
      : h.rounds.find((x) => x.row === row) || h.rounds.filter((x) => x.date === dayKey).pop() || { answers: [], results: [] };
    const R = setOf(round.set), PR = R.prompts;
    const res = round.results.map((r, k) => ({ ...r, a: round.answers[k] || {}, k }));
    resetField(round.results);
    const tot = sum(round.results);
    const verdict = VERDICTS.find(([m]) => tot >= m)[1];
    const today = h ? todayOf(h) : { rounds: [], yards: tot };
    const left = h ? people.filter((p) => !h.used.has(p.key)).length : people.length;
    const nth = h ? today.rounds.findIndex((x) => x.row === round.row) + 1 : 1;
    const myAppeal = remote.appeals.find((a) => a.date === dayKey && norm(a.player) === norm(me.player));
    const url = location.origin + location.pathname;
    const share = `Batchillion #${dayNum()} 🥏 ${tot} yds\n${res.map((r) => (r.tier ? SQUARES[r.tier] : "⬛")).join("")}\n${url}`;
    const appealable = (r) => !practiceAnswers && !myAppeal && !r.person && r.a.typed && norm(r.a.typed).replace(/ /g, "").length >= 2 && !candidates(r.a.typed).length;
    const st = h ? streak(me.player) : 0;
    show(`
      <div class="card">
        ${scorecard({ tot, verdict, R, res, round, nth })}
        ${st ? `<p class="kicker">STREAK ${st}</p>` : ""}
        ${h ? `<p class="hint">Today: ${today.rounds.length} round${today.rounds.length === 1 ? "" : "s"}, ${today.yards} yards. ${left ? `${left} teammate${left > 1 ? "s" : ""} left for you in Players.` : "You've used every teammate in Players."} ${spends(round.set) ? "" : "Stat sheets: any name, once per round."}</p>` : ""}
        <details class="answers"><summary>your answers</summary>
        <ul class="recap">${res.map((r) => {
          const t = r.tier && T[r.tier];
          const ap = myAppeal && Number(myAppeal.prompt) === r.k ? `<span class="pending">appeal ${myAppeal.tier ? (myAppeal.tier === "reject" ? "rejected" : "ranked") : "pending"}</span>` : "";
          return `<li style="--c:${t ? t.color : "var(--graphite)"}">
            <div><div class="q">${esc(PR[r.k].tierOf ? PR[r.k].short : PR[r.k].text)}</div>
            <div class="a">${esc(r.person ? r.person.full : r.a.typed || "no answer")} <span class="tag">${t ? esc(t.label) : esc(r.status)}</span> ${ap}</div>
            ${appealable(r) ? `<button class="chip" data-appeal="${r.k}" type="button">appeal this name</button>` : ""}</div>
            <div class="p">${r.pts}</div></li>`;
        }).join("")}</ul></details>
        ${res.some(appealable) ? `<p class="hint">You get one appeal a day. ${esc(window.APPEAL_WHO)} ranks it and your score updates.</p>` : ""}
        <div class="row">
          ${!R.retired && (left || !spends(round.set)) ? `<button class="btn" id="again" type="button">another ${esc(R.title.toLowerCase())}</button>` : ""}
          <button class="btn ghost" id="rounds" type="button">pick a round</button>
          <button class="btn ghost" id="share" type="button">share</button>
          <button class="btn ghost" id="lb" type="button">leaderboard</button>
        </div>
      </div>`);
    stage.querySelectorAll("[data-appeal]").forEach((b) => (b.onclick = async () => {
      const k = +b.dataset.appeal;
      b.disabled = true; b.textContent = "sending…";
      const r = await post({ action: "appeal", date: dayKey, player: me.player, token: me.token, prompt: k, typed: round.answers[k].typed });
      if (!r.ok) { toast(r.error); b.textContent = "appeal this name"; b.disabled = false; return; }
      toast(API ? `appeal sent to ${window.APPEAL_WHO}` : "saved locally (backend not connected yet)");
      await pull(true); buildRoster(); finish(row, practiceAnswers, practiceSet);
    }));
    $("#share").onclick = async () => {
      if (navigator.share) { try { await navigator.share({ text: share }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      try { await navigator.clipboard.writeText(share); toast("copied"); }
      catch { const ta = document.createElement("textarea"); ta.value = share; stage.querySelector(".card-scroll").appendChild(ta); ta.select(); toast("select and copy"); }
    };
    $("#lb").onclick = () => board("today", round.set || "classes");
    if ($("#again")) $("#again").onclick = () => (practiceAnswers ? home() : startRound($("#again"), round.set || "classes"));
    $("#rounds").onclick = () => home();
  }

  // ---------- leaderboard ----------
  // ---------- leaderboard (a modal, like how to play) ----------
  // Opens over whatever screen is up, so it never interrupts a prompt; the clock keeps running.
  // One leaderboard per round type (Players, Stat sheet I, ...), each with today and all-time best.
  let boardSet = "classes";
  async function board(view = "today", set = boardSet) {
    boardSet = set;
    const dlg = $("#board"), body = $("#boardBody");
    $("#boardSub").textContent = `BATCHILLION #${dayNum()}${API ? "" : " · LOCAL ONLY"}`;
    if (!dlg.open) { body.innerHTML = `<p class="hint">loading…</p>`; dlg.showModal(); }
    if (!(await pull())) {
      body.innerHTML = `<p class="hint">Can't reach the leaderboard right now.</p><div class="row"><button class="btn ghost" id="lbRetry" type="button">try again</button></div>`;
      $("#lbRetry").onclick = () => board(view, set); return;
    }
    buildRoster();
    // One row per finished round (not per player): best single rounds win. Today = rounds thrown today.
    let list = allRounds().filter((r) => r.set === set && !r.practice);
    if (view === "today") list = list.filter((r) => r.isToday);
    list.sort((a, b) => b.yards - a.yards || a.name.localeCompare(b.name));
    list = list.slice(0, 50);
    const when = (r) => { if (r.isToday) return `round ${r.nth} today`; const [y, m, d] = dayParts(r.date); return `#${dayIndex(r.date) - FIRST + 1} · ${m}/${d}`; };
    let rank = 0;
    const rows = list.map((r, i) => {
      if (i === 0 || r.yards !== list[i - 1].yards) rank = i + 1;
      const meRow = me && norm(r.name) === norm(me.player);
      return `<li class="${meRow ? "me" : ""}"><span class="rk">${rank}</span><span class="nm">${esc(r.name)}${meRow ? " (you)" : ""}</span><span class="sc">${r.yards}</span><span class="rd">${when(r)}</span></li>`;
    }).join("");
    $("#boardTabs").innerHTML = `
      <div class="row lb-sets">${[...openRounds(), ...unlocked().filter((r) => r.retired)].map((r) => `<button class="chip${r.id === set ? " on" : ""}" data-s="${r.id}" type="button" aria-pressed="${r.id === set}">${esc(r.title)}${r.retired ? " (retired)" : ""}</button>`).join("")}</div>
      <div class="row">
        <button class="btn ${view === "today" ? "" : "ghost"}" data-v="today" type="button" aria-pressed="${view === "today"}">today</button>
        <button class="btn ${view === "all" ? "" : "ghost"}" data-v="all" type="button" aria-pressed="${view === "all"}">all-time best</button>
      </div>`;
    body.innerHTML = list.length ? `<p class="hint">${esc(setOf(set).title)}: best single rounds, in yards</p><ol class="board">${rows}</ol>` : `<p class="hint">${view === "today" ? `nobody has finished a ${esc(setOf(set).title)} round today. be first.` : `no ${esc(setOf(set).title)} rounds yet.`}</p>`;
    dlg.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => board(b.dataset.v, set)));
    dlg.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => board(view, b.dataset.s)));
  }
  // Guarded: during a deploy a cached older page can lack this button, and a crash here would blank the game.
  if ($("#boardAdmin")) $("#boardAdmin").onclick = () => { $("#board").close(); admin(); };

  // ---------- admin: rank appeals ----------
  async function admin() {
    const key = sessionStorage.getItem("bh:admin") || "";
    if (!key) {
      show(`
        <div class="card"><p class="kicker">ADMIN</p><p class="prompt">Sign in to rank appeals</p>
        <form id="kf" class="row"><input type="password" id="kk" placeholder="admin password" aria-label="admin password" autocomplete="current-password"><button class="btn" type="submit">sign in</button></form>
        <p class="hint" id="km" aria-live="polite"></p><div class="row"><button class="btn ghost" id="back" type="button">back</button></div></div>`);
      $("#kk").focus();
      $("#back").onclick = () => home();
      $("#kf").onsubmit = async (e) => {
        e.preventDefault();
        const r = await post({ action: "login", key: $("#kk").value });
        if (!r.ok) { $("#km").textContent = r.error; return; }
        sessionStorage.setItem("bh:admin", $("#kk").value); admin();
      };
      return;
    }
    if (!(await pull())) return offlineCard(admin);
    buildRoster();
    const byName = {};
    remote.appeals.forEach((a) => {
      const k = norm(a.typed); if (!k) return;
      const it = (byName[k] = byName[k] || { typed: a.typed, tier: a.tier, year: a.year, from: [] });
      it.from.push(`${a.player} (${P[a.prompt] ? P[a.prompt].text.replace("who started university in ", "") : "?"})`);
    });
    const items = Object.values(byName).sort((a, b) => (a.tier ? 1 : 0) - (b.tier ? 1 : 0));
    show(`
      <div class="card"><p class="kicker">ADMIN · APPEALS · ${items.filter((x) => !x.tier).length} PENDING</p>
      ${items.length ? items.map((it, i) => `
        <div class="appeal${it.tier ? " done" : ""}">
          <p class="who">${esc(it.typed)} <span class="pending">${it.tier ? (it.tier === "reject" ? "rejected" : `${T[it.tier] ? esc(T[it.tier].label) : esc(it.tier)} · ${esc(it.year)}`) : "pending"}</span></p>
          <p class="q">appealed by ${esc(it.from.join(", "))}</p>
          <div class="row"><input type="text" class="yr" data-i="${i}" placeholder="start year: 2024, or 2022/2023" value="${esc(it.year)}" aria-label="start year for ${esc(it.typed)}"></div>
          <div class="chips">${Object.entries(T).map(([id, t]) => `<button class="chip tierchip" style="--c:${t.color}" data-i="${i}" data-t="${id}" type="button">${esc(t.label)}</button>`).join("")}<button class="chip" data-i="${i}" data-t="reject" type="button">reject</button></div>
        </div>`).join("") : `<p class="hint">no appeals yet.</p>`}
      <div class="row"><button class="btn ghost" id="back" type="button">back</button><button class="linkish" id="kout" type="button">admin sign out</button></div></div>`);
    $("#back").onclick = () => home();
    $("#kout").onclick = () => { sessionStorage.removeItem("bh:admin"); home(); };
    stage.querySelectorAll("[data-t]").forEach((b) => (b.onclick = async () => {
      const it = items[+b.dataset.i], year = stage.querySelector(`.yr[data-i="${b.dataset.i}"]`).value.trim();
      if (b.dataset.t !== "reject" && !yearsOf(year).length) return toast("add a start year first");
      b.disabled = true;
      const r = await post({ action: "rank", key, typed: it.typed, tier: b.dataset.t, year });
      if (!r.ok) { b.disabled = false; if (r.error === "wrong password") sessionStorage.removeItem("bh:admin"); return toast(r.error); }
      toast(b.dataset.t === "reject" ? `${it.typed} rejected` : `${it.typed} → ${T[b.dataset.t].label}, added to the roster`); admin();
    }));
  }

  // A tab left open past midnight can't score the old day.
  // A tab left open past midnight moves to the new day, but never in the middle of a round: a
  // round already under way finishes and is sent under its own day (the server allows 15 minutes).
  setInterval(() => {
    if (etKey() === dayKey || document.querySelector("#in, #next")) return;
    if (me && !practice && (ls.get(draftKey(), null) || ls.get(clockKey(), null))) return;
    dayKey = etKey(); paintDay(); home();
  }, 60000);

  // GitHub Pages lets browsers keep an old copy of the page for ~10 minutes after a deploy, which mixes
  // old and new files. If the live page is newer than this one, reload once to pick it up.
  (async () => {
    const mine = document.querySelector('meta[name="bh-version"]')?.content;
    if (!mine || location.protocol === "file:") return;
    try {
      const html = await (await fetch(location.pathname + "?nc=" + Date.now(), { cache: "no-store" })).text();
      const live = (html.match(/name="bh-version" content="([^"]+)"/) || [])[1];
      const key = "bh:reloaded:" + live;
      if (live && live !== mine && !sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); location.reload(); }
    } catch {}
  })();

  home();
})();
