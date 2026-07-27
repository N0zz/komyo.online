// Posts to the Discord changelog channel ONLY the changelog entries that were ADDED in
// this push — diffing changelog.js against the push's base commit. Mirrors the in-page
// changelog exactly, so Discord never sees chore/ci/docs/refactor noise.
//
// Env: WEBHOOK (Discord webhook URL), BEFORE (github.event.before — the base SHA).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const WEBHOOK = process.env.WEBHOOK;
const BEFORE = (process.env.BEFORE || '').trim();

// Evaluate a changelog.js (`window.CHANGELOG = [...]`) and return the array. The input is
// ALWAYS our own in-repo file (working tree, or `git show` of a committed SHA) — same trust
// as the workflow itself — never user input, so this is config-as-code, not arbitrary eval.
function load(src) {
  try { return new Function('window', src + '\n;return (window.CHANGELOG || []);')({}) || []; }
  catch { return []; }
}

const cur = load(fs.readFileSync('changelog.js', 'utf8'));

// Previous version of the file at the push base (skip on new-branch/force-push zero SHA).
// execFileSync (argv array, no shell) + a strict hex guard → BEFORE can't inject anything.
// prev === null means "no baseline to diff against" (file absent at base, or unknown SHA);
// in that case we skip rather than dump the whole existing changelog as if it were new.
let prev = null;
if (/^[0-9a-f]{40}$/.test(BEFORE)) {
  try { prev = load(execFileSync('git', ['show', `${BEFORE}:changelog.js`], { encoding: 'utf8' })); }
  catch { prev = null; }
}
if (prev === null) { console.log('No previous changelog.js to diff against — skipping (baseline).'); process.exit(0); }

// An item is "new" if its (date, exact text) pair wasn't present before.
const seen = new Set();
for (const r of prev) for (const it of (r.items || [])) seen.add(r.date + '\0' + it);

const fresh = [];
for (const r of cur) {
  const items = (r.items || []).filter(it => !seen.has(r.date + '\0' + it));
  if (items.length) fresh.push({ date: r.date, title: r.title, items });
}

if (!fresh.length) { console.log('No new changelog entries — nothing to post.'); process.exit(0); }

// POST OLDEST FIRST. changelog.js is newest-first (that is how the 🗒️ modal reads, top of the page
// = latest), but a chat channel appends downward, so posting in file order makes a multi-entry push
// read backwards: fixes to a game announced before the message announcing the game. Reversing gives
// the channel the same chronology as the rest of its history. A single-entry push is unaffected.
fresh.reverse();

// Discord caps message content at 2000 chars. Never truncate mid-sentence: build one block per
// release, splitting an over-long release on bullet boundaries (re-heading the continuation), then
// pack blocks into as few messages as fit and post them in order.
const LIMIT = 1900; // headroom under 2000 for the header line
const blocks = [];
for (const r of fresh) {
  const head = `**${r.date} · ${r.title}**`;
  let block = head;
  for (const it of r.items) {
    let line = '• ' + it;
    if (line.length > 1500) line = line.slice(0, 1499) + '…'; // lone-bullet safety net
    if (block.length + 1 + line.length > LIMIT) { blocks.push(block); block = `${head} *(cont.)*`; }
    block += '\n' + line;
  }
  blocks.push(block);
}
const messages = [];
let content = `📝 **Komyo Games** — what's new`;
for (const b of blocks) {
  if (content.length + 2 + b.length > LIMIT) { messages.push(content); content = b; }
  else content += '\n\n' + b;
}
messages.push(content);

if (!WEBHOOK) { console.log('WEBHOOK not set — would have posted:\n' + messages.join('\n\n———\n\n')); process.exit(0); }

for (const msg of messages) {
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Komyo Games', content: msg, allowed_mentions: { parse: [] } }),
  });
  console.log('Discord responded', res.status);
  if (!res.ok) { console.error(await res.text().catch(() => '')); process.exit(1); }
}
