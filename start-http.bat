@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM  codex-github-mcp  —  Windows self-hosted launcher (HTTP transport)
REM  Starts the MCP server as an HTTP server on localhost.
REM  Useful when you want to connect from a browser extension or remote client.
REM ═══════════════════════════════════════════════════════════════════════════
setlocal EnableDelayedExpansion

cd /d "%~dp0"

if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    set "line=%%A"
    if not "!line:~0,1!"=="#" set "%%A=%%B"
  )
)

if "%GITHUB_TOKEN%"=="" (
  echo [ERROR] GITHUB_TOKEN is not set.
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] node.exe not found. Please install Node.js 18+.
  exit /b 1
)

if not exist "dist\index.js" (
  echo [INFO] Building...
  call npm run build
  if errorlevel 1 ( echo [ERROR] Build failed. & exit /b 1 )
)

set MCP_PORT=3000
if not "%~1"=="" set MCP_PORT=%~1

echo [INFO] Starting HTTP MCP server on http://127.0.0.1:%MCP_PORT%
node dist\index.js --transport http --port %MCP_PORT%
