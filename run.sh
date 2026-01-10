#!/bin/bash
cd "$(dirname "$0")"

CACHE_DIR="$HOME/.cache/rlocal/gitmob"
CACHE_FILE="$CACHE_DIR/build_sha"

mkdir -p "$CACHE_DIR"

CURRENT_SHA=$(git rev-parse HEAD)
CACHED_SHA=$(cat "$CACHE_FILE" 2>/dev/null || echo "")

if [ "$CURRENT_SHA" != "$CACHED_SHA" ]; then
    echo "Build cache miss, rebuilding..."
    npm run build
    echo "$CURRENT_SHA" > "$CACHE_FILE"
fi

PORT=$(portman static get gitmob)
export PORT

exec npm start
