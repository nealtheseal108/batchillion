(() => {
  const SECONDS = 25;
  const START_DAY = new Date(2026, 10, 6); // huck #1 = Nov 6, 2026
  const $ = (s) => document.querySelector(s);
  const stage = $("#stage");

  // ---------- roster ----------
  const people = window.ROSTER.map(([full, tier, year], i) => ({
    id: i, full, tier, year, first: full.split(" ")[0].toLowerCase(), key: full.toLowerCase(),
  }));
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const byFirst = (q) => people.filter((p) => p.first === q);

  // Resolve typed text to roster people. Exact full name wins; a bare first name resolves
  // only when nobody else shares it; "andrew c" narrows by the start of the full name.
  function lookup(text) {
    const q = norm(text);
    if (!q) return [];
    const full = people.filter((p) => p.key === q);
    if (full.length) return full;
    if (!q.includes(" ")) return byFirst(q);
    return people.filter((p) => p.key.startsWith(q));
  }

  // ---------- day + storage ----------
  const today = new Date();
  const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const dayNum = Math.max(1, Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - START_DAY) / 864e5) + 1);
  $("#dayNum").textContent = `HUCK #${dayNum}`;
  const practice = new URLSearchParams(location.search).has("practice");
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("hucks:" + dayKey)); } catch { return null; } },
    set(v) { if (practice) return; try { localStorage.setItem("hucks:" + dayKey, JSON.stringify(v)); } catch {} },
  };

  // Score one saved answer against the CURRENT roster, so an appealed name scores
  // as soon as Neal adds it to roster.js.
  function score(ans, prompt) {
    const hits = ans.pid != null ? [people.find((p) => p.full === ans.full)].filter(Boolean) : lookup(ans.typed);
    if (hits.length !== 1) {
      return { pts: 0, tier: null, status: ans.typed ? (ans.appeal ? "appeal pending" : "not on the roster") : "no answer" };
    }
    const p = hits[0];
    if (!prompt.test(p.year)) return { pts: 0, tier: null, person: p, status: `wrong class: started ${p.year}` };
    return { pts: window.TIERS[p.tier].pts, tier: p.tier, person: p, status: "" };
  }

  // ---------- field ----------
  const X0 = 100, YD = 10; // own goal line at x=100, 10px per yard
  (function drawLines() {
    const g = $("#lines");
    for (let y = 0; y <= 100; y += 10) {
      const x = X0 + y * YD;
      g.insertAdjacentHTML("beforeend", `<line x1="${x}" y1="0" x2="${x}" y2="300"/>`);
      if (y > 0 && y < 100) g.insertAdjacentHTML("beforeend", `<text x="${x + 4}" y="22">${y}</text>`);
    }
  })();
  const disc = $("#disc");
  let laneY = 50;
  function huck(yards, color) {
    return new Promise((done) => {
      const sx = X0, sy = 150;
      const ex = yards >= 100 ? 1150 : X0 + yards * YD;
      const ey = laneY; laneY = laneY >= 250 ? 50 : laneY + 33;
      const cx = (sx + ex) / 2, cy = Math.min(sy, ey) - 40 - yards * 0.9;
      const path = `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`;
      const t0 = performance.now(), dur = 500 + yards * 9;
      (function step(t) {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 2);
        const x = (1 - e) ** 2 * sx + 2 * (1 - e) * e * cx + e * e * ex;
        const y = (1 - e) ** 2 * sy + 2 * (1 - e) * e * cy + e * e * ey;
        disc.setAttribute("cx", x); disc.setAttribute("cy", y);
        if (k < 1) return requestAnimationFrame(step);
        $("#trails").insertAdjacentHTML("beforeend",
          `<path d="${path}" stroke="${color}"/><circle cx="${ex}" cy="${ey}" r="9" fill="${color}"/>`);
        disc.setAttribute("cx", X0); disc.setAttribute("cy", 150);
        done();
      })(t0);
    });
  }
  function redrawTrails(results) {
    $("#trails").innerHTML = ""; laneY = 50;
    results.forEach((r) => {
      if (!r.pts) return;
      const ex = r.pts >= 100 ? 1150 : X0 + r.pts * YD, ey = laneY; laneY = laneY >= 250 ? 50 : laneY + 33;
      const cx = (X0 + ex) / 2, cy = Math.min(150, ey) - 40 - r.pts * 0.9, col = window.TIERS[r.tier].color;
      $("#trails").insertAdjacentHTML("beforeend",
        `<path d="M${X0},150 Q${cx},${cy} ${ex},${ey}" stroke="${col}"/><circle cx="${ex}" cy="${ey}" r="9" fill="${col}"/>`);
    });
  }
  const setTotal = (n) => ($("#total").textContent = n);

  // ---------- legend / how ----------
  $("#legend").innerHTML = Object.values(window.TIERS)
    .map((t) => `<div><b style="background:${t.color}"></b>${t.label} · ${t.pts} yds</div>`).join("");
  $("#howBtn").onclick = () => $("#how").showModal();

  // ---------- screens ----------
  function intro() {
    setTotal(0);
    stage.innerHTML = `
      <div class="card">
        <p class="kicker">HUCK #${dayNum}${practice ? " · PRACTICE" : ""}</p>
        <p class="prompt">Name a BatCH teammate from each starting class. Obvious picks float. <em>Rare ones go deep.</em></p>
        <div class="legend">${$("#legend").innerHTML}</div>
        <div class="row"><button class="btn" id="go" type="button">▶ pull</button></div>
      </div>`;
    $("#go").onclick = () => play([]);
  }

  function play(answers) {
    const i = answers.length;
    if (i === window.PROMPTS.length) return finish(answers);
    const prompt = window.PROMPTS[i];
    let left = SECONDS, picked = null, locked = false;
    stage.innerHTML = `
      <div class="card">
        <p class="kicker">PROMPT ${i + 1} / ${window.PROMPTS.length}</p>
        <p class="prompt">Name a BatCH teammate <em>${prompt.text}</em></p>
        <div class="timer" id="tm"><i></i></div>
        <form class="row" id="f" autocomplete="off">
          <input type="text" id="in" placeholder="first name…" aria-label="teammate name" autofocus>
          <button class="btn" type="submit">huck it</button>
        </form>
        <div class="hint" id="hint"></div>
        <div class="chips" id="chips"></div>
      </div>`;
    const input = $("#in"), hint = $("#hint"), chips = $("#chips");
    input.focus();

    input.oninput = () => {
      picked = null; chips.innerHTML = "";
      const hits = lookup(input.value);
      if (hits.length === 1) hint.textContent = `↵ ${hits[0].full}`;
      else if (hits.length > 1) {
        hint.textContent = "more than one teammate has that name, pick one:";
        chips.innerHTML = hits.map((p) => `<button type="button" class="chip" data-id="${p.id}">${p.full}</button>`).join("");
        chips.querySelectorAll(".chip").forEach((b) => (b.onclick = () => { picked = people[+b.dataset.id]; submit(); }));
      } else hint.textContent = "";
    };

    const timer = setInterval(() => {
      left -= 1;
      $("#tm i").style.width = `${(left / SECONDS) * 100}%`;
      $("#tm").classList.toggle("low", left <= 5);
      if (left <= 0) submit(true);
    }, 1000);

    function submit(timedOut) {
      if (locked) return;
      const hits = picked ? [picked] : lookup(input.value);
      if (!timedOut && hits.length > 1) { input.oninput(); return; } // make them pick
      locked = true; clearInterval(timer);
      const typed = input.value.trim();
      const ans = hits.length === 1 ? { typed, full: hits[0].full, pid: hits[0].id } : { typed, full: null, pid: null, appeal: false };
      reveal(answers, ans, prompt);
    }
    $("#f").onsubmit = (e) => { e.preventDefault(); submit(false); };
  }

  async function reveal(answers, ans, prompt) {
    const r = score(ans, prompt);
    const all = [...answers, ans];
    store.set({ answers: all, done: all.length === window.PROMPTS.length });
    if (r.pts) await huck(r.pts, window.TIERS[r.tier].color);
    setTotal(all.reduce((s, a, k) => s + score(a, window.PROMPTS[k]).pts, 0));
    const t = r.tier && window.TIERS[r.tier];
    const missing = ans.typed && !r.person;
    stage.innerHTML = `
      <div class="card result">
        <p class="kicker">PROMPT ${answers.length + 1} / ${window.PROMPTS.length}</p>
        <p class="who">${r.person ? r.person.full : ans.typed || "no answer"}</p>
        ${t ? `<span class="tier" style="background:${t.color}">${t.label}</span>
               <p class="yds">${t.pts} yds</p><p class="cap">${typeof t.caption === "function" ? t.caption() : t.caption}</p>`
            : `<p class="yds">0 yds</p><p class="cap">${r.status}</p>`}
        <div class="row">
          ${missing ? `<button class="btn ghost" id="appeal" type="button">appeal to ${window.APPEAL.who}</button>` : ""}
          <button class="btn" id="next" type="button">${answers.length + 1 === window.PROMPTS.length ? "see your hucks" : "next pull"}</button>
        </div>
      </div>`;
    if (missing) $("#appeal").onclick = () => appeal(all, all.length - 1);
    $("#next").onclick = () => play(all);
  }

  function appeal(all, k) {
    all[k].appeal = true;
    store.set({ answers: all, done: all.length === window.PROMPTS.length });
    const body = `BatCH Hucks appeal: "${all[k].typed}" for "${window.PROMPTS[k].text}". Please rank them.`;
    toast("appeal sent. your score updates once they're ranked");
    location.href = `sms:${window.APPEAL.sms}?&body=${encodeURIComponent(body)}`;
    const b = $("#appeal"); if (b) { b.disabled = true; b.textContent = "appeal sent"; }
  }

  function finish(answers) {
    const results = answers.map((a, k) => ({ a, k, ...score(a, window.PROMPTS[k]) }));
    const total = results.reduce((s, r) => s + r.pts, 0);
    setTotal(total); redrawTrails(results);
    store.set({ answers, done: true });
    const squares = { plankton: "⬜", clever: "🟫", schooler: "🟦", rare: "🟥", deep: "🟪", krillion: "🟨" };
    const share = `BatCH Hucks #${dayNum} 🥏 ${total} yds\n` + results.map((r) => (r.tier ? squares[r.tier] : "⬛")).join("");
    stage.innerHTML = `
      <div class="card">
        <p class="kicker">HUCK #${dayNum} · FINAL</p>
        <p class="prompt"><em>${total}</em> yards downfield</p>
        <ul class="recap">${results.map((r) => {
          const t = r.tier && window.TIERS[r.tier];
          return `<li style="--c:${t ? t.color : "#444"}">
            <div><div class="q">${window.PROMPTS[r.k].text}</div>
            <div class="a">${r.person ? r.person.full : r.a.typed || "no answer"} ${t ? "· " + t.label : `<span class="pending">· ${r.status}</span>`}</div></div>
            <div class="p">${r.pts}</div></li>`;
        }).join("")}</ul>
        <div class="row">
          <button class="btn" id="share" type="button">copy result</button>
          ${practice ? `<button class="btn ghost" id="again" type="button">practice again</button>` : ""}
        </div>
      </div>`;
    $("#share").onclick = async () => {
      try { await navigator.clipboard.writeText(share); toast("copied"); }
      catch { prompt("copy this:", share); }
    };
    if (practice) $("#again").onclick = () => { $("#trails").innerHTML = ""; intro(); };
  }

  function toast(msg) {
    const el = document.createElement("div"); el.className = "toast"; el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2400);
  }

  // ---------- boot ----------
  const saved = store.get();
  if (saved && saved.done && !practice) finish(saved.answers);
  else if (saved && saved.answers && saved.answers.length && !practice) play(saved.answers);
  else intro();
})();
