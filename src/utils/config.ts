import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import type { ServerConfig } from "../types/index.js";

// Load .env from cwd or script directory
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export function loadConfig(): ServerConfig {
  const transport =
    (getArg("--transport") as ServerConfig["transport"] | undefined) ||
    (process.env.MCP_TRANSPORT as ServerConfig["transport"] | undefined) ||
    "stdio";

  const port = parseInt(
    getArg("--port") || process.env.MCP_PORT || "3000",
    10
  );

  const host =
    getArg("--host") || process.env.MCP_HOST || "127.0.0.1";

  const githubToken =
    getArg("--token") ||
    process.env.GITHUB_TOKEN ||
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN ||
    "";

  const githubApiUrl =
    getArg("--api-url") ||
    process.env.GITHUB_API_URL ||
    "https://api.github.com";

  const logLevel =
    (getArg("--log-level") as ServerConfig["logLevel"] | undefined) ||
    (process.env.LOG_LEVEL as ServerConfig["logLevel"] | undefined) ||
    (hasFlag("--debug") ? "debug" : "info");

  const rateLimitRetry =
    process.env.RATE_LIMIT_RETRY !== "false";

  if (!githubToken && transport !== "http") {
    // Warn but don't abort — token may be supplied per-request in HTTP mode
    process.stderr.write(
      "[warn] No GITHUB_TOKEN found. Set it in .env or pass --token <PAT>.\n"
    );
  }

  return {
    transport: transport as ServerConfig["transport"],
    port,
    host,
    githubToken,
    githubApiUrl,
    logLevel,
    rateLimitRetry,
  };
}
