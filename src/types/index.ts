export interface ServerConfig {
  transport: "stdio" | "http";
  port: number;
  host: string;
  githubToken: string;
  githubApiUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
  rateLimitRetry: boolean;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export function okJSON(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
