{
  pkgs,
  src,
}:
pkgs.runCommand "slopfarm-forest-assets" {
  nativeBuildInputs = [pkgs.blender];
} ''
  export HOME="$TMPDIR/home"
  export PYTHONDONTWRITEBYTECODE=1
  mkdir -p "$HOME" scripts
  cp -R ${src}/scripts/blender scripts/blender
  cp -R ${src}/src src
  blender --background --factory-startup --threads 1 --python-exit-code 1 \
    --python scripts/blender/generate_forest.py
  blender --background --factory-startup --threads 1 --python-exit-code 1 \
    --python scripts/blender/validate_forest.py -- --compare ${src}/assets/forest
  blender --background --factory-startup --threads 1 --python-exit-code 1 \
    --python scripts/blender/test_market_visibility.py
  mkdir -p "$out"
  cp assets/forest/validation-report.json "$out/"
''
