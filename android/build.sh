#!/bin/sh
exec uv run --project ~/proj/webview-apk webview-apk build "$(dirname "$0")/gitmob.yaml"
