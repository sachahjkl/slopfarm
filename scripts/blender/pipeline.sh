#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output="$root/assets/forest"
scripts="$root/scripts/blender"
export PYTHONDONTWRITEBYTECODE=1

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--verify-reproducible" ) ]]; then
  echo "Usage : bash scripts/blender/pipeline.sh [--verify-reproducible]" >&2
  exit 2
fi

blender --background --factory-startup --threads 1 --python-exit-code 1 \
  --python "$scripts/generate_forest.py" -- --output "$output"

case "${1:-}" in
  --verify-reproducible)
    comparison="$(mktemp -d "$root/assets/.forest-rebuild.XXXXXX")"
    trap 'rm -rf -- "$comparison"' EXIT
    blender --background --factory-startup --threads 1 --python-exit-code 1 \
      --python "$scripts/generate_forest.py" -- --output "$comparison"
    blender --background --factory-startup --threads 1 --python-exit-code 1 \
      --python "$scripts/validate_forest.py" -- --input "$output" --compare "$comparison"
    ;;
  "")
    blender --background --factory-startup --threads 1 --python-exit-code 1 \
      --python "$scripts/validate_forest.py" -- --input "$output"
    ;;
esac
