#!/usr/bin/env bash
# Card gameplay loop — text-free, full-bleed 9:16 montage of 3 gameplay windows,
# crossfaded, muted, for the catalogue game-card media slot. Built from the same
# prepped footage + verified V2 windows (minus the payoff shot).
# Usage: card-loop.sh <footage.mp4> <keepH> <out.mp4> <t0> <t1> <t2>
#   keepH = source height AFTER cropping the bottom version-stamp footer (even).
set -euo pipefail
F="$1"; KEEP="$2"; OUT="$3"; T0="$4"; T1="$5"; T2="$6"
SXF="${7:-0.5}"        # seam crossfade / rotated-slice length (0.5s ≈ 15 frames @30fps)
CLIP=4          # seconds per window
XF=0.5          # crossfade duration between windows
vf="crop=1080:${KEEP}:0:0,scale=480:854:force_original_aspect_ratio=increase,crop=480:854,fps=30,setpts=PTS-STARTPTS"
# SEAMLESS PIXEL-PERFECT LOOP: rotate clip0's first SXF seconds to the END as the seam
# crossfade target. Play clip0[SXF..end] → clip1 → clip2 → (xfade into) clip0[0..SXF];
# `<video loop>` then wraps clip0[SXF-1frame]→clip0[SXF] — CONSECUTIVE frames of one
# capture, so no jump, no freeze, and the opening frames appear exactly once (no
# duplication). The dissolve hides the clip2→clip0 window change.
O1=$(echo "$CLIP-$SXF-$XF"|bc)         # clip0[SXF..] → clip1
O2=$(echo "2*$CLIP-$SXF-2*$XF"|bc)     # clip1 → clip2
O3=$(echo "3*$CLIP-$SXF-3*$XF"|bc)     # clip2 → clip0[0..SXF]
ffmpeg -y \
  -ss "$T0" -t "$CLIP" -i "$F" \
  -ss "$T1" -t "$CLIP" -i "$F" \
  -ss "$T2" -t "$CLIP" -i "$F" \
  -filter_complex "\
[0:v]${vf},split[c0a][c0d];\
[c0a]trim=start=${SXF}:end=${CLIP},setpts=PTS-STARTPTS[a];\
[c0d]trim=0:${SXF},setpts=PTS-STARTPTS[d];\
[1:v]${vf}[v1];[2:v]${vf}[v2];\
[a][v1]xfade=transition=fade:duration=${XF}:offset=${O1}[x1];\
[x1][v2]xfade=transition=fade:duration=${XF}:offset=${O2}[x2];\
[x2][d]xfade=transition=fade:duration=${SXF}:offset=${O3}[out]" \
  -map "[out]" -an -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT"
