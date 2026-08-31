from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    github_token: str
    github_api_url: str = "https://api.github.com"
    mcp_server_name: str = "codex-github-mcp"
    mcp_host: str = "0.0.0.0"
    mcp_port: int = 8000
    mcp_streamable_http_path: str = "/mcp"
    sandbox_runner_url: str | None = None
    sandbox_runner_bearer_token: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        token = os.getenv("GITHUB_TOKEN", "").strip()
        if not token:
            raise RuntimeError("GITHUB_TOKEN is required")
        return cls(
            github_token=token,
            github_api_url=os.getenv("GITHUB_API_URL", "https://api.github.com").rstrip("/"),
            mcp_server_name=os.getenv("MCP_SERVER_NAME", "codex-github-mcp"),
            mcp_host=os.getenv("MCP_HOST", "0.0.0.0"),
            mcp_port=int(os.getenv("MCP_PORT", "8000")),
            mcp_streamable_http_path=os.getenv("MCP_STREAMABLE_HTTP_PATH", "/mcp"),
            sandbox_runner_url=(os.getenv("SANDBOX_RUNNER_URL") or "").strip() or None,
            sandbox_runner_bearer_token=(os.getenv("SANDBOX_RUNNER_BEARER_TOKEN") or "").strip() or None,
        )
