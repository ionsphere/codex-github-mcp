from __future__ import annotations

from contextlib import suppress
from typing import Any

from fastmcp import FastMCP

from .config import Settings
from .github_api import GitHubClient
from .models import FileWrite, PullRequestResult, RefactorOperation
from .sandbox import SandboxRunner

settings = Settings.from_env()
github = GitHubClient(settings)
sandbox = SandboxRunner(settings)
mcp = FastMCP(settings.mcp_server_name)


def _resolve_ref(repo: str, ref: str | None) -> str:
    if ref:
        return ref
    return github.get_default_branch(repo)


@mcp.tool()
def get_default_branch(repo: str) -> dict[str, Any]:
    """Return the default branch for a GitHub repository."""
    return {"repo": repo, "default_branch": github.get_default_branch(repo)}


@mcp.tool()
def create_branch(repo: str, new_branch: str, from_ref: str) -> dict[str, Any]:
    """Create a branch from an existing branch or commit SHA."""
    try:
        source_sha = github.get_ref_sha(repo, from_ref)
    except Exception:
        source_sha = from_ref
    payload = github.create_branch(repo, new_branch, source_sha)
    return {"repo": repo, "branch": new_branch, "source": from_ref, "ref": payload["ref"], "sha": payload["object"]["sha"]}


@mcp.tool()
def create_branch_from_default(repo: str, new_branch: str) -> dict[str, Any]:
    """Create a branch from the repository default branch."""
    default_branch = github.get_default_branch(repo)
    source_sha = github.get_ref_sha(repo, default_branch)
    payload = github.create_branch(repo, new_branch, source_sha)
    return {
        "repo": repo,
        "default_branch": default_branch,
        "branch": new_branch,
        "ref": payload["ref"],
        "sha": payload["object"]["sha"],
    }


@mcp.tool()
def get_file_text(repo: str, path: str, ref: str = "") -> dict[str, Any]:
    """Read one text file from a repository ref."""
    resolved_ref = _resolve_ref(repo, ref or None)
    payload = github.get_file_text(repo, path, resolved_ref)
    payload["ref"] = resolved_ref
    return payload


@mcp.tool()
def get_files_text(repo: str, paths: list[str], ref: str = "") -> dict[str, Any]:
    """Read several text files from a repository ref."""
    resolved_ref = _resolve_ref(repo, ref or None)
    return {
        "repo": repo,
        "ref": resolved_ref,
        "files": [github.get_file_text(repo, path, resolved_ref) for path in paths],
    }


@mcp.tool()
def search_code(repo: str, query: str, ref: str = "") -> dict[str, Any]:
    """Search code in a repository."""
    resolved_ref = ref or None
    payload = github.search_code(repo, query, resolved_ref)
    items = payload.get("items", [])
    return {
        "repo": repo,
        "ref": resolved_ref,
        "total_count": payload.get("total_count", 0),
        "results": [
            {
                "name": item.get("name"),
                "path": item.get("path"),
                "sha": item.get("sha"),
                "url": item.get("html_url"),
                "repository": item.get("repository", {}).get("full_name"),
            }
            for item in items
        ],
    }


@mcp.tool()
def get_repo_snapshot(repo: str, ref: str = "", recursive: bool = True) -> dict[str, Any]:
    """Return a repository tree snapshot for a ref."""
    resolved_ref = _resolve_ref(repo, ref or None)
    head_sha = github.get_ref_sha(repo, resolved_ref)
    commit = github.get_commit(repo, head_sha)
    tree = github.get_tree_recursive(repo, commit["tree"]["sha"], recursive=recursive)
    return {
        "repo": repo,
        "ref": resolved_ref,
        "commit_sha": head_sha,
        "tree_sha": commit["tree"]["sha"],
        "truncated": tree.get("truncated", False),
        "entries": tree.get("tree", []),
    }


@mcp.tool()
def put_files_atomically(repo: str, branch: str, files: list[dict[str, str]], commit_message: str) -> dict[str, Any]:
    """Apply full-file replacements as one atomic commit on a branch."""
    typed_files = [FileWrite.model_validate(item) for item in files]
    return github.put_files_atomically(repo, branch, typed_files, commit_message)


@mcp.tool()
def apply_refactor_plan(
    repo: str,
    base_branch: str,
    new_branch: str,
    operations: list[dict[str, Any]],
    commit_message: str,
    open_pr: bool = False,
    pr_title: str = "",
    pr_body: str = "",
) -> dict[str, Any]:
    """Create a branch and apply a multi-file create/update/delete/rename plan in one commit."""
    typed_ops = [RefactorOperation.model_validate(item) for item in operations]
    result = github.apply_refactor_plan(repo, base_branch, new_branch, typed_ops, commit_message)
    if open_pr:
        title = pr_title or commit_message
        body = pr_body or "Automated refactor plan applied by codex-github-mcp."
        pr = github.create_pr(repo, new_branch, base_branch, title, body)
        result["pull_request"] = PullRequestResult(
            number=pr["number"],
            url=pr["html_url"],
            state=pr["state"],
            head=pr["head"]["ref"],
            base=pr["base"]["ref"],
        ).model_dump()
    return result


@mcp.tool()
def get_changed_files(repo: str, base: str, head: str) -> dict[str, Any]:
    """List changed files between two refs."""
    payload = github.compare_commits(repo, base, head)
    return {
        "repo": repo,
        "base": base,
        "head": head,
        "ahead_by": payload.get("ahead_by"),
        "behind_by": payload.get("behind_by"),
        "total_commits": payload.get("total_commits"),
        "files": [
            {
                "filename": f.get("filename"),
                "status": f.get("status"),
                "additions": f.get("additions"),
                "deletions": f.get("deletions"),
                "changes": f.get("changes"),
                "patch": f.get("patch"),
            }
            for f in payload.get("files", [])
        ],
    }


@mcp.tool()
def create_pr(repo: str, head: str, base: str, title: str, body: str, draft: bool = False) -> dict[str, Any]:
    """Open a pull request."""
    pr = github.create_pr(repo, head, base, title, body, draft=draft)
    return PullRequestResult(
        number=pr["number"],
        url=pr["html_url"],
        state=pr["state"],
        head=pr["head"]["ref"],
        base=pr["base"]["ref"],
    ).model_dump()


@mcp.tool()
def run_repo_command_in_sandbox(repo: str, branch: str, command: str) -> dict[str, Any]:
    """Delegate one repository command to a remote sandbox runner, if configured."""
    return sandbox.run_command(repo, branch, command).model_dump()


@mcp.tool()
def run_patch_test_plan(repo: str, branch: str, commands: list[str]) -> dict[str, Any]:
    """Run a sequence of validation commands in a remote sandbox runner."""
    runs = [sandbox.run_command(repo, branch, command).model_dump() for command in commands]
    return {
        "repo": repo,
        "branch": branch,
        "all_passed": all(run.get("ok") for run in runs),
        "runs": runs,
    }


def main() -> None:
    try:
        mcp.run(
            transport="streamable-http",
            host=settings.mcp_host,
            port=settings.mcp_port,
            path=settings.mcp_streamable_http_path,
        )
    finally:
        with suppress(Exception):
            github.close()


if __name__ == "__main__":
    main()
