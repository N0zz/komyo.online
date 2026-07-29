#!/usr/bin/env bash
# Stamp unreleased games with their REAL go-live date (the day they are pushed to main).
# `added` drives the NEW badge, `playableSince` gates their challenge/random-pick slots, the
# changelog entry is what players read and sitemap.xml carries a lastmod — all must be the SAME
# single date, so this sets them together. Re-run on the actual push day, e.g.
#   scripts/set-release-date.sh 2026-07-29 tube-racer
# With no slugs it falls back to the 2026-07-27 batch, which is how it shipped originally.
set -euo pipefail
NEW="${1:?usage: set-release-date.sh YYYY-MM-DD [slug ...]}"
[[ "$NEW" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "not a date: $NEW" >&2; exit 1; }
shift || true
cd "$(dirname "$0")/.."
GAMES="${*:-type-siege dusk-runner floodgate mirror-maze}"
FIRST=$(echo "$GAMES" | awk '{print $1}')
OLD=$(sed -n "s/.*'\?$FIRST'\?: '\([0-9-]*\)'.*/\1/p" challenges.js | head -1)
[[ -n "$OLD" ]] || { echo "could not read the current date from challenges.js" >&2; exit 1; }
echo "release date: $OLD → $NEW"
for g in $GAMES; do
    perl -0pi -e "s/(slug: \"$g\",(?:.*?\n)*?    added: \")$OLD(\")/\${1}$NEW\${2}/" games.js
done
for g in $GAMES; do
    perl -pi -e "s/('?\Q$g\E'?): '$OLD'/\$1: '$NEW'/g" challenges.js
    perl -pi -e "s|(games/\Q$g\E/</loc><lastmod>)$OLD|\${1}$NEW|" sitemap.xml
done
perl -pi -e "s/(date: ')$OLD(', title: '(?:Four new games|New game))/\${1}$NEW\${2}/" changelog.js
echo "--- games.js"; grep -E "added: \"$NEW\"" games.js | sed 's/^/  /'
echo "--- challenges.js"; grep -o "'\?[a-z-]*'\?: '$NEW'" challenges.js | sed 's/^/  /'
echo "--- changelog.js"; grep -n "date: '$NEW'" changelog.js | sed 's/^/  /'
