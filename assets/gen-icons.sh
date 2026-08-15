#!/bin/sh
dir="$(dirname "$0")"
svg="$dir/icon.svg"

rsvg-convert -w 180 -h 180 "$svg" -o "$dir/../src/app/icon.png"
rsvg-convert -w 180 -h 180 "$svg" -o "$dir/../src/app/apple-icon.png"
rsvg-convert -w 192 -h 192 "$svg" -o "$dir/../public/icon-192.png"
rsvg-convert -w 512 -h 512 "$svg" -o "$dir/../public/icon-512.png"

rsvg-convert -w 16 -h 16 "$svg" -o /tmp/gitmob-icon-16.png
rsvg-convert -w 32 -h 32 "$svg" -o /tmp/gitmob-icon-32.png
magick /tmp/gitmob-icon-16.png /tmp/gitmob-icon-32.png "$dir/../src/app/favicon.ico"
