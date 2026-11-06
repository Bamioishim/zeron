#!/usr/bin/env bash
# Rebuild zeron-desktop-demo.mp4 from reviewed raw screen recordings (real footage only).
# Usage:
#   MEDIA_ROOT=/path/to/raws ./docs/scripts/build-desktop-demo.sh
# Expects in MEDIA_ROOT (or MEDIA): zeron-public-desktop-raw.mp4, zeron-practice-desktop-raw.mp4
# Writes: zeron-desktop-demo.mp4, zeron-desktop-demo-thumb.jpg (and _edit/ workdir)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MEDIA_ROOT="${MEDIA_ROOT:-${MEDIA:-${ROOT}/../zeron-media}}"
PUB="${MEDIA_ROOT}/zeron-public-desktop-raw.mp4"
PRAC="${MEDIA_ROOT}/zeron-practice-desktop-raw.mp4"
OUT="${OUT:-${MEDIA_ROOT}/zeron-desktop-demo.mp4}"
THUMB="${THUMB:-${MEDIA_ROOT}/zeron-desktop-demo-thumb.jpg}"
WORK="${MEDIA_ROOT}/_edit"
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf}"
FONT2="${FONT2:-/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf}"
test -f "$PUB" || { echo "missing $PUB (set MEDIA_ROOT)"; exit 1; }
test -f "$PRAC" || { echo "missing $PRAC (set MEDIA_ROOT)"; exit 1; }
rm -rf "$WORK" && mkdir -p "$WORK"
PRACTICE_OV="drawbox=x=0:y=0:w=iw:h=42:color=black@0.55:t=fill,drawtext=fontfile=${FONT}:text='LOCAL PRACTICE — NO FUNDS MOVED':fontcolor=0xD4FC50:fontsize=22:x=(w-text_w)/2:y=10,drawtext=fontfile=${FONT2}:text='Simulated UI rewards only · not mainnet':fontcolor=white@0.9:fontsize=14:x=(w-text_w)/2:y=34"
BURN_OV="drawbox=x=0:y=h-56:w=iw:h=56:color=black@0.6:t=fill,drawtext=fontfile=${FONT}:text='Destroyed fees to 0x...dEaD (useBurn=false)':fontcolor=0xD4FC50:fontsize=20:x=(w-text_w)/2:y=h-48,drawtext=fontfile=${FONT2}:text='Not native token.burn() / not totalSupply proof':fontcolor=white@0.95:fontsize=14:x=(w-text_w)/2:y=h-24"

ffmpeg -y -ss 0 -to 5 -i "$PUB" -an -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r 30 "$WORK/01_landing.mp4"
ffmpeg -y -ss 34 -to 42 -i "$PRAC" -an -vf "setpts=PTS/1.5,fps=30,${PRACTICE_OV}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r 30 "$WORK/02_prac_move.mp4"
ffmpeg -y -ss 42 -to 70 -i "$PRAC" -an -vf "fps=30,${PRACTICE_OV}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r 30 "$WORK/03_prac_combat.mp4"
ffmpeg -y -ss 73 -to 77 -i "$PRAC" -an -vf "fps=30,${PRACTICE_OV}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r 30 "$WORK/04_prac_potion.mp4"
ffmpeg -y -ss 19 -to 27 -i "$PUB" -an -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r 30 "$WORK/05_how.mp4"
ffmpeg -y -ss 35 -to 43 -i "$PUB" -an -vf "fps=30,${BURN_OV}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r 30 "$WORK/06_burn.mp4"
ffmpeg -y -ss 1 -i "$PUB" -frames:v 1 -update 1 "$WORK/endframe.png"
ffmpeg -y -loop 1 -t 5 -i "$WORK/endframe.png" -vf "fps=30,drawbox=x=0:y=h-120:w=iw:h=120:color=black@0.65:t=fill,drawtext=fontfile=${FONT}:text='ZERON  ·  wif on Robinhood Chain':fontcolor=0xD4FC50:fontsize=26:x=(w-text_w)/2:y=h-108,drawtext=fontfile=${FONT2}:text='CA  0x5173b8eA6923c2d40267890D45C46a3480954773':fontcolor=white:fontsize=16:x=(w-text_w)/2:y=h-72,drawtext=fontfile=${FONT2}:text='zeron-game.vercel.app':fontcolor=white:fontsize=18:x=(w-text_w)/2:y=h-42" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r 30 -t 5 "$WORK/07_end.mp4"
printf '%s\n' "file '$WORK/01_landing.mp4'" "file '$WORK/02_prac_move.mp4'" "file '$WORK/03_prac_combat.mp4'" "file '$WORK/04_prac_potion.mp4'" "file '$WORK/05_how.mp4'" "file '$WORK/06_burn.mp4'" "file '$WORK/07_end.mp4'" > "$WORK/list.txt"
ffmpeg -y -f concat -safe 0 -i "$WORK/list.txt" -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -movflags +faststart -an "$OUT"
ffmpeg -y -ss 26 -i "$WORK/03_prac_combat.mp4" -frames:v 1 -update 1 -q:v 3 "$THUMB"
# Optional: copy into repo docs/assets when DOCS_ASSETS=1
if [[ "${DOCS_ASSETS:-}" == "1" ]]; then
  cp -f "$OUT" "$ROOT/docs/assets/zeron-desktop-demo.mp4"
  cp -f "$THUMB" "$ROOT/docs/assets/zeron-desktop-demo-thumb.jpg"
fi
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
ls -la "$OUT" "$THUMB"
