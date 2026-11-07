// BatCH roster for the daily huck game.
// One line per member who has played at least one tournament (BatCH Bash counts).
// tier: plankton | clever | schooler | rare | deep | krillion
// year: the year they started at UNC, or a list of years when either counts ([2022, 2023]).
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
  schooler: { label: "schooler",          pts: 30,  color: "#7cc4ef", caption: "textbook swing. gets the disc moving" },
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
  { id: "y2021", short: "in 2021 or before", text: "who started at UNC in 2021 or before", test: (y) => y <= 2021 },
  { id: "y2022", short: "in 2022", text: "who started at UNC in 2022", test: (y) => y === 2022 },
  { id: "y2023", short: "in 2023", text: "who started at UNC in 2023", test: (y) => y === 2023 },
  { id: "y2024", short: "in 2024", text: "who started at UNC in 2024", test: (y) => y === 2024 },
  { id: "y2025", short: "in 2025", text: "who started at UNC in 2025", test: (y) => y === 2025 },
  { id: "y2026", short: "in 2026", text: "who started at UNC in 2026", test: (y) => y === 2026 },
  { id: "wild",  short: "ever", text: "who ever played, any year (wildcard)", test: () => true },
];

// Shared backend (Google Apps Script web app, see backend/Code.gs). Paste the /exec URL here after
// deploying. Empty = local-only mode: the game works but there is no public leaderboard,
// no cross-device daily lock, and appeals fall back to copy-and-DM.
window.BACKEND_URL = "https://script.google.com/macros/s/AKfycbzC11Mk4p7tqF5vtPYV0s4UO85jqrhlXRX5NNaO1Hdo2CGFDybM0-vUc5E9jn2-LYLj/exec";
window.APPEAL_WHO = "Neal";
