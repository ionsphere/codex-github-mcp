# codex-github-mcp

A full-featured **Model Context Protocol (MCP) server** for GitHub — purpose-built so Claude, Codex, and any other MCP-compatible AI can work with GitHub efficiently.

## Feature highlights

| Category | Tools |
|---|---|
| **Repositories** | list, get, create, fork, delete, topics, collaborators |
| **Branches & Tags** | list, create, delete branches; list & create tags |
| **Commits** | list, get full diff, compare refs, cherry-pick diff |
| **Files & Contents** | get file, list directory, raw text, create/update, delete, push multiple files atomically |
| **Full Repo Checkout** | `checkout_repo` — downloads **every file** in the repo as structured JSON in one call |
| **Issues** | list, get, create, update, close/reopen, labels, milestones |
| **Comments** | add, list, update, delete issue & review comments |
| **Pull Requests** | list, get, create, update, merge (merge/squash/rebase) |
| **PR Reviews** | list, create (APPROVE / REQUEST_CHANGES / COMMENT), inline review comments |
| **Search** | repositories, code, issues/PRs, commits, users |
| **GitHub Actions** | list workflows & runs, get run details, trigger, cancel, re-run, jobs, logs, artifacts |
| **Gists** | list, get, create, update, delete |
| **Notifications** | list, mark read, get & mark thread |
| **Users & Orgs** | get authenticated user, get user, list orgs, get org, list members, list followers |
| **Git Data API** | get/list/update refs, create commits/trees/blobs (low-level) |

**89 tools total.**

---

## Requirements

- **Node.js 18+** (LTS recommended)
- A GitHub **Personal Access Token** (PAT) with the scopes you need:
  - `repo` — full repository access (read + write)
  - `read:org` — org membership
  - `gist` — gist read/write
  - `notifications` — notifications
  - `workflow` — trigger/manage Actions
- For GitHub Enterprise Server add `read:user` and change `GITHUB_API_URL`.

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/your-org/codex-github-mcp.git
cd codex-github-mcp
npm install

# 2. Configure
cp .env.example .env
# Edit .env and set GITHUB_TOKEN=ghp_...

# 3. Build
npm run build

# 4. Run (stdio — for Claude Desktop / Codex CLI)
node dist/index.js
# or
./start.sh          # Unix/macOS
start.bat           # Windows
```

---

## Transports

### stdio (default)

The default transport. The server reads JSON-RPC from `stdin` and writes to `stdout`. All log output goes to `stderr` so it never corrupts the MCP stream.

This is the mode used by **Claude Desktop**, **Codex CLI**, **Cursor**, **Zed**, and virtually every standard MCP harness.

```bash
node dist/index.js --transport stdio
```

### HTTP (Streamable HTTP)

Runs an HTTP server that implements the MCP Streamable HTTP transport (POST/GET/DELETE `/mcp`). Ideal for self-hosting on a Windows PC and connecting from a browser extension or a remote client.

```bash
node dist/index.js --transport http --port 3000
# or
start-http.bat 3000   # Windows
./start-http.sh       # Unix/macOS
```

Endpoints:
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | Start a new session or send a request to an existing one |
| `GET` | `/mcp` | SSE stream (send `Mcp-Session-Id` header) |
| `DELETE` | `/mcp` | Close a session |
| `GET` | `/health` | Health check — no auth required |
| `GET` | `/tools` | List all tool names & descriptions — no auth required |

Pass your GitHub token per-request via:
- `Authorization: Bearer ghp_...`
- `X-GitHub-Token: ghp_...`

---

## Configuration

All options can be set via environment variables (`.env` file) or CLI flags.

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | `--token` | *(required)* | GitHub PAT |
| `GITHUB_API_URL` | `--api-url` | `https://api.github.com` | Override for GitHub Enterprise |
| `MCP_TRANSPORT` | `--transport` | `stdio` | `stdio` or `http` |
| `MCP_PORT` | `--port` | `3000` | HTTP server port |
| `MCP_HOST` | `--host` | `127.0.0.1` | HTTP server bind address |
| `LOG_LEVEL` | `--log-level` | `info` | `debug` / `info` / `warn` / `error` |

---

## Integrating with Claude Desktop

Edit `claude_desktop_config.json` (location below):

| OS | Path |
|----|------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/claude/claude_desktop_config.json` |

### Option A — run directly with Node (cross-platform)

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": [
        "C:/path/to/codex-github-mcp/dist/index.js",
        "--transport", "stdio"
      ],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Option B — use the Windows batch launcher

```json
{
  "mcpServers": {
    "github": {
      "command": "cmd",
      "args": ["/c", "C:\\path\\to\\codex-github-mcp\\start.bat"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Option C — use the Unix shell launcher

```json
{
  "mcpServers": {
    "github": {
      "command": "/bin/bash",
      "args": ["/path/to/codex-github-mcp/start.sh"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Option D — npx (if published to npm)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "codex-github-mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

---

## Integrating with Codex CLI

Add to `~/.codex/config.yaml` (or `%USERPROFILE%\.codex\config.yaml` on Windows):

```yaml
mcpServers:
  - name: github
    command: node
    args:
      - C:/path/to/codex-github-mcp/dist/index.js
      - --transport
      - stdio
    env:
      GITHUB_TOKEN: ghp_your_token_here
```

Or with the batch file on Windows:

```yaml
mcpServers:
  - name: github
    command: cmd
    args:
      - /c
      - C:\path\to\codex-github-mcp\start.bat
    env:
      GITHUB_TOKEN: ghp_your_token_here
```

---

## Integrating with Cursor

Add to `.cursor/mcp.json` in your project root or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["C:/path/to/codex-github-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

---

## HTTP transport: connect from any client

```bash
# 1. Start the HTTP server
node dist/index.js --transport http --port 3000

# 2. Initialize a session
SESSION=$(curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ghp_your_token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' \
  | tee /dev/stderr | python3 -c "import sys,json; h=input(); print(json.loads(h))" 2>&1 | head -1)

# 3. List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id-from-response-header>" \
  -H "Authorization: Bearer ghp_your_token" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

---

## Self-hosting on Windows (step by step)

1. **Install Node.js 18+** from https://nodejs.org — choose the LTS installer.
2. **Clone this repo** or download and extract the zip.
3. Open **Command Prompt** or **PowerShell** in the repo folder.
4. Run:
   ```
   npm install
   npm run build
   ```
5. Copy `.env.example` to `.env` and fill in your `GITHUB_TOKEN`.
6. **For Claude Desktop**: edit `claude_desktop_config.json` as shown above and restart Claude.
7. **For HTTP mode**: run `start-http.bat` — the server starts on `http://127.0.0.1:3000`.

> **Tip:** To run the HTTP server automatically at startup on Windows, create a Scheduled Task that runs `start-http.bat` at login, or use [NSSM](https://nssm.cc/) to register it as a Windows Service.

---

## Key tool reference

### `checkout_repo` — read an entire codebase

This is the primary tool for Claude and Codex to read a full repository at once.

```json
{
  "name": "checkout_repo",
  "arguments": {
    "owner": "octocat",
    "repo": "hello-world",
    "ref": "main",
    "path_filter": "src/",
    "extensions": [".ts", ".tsx", ".js"],
    "max_file_size": 50000,
    "max_files": 300
  }
}
```

Returns a JSON object with every matching file's path + UTF-8 content. Binary files are listed but their content is omitted by default.

### `push_files` — atomic multi-file commit

Commits multiple files in a single Git commit without needing a local clone:

```json
{
  "name": "push_files",
  "arguments": {
    "owner": "octocat",
    "repo": "hello-world",
    "branch": "feature/my-change",
    "message": "feat: add new feature",
    "files": [
      { "path": "src/index.ts", "content": "export const hello = 'world';\n" },
      { "path": "README.md",   "content": "# Hello World\n" }
    ]
  }
}
```

### `get_raw_file` — read a single file

```json
{
  "name": "get_raw_file",
  "arguments": {
    "owner": "octocat",
    "repo": "hello-world",
    "path": "src/index.ts",
    "ref": "main",
    "max_chars": 50000
  }
}
```

---

## GitHub Enterprise Server

Set `GITHUB_API_URL` to your GHE API endpoint:

```
GITHUB_API_URL=https://github.your-company.com/api/v3
```

Everything else works identically.

---

## Security notes

- The token is read from environment variables or `.env` — it is **never logged** or transmitted over the wire beyond the GitHub API call.
- In HTTP mode, pass the token via `Authorization: Bearer <token>` or `X-GitHub-Token` per-request. The server does not store tokens between sessions.
- Do not commit your `.env` file — it is listed in `.gitignore`.
- Use a **Fine-Grained PAT** with the minimum necessary repository permissions for best security.

---

## Development

```bash
npm run build       # compile TypeScript → dist/
npm run dev         # watch mode (recompiles on change)
npm run typecheck   # type-check without emitting
```

### Project structure

```
src/
  index.ts              # Entry point, transport selection
  types/index.ts        # Shared ToolResult type
  utils/
    config.ts           # Config loading (env + CLI args)
    logger.ts           # stderr-safe logger
    octokit.ts          # Octokit factory + error wrapper
    zodToJsonSchema.ts  # Zod → JSON Schema converter
  tools/
    index.ts            # Central tool registry (TOOLS map)
    repository.ts       # Repo, branch, commit, tag, release tools
    contents.ts         # File/tree/blob tools + push_files
    checkout.ts         # checkout_repo + get_repo_archive_url
    issues.ts           # Issues, labels, milestones, comments
    pullrequests.ts     # PRs, reviews, review comments
    search.ts           # Search: repos, code, issues, commits, users
    actions.ts          # GitHub Actions: workflows, runs, jobs, artifacts
    users.ts            # Users, orgs, followers
    gists.ts            # Gist CRUD
    notifications.ts    # Notification management
    git.ts              # Low-level Git Data API
```

---

## License

MIT
