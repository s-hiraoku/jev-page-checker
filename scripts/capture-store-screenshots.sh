#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/store/images"
mkdir -p "$out"
base="http://127.0.0.1:4174"
shots=(
  "screenshot-side-pass.png ?scene=pass&store=1"
  "screenshot-side-fail.png ?scene=fail&store=1"
  "screenshot-options.png ?scene=setup&store=1#options"
  "screenshot-details.png ?scene=pass&store=1#details"
)
for entry in "${shots[@]}"; do
  name="${entry%% *}"
  path="${entry#* }"
  timeout 20 google-chrome --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --window-size=1280,800 --user-data-dir="$root/.chrome-store-profile" \
    --virtual-time-budget=4000 --screenshot="$out/$name" "$base/$path" || true
  test -s "$out/$name"
done
python3 - <<PY
from pathlib import Path
root = Path("$out")
for path in sorted(root.glob("screenshot-*.png")):
    print(path.name, path.stat().st_size)
PY
