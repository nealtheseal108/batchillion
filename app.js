(() => {
  const SECONDS = 30;
  const ZONE = "America/New_York"; // the day flips at midnight Eastern for everyone
  const $ = (s) => document.querySelector(s);
  const stage = $("#stage");
  const API = window.BACKEND_URL || "";
  const T = window.TIERS, P = window.PROMPTS;

  // ---------- helpers ----------
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const yearsOf = (y) => (Array.isArray(y) ? y : String(y || "").split(/[\/, ]+/).map(Number).filter(Boolean));
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
    ...p, row: p.row ?? i + 1, answers: Array.isArray(p.answers) ? p.answers : [], done: p.done ?? (Array.isArray(p.answers) && p.answers.length >= 7),
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
      let open = plays.find((p) => p.date === b.date && norm(p.player) === norm(b.player) && !p.done);
      if (!open) { open = { row: plays.length + 1, date: b.date, player: b.player, answers: [], done: false }; plays.push(open); ls.set("bh:plays", plays); }
      return { ok: true, row: open.row, answers: open.answers };
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
  const exactOf = (text) => { const k = norm(text); return k ? people.find((p) => p.key === k) : undefined; };
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
    if (q.length < 4) return [];
    return people.filter((p) => lev(q, p.key) <= 1 || (!multi && p.first.length >= 4 && lev(q, p.first) <= 1));
  }
  const byValue = (x, y) => T[x.tier].pts - T[y.tier].pts || x.full.localeCompare(y.full);

  // ---------- scoring ----------
  // One answer against today's roster (so ranked appeals apply retroactively).
  function score(ans, k) {
    const prompt = P[k];
    if (!prompt || !ans || typeof ans !== "object") return { pts: 0, status: "no answer" };
    const p = exactOf(ans.full || ans.typed);
    if (!p) return { pts: 0, status: ans.reused ? `${ans.reused} was already used` : ans.typed ? "not on the list" : "no answer" };
    if (!p.years.some(prompt.test)) return { pts: 0, person: p, status: `wrong class: started ${p.years.join(" or ")}` };
    return { pts: T[p.tier].pts, tier: p.tier, person: p };
  }
  // A round scored against everyone the player had already used. A teammate counts once per
  // player, ever, even when an appeal makes an old answer valid later.
  function scoreRound(answers, used) {
    return (Array.isArray(answers) ? answers.slice(0, P.length) : []).map((a, k) => {
      const r = score(a, k);
      if (!r.person) return r;
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
    playsOf(player).forEach((pl) => { const before = new Set(used); rounds.push({ row: pl.row, date: pl.date, done: pl.done, answers: pl.answers, before, results: scoreRound(pl.answers, used) }); });
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
  // One scale everywhere: every point moves the disc 0.7 yards, so 100 points is exactly the 70-yard field
  // (caught on the far goal line). The field's line markers count in points, matching the score.
  const PER_PT = FIELD / 100, LINE = 10 * PER_PT;            // a marker every 10 points
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
    for (let b = Math.floor(offset / LINE - 1e-6); b * LINE < offset + FIELD; b++) // a turf band per 10 points
      turf += `<rect x="${xAt(b * LINE)}" y="0" width="${LINE * YD + 0.5}" height="300" class="${b % 2 ? "band-b" : "band-a"}"/>`;
    for (let n = Math.ceil(offset / LINE - 1e-6); n * LINE < offset + FIELD - 1e-6; n++) {
      const y = n * LINE;
      if (Math.abs(y - offset) < 1e-6) continue;
      const x = xAt(y), label = n * 10;                     // running points at this marker
      lines += `<line x1="${x}" y1="0" x2="${x}" y2="300"/>` + (y <= offset + FIELD - room * PER_PT * 1.4 ? `<text x="${x + 6}" y="${ly}">${label}</text>` : "");
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
    if (draft && draft.row) return play(draft.answers || [], draft.row);   // a round in progress on this device
    resetField();
    const h = history(me.player), st = streak(me.player), today = todayOf(h);
    const left = people.filter((p) => !h.used.has(p.key)).length;
    show(`
      <div class="card">
        <p class="kicker">BATCHILLION #${dayNum()}${practice ? " · PRACTICE" : ""}${st ? ` · STREAK ${st}` : ""}</p>
        <p class="prompt">You're up, <em>${esc(me.player)}</em>. Name one teammate per class. The rarer the pick, the deeper the huck.</p>
        <p class="hint">${today.rounds.length ? `Today: ${today.rounds.length} round${today.rounds.length > 1 ? "s" : ""}, ${today.yards} yards. ` : ""}${left ? `${left} teammate${left > 1 ? "s" : ""} left for you. Play as many rounds as you want; every name you use is gone for good.` : "You've used every teammate. Nobody left to throw to."}</p>
        <div class="row">
          <button class="btn" id="go" type="button" ${left ? "" : "disabled"}>${today.rounds.length ? "pull again" : "pull"}</button>
          <button class="btn ghost" id="out" type="button">not ${esc(me.player)}? sign out</button>
        </div>
      </div>`);
    $("#go").focus();
    $("#go").onclick = () => startRound($("#go"));
    $("#out").onclick = signOut;
  }

  // Opens a round on the server (or picks up one left open), then plays it.
  async function startRound(btn) {
    if (practice) return play([], 0);
    if (btn) btn.disabled = true;
    // iOS only raises the keyboard for focus() inside the tap itself, so hold it with a stand-in box.
    const proxy = Object.assign(document.createElement("input"), { type: "text" });
    proxy.style.cssText = "position:fixed;top:0;left:0;opacity:0;height:0;font-size:16px";
    document.body.appendChild(proxy); proxy.focus();
    const r = await post({ action: "start", date: dayKey, player: me.player, token: me.token });
    if (!r.ok) {
      proxy.remove();
      if (r.error === "sign in again") return signOut();
      if (r.net) return offlineCard(home);
      toast(r.error); return home();
    }
    const st = { row: r.row, answers: Array.isArray(r.answers) ? r.answers : [] };
    ls.set(draftKey(), st); ls.del(clockKey());
    play(st.answers, st.row); proxy.remove();
  }

  // ---------- one prompt ----------
  function play(answers, row) {
    const i = answers.length;
    if (i >= P.length) return submitRound(answers, row);
    const prior = practice ? new Set() : usedBefore(me.player, row);
    const results = scoreRound(answers, new Set(prior));
    const used = new Set(prior); results.forEach((r) => r.person && used.add(r.person.key));
    resetField(results);
    // The clock lives in storage, so reloading mid-prompt does not buy a fresh 30 seconds.
    let clock = practice ? null : ls.get(clockKey(), null);
    if (!clock || clock.i !== i || clock.row !== row) { clock = { row, i, t0: Date.now() }; if (!practice) ls.set(clockKey(), clock); }
    const deadline = clock.t0 + SECONDS * 1000;
    let locked = false, lastReject = "";
    const left = people.filter((p) => p.years.some(P[i].test) && !used.has(p.key)).length;
    show(`
      <div class="card">
        <p class="kicker">PROMPT ${i + 1} / ${P.length} · ${left} LEFT FOR YOU</p>
        <p class="prompt">Name a BatCH teammate <em>${esc(P[i].text)}</em></p>
        <div class="clock" id="clk"><span class="secs" id="secs">${SECONDS}</span><div class="timer" id="tm"><i></i></div></div>
        <form class="row" id="f" autocomplete="off">
          <input type="text" id="in" placeholder="name…" aria-label="teammate name" autocapitalize="words" autocorrect="off" spellcheck="false" maxlength="60">
          <button class="btn" type="submit">huck it</button>
        </form>
        <div class="hint" id="hint" aria-live="polite"></div>
      </div>`);
    const input = $("#in"), hint = $("#hint");
    if (!left) hint.textContent = "nobody left in this class for you. try a name you know is missing (you can appeal it), or wait for the buzzer.";
    input.focus();
    // No hints while typing: autocorrect only happens when the player presses enter.
    input.oninput = () => { hint.textContent = ""; };

    function tick() {
      const bar = $("#tm i"); if (!bar) return stopTimer();
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      bar.style.width = `${(left / SECONDS) * 100}%`;
      $("#secs").textContent = left;
      $("#clk").classList.toggle("low", left <= 5);
      if (left <= 0) submit(true);
    }
    $("#f").onsubmit = (e) => { e.preventDefault(); submit(false); };
    stopTimer(); activeTimer = setInterval(tick, 250); tick();

    // Enter either catches or it doesn't. A miss clears the box and the clock keeps running;
    // only a catch (or the buzzer) ends the prompt.
    function drop(msg) { input.value = ""; hint.textContent = msg; input.focus(); }
    function submit(timedOut) {
      if (locked) return;
      const raw = input.value.trim(), ex = exactOf(raw);
      const catches = ex && !used.has(ex.key) && ex.years.some(P[i].test);
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
        if (used.has(ex.key)) return drop(`${ex.full} is already used. ever. pick someone else`);
        if (!catches) return drop(`${ex.full} didn't start ${P[i].short}. try again`);
      }
      locked = true; stopTimer();
      const offRoster = raw && !ex && !candidates(raw).length;
      const ans = catches ? { typed: raw, full: ex.full } : { typed: offRoster ? raw : lastReject, full: null };
      if (!practice) ls.del(clockKey());
      reveal([...answers, ans], sum(results), row);
    }
  }

  // Each throw is saved on the server right away, so a teammate is spent the moment you name them,
  // even if you close the tab mid-round.
  function sendThrows(row, all) {
    if (practice || !row) return Promise.resolve({ ok: true });
    return post({ action: "throw", date: dayKey, player: me.player, token: me.token, row, answers: all });
  }
  async function reveal(all, before, row) {
    const k = all.length - 1, ans = all[k];
    if (!practice) { ls.set(draftKey(), { row, answers: all }); if (all.length < P.length) sendThrows(row, all); }
    const prior = practice ? new Set() : usedBefore(me.player, row);
    const r = scoreRound(all, new Set(prior))[k];
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
        ${t ? `<span class="tier">${esc(t.label)}</span><p class="yds">${t.pts} <small>pts${t.pts >= 100 ? " · caught in the end zone" : ""}</small></p><p class="cap">${esc(cap)}</p>`
            : `<p class="yds">0 <small>pts</small></p><p class="cap">${esc(window.ZERO_CAPTION)}</p><p class="small">${esc(r.status)}${ans.typed && !r.person ? " · you can appeal one name at the end" : ""}</p>`}
        <div class="row"><button class="btn" id="next" type="button">${last ? "see how far you threw it" : "next pull"}</button></div>
      </div>`);
    $("#next").focus();
    $("#next").onclick = () => play(all, row);
  }

  async function submitRound(answers, row) {
    if (practice) return finish(0, answers);
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
    $("#resend").onclick = () => submitRound(answers, row);
  }

  // ---------- recap + appeal ----------
  const VERDICTS = [ // the day's total, on the same 0-700 scale as krillion; lines by Neal
    [450, "the solution to every problem is to huck it and that's what you did"],
    [351, "easy golf"],
    [251, "nate 'mr. consistent' scofield type performance"],
    [151, "do you even come to practice?"],
    [0, "get in mitchell's car on the way to tournaments"],
  ];
  const SQUARES = { plankton: "⬜", clever: "🟫", schooler: "🟦", rare: "🟥", deep: "🟪", krillion: "🟨" };

  function finish(row, practiceAnswers = null) {
    const h = practiceAnswers ? null : history(me.player);
    const round = practiceAnswers ? { answers: practiceAnswers, results: scoreRound(practiceAnswers, new Set()) }
      : h.rounds.find((x) => x.row === row) || h.rounds.filter((x) => x.date === dayKey).pop() || { answers: [], results: [] };
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
        <p class="kicker">BATCHILLION #${dayNum()}${nth > 0 ? ` · ROUND ${nth} TODAY` : ""}${st ? ` · STREAK ${st}` : ""}</p>
        <p class="prompt">You threw it <em>${tot}</em> yards</p>
        <p class="verdict">${esc(verdict)}</p>
        ${h ? `<p class="hint">Today: ${today.rounds.length} round${today.rounds.length === 1 ? "" : "s"}, ${today.yards} yards. ${left ? `${left} teammate${left > 1 ? "s" : ""} left for you.` : "You've used every teammate."}</p>` : ""}
        <ul class="recap">${res.map((r) => {
          const t = r.tier && T[r.tier];
          const ap = myAppeal && Number(myAppeal.prompt) === r.k ? `<span class="pending">appeal ${myAppeal.tier ? (myAppeal.tier === "reject" ? "rejected" : "ranked") : "pending"}</span>` : "";
          return `<li style="--c:${t ? t.color : "var(--graphite)"}">
            <div><div class="q">${esc(P[r.k].text)}</div>
            <div class="a">${esc(r.person ? r.person.full : r.a.typed || "no answer")} <span class="tag">${t ? esc(t.label) : esc(r.status)}</span> ${ap}</div>
            ${appealable(r) ? `<button class="chip" data-appeal="${r.k}" type="button">appeal this name</button>` : ""}</div>
            <div class="p">${r.pts}</div></li>`;
        }).join("")}</ul>
        ${res.some(appealable) ? `<p class="hint">You get one appeal a day. ${esc(window.APPEAL_WHO)} ranks it and your score updates.</p>` : ""}
        <div class="row">
          ${left ? `<button class="btn" id="again" type="button">pull again</button>` : ""}
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
      await pull(true); buildRoster(); finish(row, practiceAnswers);
    }));
    $("#share").onclick = async () => {
      if (navigator.share) { try { await navigator.share({ text: share }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      try { await navigator.clipboard.writeText(share); toast("copied"); }
      catch { const ta = document.createElement("textarea"); ta.value = share; stage.querySelector(".card-scroll").appendChild(ta); ta.select(); toast("select and copy"); }
    };
    $("#lb").onclick = () => board();
    if ($("#again")) $("#again").onclick = () => (practiceAnswers ? home() : startRound($("#again")));
  }

  // ---------- leaderboard ----------
  // ---------- leaderboard (a modal, like how to play) ----------
  // Opens over whatever screen is up, so it never interrupts a prompt; the clock keeps running.
  async function board(view = "today") {
    const dlg = $("#board"), body = $("#boardBody");
    $("#boardSub").textContent = `BATCHILLION #${dayNum()}${API ? "" : " · LOCAL ONLY"}`;
    if (!dlg.open) { body.innerHTML = `<p class="hint">loading…</p>`; dlg.showModal(); }
    if (!(await pull())) {
      body.innerHTML = `<p class="hint">Can't reach the leaderboard right now.</p><div class="row"><button class="btn ghost" id="lbRetry" type="button">try again</button></div>`;
      $("#lbRetry").onclick = () => board(view); return;
    }
    buildRoster();
    // One row per finished round (not per player): best single rounds win. Today = rounds thrown today.
    const names = {};
    remote.plays.forEach((pl) => { names[norm(pl.player)] = names[norm(pl.player)] || pl.player; });
    let list = [];
    Object.values(names).forEach((name) => {
      const h = history(name);
      let nToday = 0;
      h.rounds.forEach((r) => {
        const isToday = r.date === dayKey; if (isToday) nToday++;
        if (r.done || r.answers.length >= P.length) list.push({ name, yards: sum(r.results), date: r.date, isToday, nth: isToday ? nToday : 0 });
      });
    });
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
      <button class="btn ${view === "today" ? "" : "ghost"}" data-v="today" type="button" aria-pressed="${view === "today"}">today</button>
      <button class="btn ${view === "all" ? "" : "ghost"}" data-v="all" type="button" aria-pressed="${view === "all"}">all-time best</button>`;
    body.innerHTML = list.length ? `<p class="hint">best single rounds, in yards</p><ol class="board">${rows}</ol>` : `<p class="hint">${view === "today" ? "nobody has finished a round today. be first." : "no rounds yet."}</p>`;
    dlg.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => board(b.dataset.v)));
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
