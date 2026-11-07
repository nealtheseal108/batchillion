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
  ["Micah", "schooler", 2025],
  ["Daniel", "plankton", 2023],
  ["JT", "rare", 2026],
  ["Patrick", "rare", 2026],
  ["William", "rare", 2026],
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
// Each prompt sets its own tiers from how often each answer happened. Ties share a tier. Most = plankton;
// one in a batchillion only if a single person has the fewest; at most 2 deep cuts; rares unlimited.
// Stats names map to roster names (Matthew = Matthew Bain, Michael = Michael Sun, Noah N = Noah Biggers).
window.ROUNDS = [
  { id: "classes", title: "Players", prompts: window.PROMPTS },
  { id: "stats1", title: "Stat sheet I", unlock: "2026-11-7", prompts: [
      { id: "owen-ast", short: "caught a goal from Owen", text: "who caught a goal from Owen (Owen got the assist)", tiers: {"Bryce": "plankton", "Dylan Edwards": "rare", "Gavin": "rare", "Noah Goldblatt": "schooler", "Parker": "rare"} },
      { id: "nate-ast", short: "caught a goal from Nate", text: "who caught a goal from Nate (Nate got the assist)", tiers: {"Ben Horton": "rare", "Bryce": "plankton", "Daniel": "rare", "Gavin": "rare", "Kent": "rare", "Micah": "schooler", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "schooler"} },
      { id: "to-gavin", short: "assisted Gavin", text: "who threw a goal to Gavin (they got the assist)", tiers: {"Aashay Rathi": "rare", "Bryce": "schooler", "Carson Jewell": "schooler", "Centurion": "rare", "Kent": "rare", "Max": "rare", "Nate": "rare", "Neal": "plankton", "Oliver": "rare", "Owen": "rare"} },
      { id: "has-d", short: "got a D", text: "with a D (block) this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "rare", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Eli Card": "rare", "Elliot": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "JT": "rare", "Kent": "rare", "King": "rare", "Matthew Bain": "schooler", "Max": "rare", "Micah": "schooler", "Michael Sun": "rare", "Nate": "rare", "Neal": "schooler", "Noah Biggers": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "plankton"} },
      { id: "feasterns", short: "goal at Feasterns", text: "who caught a goal at Feasterns", tiers: {"Ben Horton": "rare", "Bryce": "plankton", "Carson Jewell": "rare", "Centurion": "schooler", "Daniel": "rare", "Gavin": "schooler", "Matthew Bain": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Owen": "schooler"} },
      { id: "pulled", short: "pulled", text: "who has pulled this season", tiers: {"Andrew Carneiro": "rare", "Bryce": "rare", "Carson Jewell": "rare", "Centurion": "rare", "Gavin": "rare", "Kent": "rare", "King": "rare", "Max": "plankton", "Neal": "schooler", "Noah Goldblatt": "rare"} },
      { id: "vs-duke", short: "goal vs Duke", text: "who caught a goal against Duke", tiers: {"Andrew Carneiro": "plankton", "Bryce": "rare", "Carson Jewell": "rare", "Dylan Edwards": "plankton", "Gavin": "plankton", "Noah Goldblatt": "rare", "Oliver": "rare", "Ryan B": "rare"} },
    ] },
  { id: "stats2", title: "Stat sheet II", unlock: "2026-11-7", prompts: [
      { id: "oliver-ast", short: "caught a goal from Oliver", text: "who caught a goal from Oliver (Oliver got the assist)", tiers: {"Bryce": "rare", "Gavin": "rare", "Kent": "schooler", "Micah": "rare", "Nate": "rare", "Noah Goldblatt": "rare", "Owen": "plankton", "Parker": "rare"} },
      { id: "bryce-ast", short: "caught a goal from Bryce", text: "who caught a goal from Bryce (Bryce got the assist)", tiers: {"Aashay Rathi": "rare", "Ben Horton": "rare", "Centurion": "rare", "Gavin": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Neal": "rare", "Oliver": "plankton", "Owen": "rare"} },
      { id: "to-owen", short: "assisted Owen", text: "who threw a goal to Owen (they got the assist)", tiers: {"Aashay Rathi": "rare", "Bryce": "rare", "Gavin": "rare", "Kent": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "plankton", "Parker": "rare"} },
      { id: "bankrun", short: "goal at Bankrun", text: "who caught a goal at Bankrun", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "plankton", "Ben Horton": "rare", "Bryce": "schooler", "Centurion": "rare", "Eli Card": "rare", "Gavin": "rare", "JT": "rare", "Michael Sun": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "rare", "Parker": "schooler", "Ryan B": "rare"} },
      { id: "dropped", short: "dropped one", text: "who has dropped a pass this season", tiers: {"Aashay Rathi": "rare", "Ben Horton": "schooler", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Gavin": "rare", "JT": "rare", "Matthew Bain": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "plankton", "Parker": "schooler"} },
      { id: "vs-usc", short: "goal vs USC", text: "who caught a goal against USC", tiers: {"Aashay Rathi": "schooler", "Bryce": "rare", "Drake": "rare", "Gavin": "rare", "Kent": "rare", "Micah": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Owen": "schooler", "Parker": "plankton"} },
      { id: "five-goals", short: "5+ goals caught", text: "who has caught 5 or more goals this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "deep", "Bryce": "plankton", "Centurion": "deep", "Gavin": "schooler", "Kent": "rare", "Max": "rare", "Micah": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "schooler"} },
    ] },
];

// Shared backend (Google Apps Script web app, see backend/Code.gs). Paste the /exec URL here after
// deploying. Empty = local-only mode: the game works but there is no public leaderboard,
// no cross-device daily lock, and appeals fall back to copy-and-DM.
window.BACKEND_URL = "https://script.google.com/macros/s/AKfycbzC11Mk4p7tqF5vtPYV0s4UO85jqrhlXRX5NNaO1Hdo2CGFDybM0-vUc5E9jn2-LYLj/exec";
window.APPEAL_WHO = "Neal";
