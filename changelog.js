// Player-facing changelog — newest first. Single source of truth for BOTH the in-page
// 🗒️ Changelog modal (index.html) AND the Discord changelog post: the GitHub Action posts
// only the entries ADDED in a push (diff vs the previous commit), so Discord == this file.
// One release per date: { date:'YYYY-MM-DD', title:'…', items:['New: …','Fix: …'] }.
// Keep bullets plain-language and about what a PLAYER notices — never kit/test/build/refactor.
window.CHANGELOG = [
  { date: '2026-06-27', title: 'We are now Komyo Games', items: [
    'New name & logo: funyo is now Komyo Games — same games, fresh fox mascot.',
    'New: your score auto-posts to our Discord on game-over — now with the game mode + stats (accuracy, level, wave…). Set a display name in the menu, or stay anonymous.',
  ] },
  { date: '2026-06-27', title: 'Home redesign & polish', items: [
    'New: redesigned home page — slide-out menu, instant search and genre filters (your filters now save in the link, so you can bookmark them).',
    'New: NEW and UPDATED badges on game tiles, so fresh and recently-improved games are easy to spot.',
    'New: “Reset all data” to clear your scores, progress and favorites across every game.',
    'New: this changelog 🙂',
    'Fix: Brick Breaker ran too fast on some phones — speed is now consistent everywhere.',
    'Fix: Range “Sprint” is now a proper race to 100 targets.',
  ] },
  { date: '2026-06-26', title: 'First games launch', items: [
    'Added 8 games: Asteroids, Keep Defender, Bubble Pop, Brick Breaker, Stack, Meadow Flyer, Range and Neon Snake.',
  ] },
];
