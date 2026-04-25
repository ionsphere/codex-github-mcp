#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  codex-github-mcp  —  Unix/macOS self-hosted launcher (stdio transport)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

# Load .env if present
if [[ -f .env ]]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[ERROR] GITHUB_TOKEN is not set. Add it to .env or export it." >&2
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "[ERROR] node not found in PATH. Install Node.js 18+." >&2
  exit 1
fi

if [[ ! -f dist/index.js ]]; then
  echo "[INFO] dist/index.js not found — building..." >&2
  npm run build
fi

exec node dist/index.js --transport stdio "$@"
