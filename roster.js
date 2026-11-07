// BatCH roster for the daily huck game.
// One line per member who has played at least one tournament (BatCH Bash counts).
// tier: plankton | clever | schooler | rare | deep | krillion
// year: the year they started at UNC. Anything 2021 or earlier lands in the "2021 or before" prompt.
// To add or re-rank someone, edit this list and push. Every player's score is recomputed from
// this file on load, so an appealed name scores as soon as it is added here.
window.ROSTER = [
  ["Aashay Rathi", "schooler", 2026],
  ["Adam Eligator", "deep", 2023],
  ["Aidan Menickelli", "rare", 2025],
  ["Andrew Carneiro", "schooler", 2025],
  ["Andrew Wang", "deep", 2023],
  ["Ani", "krillion", 2023],
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
  ["Gavin", "schooler", 2025],
  ["Gram", "rare", 2025],
  ["Henry Holland", "deep", 2023],
  ["Isaac Ho", "rare", 2025],
  ["Isaac Lefevre", "rare", 2026],
  ["Ish", "rare", 2025],
  ["Jack Herring", "schooler", 2023],
  ["James Conley", "rare", 2021],
  ["Jeremy F", "rare", 2025],
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
  ["Oliver", "schooler", 2025],
  ["Owen", "plankton", 2023],
  ["Parker", "schooler", 2023],
  ["Peter C", "deep", 2022],
  ["Peter D", "schooler", 2026],
  ["Rishi Singh", "deep", 2023],
  ["Robert S", "krillion", 2024],
  ["Ryan B", "rare", 2026],
  ["Sylvan", "krillion", 2025],
  ["Taran", "rare", 2022],
];

// Tiers: points are yards downfield. 100 = caught in the end zone.
window.TIERS = {
  plankton: { label: "plankton",          pts: 10,  color: "#9aa3a6", caption: "that's the farthest i've seen nate throw" },
  clever:   { label: "too clever",        pts: 15,  color: "#c07a3e", caption: "bro that is NOT smart" },
  schooler: { label: "schooler",          pts: 30,  color: "#7cc4ef", caption: "textbook swing. gets the disc moving" },
  rare:     { label: "rare",              pts: 60,  color: "#e2453c", caption: "schmeatball sub but caught by Gavin/Parker" },
  deep:     { label: "deep cut",          pts: 85,  color: "#a463e0", caption: () => (Math.random() < 0.5 ? `Blueberry for ${window.pickKrillion()}` : "this is as niche as the april 2025 leadership call with justin ford") },
  krillion: { label: "one in a krillion", pts: 100, color: "#f2c230", caption: "Andrew's pulls" },
};

// Deep-cut caption names a random one-in-a-krillion teammate.
window.pickKrillion = () => {
  const k = window.ROSTER.filter((r) => r[1] === "krillion").map((r) => r[0].split(" ")[0]);
  return k[Math.floor(Math.random() * k.length)];
};

// The seven daily prompts, in order.
window.PROMPTS = [
  { id: "y2021", text: "who started at UNC in 2021 or before", test: (y) => y <= 2021 },
  { id: "y2022", text: "who started at UNC in 2022", test: (y) => y === 2022 },
  { id: "y2023", text: "who started at UNC in 2023", test: (y) => y === 2023 },
  { id: "y2024", text: "who started at UNC in 2024", test: (y) => y === 2024 },
  { id: "y2025", text: "who started at UNC in 2025", test: (y) => y === 2025 },
  { id: "y2026", text: "who started at UNC in 2026", test: (y) => y === 2026 },
  { id: "wild",  text: "anyone, ever: wildcard", test: () => true },
];

// Where appeals go. The appeal button opens a text with the name prefilled.
window.APPEAL = { sms: "+14253401365", who: "Neal" };
