#!/bin/bash
# =============================================================================
# TokenCompare – Lokaler Entwicklungsserver
# =============================================================================

# Port aus Kommandozeilen-Argument oder Standard 8080
PORT=${1:-8080}

# Ermittle das Verzeichnis, in dem dieses Skript liegt (für --directory)
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== TokenCompare ==="
echo "Starte Server auf: http://localhost:$PORT"

# Versuche, den Browser automatisch zu öffnen (xdg-open für Linux, open für macOS)
xdg-open "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT" 2>/dev/null || true

# Python 3 HTTP-Server – serviert statische Dateien aus dem Projektverzeichnis
python3 -m http.server "$PORT" --directory "$DIR"