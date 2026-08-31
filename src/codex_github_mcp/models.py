from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, model_validator


class FileWrite(BaseModel):
    path: str = Field(min_length=1)
    content: str


class RefactorOperationType(str, Enum):
    create = "create"
    update = "update"
    delete = "delete"
    rename = "rename"


class RefactorOperation(BaseModel):
    type: RefactorOperationType
    path: str = Field(min_length=1)
    new_path: str | None = None
    content: str | None = None

    @model_validator(mode="after")
    def validate_shape(self) -> "RefactorOperation":
        if self.type in {RefactorOperationType.create, RefactorOperationType.update} and self.content is None:
            raise ValueError("content is required for create and update operations")
        if self.type == RefactorOperationType.rename and not self.new_path:
            raise ValueError("new_path is required for rename operations")
        return self


class PullRequestResult(BaseModel):
    number: int
    url: str
    state: str
    head: str
    base: str


class SandboxRunResult(BaseModel):
    ok: bool
    configured: bool
    exit_code: int | None = None
    stdout: str | None = None
    stderr: str | None = None
    raw: dict | None = None
