// Footer music: the same playlist and player as the World Cup site, through YouTube's IFrame API.
// Fades in and out between songs, prev / play-pause / next / loop-one, skips anything that won't
// embed. Music is on by default: it tries to start right away and, where the browser blocks sound
// until you interact, starts on the first tap or key press. Pausing turns it off for this visit only.
(() => {
  const MUSIC = [
    { id: "K4Fk9Clc12w", title: "Shotput (slowed + reverb)", artist: "Still Woozy" },
    { id: "hb24kZ0fiEA", title: "Flight's Booked", artist: "Drake", start: 55 },
    { id: "1_w9ZtbHj_E", title: "Link Up", artist: "Don Toliver" },
    { id: "nfJReXaXkTY", title: "Passionfruit (slowed + reverb)", artist: "Drake", start: 72 },
    { id: "wTPWI3qkx5c", title: "Heat Waves (8D slowed)", artist: "Glass Animals" },
    { id: "-J2rSm8K9_Y", title: "Babydoll", artist: "Dominic Fike" },
    { id: "ISsxv6i9f_k", title: "Kiss Me More (slowed + reverb)", artist: "Doja Cat & SZA" },
    { id: "y9NPx6NDA6M", title: "Ay No Puedo", artist: "The Marías" },
    { id: "_9hkXCYiEjc", title: "No One Noticed", artist: "The Marías" },
    { id: "U8F5G5wR1mk", title: "tv off", artist: "Kendrick Lamar" },
    { id: "0UPDBODtxzw", title: "Dracula (JENNIE Remix)", artist: "Tame Impala & JENNIE", start: 24 },
  ];
  const MAXVOL = 45, FADE_MS = 2500, FADE_TICK = 80;
  const $ = (s) => document.querySelector(s);
  if (!$("#tunes")) return; // a cached older page without the player: do nothing rather than crash
  // Off lasts for this visit only (Neal: music on by default); the old forever-off setting is dropped.
  try { localStorage.removeItem("bh:music"); } catch {}
  const pref = {
    get() { try { return sessionStorage.getItem("bh:music"); } catch { return null; } },
    set(v) { try { sessionStorage.setItem("bh:music", v); } catch {} },
  };

  let player = null, ready = false, on = false, wanted = false, idx = 0, repeatOne = false, fadeTimer = null, endWatch = null;

  // ---- Listens: one listen = a minute or more of real playing time in one play of a song (pauses
  // don't count, skipping or reloading before a minute doesn't count; a looped repeat needs another
  // minute). Shared counts live on the backend ("listen" action); with no backend, in this browser.
  const LISTEN_MS = window.BH_FAST ? 3000 : 60000;
  const API = window.BACKEND_URL || "";
  let playMs = 0, counted = false, lastTick = 0;
  const clientId = (() => {
    try { let c = localStorage.getItem("bh:client"); if (!c) { c = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("bh:client", c); } return c; }
    catch { return "anon"; }
  })();
  const localCounts = () => { try { return JSON.parse(localStorage.getItem("bh:listens") || "{}"); } catch { return {}; } };
  function recordListen(song) {
    if (!API) { const c = localCounts(); c[song] = (c[song] || 0) + 1; try { localStorage.setItem("bh:listens", JSON.stringify(c)); } catch {} return; }
    fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "listen", song, client: clientId }) }).catch(() => {});
  }
  function newPlay() { playMs = 0; counted = false; lastTick = 0; }
  setInterval(() => {   // pause-aware: only time while YouTube says the song is playing adds up
    const now = Date.now();
    let playing = false; try { playing = on && player && player.getPlayerState() === 1; } catch {}
    if (playing && lastTick) playMs += Math.min(now - lastTick, 2000);
    lastTick = playing ? now : 0;
    if (playing && !counted && playMs >= LISTEN_MS) { counted = true; recordListen(MUSIC[idx].id); }
  }, 500);

  function paint() {
    const t = MUSIC[idx];
    $("#pbTitle").textContent = t.title;
    $("#pbArtist").textContent = t.artist;
    $("#pbPlay").setAttribute("aria-label", on ? "Pause" : "Play");
    $("#pbPlay").classList.toggle("is-on", on);
    $("#tunes").classList.toggle("playing", on);
    $("#pbLoop").classList.toggle("is-on", repeatOne);
    $("#pbLoop").setAttribute("aria-pressed", String(repeatOne));
  }
  const clearFade = () => { clearInterval(fadeTimer); fadeTimer = null; };
  function fadeTo(target) {
    clearFade();
    let start; try { start = player.getVolume(); } catch { start = target; }
    const steps = Math.max(1, Math.round(FADE_MS / FADE_TICK)); let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      try { player.setVolume(Math.max(0, Math.min(100, start + (target - start) * (i / steps)))); } catch {}
      if (i >= steps) clearFade();
    }, FADE_TICK);
  }
  function armEndWatch() { // fade out into the next song
    clearInterval(endWatch);
    endWatch = setInterval(() => {
      if (!on) return;
      try {
        const d = player.getDuration(), t = player.getCurrentTime();
        if (d > 0 && d - t <= FADE_MS / 1000 + 0.3) { clearInterval(endWatch); endWatch = null; fadeTo(0); }
      } catch {}
    }, 300);
  }
  function load(i) {
    idx = (i + MUSIC.length) % MUSIC.length; newPlay();
    wanted = on = true;
    const t = MUSIC[idx];
    try {
      player.unMute(); player.setVolume(0);
      player.loadVideoById(t.start ? { videoId: t.id, startSeconds: t.start } : t.id);
      player.playVideo();
    } catch {}
    paint();
  }
  function start() {
    wanted = true;
    if (!ready || !player) return;
    try {
      player.unMute(); on = true;
      if (player.getPlayerState() !== 2) player.setVolume(0); // fresh start fades in; a resume keeps its volume
      player.playVideo(); fadeTo(MAXVOL); armEndWatch();
    } catch {}
    paint();
  }
  function pause() {
    try { player.pauseVideo(); } catch {}
    on = false; wanted = false; clearFade(); clearInterval(endWatch); endWatch = null; paint();
  }
  const next = () => load(idx + 1);
  function prev() { // well into a song, "previous" restarts it; otherwise go back one
    let restart = false; try { restart = player.getCurrentTime() > 3; } catch {}
    load(restart ? idx : idx - 1);
  }

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player("ythost", {
      videoId: MUSIC[0].id,
      playerVars: { autoplay: 0, playsinline: 1, controls: 0, rel: 0 },
      events: {
        onReady: () => { ready = true; paint(); if (wanted) start(); },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) repeatOne ? load(idx) : next();
          else if (e.data === YT.PlayerState.PLAYING && on) { fadeTo(MAXVOL); armEndWatch(); paint(); }
        },
        onError: () => next(), // skip any song that won't play here
      },
    });
  };

  // Controls
  const tunes = $("#tunes");
  $("#pbPlay").onclick = () => { if (on) { pause(); pref.set("off"); } else { start(); pref.set("on"); } };
  $("#pbNext").onclick = () => { pref.set("on"); next(); };
  $("#pbPrev").onclick = () => { pref.set("on"); prev(); };
  $("#pbLoop").onclick = () => { repeatOne = !repeatOne; paint(); };

  // ---- Most played: the ranking, in a modal like How to play / Leaderboard.
  const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function counts() {
    if (!API) return localCounts();
    try { const d = await (await fetch(API)).json(); return Object.fromEntries((d.listens || []).map((x) => [x.song, x.listens])); }
    catch { return null; }
  }
  async function openSongs() {
    const dlg = $("#songs"), body = $("#songsBody");
    if (!dlg) return;
    body.innerHTML = '<p class="hint">loading…</p>';
    if (!dlg.open) dlg.showModal();
    const c = await counts();
    if (!c) { body.innerHTML = '<p class="hint">Can\'t reach the counts right now.</p>'; return; }
    const list = MUSIC.map((t, i) => ({ ...t, i, n: c[t.id] || 0 })).sort((a, b) => b.n - a.n || a.i - b.i);
    const top = Math.max(1, list[0].n);
    let rank = 0;
    body.innerHTML = '<ol class="songrank">' + list.map((t, k) => {
      if (k === 0 || t.n !== list[k - 1].n) rank = k + 1;
      return `<li><button type="button" class="sr-row" data-i="${t.i}" aria-label="play ${esc(t.title)}"><span class="sr-rk">${rank}</span>`
        + `<span class="sr-txt"><span class="sr-t">${esc(t.title)}</span><span class="sr-a">${esc(t.artist)}</span>`
        + `<span class="sr-bar"><i style="width:${Math.round((t.n / top) * 100)}%"></i></span></span>`
        + `<span class="sr-n">${t.n}</span></button></li>`;
    }).join("") + "</ol>";
    body.querySelectorAll(".sr-row").forEach((b) => (b.onclick = () => { pref.set("on"); if (ready) load(+b.dataset.i); else { idx = +b.dataset.i; start(); } }));
  }
  if ($("#pbRank")) $("#pbRank").onclick = openSongs;

  // On by default: ask to play as soon as the player is ready; browsers that block sound until the
  // first interaction get it on the first tap or key press instead (unless paused this visit).
  if (pref.get() !== "off") {
    wanted = true;
    const first = (e) => {
      document.removeEventListener("pointerdown", first, true); document.removeEventListener("keydown", first, true);
      if (!(e.target && tunes.contains(e.target))) start();
    };
    document.addEventListener("pointerdown", first, true); document.addEventListener("keydown", first, true);
  }

  paint();
})();
