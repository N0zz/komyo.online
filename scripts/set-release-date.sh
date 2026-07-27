#!/usr/bin/env bash
# Stamp the four unreleased games with their REAL go-live date (the day they are pushed to main).
# `added` drives the NEW badge, `playableSince` gates their challenge/random-pick slots, and the
# changelog entry is what players read — all three must be the SAME single date, so this sets them
# together. Re-run on the actual push day:  scripts/set-release-date.sh 2026-07-28
set -euo pipefail
NEW="${1:?usage: set-release-date.sh YYYY-MM-DD}"
[[ "$NEW" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "not a date: $NEW" >&2; exit 1; }
cd "$(dirname "$0")/.."
GAMES="type-siege dusk-runner floodgate mirror-maze"
OLD=$(sed -n "s/.*'dusk-runner': '\([0-9-]*\)'.*/\1/p" challenges.js | head -1)
[[ -n "$OLD" ]] || { echo "could not read the current date from challenges.js" >&2; exit 1; }
echo "release date: $OLD → $NEW"
for g in $GAMES; do
    perl -0pi -e "s/(slug: \"$g\",(?:.*?\n)*?    added: \")$OLD(\")/\${1}$NEW\${2}/" games.js
done
perl -pi -e "s/('?\b(?:dusk-runner|mirror-maze|type-siege|floodgate)'?): '$OLD'/\$1: '$NEW'/g" challenges.js
perl -pi -e "s/(date: ')$OLD(', title: 'Four new games)/\${1}$NEW\${2}/" changelog.js
echo "--- games.js"; grep -E "added: \"$NEW\"" games.js | sed 's/^/  /'
echo "--- challenges.js"; grep -o "'\?[a-z-]*'\?: '$NEW'" challenges.js | sed 's/^/  /'
echo "--- changelog.js"; grep -n "date: '$NEW'" changelog.js | sed 's/^/  /'
