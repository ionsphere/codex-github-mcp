from __future__ import annotations

from typing import Any

import httpx

from .config import Settings
from .models import FileWrite, RefactorOperation, RefactorOperationType


class GitHubApiError(RuntimeError):
    pass


class GitHubClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = httpx.Client(
            base_url=settings.github_api_url,
            headers={
                "Authorization": f"Bearer {settings.github_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": settings.mcp_server_name,
            },
            timeout=30.0,
        )

    def close(self) -> None:
        self._client.close()

    def _request(self, method: str, path: str, *, expected_status: int | tuple[int, ...] = (200,), **kwargs: Any) -> Any:
        response = self._client.request(method, path, **kwargs)
        expected = (expected_status,) if isinstance(expected_status, int) else expected_status
        if response.status_code not in expected:
            raise GitHubApiError(
                f"GitHub API {method} {path} failed with {response.status_code}: {response.text}"
            )
        if response.content:
            return response.json()
        return None

    def get_repo(self, repo: str) -> dict[str, Any]:
        return self._request("GET", f"/repos/{repo}")

    def get_default_branch(self, repo: str) -> str:
        return self.get_repo(repo)["default_branch"]

    def get_branch(self, repo: str, branch: str) -> dict[str, Any]:
        return self._request("GET", f"/repos/{repo}/branches/{branch}")

    def get_ref_sha(self, repo: str, ref: str) -> str:
        payload = self._request("GET", f"/repos/{repo}/git/ref/heads/{ref}")
        return payload["object"]["sha"]

    def get_commit(self, repo: str, sha: str) -> dict[str, Any]:
        return self._request("GET", f"/repos/{repo}/git/commits/{sha}")

    def create_branch(self, repo: str, new_branch: str, from_sha: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/repos/{repo}/git/refs",
            expected_status=201,
            json={"ref": f"refs/heads/{new_branch}", "sha": from_sha},
        )

    def get_file_text(self, repo: str, path: str, ref: str) -> dict[str, Any]:
        response = self._request("GET", f"/repos/{repo}/contents/{path}", params={"ref": ref})
        if response.get("type") != "file":
            raise GitHubApiError(f"{path} is not a file")
        content = response.get("content", "")
        if response.get("encoding") == "base64":
            import base64

            decoded = base64.b64decode(content).decode("utf-8")
        else:
            decoded = content
        return {"path": response["path"], "sha": response["sha"], "content": decoded}

    def search_code(self, repo: str, query: str, ref: str | None = None, per_page: int = 20) -> dict[str, Any]:
        q = f"repo:{repo} {query}".strip()
        if ref:
            q = f"{q} ref:{ref}"
        return self._request("GET", "/search/code", params={"q": q, "per_page": per_page})

    def get_tree_recursive(self, repo: str, tree_sha: str, recursive: bool = True) -> dict[str, Any]:
        params = {"recursive": "1"} if recursive else None
        return self._request("GET", f"/repos/{repo}/git/trees/{tree_sha}", params=params)

    def create_blob(self, repo: str, content: str) -> str:
        payload = self._request(
            "POST",
            f"/repos/{repo}/git/blobs",
            expected_status=201,
            json={"content": content, "encoding": "utf-8"},
        )
        return payload["sha"]

    def create_tree(self, repo: str, tree_elements: list[dict[str, Any]], base_tree_sha: str | None) -> str:
        payload = self._request(
            "POST",
            f"/repos/{repo}/git/trees",
            expected_status=201,
            json={"tree": tree_elements, "base_tree": base_tree_sha},
        )
        return payload["sha"]

    def create_commit(self, repo: str, message: str, tree_sha: str, parent_sha: str) -> str:
        payload = self._request(
            "POST",
            f"/repos/{repo}/git/commits",
            expected_status=201,
            json={"message": message, "tree": tree_sha, "parents": [parent_sha]},
        )
        return payload["sha"]

    def update_ref(self, repo: str, branch: str, sha: str, force: bool = False) -> dict[str, Any]:
        return self._request(
            "PATCH",
            f"/repos/{repo}/git/refs/heads/{branch}",
            expected_status=200,
            json={"sha": sha, "force": force},
        )

    def compare_commits(self, repo: str, base: str, head: str) -> dict[str, Any]:
        return self._request("GET", f"/repos/{repo}/compare/{base}...{head}")

    def create_pr(self, repo: str, head: str, base: str, title: str, body: str, draft: bool = False) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/repos/{repo}/pulls",
            expected_status=201,
            json={"title": title, "body": body, "head": head, "base": base, "draft": draft},
        )

    def put_files_atomically(
        self,
        repo: str,
        branch: str,
        files: list[FileWrite],
        commit_message: str,
    ) -> dict[str, Any]:
        head_sha = self.get_ref_sha(repo, branch)
        base_commit = self.get_commit(repo, head_sha)
        base_tree_sha = base_commit["tree"]["sha"]

        tree_elements: list[dict[str, Any]] = []
        created_blobs: list[dict[str, str]] = []
        for file in files:
            blob_sha = self.create_blob(repo, file.content)
            created_blobs.append({"path": file.path, "blob_sha": blob_sha})
            tree_elements.append(
                {
                    "path": file.path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob_sha,
                }
            )

        new_tree_sha = self.create_tree(repo, tree_elements, base_tree_sha)
        commit_sha = self.create_commit(repo, commit_message, new_tree_sha, head_sha)
        self.update_ref(repo, branch, commit_sha, force=False)
        return {
            "branch": branch,
            "base_commit": head_sha,
            "commit_sha": commit_sha,
            "tree_sha": new_tree_sha,
            "files": created_blobs,
        }

    def apply_refactor_plan(
        self,
        repo: str,
        base_branch: str,
        new_branch: str,
        operations: list[RefactorOperation],
        commit_message: str,
    ) -> dict[str, Any]:
        base_sha = self.get_ref_sha(repo, base_branch)
        self.create_branch(repo, new_branch, base_sha)
        tree_entries: list[dict[str, Any]] = []
        renamed_sources_to_delete: set[str] = set()

        for op in operations:
            if op.type == RefactorOperationType.delete:
                tree_entries.append({"path": op.path, "mode": "100644", "type": "blob", "sha": None})
                continue
            if op.type == RefactorOperationType.rename:
                renamed_sources_to_delete.add(op.path)
                current = self.get_file_text(repo, op.path, base_branch)
                blob_sha = self.create_blob(repo, current["content"])
                tree_entries.append(
                    {"path": op.new_path, "mode": "100644", "type": "blob", "sha": blob_sha}
                )
                continue
            blob_sha = self.create_blob(repo, op.content or "")
            tree_entries.append({"path": op.path, "mode": "100644", "type": "blob", "sha": blob_sha})

        for path in renamed_sources_to_delete:
            tree_entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})

        head_sha = self.get_ref_sha(repo, new_branch)
        base_commit = self.get_commit(repo, head_sha)
        base_tree_sha = base_commit["tree"]["sha"]
        new_tree_sha = self.create_tree(repo, tree_entries, base_tree_sha)
        commit_sha = self.create_commit(repo, commit_message, new_tree_sha, head_sha)
        self.update_ref(repo, new_branch, commit_sha, force=False)
        return {
            "base_branch": base_branch,
            "new_branch": new_branch,
            "base_commit": head_sha,
            "commit_sha": commit_sha,
            "tree_sha": new_tree_sha,
            "operations_applied": len(operations),
        }
