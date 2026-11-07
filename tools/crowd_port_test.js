// Checks the game's JavaScript tier rules (app.js crowdTiers block) against the Python generator: with no crowd
// data, tierize + capTiers on each stat question's `ob` must reproduce its stored tiers exactly.
// Usage: node tools/crowd_port_test.js roster.js app.js [--only stats9,stats10]   (exit 1 on any mismatch)
const fs = require("fs"), path = require("path");
global.window = global; window.pickKrillion = () => "";
require(path.resolve(process.argv[2]));
const src = fs.readFileSync(process.argv[3], "utf8");
const oi = process.argv.indexOf("--only"), only = oi > 0 ? new Set(process.argv[oi + 1].split(",")) : null;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const grab = (start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));
eval(grab("  const CROWD_MIN_PLAYERS", "  const crowdCache").replace(/^  const /gm, "  var "));
let bad = 0, n = 0;
for (const R of window.ROUNDS) for (const q of R.prompts) {
  if (!q.ob || (only && !only.has(R.id))) continue; n++;
  const ob = Object.fromEntries(Object.entries(q.ob).map(([k, v]) => [norm(k), v]));
  const got = capTiers(tierize(ob), ob), want = Object.fromEntries(Object.entries(q.tiers).map(([k, v]) => [norm(k), v]));
  const diff = Object.keys(want).filter((k) => got[k] !== want[k]);
  if (diff.length) { bad++; console.log(R.id, q.id, diff.map((k) => `${k}: js ${got[k]} vs py ${want[k]}`).join("; ")); }
}
console.log(`${n - bad}/${n} prompts match`);
process.exit(bad || !n ? 1 : 0);
