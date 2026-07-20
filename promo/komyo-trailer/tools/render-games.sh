#!/bin/bash
set -e
cd ~/arcade/promo/komyo-trailer
declare -a JOBS=(
  "game-v2-stage-9x16.html:game-v2-stage-9x16-forcefield.mp4"
  "game-v2-stage-9x16-snakebanger.html:game-v2-stage-9x16-snakebanger.mp4"
  "game-v3-hype-9x16.html:game-v3-hype-9x16-forcefield.mp4"
  "game-v3-hype-9x16-snakebanger.html:game-v3-hype-9x16-snakebanger.mp4"
)
for j in "${JOBS[@]}"; do
  src="${j%%:*}"; out="${j##*:}"
  echo "=== RENDER $out (60fps) ==="
  cp "variants/$src" index.html
  npx --yes hyperframes@0.7.53 render --fps 60 --quality high --output "finals-games/$out" 2>&1 | tail -2
done
echo "ALL DONE"; ls -la finals-games/*.mp4
