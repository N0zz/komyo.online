// Single source of truth for the arcade catalogue.
// Add a game = drop it in games/<slug>/ and add one entry here.
// `soon: true` renders a greyed, non-clickable "coming soon" tile.
window.GAMES = [
  {
    slug: "asteroids",
    title: "Asteroids",
    blurb: "Fly, shoot, survive. Classic arcade + roguelite modes with upgrades.",
    icon: "🛸",
    accent: "#9fe8ff",
    tag: "ARCADE",
  },
  {
    slug: "tower-defense",
    title: "Keep Defender",
    blurb: "Hold the path. Build towers, spend gold, defend the keep wave after wave.",
    icon: "🏰",
    accent: "#e0b25a",
    tag: "STRATEGY",
  },
  {
    slug: "flappy",
    title: "Meadow Flyer",
    blurb: "One-tap flyer through a soft storybook meadow.",
    icon: "🐤",
    accent: "#8fd3a6",
    soon: true,
  },
  {
    slug: "aim-trainer",
    title: "Range",
    blurb: "Flick-aim headshot practice on a tactical range, against the clock.",
    icon: "🎯",
    accent: "#ff7a3c",
    soon: true,
  },
  {
    slug: "spellcaster",
    title: "Arcane",
    blurb: "Cast spells against waves of the dark. Runes, sigils, and gold filigree.",
    icon: "🔮",
    accent: "#b98cff",
    soon: true,
  },
  {
    slug: "snake",
    title: "Neon Snake",
    blurb: "The classic, in glowing neon. Grow long, don't bite yourself.",
    icon: "🐍",
    accent: "#7fffb0",
    soon: true,
  },
];
