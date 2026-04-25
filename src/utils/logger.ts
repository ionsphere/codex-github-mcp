type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function log(level: LogLevel, msg: string, meta?: unknown): void {
  if (levels[level] < levels[currentLevel]) return;
  const ts = new Date().toISOString();
  const line = meta
    ? `[${ts}] [${level.toUpperCase()}] ${msg} ${JSON.stringify(meta)}`
    : `[${ts}] [${level.toUpperCase()}] ${msg}`;
  // Always write to stderr so stdout stays clean for stdio MCP transport
  process.stderr.write(line + "\n");
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
};
