from __future__ import annotations

from typing import Any

import httpx

from .config import Settings
from .models import SandboxRunResult


class SandboxRunner:
    def __init__(self, settings: Settings) -> None:
        self._url = settings.sandbox_runner_url
        self._token = settings.sandbox_runner_bearer_token

    @property
    def configured(self) -> bool:
        return bool(self._url)

    def run_command(self, repo: str, branch: str, command: str) -> SandboxRunResult:
        if not self._url:
            return SandboxRunResult(ok=False, configured=False, stderr="SANDBOX_RUNNER_URL is not configured")

        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                self._url,
                headers=headers,
                json={"repo": repo, "branch": branch, "command": command},
            )
            response.raise_for_status()
            payload: dict[str, Any] = response.json()

        exit_code = payload.get("exit_code")
        return SandboxRunResult(
            ok=exit_code == 0,
            configured=True,
            exit_code=exit_code,
            stdout=payload.get("stdout"),
            stderr=payload.get("stderr"),
            raw=payload,
        )
