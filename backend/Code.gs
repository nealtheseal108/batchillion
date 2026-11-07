/**
 * Batchillion backend: a Google Apps Script web app that stores accounts, rounds and appeals in
 * this spreadsheet and serves them to the game as JSON.
 *
 * Setup (once, about 3 minutes):
 *   1. Create a new Google Sheet named "Batchillion".
 *   2. Extensions > Apps Script. Replace the editor contents with this file. Save.
 *   3. In the editor pick the function "setup" and press Run. Approve the permissions. It makes
 *      the tabs and prints your admin password (ADMIN_KEY) in the log. Never put it in site code.
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
  // The public roster additions: every approved appeal lands here (and Neal can add rows by hand).
  // tier = plankton, clever, schooler, rare, deep or krillion; year = 2024 or 2022/2023.
  roster: ["name", "tier", "year", "addedAt", "source"],
};

// Run once from the Apps Script editor (select "setup", press Run). It asks for permission,
// creates the three tabs, and, if no admin password exists yet, makes one and prints it in the
// execution log. Change it anytime in Project Settings > Script properties > ADMIN_KEY.
function setup() {
  Object.keys(TABS).forEach(sheet_);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_KEY")) {
    props.setProperty("ADMIN_KEY", Utilities.getUuid().replace(/-/g, "").slice(0, 20));
    console.log("Your Batchillion admin password: " + props.getProperty("ADMIN_KEY"));
  } else console.log("Admin password already set (Project Settings > Script properties).");
  MailApp.getRemainingDailyQuota(); // makes the permission screen include email, for appeal alerts
}

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
// New rows store dates as text (see text_); this only reads older rows that Sheets turned into dates.
let SHEET_TZ_ = null;
const sheetTz_ = () => SHEET_TZ_ || (SHEET_TZ_ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || ZONE);
// Sheets parsed "2026-11-7" as midnight UTC (seen in the live sheet), so a date sitting exactly on a UTC midnight
// is read in UTC; anything else in the sheet's own zone.
const day_ = (v) => {
  if (!(v instanceof Date)) return String(v || "").replace(/^'/, "").trim();
  const utcMidnight = v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0;
  return Utilities.formatDate(v, utcMidnight ? "UTC" : sheetTz_(), "yyyy-M-d");
};
const text_ = (s) => "'" + String(s);   // forces a cell to stay text
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
function cleanAnswers_(answers, player, row, plays) {
  const used = new Set();
  plays.filter((r) => norm_(r.player) === norm_(player) && r._row !== row)
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
  const plays = rows_("plays").map((r) => ({ row: r._row, date: day_(r.date), player: String(r.player), answers: parse_(r.answers), done: String(r.submittedAt || "") !== "" }));
  const appeals = rows_("appeals").map((r) => ({
    date: day_(r.date), player: String(r.player), prompt: Number(r.prompt), typed: String(r.typed),
    tier: String(r.tier || "").trim().toLowerCase(), year: String(r.year || "").trim(),
  }));
  const roster = rows_("roster").map((r) => ({ name: String(r.name).trim(), tier: String(r.tier || "").trim().toLowerCase(), year: String(r.year || "").trim() }))
    .filter((r) => r.name && r.tier && r.year);
  return json_({ ok: true, today: today_(), now: Date.now(), plays, appeals, roster });
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
      // Approved names join the public roster tab; a rejected one is taken back out.
      const rs = sheet_("roster"), existing = rows_("roster").find((r) => norm_(r.name) === norm_(b.typed));
      const pretty = String(b.typed || "").trim().replace(/\b\w/g, (c) => c.toUpperCase());
      if (tier === "reject") { if (existing && existing.source === "appeal") rs.deleteRow(existing._row); }
      else if (existing) { rs.getRange(existing._row, 2, 1, 2).setNumberFormat("@").setValues([[tier, year]]); }
      else rs.appendRow([cell_(pretty), tier, year, new Date(), "appeal"]);
      return json_({ ok: true, updated: n, added: tier !== "reject" });
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
    const mineAll = plays.filter((r) => norm_(r.player) === norm_(player));
    const isDone = (r) => String(r.submittedAt || "") !== "";
    const sh = sheet_("plays");

    // Start: as many rounds a day as you like. Reuse a round left open today, or open a new one.
    if (b.action === "start") {
      if (date !== today_()) return json_({ ok: false, error: "a new Batchillion is live. reload the page" });
      const open = mineAll.find((r) => day_(r.date) === date && !isDone(r));
      if (open) return json_({ ok: true, row: open._row, answers: parse_(open.answers) });
      sh.appendRow([text_(date), cell_(name), "", new Date(), ""]);
      return json_({ ok: true, row: sh.getLastRow(), answers: [] });
    }

    // Throw: saves the round so far (each throw spends the teammate); 7 answers closes the round.
    if (b.action === "throw" || b.action === "play") {
      if (!dayOk_(date)) return json_({ ok: false, error: "that day is over. a new Batchillion is live" });
      if (!Array.isArray(b.answers) || !b.answers.length || b.answers.length > PROMPTS) return json_({ ok: false, error: "bad request" });
      let r = mineAll.find((x) => x._row === Number(b.row));
      if (!r && b.action === "play") r = mineAll.find((x) => day_(x.date) === date && !isDone(x));   // older pages
      if (!r) { sh.appendRow([text_(date), cell_(name), "", new Date(), ""]); r = { _row: sh.getLastRow(), submittedAt: "" }; }
      if (isDone(r)) return json_({ ok: false, error: "that round is closed" });
      // Saves can land out of order; a round only ever grows, so an older, shorter save is ignored.
      const stored = r.answers !== undefined ? parse_(r.answers) : [];
      if (b.answers.length < stored.length) return json_({ ok: true, done: false, answers: stored, stale: true });
      const answers = cleanAnswers_(b.answers, player, r._row, plays);
      sh.getRange(r._row, 3).setValue(JSON.stringify(answers));
      const done = answers.length >= PROMPTS;
      if (done) sh.getRange(r._row, 5).setValue(new Date());
      return json_({ ok: true, done, answers });
    }

    // Appeal: one a day, only for a name this player threw today that matched nobody.
    if (b.action === "appeal") {
      if (!dayOk_(date)) return json_({ ok: false, error: "that day is over" });
      const k = Number(b.prompt), typed = String(b.typed || "").trim().slice(0, 60);
      if (!(k >= 0 && k < PROMPTS && Math.floor(k) === k) || norm_(typed).replace(/ /g, "").length < 2) return json_({ ok: false, error: "bad request" });
      const threw = mineAll.filter((r) => day_(r.date) === date).some((r) => { const a = parse_(r.answers)[k]; return a && !a.full && norm_(a.typed) === norm_(typed); });
      if (!threw) return json_({ ok: false, error: "you can only appeal a name you threw today" });
      if (rows_("appeals").some((r) => day_(r.date) === date && norm_(r.player) === norm_(player))) return json_({ ok: false, error: "one appeal per day" });
      sheet_("appeals").appendRow([text_(date), cell_(name), k, cell_(typed), "", "", new Date()]);
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
