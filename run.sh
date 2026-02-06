#!/bin/bash
cd "$(dirname "$0")"

export GITMOB_PROD=1

CACHE_DIR="$HOME/.cache/rlocal/gitmob"
CACHE_FILE="$CACHE_DIR/build_sha"

mkdir -p "$CACHE_DIR"

CURRENT_SHA=$(git rev-parse HEAD)
CACHED_SHA=$(cat "$CACHE_FILE" 2>/dev/null || echo "")
BUILD_DIR=".next-prod"

if [ "$CURRENT_SHA" != "$CACHED_SHA" ] || [ ! -f "$BUILD_DIR/BUILD_ID" ]; then
    echo "Building (sha: $CURRENT_SHA)..."
    rm -rf "$BUILD_DIR"
    npm run build
    if [ ! -f "$BUILD_DIR/BUILD_ID" ]; then
        rm -f "$CACHE_FILE"
        echo "Build failed" >&2
        exit 1
    fi
    echo "$CURRENT_SHA" > "$CACHE_FILE"
fi

PORT=$(portman static get-port gitmob)
export PORT

exec ./node_modules/.bin/next start
