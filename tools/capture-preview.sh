#!/usr/bin/env bash
set -euo pipefail

output="${1:-preview.png}"
url="${2:-http://127.0.0.1:5173/}"
wrapper="$(mktemp --suffix=.html)"
trap 'rm -f "$wrapper"' EXIT

cat >"$wrapper" <<HTML
<!doctype html>
<style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden}</style>
<iframe src="$url"></iframe>
<script type="module">await new Promise(resolve => setTimeout(resolve, 8000));</script>
HTML

firefox --headless --screenshot "$output" --window-size 1280,720 "file://$wrapper"
