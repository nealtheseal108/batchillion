// BatCH roster for the daily huck game.
// One line per member who has played at least one tournament (BatCH Bash counts).
// tier: debris (0) | plankton | clever | schooler | rare | deep | krillion
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
  ["Nate", "debris", 2023],
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
  debris:   { label: "debris",            pts: 0,   color: "#6f6257", caption: "why would you huck it into triple coverage" },
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
// Stat rounds, built from BatCH26-27-stats.csv (Bankrun, Barebones, Feasterns and the Nov 5 Duke scrim) by stat_gen.py.
// Each prompt sets its own tiers from how often each answer happened. Ties share a tier. Most = plankton;
// one in a batchillion only if a single person has the fewest; at most 2 deep cuts; rares unlimited.
// Stats names map to roster names (Matthew = Matthew Bain, Michael = Michael Sun, Noah N = Noah Biggers).
// Sheets I-IV are retired (hidden from the round picker, still scored for rounds already played).
// Sheets V-VIII (stat_gen2.py) mix ratios and counts; each can reach 625+ yards.
window.ROUNDS = [
  { id: "classes", title: "Players", prompts: window.PROMPTS },
  { id: "stats1", title: "Stat sheet I", retired: true, unlock: "2026-11-7", prompts: [
      { id: "owen-ast", short: "caught a goal from Owen", text: "who caught a goal from Owen this season", tiers: {"Bryce": "plankton", "Dylan Edwards": "rare", "Gavin": "rare", "Noah Goldblatt": "schooler", "Parker": "rare"} },
      { id: "nate-ast", short: "caught a goal from Nate", text: "who caught a goal from Nate this season", tiers: {"Ben Horton": "rare", "Bryce": "plankton", "Daniel": "rare", "Gavin": "rare", "Kent": "rare", "Micah": "schooler", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "schooler"} },
      { id: "to-gavin", short: "threw an assist to Gavin", text: "who threw an assist to Gavin this season", tiers: {"Aashay Rathi": "rare", "Bryce": "schooler", "Carson Jewell": "schooler", "Centurion": "rare", "Kent": "rare", "Max": "rare", "Nate": "rare", "Neal": "plankton", "Oliver": "rare", "Owen": "rare"} },
      { id: "has-d", short: "got a D", text: "with a D (block) this season, tournaments and scrims", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "rare", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Eli Card": "rare", "Elliot": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "JT": "rare", "Kent": "rare", "King": "rare", "Matthew Bain": "schooler", "Max": "rare", "Micah": "schooler", "Michael Sun": "rare", "Nate": "rare", "Neal": "schooler", "Noah Biggers": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "plankton"} },
      { id: "feasterns", short: "caught a goal at Feasterns", text: "who caught a goal at the Feasterns tournament (Oct 16-18)", tiers: {"Ben Horton": "rare", "Bryce": "plankton", "Carson Jewell": "rare", "Centurion": "schooler", "Daniel": "rare", "Gavin": "schooler", "Matthew Bain": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Owen": "schooler"} },
      { id: "pulled", short: "pulled", text: "who has pulled this season, tournaments and scrims", tiers: {"Andrew Carneiro": "rare", "Bryce": "rare", "Carson Jewell": "rare", "Centurion": "rare", "Gavin": "rare", "Kent": "rare", "King": "rare", "Max": "plankton", "Neal": "schooler", "Noah Goldblatt": "rare"} },
      { id: "vs-duke", short: "caught a goal in the Duke scrim", text: "who caught a goal in the Duke scrim (Nov 5)", tiers: {"Andrew Carneiro": "plankton", "Bryce": "rare", "Carson Jewell": "rare", "Dylan Edwards": "plankton", "Gavin": "plankton", "Noah Goldblatt": "rare", "Oliver": "rare", "Ryan B": "rare"} },
    ] },
  { id: "stats2", title: "Stat sheet II", retired: true, unlock: "2026-11-7", prompts: [
      { id: "oliver-ast", short: "caught a goal from Oliver", text: "who caught a goal from Oliver this season", tiers: {"Bryce": "rare", "Gavin": "rare", "Kent": "schooler", "Micah": "rare", "Nate": "rare", "Noah Goldblatt": "rare", "Owen": "plankton", "Parker": "rare"} },
      { id: "bryce-ast", short: "caught a goal from Bryce", text: "who caught a goal from Bryce this season", tiers: {"Aashay Rathi": "rare", "Ben Horton": "rare", "Centurion": "rare", "Gavin": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Neal": "rare", "Oliver": "plankton", "Owen": "rare"} },
      { id: "to-owen", short: "threw an assist to Owen", text: "who threw an assist to Owen this season", tiers: {"Aashay Rathi": "rare", "Bryce": "rare", "Gavin": "rare", "Kent": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "plankton", "Parker": "rare"} },
      { id: "bankrun", short: "caught a goal at Bankrun", text: "who caught a goal at the Bankrun tournament (Sept 19-20)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "plankton", "Ben Horton": "rare", "Bryce": "schooler", "Centurion": "rare", "Eli Card": "rare", "Gavin": "rare", "JT": "rare", "Michael Sun": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "rare", "Parker": "schooler", "Ryan B": "rare"} },
      { id: "dropped", short: "dropped one", text: "who has dropped a pass this season, tournaments and scrims", tiers: {"Aashay Rathi": "rare", "Ben Horton": "schooler", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Gavin": "rare", "JT": "rare", "Matthew Bain": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "plankton", "Parker": "schooler"} },
      { id: "vs-usc", short: "caught a goal vs USC", text: "who caught a goal against USC at Barebones (Oct 3-4)", tiers: {"Aashay Rathi": "schooler", "Bryce": "rare", "Drake": "rare", "Gavin": "rare", "Kent": "rare", "Micah": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Owen": "schooler", "Parker": "plankton"} },
      { id: "five-goals", short: "caught 5+ goals", text: "who has caught 5 or more goals this season, tournaments and scrims", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "deep", "Bryce": "plankton", "Centurion": "deep", "Gavin": "schooler", "Kent": "rare", "Max": "rare", "Micah": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "schooler"} },
    ] },
  { id: "stats3", title: "Stat sheet III", retired: true, unlock: "2026-11-7", prompts: [
      { id: "neal-ast", short: "caught a goal from Neal", text: "who caught a goal from Neal this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "plankton", "Ben Horton": "rare", "Bryce": "rare", "Centurion": "rare", "Daniel": "schooler", "Dylan Edwards": "rare", "Eli Card": "rare", "Gavin": "plankton", "King": "rare", "Matthew Bain": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "rare", "Parker": "rare", "Ryan B": "rare"} },
      { id: "to-bryce", short: "threw an assist to Bryce", text: "who threw an assist to Bryce this season", tiers: {"Carson Jewell": "rare", "Gavin": "schooler", "Max": "rare", "Nate": "schooler", "Neal": "rare", "Oliver": "rare", "Owen": "plankton"} },
      { id: "barebones", short: "caught a goal at Barebones", text: "who caught a goal at the Barebones tournament (Oct 3-4)", tiers: {"Aashay Rathi": "rare", "Bryce": "rare", "Daniel": "deep", "Drake": "rare", "Gavin": "schooler", "Kent": "schooler", "King": "krillion", "Max": "rare", "Micah": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "plankton", "Parker": "plankton"} },
      { id: "d-feasterns", short: "got a D at Feasterns", text: "who got a D (block) at the Feasterns tournament (Oct 16-18)", tiers: {"Ben Horton": "rare", "Bryce": "rare", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "King": "rare", "Matthew Bain": "schooler", "Max": "schooler", "Micah": "plankton", "Michael Sun": "rare", "Nate": "rare", "Neal": "rare", "Oliver": "rare", "Owen": "rare", "Parker": "rare"} },
      { id: "break-goal", short: "caught a goal on a D point", text: "who caught a goal on a D point this season (a break), tournaments and scrims", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "plankton", "Ben Horton": "schooler", "Bryce": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Eli Card": "rare", "Gavin": "schooler", "Kent": "rare", "King": "rare", "Matthew Bain": "rare", "Max": "schooler", "Micah": "rare", "Michael Sun": "rare", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Parker": "schooler", "Ryan B": "rare"} },
      { id: "vs-app", short: "caught a goal vs App State", text: "who caught a goal against App State this season (Bankrun, Barebones or Feasterns)", tiers: {"Aashay Rathi": "deep", "Andrew Carneiro": "schooler", "Bryce": "plankton", "Carson Jewell": "rare", "Gavin": "plankton", "Kent": "rare", "Max": "rare", "Micah": "rare", "Neal": "rare", "Oliver": "deep", "Owen": "schooler", "Parker": "rare"} },
      { id: "ast-bankrun", short: "threw an assist at Bankrun", text: "who threw an assist at the Bankrun tournament (Sept 19-20)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Bryce": "rare", "Centurion": "rare", "Gavin": "schooler", "Max": "schooler", "Nate": "rare", "Neal": "plankton", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "rare", "Parker": "rare"} },
    ] },
  { id: "stats4", title: "Stat sheet IV", retired: true, unlock: "2026-11-7", prompts: [
      { id: "gavin-ast", short: "caught a goal from Gavin", text: "who caught a goal from Gavin this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Bryce": "plankton", "Max": "rare", "Oliver": "rare", "Owen": "schooler", "Parker": "rare"} },
      { id: "to-parker", short: "threw an assist to Parker", text: "who threw an assist to Parker this season", tiers: {"Aashay Rathi": "plankton", "Centurion": "plankton", "Daniel": "rare", "Gavin": "rare", "Kent": "rare", "Neal": "plankton", "Oliver": "plankton", "Owen": "rare"} },
      { id: "ast-barebones", short: "threw an assist at Barebones", text: "who threw an assist at the Barebones tournament (Oct 3-4)", tiers: {"Aashay Rathi": "rare", "Bryce": "schooler", "Daniel": "schooler", "Elliot": "deep", "Gavin": "rare", "JT": "deep", "Kent": "rare", "Max": "rare", "Micah": "rare", "Nate": "schooler", "Neal": "plankton", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "rare", "Parker": "rare"} },
      { id: "d-barebones", short: "got a D at Barebones", text: "who got a D (block) at the Barebones tournament (Oct 3-4)", tiers: {"Aashay Rathi": "rare", "Bryce": "rare", "Daniel": "rare", "Drake": "rare", "Elliot": "schooler", "Gavin": "schooler", "JT": "rare", "Kent": "rare", "King": "rare", "Max": "rare", "Micah": "rare", "Nate": "rare", "Neal": "schooler", "Noah Goldblatt": "schooler", "Owen": "rare", "Parker": "plankton"} },
      { id: "break-assist", short: "threw an assist on a D point", text: "who threw an assist on a D point this season (a break), tournaments and scrims", tiers: {"Aashay Rathi": "rare", "Bryce": "rare", "Centurion": "rare", "Daniel": "schooler", "Elliot": "rare", "Gavin": "rare", "JT": "rare", "Kent": "rare", "Matthew Bain": "rare", "Max": "rare", "Micah": "rare", "Nate": "rare", "Neal": "plankton", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "rare", "Parker": "rare"} },
      { id: "vs-wm", short: "caught a goal vs William & Mary", text: "who caught a goal against William & Mary at Feasterns (Oct 17)", tiers: {"Ben Horton": "rare", "Bryce": "plankton", "Centurion": "rare", "Gavin": "rare", "Matthew Bain": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Owen": "rare"} },
      { id: "throwaway", short: "threw it away", text: "who has thrown a throwaway this season, tournaments and scrims", tiers: {"Aashay Rathi": "rare", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "schooler", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "JT": "rare", "Kent": "rare", "King": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "schooler", "Neal": "plankton", "Noah Goldblatt": "schooler", "Oliver": "schooler", "Owen": "rare", "Parker": "rare", "Riley": "rare", "Ryan B": "rare"} },
    ] },
  { id: "stats5", title: "Stat sheet V", unlock: "2026-11-7", prompts: [
      { id: "comp75", short: "completed 75%+ of throws", text: "who completed 75% or more of their throws this season (min 5 throws)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Bryce": "rare", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Elliot": "rare", "Gavin": "plankton", "JT": "krillion", "Kent": "rare", "King": "rare", "Matthew Bain": "schooler", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "schooler", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "schooler", "Riley": "deep"} },
      { id: "goal40", short: "a goal every 40 points", text: "who caught a goal at least once every 40 points they played this season (min 15 points played)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "schooler", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Eli Card": "rare", "Gavin": "plankton", "JT": "deep", "Kent": "rare", "Matthew Bain": "krillion", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Neal": "schooler", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "schooler", "Ryan B": "rare"} },
      { id: "dshare45", short: "45%+ of points on D", text: "who played 45% or more of their points on the D line this season (min 15 points played)", tiers: {"Aashay Rathi": "deep", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Centurion": "rare", "Daniel": "schooler", "Drake": "schooler", "Eli Card": "rare", "Elliot": "rare", "Ethan Berson": "rare", "JT": "rare", "King": "schooler", "Matthew Bain": "rare", "Max": "schooler", "Michael Sun": "rare", "Neal": "plankton", "Noah Goldblatt": "schooler", "Parker": "rare", "Peter D": "rare", "Riley": "krillion", "Ryan B": "rare"} },
      { id: "goal3", short: "3+ goals", text: "who has caught 3 or more goals this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "plankton", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "deep", "Gavin": "schooler", "Kent": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "deep", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "schooler"} },
      { id: "ast2", short: "2+ assists", text: "who has thrown 2 or more assists this season", tiers: {"Aashay Rathi": "rare", "Ben Horton": "deep", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Gavin": "schooler", "Kent": "rare", "Max": "rare", "Micah": "deep", "Nate": "schooler", "Neal": "plankton", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "rare", "Parker": "rare"} },
      { id: "pts35", short: "35+ points", text: "who has played 35 or more points this season", tiers: {"Aashay Rathi": "rare", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Ethan Berson": "krillion", "Gavin": "schooler", "JT": "rare", "Kent": "rare", "King": "rare", "Matthew Bain": "deep", "Max": "rare", "Micah": "rare", "Nate": "schooler", "Neal": "plankton", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "rare"} },
      { id: "tour2", short: "a goal at 2+ tournaments", text: "who caught a goal at 2 or more of this season's three tournaments (Bankrun, Barebones, Feasterns)", tiers: {"Aashay Rathi": "rare", "Ben Horton": "rare", "Bryce": "plankton", "Centurion": "rare", "Daniel": "deep", "Gavin": "schooler", "Max": "rare", "Micah": "rare", "Michael Sun": "krillion", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "schooler"} },
    ] },
  { id: "stats6", title: "Stat sheet VI", unlock: "2026-11-7", prompts: [
      { id: "catch92", short: "caught 92%+ of passes", text: "who caught 92% or more of the passes thrown to them this season, drops counted (min 5 catches)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Bryce": "rare", "Carson Jewell": "rare", "Centurion": "deep", "Daniel": "rare", "Drake": "rare", "Dylan Edwards": "rare", "Elliot": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "Kent": "schooler", "King": "rare", "Matthew Bain": "krillion", "Max": "plankton", "Micah": "rare", "Nate": "schooler", "Neal": "schooler", "Noah Goldblatt": "rare", "Oliver": "schooler", "Parker": "rare", "Riley": "rare"} },
      { id: "d30", short: "a D every 30 points", text: "who got a D at least once every 30 points they played this season (min 15 points played)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "deep", "Ben Horton": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Eli Card": "krillion", "Elliot": "rare", "Gavin": "schooler", "Kent": "rare", "Matthew Bain": "plankton", "Max": "rare", "Micah": "schooler", "Nate": "rare", "Neal": "schooler", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "rare", "Parker": "schooler"} },
      { id: "oshare15", short: "15%+ of points on O", text: "who played 15% or more of their points on the O line this season (min 15 points played)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "deep", "Ben Horton": "rare", "Bryce": "plankton", "Carson Jewell": "schooler", "Centurion": "rare", "Daniel": "rare", "Eli Card": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "Kent": "schooler", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "schooler", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "schooler", "Parker": "rare", "Peter D": "krillion", "Riley": "rare", "Ryan B": "rare"} },
      { id: "rec10", short: "10+ catches", text: "who has made 10 or more catches this season (goals included)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Gavin": "schooler", "JT": "krillion", "Kent": "rare", "King": "rare", "Matthew Bain": "deep", "Max": "rare", "Micah": "rare", "Nate": "plankton", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "schooler", "Parker": "schooler"} },
      { id: "ta-feasterns", short: "threw it away at Feasterns", text: "who threw a throwaway at the Feasterns tournament (Oct 16-18)", tiers: {"Ben Horton": "rare", "Bryce": "rare", "Carson Jewell": "schooler", "Centurion": "rare", "Daniel": "rare", "Ethan Berson": "deep", "Gavin": "schooler", "King": "krillion", "Max": "rare", "Micah": "rare", "Nate": "schooler", "Neal": "plankton", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "rare", "Parker": "rare"} },
      { id: "comp8", short: "8+ completed throws", text: "who has completed 8 or more throws this season (assists included)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "krillion", "Ben Horton": "rare", "Bryce": "rare", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Gavin": "schooler", "Kent": "rare", "King": "deep", "Matthew Bain": "deep", "Max": "rare", "Micah": "rare", "Nate": "plankton", "Neal": "schooler", "Noah Goldblatt": "schooler", "Oliver": "schooler", "Owen": "rare", "Parker": "rare"} },
      { id: "dp20", short: "20+ D points", text: "who has played 20 or more D points this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "rare", "Centurion": "rare", "Daniel": "schooler", "Drake": "rare", "Elliot": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "JT": "rare", "King": "rare", "Matthew Bain": "rare", "Max": "schooler", "Micah": "rare", "Michael Sun": "krillion", "Nate": "rare", "Neal": "plankton", "Noah Goldblatt": "schooler", "Owen": "rare", "Parker": "rare", "Peter D": "deep"} },
    ] },
  { id: "stats7", title: "Stat sheet VII", unlock: "2026-11-7", prompts: [
      { id: "ta10", short: "threw it away on 10%+ of throws", text: "who threw it away on 10% or more of their throws this season (min 5 throws)", tiers: {"Aashay Rathi": "rare", "Ben Horton": "schooler", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "deep", "Daniel": "rare", "Ethan Berson": "schooler", "Gavin": "schooler", "JT": "rare", "Kent": "rare", "King": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Neal": "plankton", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "rare", "Parker": "rare", "Riley": "krillion"} },
      { id: "ast50", short: "an assist every 50 points", text: "who threw an assist at least once every 50 points they played this season (min 15 points played)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "deep", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Elliot": "krillion", "Gavin": "schooler", "JT": "rare", "Kent": "rare", "Matthew Bain": "rare", "Max": "rare", "Micah": "rare", "Nate": "schooler", "Neal": "plankton", "Noah Goldblatt": "schooler", "Oliver": "schooler", "Owen": "rare", "Parker": "rare"} },
      { id: "rec3", short: "a catch every 3 points", text: "who caught the disc at least once every 3 points they played this season (min 15 points played)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "deep", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Gavin": "schooler", "Kent": "rare", "Matthew Bain": "krillion", "Max": "rare", "Micah": "rare", "Nate": "plankton", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "rare", "Parker": "schooler"} },
      { id: "c-bankrun", short: "made a catch at Bankrun", text: "who made a catch at the Bankrun tournament (Sept 19-20)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "schooler", "Eli Card": "rare", "Ethan Berson": "rare", "Gavin": "rare", "JT": "rare", "King": "deep", "Luke Sellers": "deep", "Max": "rare", "Michael Sun": "rare", "Nate": "plankton", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "rare", "Parker": "schooler", "Riley": "rare", "Ryan B": "rare"} },
      { id: "p-feasterns", short: "played at Feasterns", text: "who played at least one point at the Feasterns tournament (Oct 16-18)", tiers: {"Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Ethan Berson": "deep", "Gavin": "plankton", "King": "rare", "Matthew Bain": "rare", "Max": "rare", "Micah": "schooler", "Michael Sun": "rare", "Nate": "schooler", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "schooler", "Parker": "rare", "Peter D": "krillion"} },
      { id: "o10", short: "10+ O points", text: "who has played 10 or more O points this season", tiers: {"Aashay Rathi": "rare", "Ben Horton": "rare", "Bryce": "plankton", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Ethan Berson": "deep", "Gavin": "schooler", "Kent": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "krillion", "Nate": "schooler", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "schooler", "Parker": "rare"} },
      { id: "d2", short: "2+ Ds", text: "who has gotten 2 or more Ds (blocks) this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "deep", "Ben Horton": "rare", "Bryce": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Elliot": "rare", "Gavin": "schooler", "Kent": "rare", "King": "deep", "Matthew Bain": "rare", "Max": "rare", "Micah": "schooler", "Nate": "rare", "Neal": "schooler", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "rare", "Parker": "plankton"} },
    ] },
  { id: "stats8", title: "Stat sheet VIII", unlock: "2026-11-7", prompts: [
      { id: "touch2", short: "a touch every 2 points", text: "who touched the disc (a catch or a throw) at least once every 2 points they played this season (min 15 points played)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Gavin": "schooler", "Kent": "rare", "Matthew Bain": "deep", "Max": "rare", "Micah": "rare", "Nate": "plankton", "Neal": "schooler", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "rare", "Parker": "rare", "Riley": "krillion"} },
      { id: "ddp25", short: "a D every 25 D points", text: "who got a D at least once every 25 D points they played this season (min 10 D points played)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Eli Card": "rare", "Elliot": "rare", "Ethan Berson": "krillion", "Gavin": "schooler", "Kent": "rare", "Matthew Bain": "rare", "Max": "rare", "Micah": "schooler", "Michael Sun": "deep", "Nate": "schooler", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "schooler", "Owen": "plankton", "Parker": "schooler"} },
      { id: "goal25", short: "a goal every 25 points", text: "who caught a goal at least once every 25 points they played this season (min 15 points played)", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "schooler", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Drake": "deep", "Eli Card": "rare", "Gavin": "plankton", "JT": "krillion", "Kent": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "rare", "Nate": "rare", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "schooler", "Ryan B": "rare"} },
      { id: "c-feasterns", short: "made a catch at Feasterns", text: "who made a catch at the Feasterns tournament (Oct 16-18)", tiers: {"Ben Horton": "rare", "Bryce": "rare", "Carson Jewell": "schooler", "Centurion": "rare", "Daniel": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "King": "rare", "Matthew Bain": "rare", "Max": "rare", "Micah": "rare", "Michael Sun": "deep", "Nate": "plankton", "Neal": "schooler", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "schooler", "Parker": "rare", "Peter D": "deep"} },
      { id: "pts30", short: "30+ points", text: "who has played 30 or more points this season", tiers: {"Aashay Rathi": "rare", "Ben Horton": "rare", "Bryce": "schooler", "Carson Jewell": "rare", "Centurion": "rare", "Daniel": "rare", "Drake": "rare", "Elliot": "deep", "Ethan Berson": "rare", "Gavin": "schooler", "JT": "rare", "Kent": "rare", "King": "rare", "Matthew Bain": "rare", "Max": "schooler", "Micah": "rare", "Michael Sun": "krillion", "Nate": "schooler", "Neal": "plankton", "Noah Goldblatt": "schooler", "Oliver": "rare", "Owen": "schooler", "Parker": "rare"} },
      { id: "dp15", short: "15+ D points", text: "who has played 15 or more D points this season", tiers: {"Aashay Rathi": "rare", "Andrew Carneiro": "rare", "Ben Horton": "rare", "Bryce": "rare", "Centurion": "rare", "Daniel": "schooler", "Drake": "rare", "Elliot": "rare", "Ethan Berson": "rare", "Gavin": "schooler", "JT": "rare", "Kent": "krillion", "King": "schooler", "Matthew Bain": "rare", "Max": "schooler", "Micah": "rare", "Michael Sun": "deep", "Nate": "rare", "Neal": "plankton", "Noah Goldblatt": "schooler", "Owen": "rare", "Parker": "schooler", "Peter D": "rare"} },
      { id: "barebones", short: "caught a goal at Barebones", text: "who caught a goal at the Barebones tournament (Oct 3-4)", tiers: {"Aashay Rathi": "rare", "Bryce": "rare", "Daniel": "deep", "Drake": "rare", "Gavin": "schooler", "Kent": "schooler", "King": "krillion", "Max": "rare", "Micah": "rare", "Nate": "rare", "Neal": "rare", "Noah Goldblatt": "rare", "Oliver": "rare", "Owen": "plankton", "Parker": "plankton"} },
    ] },
];

// Shared backend (Google Apps Script web app, see backend/Code.gs). Paste the /exec URL here after
// deploying. Empty = local-only mode: the game works but there is no public leaderboard,
// no cross-device daily lock, and appeals fall back to copy-and-DM.
window.BACKEND_URL = "https://script.google.com/macros/s/AKfycbzC11Mk4p7tqF5vtPYV0s4UO85jqrhlXRX5NNaO1Hdo2CGFDybM0-vUc5E9jn2-LYLj/exec";
window.APPEAL_WHO = "Neal";
