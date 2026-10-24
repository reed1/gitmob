#!/bin/sh
# Every PWA declares its icons through `metadata.icons`, not through Next's app-directory file
# conventions: a convention file in `src/app/` wins over metadata on every nested route too, so
# the root icon would follow /pinboard and /checklist around. Everything lives in `public/` instead.
dir="$(dirname "$0")"
pub="$dir/../public"
svg="$dir/icon.svg"
pin="$dir/pinboard-icon.svg"
check="$dir/checklist-icon.svg"

rsvg-convert -w 180 -h 180 "$svg" -o "$pub/icon.png"
rsvg-convert -w 180 -h 180 "$svg" -o "$pub/apple-icon.png"
rsvg-convert -w 192 -h 192 "$svg" -o "$pub/icon-192.png"
rsvg-convert -w 512 -h 512 "$svg" -o "$pub/icon-512.png"

rsvg-convert -w 180 -h 180 "$pin" -o "$pub/pinboard-icon.png"
rsvg-convert -w 180 -h 180 "$pin" -o "$pub/pinboard-apple-icon.png"
rsvg-convert -w 192 -h 192 "$pin" -o "$pub/pinboard-icon-192.png"
rsvg-convert -w 512 -h 512 "$pin" -o "$pub/pinboard-icon-512.png"

rsvg-convert -w 180 -h 180 "$check" -o "$pub/checklist-icon.png"
rsvg-convert -w 180 -h 180 "$check" -o "$pub/checklist-apple-icon.png"
rsvg-convert -w 192 -h 192 "$check" -o "$pub/checklist-icon-192.png"
rsvg-convert -w 512 -h 512 "$check" -o "$pub/checklist-icon-512.png"

rsvg-convert -w 16 -h 16 "$svg" -o /tmp/gitmob-icon-16.png
rsvg-convert -w 32 -h 32 "$svg" -o /tmp/gitmob-icon-32.png
magick /tmp/gitmob-icon-16.png /tmp/gitmob-icon-32.png "$pub/favicon.ico"

rsvg-convert -w 16 -h 16 "$pin" -o /tmp/gitmob-pin-16.png
rsvg-convert -w 32 -h 32 "$pin" -o /tmp/gitmob-pin-32.png
magick /tmp/gitmob-pin-16.png /tmp/gitmob-pin-32.png "$pub/pinboard-favicon.ico"

rsvg-convert -w 16 -h 16 "$check" -o /tmp/gitmob-check-16.png
rsvg-convert -w 32 -h 32 "$check" -o /tmp/gitmob-check-32.png
magick /tmp/gitmob-check-16.png /tmp/gitmob-check-32.png "$pub/checklist-favicon.ico"
