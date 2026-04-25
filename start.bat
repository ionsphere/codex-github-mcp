@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM  codex-github-mcp  —  Windows self-hosted launcher (stdio transport)
REM  Used by Claude Desktop / Codex on Windows.
REM ═══════════════════════════════════════════════════════════════════════════
setlocal

REM Change to the directory where this .bat file lives
cd /d "%~dp0"

REM If a .env file exists, load it (simple key=value, no quotes needed)
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    REM Skip comment lines
    set "line=%%A"
    if not "!line:~0,1!"=="#" set "%%A=%%B"
  )
)
setlocal EnableDelayedExpansion

REM Fall back to the environment variable if GITHUB_TOKEN is not set
if "%GITHUB_TOKEN%"=="" (
  echo [ERROR] GITHUB_TOKEN is not set. Please set it in .env or as an environment variable.
  exit /b 1
)

REM Ensure node is available
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] node.exe not found in PATH. Please install Node.js 18+.
  exit /b 1
)

REM Build if dist/ is missing
if not exist "dist\index.js" (
  echo [INFO] dist\index.js not found — building...
  call npm run build
  if errorlevel 1 (
    echo [ERROR] Build failed.
    exit /b 1
  )
)

REM Start the MCP server in stdio mode
node dist\index.js --transport stdio %*
