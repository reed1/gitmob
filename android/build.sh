#!/bin/sh
uv run --project ~/proj/webview-apk webview-apk build "$(dirname "$0")/gitmob.yaml"
scp /home/reed/proj/webview-apk/app/build/outputs/apk/debug/app-debug.apk sgtent:dl/gitmob.apk
echo https://dl.r-mulyadi.com/gitmob.apk
