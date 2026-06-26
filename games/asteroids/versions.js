// Single source of truth for the version menu.
// Each entry is a self-contained, fully-playable build living in levels/.
// Git history is the record of iterations — see CLAUDE.md.
window.VERSIONS = [
  {
    file: "levels/classic.html",
    title: "Classic Asteroids",
    desc: "The original — fly, shoot, dodge, screen-wrap.",
    tag: "CLASSIC",
    // speedrun goal shown in the menu
    goal: "Reach 2000 points",
  },
  {
    file: "levels/classic-enhanced.html",
    title: "Classic Asteroids — Enhanced",
    desc: "Pause, Enter/Space start, weapon tiers, polish.",
    tag: "CLASSIC",
    goal: "Reach 2000 points",
  },
  {
    file: "levels/roguelite-levelup.html",
    title: "Roguelite: Auto Level-Up",
    desc: "Enemies drop XP gems — level up and pick upgrades.",
    tag: "ROGUELITE",
    goal: "Clear wave 5 (first boss)",
  },
  {
    file: "levels/roguelite-milestones.html",
    title: "Roguelite: Score Milestones",
    desc: "Cross score milestones to pick upgrades.",
    tag: "ROGUELITE",
    goal: "Clear wave 5 (first boss)",
  },
  {
    file: "levels/roguelite-shop.html",
    title: "Roguelite: Wave Shop",
    desc: "Spend credits in a shop between waves.",
    tag: "ROGUELITE",
    goal: "Clear wave 5 (first boss)",
  },
];
