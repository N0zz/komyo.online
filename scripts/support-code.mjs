// Today's parental-lock support code (see game-kit.js lockSupportCode — keep the math in lockstep).
// Usage: node scripts/support-code.mjs [YYYY-MM-DD]
// The code rotates at UTC midnight on its own — nothing to store or update anywhere. Give it to a
// parent who forgot their PIN: Settings/store PIN pad → "Forgot PIN?" → "Enter support code".
// It removes the lock without revealing their PIN; scores and progress are untouched.
// The pad also accepts YESTERDAY's UTC code, so a just-generated code survives the midnight edge.
function supportCode(dayStr) {
  const s = 'komyo-support:' + dayStr;
  let h = 2166136261;
  for (let j = 0; j < 7; j++) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return ('0000000' + (h % 100000000)).slice(-8);
}

const day = process.argv[2] || new Date().toISOString().slice(0, 10);
console.log(`${day} (UTC): ${supportCode(day)}`);
