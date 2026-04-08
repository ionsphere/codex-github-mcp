from codex_github_mcp.models import RefactorOperation, RefactorOperationType


def test_update_requires_content() -> None:
    try:
        RefactorOperation(type=RefactorOperationType.update, path="a.txt")
    except ValueError:
        pass
    else:
        raise AssertionError("expected update without content to fail")


def test_rename_requires_new_path() -> None:
    try:
        RefactorOperation(type=RefactorOperationType.rename, path="a.txt")
    except ValueError:
        pass
    else:
        raise AssertionError("expected rename without new_path to fail")
