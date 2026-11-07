// BatCH roster for the daily huck game.
// One line per member who has played at least one tournament (BatCH Bash counts).
// tier: plankton | clever | schooler | rare | deep | krillion
// year: the year they started university (any school), or a list of years when either counts ([2022, 2023]).
//   Anything 2021 or earlier lands in the "2021 or before" prompt.
// note (optional 4th field): an extra line shown when someone guesses them.
// To add or re-rank someone, edit this list and push. Every player's score is recomputed from
// this file on load, so an appealed name scores as soon as it is added here.
window.ROSTER = [
  ["Aashay Rathi", "schooler", 2026],
  ["Adam Eligator", "deep", 2023],
  ["Aidan Menickelli", "rare", 2025],
  ["Andrew Carneiro", "schooler", 2025],
  ["Andrew Wang", "deep", 2023],
  ["Ani", "deep", 2023],
  ["Ben Crosbie", "rare", 2020],
  ["Ben Horton", "schooler", 2026],
  ["Ben Van Duin", "deep", 2023],
  ["Brian Chen", "schooler", 2019],
  ["Brian Mateer", "clever", 2019],   // "before 20"
  ["Bryan Reed", "rare", 2020],
  ["Caleb Promislow", "schooler", 2022],
  ["Carson Jewell", "schooler", 2026],
  ["Centurion", "schooler", 2024],
  ["Coleman", "rare", 2023],
  ["Dan Xiao", "deep", 2022],
  ["Dax", "schooler", 2025],
  ["Drake", "rare", 2025],
  ["Dylan Edwards", "schooler", 2023],
  ["Eli Card", "schooler", 2026],
  ["Elliot", "rare", 2021],
  ["Elio", "clever", 2024],
  ["Ethan Berson", "schooler", 2025],
  ["Gavin", "plankton", 2025],
  ["Gram", "deep", 2025],
  ["Henry Holland", "deep", 2023],
  ["Isaac Ho", "rare", 2025],
  ["Ish", "deep", 2025],
  ["Jack Herring", "schooler", 2023],
  ["James Conley", "rare", 2021],
  ["Jeremy F", "deep", 2025],
  ["Jon Aycock", "clever", 2019],     // "before 20"
  ["Josh Lo", "rare", 2025],
  ["Kent", "schooler", 2026],
  ["Kevin Chen", "rare", 2020],
  ["King", "plankton", 2025],
  ["Krause", "clever", 2018],
  ["Luke Sellers", "krillion", 2026],
  ["Matthew Bain", "schooler", 2023],
  ["Matthew Lee", "deep", 2023],
  ["Michael Sun", "schooler", 2026],
  ["Michael Hopfinger", "schooler", 2022],
  ["Mitchell", "clever", 2019],
  ["Nate", "plankton", 2023],
  ["Neal", "plankton", 2024],
  ["Neil Khot", "rare", 2020],
  ["Noah Biggers", "clever", 2026],
  ["Noah Goldblatt", "schooler", 2026],
  ["Noah Judd", "deep", 2023],
  ["Oliver", "plankton", 2025],
  ["Owen", "plankton", 2023],
  ["Parker", "plankton", 2023],
  ["Peter C", "krillion", 2022],
  ["Peter D", "schooler", 2026],
  ["Rishi Singh", "deep", 2023],
  ["Robert S", "krillion", 2024],
  ["Ryan B", "rare", 2026],
  ["Sylvan", "krillion", 2025],
  ["Taran", "rare", 2022],
  ["Avi Faber", "krillion", 2019],
  ["Daniel Wu", "deep", 2019, "he's engaged now"],   // anything before 2020
  ["Daniel Zhang", "rare", 2021],
  ["Eli Broun", "rare", 2021],
  ["Fionn", "deep", 2021],
  ["Hayden", "krillion", 2023],
  ["Kevin Tanner", "rare", 2020],
  ["Krish Singhvi", "deep", [2022, 2023]],
  ["Michael Zaucha", "krillion", 2020],  // 2020 or before
  ["Richard Ly", "deep", 2019],
  ["Sean Kim", "rare", 2022],
  ["Sebastian Radomski", "deep", 2024],
  ["Bryce", "plankton", 2025],
  ["Riley", "schooler", 2025],
  ["Max", "schooler", 2026],
  ["Brody", "deep", 2025],
];

// Tiers: points are yards downfield. 100 = caught in the end zone.
window.TIERS = {
  plankton: { label: "plankton",          pts: 10,  color: "#9aa3a6", caption: "that's the farthest i've seen nate throw" },
  clever:   { label: "too clever",        pts: 15,  color: "#c07a3e", caption: "bro that is NOT smart" },
  schooler: { label: "schooler",          pts: 30,  color: "#7cc4ef", caption: "average distance of a king hammer" },
  rare:     { label: "rare",              pts: 60,  color: "#ef5a51", caption: "schmeatball sub but caught by Gavin/Parker" },
  deep:     { label: "deep cut",          pts: 85,  color: "#a463e0", caption: () => (Math.random() < 0.5 ? `Blueberry for ${window.pickKrillion()}` : "this is as niche as the april 2025 leadership call with justin ford") },
  krillion: { label: "one in a batchillion", pts: 100, color: "#f2c230", caption: "Andrew's pulls" },
};

// Shown on any 0-point throw (not on the list, wrong class, already used, no answer).
window.ZERO_CAPTION = "your plus minus is in the gutter bro";

// Deep-cut caption names a random one-in-a-batchillion teammate.
window.pickKrillion = () => {
  const k = window.ROSTER.filter((r) => r[1] === "krillion").map((r) => r[0].split(" ")[0]);
  return k[Math.floor(Math.random() * k.length)];
};

// The seven daily prompts, in order.
window.PROMPTS = [
  { id: "y2021", short: "in 2021 or before", text: "who started university in 2021 or before", test: (y) => y <= 2021 },
  { id: "y2022", short: "in 2022", text: "who started university in 2022", test: (y) => y === 2022 },
  { id: "y2023", short: "in 2023", text: "who started university in 2023", test: (y) => y === 2023 },
  { id: "y2024", short: "in 2024", text: "who started university in 2024", test: (y) => y === 2024 },
  { id: "y2025", short: "in 2025", text: "who started university in 2025", test: (y) => y === 2025 },
  { id: "y2026", short: "in 2026", text: "who started university in 2026", test: (y) => y === 2026 },
  { id: "wild",  short: "ever", text: "who ever played, any year (wildcard)", test: () => true },
];

// Round types. "Players" asks by starting year (window.PROMPTS); stat rounds carry their own per-prompt tiers.
// A round with an "unlock" date shows up from that day on (Eastern time).
// Stat rounds, built from BatCH26-27-stats.csv (this season's tournament stats through Bankrun) by stat_gen.py.
// Each prompt sets its own tiers from how often each answer happened: the most frequent is plankton,
// the least frequent is the one in a batchillion, then schooler, rare and deep cut in between.
// Players not on the roster yet (Daniel, JT, Matthew, Micah, Michael, Noah N, Patrick, William) still count here.
window.ROUNDS = [
  { id: "classes", title: "Players", blurb: "one teammate per starting year", prompts: window.PROMPTS },
  { id: "stats1", title: "Stat sheet I", blurb: "assists, Ds, pulls, Feasterns, Duke", unlock: "2026-11-7", prompts: [
      { id: "owen-ast", short: "Owen assisted", text: "that Owen has thrown a goal to", tiers: {"Bryce": "plankton", "Dylan Edwards": "krillion", "Gavin": "rare", "Noah Goldblatt": "schooler", "Parker": "deep"} },
      { id: "nate-ast", short: "Nate assisted", text: "that Nate has thrown a goal to", tiers: {"Ben Horton": "rare", "Bryce": "plankton", "Daniel": "krillion", "Gavin": "rare", "Kent": "deep", "Micah": "schooler", "Noah Goldblatt": "deep", "Oliver": "rare", "Owen": "schooler"} },
      { id: "to-gavin", short: "threw to Gavin", text: "who has thrown a goal to Gavin", tiers: {"Aashay Rathi": "deep", "Bryce": "schooler", "Carson Jewell": "schooler", "Centurion": "deep", "Kent": "deep", "Max": "krillion", "Nate": "rare", "Neal": "plankton", "Oliver": "rare", "Owen": "rare"} },
      { id: "has-d", short: "got a D", text: "with a D (block) this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "deep", "Ben Horton": "rare", "Bryce": "rare", "Carson Jewell": "deep", "Centurion": "rare", "Daniel": "rare", "Drake": "deep", "Eli Card": "deep", "Elliot": "rare", "Ethan Berson": "deep", "Gavin": "schooler", "JT": "deep", "Kent": "deep", "King": "deep", "Matthew": "schooler", "Max": "rare", "Micah": "schooler", "Michael": "deep", "Nate": "rare", "Neal": "schooler", "Noah Goldblatt": "schooler", "Noah N": "krillion", "Oliver": "rare", "Owen": "schooler", "Parker": "plankton"} },
      { id: "feasterns", short: "scored at Feasterns", text: "who scored at Feasterns", tiers: {"Ben Horton": "rare", "Bryce": "plankton", "Carson Jewell": "rare", "Centurion": "schooler", "Daniel": "deep", "Gavin": "schooler", "Matthew": "deep", "Max": "rare", "Micah": "rare", "Michael": "krillion", "Nate": "rare", "Neal": "deep", "Noah Goldblatt": "deep", "Owen": "schooler"} },
      { id: "pulled", short: "pulled", text: "who has pulled this season", tiers: {"Andrew Carneiro": "schooler", "Bryce": "deep", "Carson Jewell": "krillion", "Centurion": "rare", "Gavin": "rare", "Kent": "deep", "King": "deep", "Max": "plankton", "Neal": "schooler", "Noah Goldblatt": "rare"} },
      { id: "vs-duke", short: "scored vs Duke", text: "who scored against Duke", tiers: {"Andrew Carneiro": "schooler", "Bryce": "rare", "Carson Jewell": "deep", "Dylan Edwards": "schooler", "Gavin": "plankton", "Noah Goldblatt": "deep", "Oliver": "rare", "Ryan B": "krillion"} },
    ] },
  { id: "stats2", title: "Stat sheet II", blurb: "assists, drops, Bankrun, USC, 5+ goals", unlock: "2026-11-7", prompts: [
      { id: "oliver-ast", short: "Oliver assisted", text: "that Oliver has thrown a goal to", tiers: {"Bryce": "schooler", "Gavin": "deep", "Kent": "schooler", "Micah": "krillion", "Nate": "rare", "Noah Goldblatt": "deep", "Owen": "plankton", "Parker": "rare"} },
      { id: "bryce-ast", short: "Bryce assisted", text: "that Bryce has thrown a goal to", tiers: {"Aashay Rathi": "rare", "Ben Horton": "deep", "Centurion": "deep", "Gavin": "schooler", "Micah": "deep", "Michael": "krillion", "Nate": "schooler", "Neal": "rare", "Oliver": "plankton", "Owen": "rare"} },
      { id: "to-owen", short: "threw to Owen", text: "who has thrown a goal to Owen", tiers: {"Aashay Rathi": "deep", "Bryce": "rare", "Gavin": "schooler", "Kent": "deep", "Nate": "schooler", "Neal": "rare", "Noah Goldblatt": "krillion", "Oliver": "plankton", "Parker": "rare"} },
      { id: "bankrun", short: "scored at Bankrun", text: "who scored at Bankrun", tiers: {"Aashay Rathi": "deep", "Andrew Carneiro": "plankton", "Ben Horton": "rare", "Bryce": "schooler", "Centurion": "deep", "Eli Card": "rare", "Gavin": "schooler", "JT": "deep", "Michael": "deep", "Neal": "rare", "Noah Goldblatt": "deep", "Oliver": "rare", "Owen": "rare", "Parker": "schooler", "Ryan B": "krillion"} },
      { id: "dropped", short: "dropped one", text: "who has dropped a pass this season", tiers: {"Aashay Rathi": "deep", "Ben Horton": "schooler", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "deep", "Daniel": "deep", "Gavin": "rare", "JT": "deep", "Matthew": "deep", "Micah": "krillion", "Michael": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "plankton", "Parker": "schooler"} },
      { id: "vs-usc", short: "scored vs USC", text: "who scored against USC", tiers: {"Aashay Rathi": "schooler", "Bryce": "rare", "Drake": "deep", "Gavin": "rare", "Kent": "rare", "Micah": "krillion", "Nate": "deep", "Neal": "deep", "Noah Goldblatt": "rare", "Owen": "schooler", "Parker": "plankton"} },
      { id: "five-goals", short: "5+ goals", text: "with 5 or more goals this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "deep", "Bryce": "plankton", "Centurion": "krillion", "Gavin": "schooler", "Kent": "rare", "Max": "deep", "Micah": "deep", "Nate": "deep", "Neal": "deep", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "schooler", "Parker": "schooler"} },
    ] },
];

// Shared backend (Google Apps Script web app, see backend/Code.gs). Paste the /exec URL here after
// deploying. Empty = local-only mode: the game works but there is no public leaderboard,
// no cross-device daily lock, and appeals fall back to copy-and-DM.
window.BACKEND_URL = "https://script.google.com/macros/s/AKfycbzC11Mk4p7tqF5vtPYV0s4UO85jqrhlXRX5NNaO1Hdo2CGFDybM0-vUc5E9jn2-LYLj/exec";
window.APPEAL_WHO = "Neal";
