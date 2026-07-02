#!/usr/bin/env bash
# bench.sh — request-size / compression benchmark for komyo.
# For each asset: raw (identity) size, size actually served with Accept-Encoding,
# the encoding the server picked, TTFB, and what gzip -9 / brotli -q11 could do.
#
# usage: scripts/bench.sh [base-url ...]
#        default bases: http://localhost:8765 https://komyo.online
set -euo pipefail
export LC_ALL=C # consistent decimal points in awk output

if [ $# -gt 0 ]; then
    BASES=("$@")
else
    BASES=(http://localhost:8765 https://komyo.online)
fi

ASSETS=(
    /
    /games.js
    /challenges.js
    /changelog.js
    /analytics.js
    /game-kit.js
    /game-kit.css
    /sw.js
    /manifest.json
    /favicon.svg
    /og-image.png
    /games/snake/
)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

HAS_BROTLI=0
command -v brotli > /dev/null 2>&1 && HAS_BROTLI=1

human() {
    awk -v b="$1" 'BEGIN {
        if (b >= 1048576) printf "%.1fM", b / 1048576
        else if (b >= 1024) printf "%.1fK", b / 1024
        else printf "%dB", b
    }'
}

bench_base() {
    local base="$1"
    local t_raw=0 t_srv=0 t_gz=0 t_br=0
    printf '\n== %s ==\n' "$base"
    printf '%-22s %9s %9s %-8s %8s %8s %7s  %s\n' \
        asset raw served enc gzip-9 br-11 ttfb cache-control

    for a in "${ASSETS[@]}"; do
        local url="$base$a" body="$TMP/body"

        # raw (uncompressed) body — also the input for the "what could we save" columns
        local raw
        raw=$(curl -sS --compressed -o "$body" -w '%{size_download}' \
            -H 'Cache-Control: no-cache' "$url" 2> /dev/null) || {
            printf '%-22s %9s\n' "$a" 'FAIL'
            continue
        }
        raw=$(wc -c < "$body" | tr -d ' ')

        # what the server actually sends to a modern browser
        local line served enc ttfb cc
        line=$(curl -sS -o /dev/null \
            -H 'Accept-Encoding: gzip, br, zstd' -H 'Cache-Control: no-cache' \
            -w '%{size_download}|%header{content-encoding}|%{time_starttransfer}|%header{cache-control}' \
            "$url" 2> /dev/null)
        served=${line%%|*}
        line=${line#*|}
        enc=${line%%|*}
        line=${line#*|}
        ttfb=${line%%|*}
        cc=${line#*|}
        [ -n "$enc" ] || enc=none

        # achievable sizes
        local gz br=-
        gz=$(gzip -9 -c "$body" | wc -c | tr -d ' ')
        if [ "$HAS_BROTLI" = 1 ]; then
            br=$(brotli -q 11 -c "$body" | wc -c | tr -d ' ')
            t_br=$((t_br + br))
        fi

        t_raw=$((t_raw + raw))
        t_srv=$((t_srv + served))
        t_gz=$((t_gz + gz))

        printf '%-22s %9s %9s %-8s %8s %8s %6sms  %s\n' \
            "$a" "$(human "$raw")" "$(human "$served")" "$enc" \
            "$(human "$gz")" "$(if [ "$br" = - ]; then echo -; else human "$br"; fi)" \
            "$(awk -v t="$ttfb" 'BEGIN { printf "%d", t * 1000 }')" "$cc"
    done

    printf '%-22s %9s %9s %-8s %8s %8s\n' 'TOTAL' \
        "$(human "$t_raw")" "$(human "$t_srv")" '' "$(human "$t_gz")" \
        "$(if [ "$HAS_BROTLI" = 1 ]; then human "$t_br"; else echo -; fi)"
}

for b in "${BASES[@]}"; do
    bench_base "$b"
done

[ "$HAS_BROTLI" = 1 ] || printf '\n(no brotli CLI on this machine — br-11 column skipped)\n'
