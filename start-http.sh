#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  codex-github-mcp  —  Unix/macOS self-hosted launcher (HTTP transport)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -o allexport
  source .env
  set +o allexport
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[ERROR] GITHUB_TOKEN is not set." >&2
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "[ERROR] node not found in PATH. Install Node.js 18+." >&2
  exit 1
fi

if [[ ! -f dist/index.js ]]; then
  echo "[INFO] Building..." >&2
  npm run build
fi

PORT="${MCP_PORT:-3000}"
echo "[INFO] Starting HTTP MCP server on http://127.0.0.1:${PORT}" >&2
exec node dist/index.js --transport http --port "${PORT}" "$@"
