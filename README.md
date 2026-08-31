# codex-github-mcp

A remote MCP server that gives ChatGPT or the Responses API a **repo-writer surface** for GitHub.

The design goal is to avoid brittle one-file-at-a-time editing. Instead, it exposes tools for:

- reading one or many files
- creating branches from the default branch
- searching code
- computing repo snapshots
- applying **atomic multi-file commits** through the Git Data API
- opening pull requests
- listing changed files
- optionally delegating test execution to a remote sandbox runner

## Why this exists

Built-in repo connectors are often strongest at discovery and light inspection. Real coding flows need a tool layer that can:

1. read many files at once
2. batch refactors into one commit
3. create reviewable branches and PRs
4. optionally run validation in a cloud worker

This server is shaped around those needs.

## Implemented MCP tools

### Core GitHub workflow

- `get_default_branch(repo)`
- `create_branch(repo, new_branch, from_ref)`
- `create_branch_from_default(repo, new_branch)`
- `get_file_text(repo, path, ref="")`
- `get_files_text(repo, paths, ref="")`
- `search_code(repo, query, ref="")`
- `get_repo_snapshot(repo, ref="", recursive=true)`
- `put_files_atomically(repo, branch, files, commit_message)`
- `apply_refactor_plan(repo, base_branch, new_branch, operations, commit_message, open_pr=false, pr_title="", pr_body="")`
- `get_changed_files(repo, base, head)`
- `create_pr(repo, head, base, title, body, draft=false)`

### Optional execution hooks

- `run_repo_command_in_sandbox(repo, branch, command)`
- `run_patch_test_plan(repo, branch, commands)`

The sandbox tools delegate to a remote execution service if `SANDBOX_RUNNER_URL` is configured. Otherwise they return a structured “not configured” response instead of failing mysteriously.

## Architecture

### Atomic edits

`put_files_atomically` does **not** loop over the contents API. It uses the Git Data API pattern:

1. resolve the branch head commit
2. load the base tree
3. create blobs for changed files
4. create a derived tree
5. create a commit
6. fast-forward the branch ref

That allows one multi-file operation to become one commit.

### Authentication

The server expects a GitHub token in `GITHUB_TOKEN`.

For production, prefer installing a GitHub App and minting installation tokens in front of this process or inside a deployment wrapper. A PAT may work technically, but a GitHub App is the intended production path.

## Environment

Copy `.env.example` and fill in the values.

Required:

- `GITHUB_TOKEN`

Optional:

- `GITHUB_API_URL` defaults to `https://api.github.com`
- `MCP_SERVER_NAME` defaults to `codex-github-mcp`
- `SANDBOX_RUNNER_URL` for remote command execution
- `SANDBOX_RUNNER_BEARER_TOKEN` for sandbox auth
- `MCP_HOST` defaults to `0.0.0.0`
- `MCP_PORT` defaults to `8000`
- `MCP_STREAMABLE_HTTP_PATH` defaults to `/mcp`

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
```

Start the server:

```bash
codex-github-mcp
```

Or:

```bash
python -m codex_github_mcp.server
```

## Remote deployment

This repository is intended to be deployed as a **remote MCP server**.

Good deployment targets:

- Fly.io
- Railway
- Render
- ECS/Fargate
- Cloud Run
- any container host that exposes HTTPS

Put the server behind HTTPS and supply the GitHub token through your platform’s secret manager.

## Example MCP usage flow

A client can do the following:

1. `create_branch_from_default`
2. `get_files_text`
3. `put_files_atomically` or `apply_refactor_plan`
4. `run_patch_test_plan`
5. `create_pr`

## Future extensions

Useful next steps:

- GitHub App installation-token minting inside the service
- PR comments and review-thread tools
- branch protection awareness
- per-repo allowlists
- artifact upload from sandbox runs
- richer diff summaries
- approval policy integration for API callers

## License

MIT
