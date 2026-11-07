/**
 * Batchillion backend: a Google Apps Script web app that stores accounts, rounds and appeals in
 * this spreadsheet and serves them to the game as JSON.
 *
 * Setup (once, about 3 minutes):
 *   1. Create a new Google Sheet named "Batchillion".
 *   2. Extensions > Apps Script. Replace the editor contents with this file. Save.
 *   3. Project Settings (gear) > Script properties > Add property
 *        ADMIN_KEY = a long password you choose. Never put it in the website code.
 *   4. Deploy > New deployment > type "Web app".
 *        Execute as: Me.   Who has access: Anyone.
 *      Authorize when asked (it needs this sheet and permission to email you about appeals).
 *   5. Copy the /exec URL into roster.js as window.BACKEND_URL, then push the site.
 *   After editing this file later: Deploy > Manage deployments > edit > Version: New version.
 *
 * Ranking an appeal: open the site, click "leaderboard" then "admin", sign in with ADMIN_KEY, and
 * pick a tier and start year for each appeal (or reject it). You can also type them into the
 * "appeals" tab: tier = plankton, clever, schooler, rare, deep, krillion or reject; year = 2024
 * or 2022/2023. Everyone who typed that name gets the points on their next page load.
 */
const ZONE = "America/New_York";
const PROMPTS = 7;
const TABS = {
  plays: ["date", "player", "answers", "startedAt", "submittedAt"],
  appeals: ["date", "player", "prompt", "typed", "tier", "year", "submittedAt"],
  accounts: ["player", "salt", "hash", "token", "createdAt"],
};

// ---------- sheet helpers ----------
function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(TABS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), 4).setNumberFormat("@"); // dates and names stay plain text
  }
  return sh;
}
function rows_(name) {
  const v = sheet_(name).getDataRange().getValues();
  const head = v.shift();
  return v.map((r, i) => Object.assign({ _row: i + 2 }, Object.fromEntries(head.map((h, j) => [h, r[j]]))))
    .filter((r) => String(r[head[0]]) !== "");
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
const norm_ = (s) => String(s || "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
// Anything a player types is stored as text, never as a formula.
const cell_ = (s) => { s = String(s == null ? "" : s); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
// Sheets may still turn a typed date into a Date object; read both shapes back as "yyyy-M-d".
const day_ = (v) => (v instanceof Date ? Utilities.formatDate(v, ZONE, "yyyy-M-d") : String(v || "").trim());
const today_ = () => Utilities.formatDate(new Date(), ZONE, "yyyy-M-d");
const yesterday_ = () => Utilities.formatDate(new Date(Date.now() - 864e5), ZONE, "yyyy-M-d");
const parse_ = (s) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };

// A round belongs to the day it was played. A round started just before midnight may still be
// sent in the first 15 minutes of the next day.
function dayOk_(date) {
  if (date === today_()) return true;
  const now = new Date();
  const mins = Number(Utilities.formatDate(now, ZONE, "H")) * 60 + Number(Utilities.formatDate(now, ZONE, "m"));
  return date === yesterday_() && mins < 15;
}

// ---------- accounts ----------
// Passwords are never stored: only a salted SHA-256 hash. Any password is allowed, even blank.
function hash_(salt, pw) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "|" + pw));
}
function account_(player) {
  const k = norm_(player);
  if (!k) return null;
  const v = sheet_("accounts").getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (norm_(v[i][0]) === k) return { row: i + 1, name: String(v[i][0]), salt: v[i][1], hash: v[i][2], token: v[i][3] };
  return null;
}

// ---------- rounds ----------
// Keep only the fields the game uses, and enforce the never-reuse rule here too: a full name the
// player already threw on an earlier day, or earlier in this round, is stored as "reused".
function cleanAnswers_(answers, player, date, plays) {
  const used = new Set();
  plays.filter((r) => norm_(r.player) === norm_(player) && day_(r.date) !== date)
    .forEach((r) => parse_(r.answers).forEach((a) => a && a.full && used.add(norm_(a.full))));
  return answers.slice(0, PROMPTS).map((a) => {
    a = a && typeof a === "object" ? a : {};
    const typed = String(a.typed || "").slice(0, 60), full = a.full ? String(a.full).slice(0, 60) : null;
    if (full && used.has(norm_(full))) return { typed: "", full: null, reused: full };
    if (full) used.add(norm_(full));
    return { typed, full };
  });
}

// GET: everything the game needs. All rounds (for the leaderboard and the never-reuse rule), all
// appeals (ranked ones become roster additions), and today's date in Eastern time.
function doGet() {
  const plays = rows_("plays").map((r) => ({ date: day_(r.date), player: String(r.player), answers: parse_(r.answers) }));
  const appeals = rows_("appeals").map((r) => ({
    date: day_(r.date), player: String(r.player), prompt: Number(r.prompt), typed: String(r.typed),
    tier: String(r.tier || "").trim().toLowerCase(), year: String(r.year || "").trim(),
  }));
  return json_({ ok: true, today: today_(), now: Date.now(), plays, appeals });
}

// POST (text/plain body with JSON): {action, ...}
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: "busy, try again" });
  try {
    let b;
    try { b = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { return json_({ ok: false, error: "bad request" }); }

    // Admin: check the password, or rank one appeal. Five wrong guesses a minute locks it briefly.
    if (b.action === "login" || b.action === "rank") {
      const cache = CacheService.getScriptCache(), slot = "fails" + Utilities.formatDate(new Date(), ZONE, "yyyyMMddHHmm");
      const fails = Number(cache.get(slot) || 0);
      const key = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY");
      const ok = !!key && String(b.key || "") === key;   // the right key always works, even during a lockout
      if (!ok) {
        if (fails >= 5) return json_({ ok: false, error: "too many tries. wait a minute" });
        cache.put(slot, String(fails + 1), 120);
        return json_({ ok: false, error: "wrong password" });
      }
      if (b.action === "login") return json_({ ok: true });
      const tier = String(b.tier || "").toLowerCase();
      if (["plankton", "clever", "schooler", "rare", "deep", "krillion", "reject"].indexOf(tier) < 0) return json_({ ok: false, error: "bad tier" });
      const year = String(b.year || "").trim();
      if (tier !== "reject" && !/^\d{4}([\/, ]+\d{4})*$/.test(year)) return json_({ ok: false, error: "year must look like 2024 or 2022/2023" });
      const sh = sheet_("appeals"), head = TABS.appeals;
      let n = 0;
      rows_("appeals").forEach((r) => {   // rank every appeal of the same name at once
        if (norm_(r.typed) !== norm_(b.typed)) return;
        sh.getRange(r._row, head.indexOf("tier") + 1).setValue(tier);
        sh.getRange(r._row, head.indexOf("year") + 1).setNumberFormat("@").setValue(tier === "reject" ? "" : year);
        n++;
      });
      return json_({ ok: true, updated: n });
    }

    // Accounts: anyone can create one; the name is first come, first served.
    if (b.action === "register" || b.action === "signin") {
      const name = String(b.player || "").trim().slice(0, 40), pw = String(b.password || "");
      if (norm_(name).replace(/ /g, "").length < 2) return json_({ ok: false, error: "use at least two letters in your name" });
      const a = account_(name);
      if (b.action === "register") {
        if (a) return json_({ ok: false, error: "that name already has an account. sign in instead" });
        const salt = Utilities.getUuid(), token = Utilities.getUuid();
        sheet_("accounts").appendRow([cell_(name), salt, hash_(salt, pw), token, new Date()]);
        return json_({ ok: true, player: name, token });
      }
      if (!a) return json_({ ok: false, error: "no account", noAccount: true });
      if (hash_(a.salt, pw) !== a.hash) return json_({ ok: false, error: "wrong password" });
      const token = a.token || Utilities.getUuid();   // one token, so every device stays signed in
      if (!a.token) sheet_("accounts").getRange(a.row, 4).setValue(token);
      return json_({ ok: true, player: a.name, token });
    }

    const date = String(b.date || ""), player = String(b.player || "").trim();
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(date) || !player) return json_({ ok: false, error: "bad request" });
    const acct = account_(player);
    if (!acct || !b.token || acct.token !== b.token) return json_({ ok: false, error: "sign in again" });
    const name = acct.name;   // store the account's own spelling of the name

    const plays = rows_("plays");
    const mine = plays.find((r) => day_(r.date) === date && norm_(r.player) === norm_(player));
    const thrown = !!mine && parse_(mine.answers).length > 0;

    // Start: claims today's round the moment the first prompt appears, so a round abandoned in a
    // second browser still counts as today's one round.
    if (b.action === "start") {
      if (date !== today_()) return json_({ ok: false, error: "a new Batchillion is live. reload the page" });
      if (thrown) return json_({ ok: false, error: "already played today" });
      if (mine) return json_({ ok: true, fresh: false });
      sheet_("plays").appendRow([date, cell_(name), "", new Date(), ""]);
      // Marks the round as live for 15 minutes, so opening the site on a second device can't forfeit it.
      CacheService.getScriptCache().put("live:" + norm_(name) + ":" + date, "1", 900);
      return json_({ ok: true, fresh: true });
    }

    if (b.action === "play") {
      if (!dayOk_(date)) return json_({ ok: false, error: "that day is over. a new Batchillion is live" });
      if (thrown) return json_({ ok: false, error: "already played today" });
      if (b.forfeit && mine && CacheService.getScriptCache().get("live:" + norm_(name) + ":" + date))
        return json_({ ok: false, error: "round in progress on another device", live: true });
      if (!Array.isArray(b.answers) || b.answers.length !== PROMPTS) return json_({ ok: false, error: "bad request" });
      const answers = JSON.stringify(cleanAnswers_(b.answers, player, date, plays));
      const sh = sheet_("plays");
      if (mine) { sh.getRange(mine._row, 3).setValue(answers); sh.getRange(mine._row, 5).setValue(new Date()); }
      else sh.appendRow([date, cell_(name), answers, new Date(), new Date()]);
      return json_({ ok: true });
    }

    // Appeal: one a day, only for a name this player actually threw today that matched nobody.
    if (b.action === "appeal") {
      if (!dayOk_(date)) return json_({ ok: false, error: "that day is over" });
      const k = Number(b.prompt), typed = String(b.typed || "").trim().slice(0, 60);
      if (!(k >= 0 && k < PROMPTS && Math.floor(k) === k) || norm_(typed).replace(/ /g, "").length < 2) return json_({ ok: false, error: "bad request" });
      const ans = mine ? parse_(mine.answers)[k] : null;
      if (!ans || ans.full || norm_(ans.typed) !== norm_(typed)) return json_({ ok: false, error: "you can only appeal a name you threw today" });
      if (rows_("appeals").some((r) => day_(r.date) === date && norm_(r.player) === norm_(player))) return json_({ ok: false, error: "one appeal per day" });
      sheet_("appeals").appendRow([date, cell_(name), k, cell_(typed), "", "", new Date()]);
      try {
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(),   // the sheet owner (the script runs as them)
           `Batchillion appeal: ${typed}`,
          `${name} appealed "${typed}" for prompt ${k + 1} on ${date}.\n\n` +
          `Rank it on the site (leaderboard > admin) or in the appeals tab: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`);
      } catch (err) { /* the appeal is saved even if the email quota is used up */ }
      return json_({ ok: true });
    }
    return json_({ ok: false, error: "unknown action" });
  } finally {
    lock.releaseLock();
  }
}
