#!/bin/bash
PORT=${1:-8080}
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== TokenCompare ==="
echo "Starte Server auf: http://localhost:$PORT"
xdg-open "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT" 2>/dev/null || true
python3 -m http.server "$PORT" --directory "$DIR"