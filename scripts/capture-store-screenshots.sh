#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$root/scripts/capture-store-screenshots.mjs"
