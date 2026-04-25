#!/usr/bin/env node
/**
 * codex-github-mcp — entry point
 *
 * Supports two transports:
 *   stdio  — default; used by Claude Desktop, Codex CLI, and most MCP harnesses
 *   http   — Streamable HTTP; for self-hosted Windows setups and network clients
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./utils/config.js";
import { setLogLevel, logger } from "./utils/logger.js";
import { createOctokit } from "./utils/octokit.js";
import { TOOLS } from "./tools/index.js";
import { zodToJsonSchema } from "./utils/zodToJsonSchema.js";

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  logger.info("codex-github-mcp starting", { transport: config.transport, version: "1.0.0" });

  const server = new Server(
    { name: "codex-github-mcp", version: "1.0.0" },
    {
      capabilities: {
        tools: { listChanged: false },
      },
    }
  );

  // ── tools/list ──────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = Object.entries(TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: zodToJsonSchema(def.inputSchema),
    }));
    logger.debug(`Listing ${tools.length} tools`);
    return { tools };
  });

  // ── tools/call ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name, arguments: rawArgs } = request.params;
    logger.info(`Tool called: ${name}`, { args: rawArgs });

    const toolDef = TOOLS[name];
    if (!toolDef) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    // Validate input with Zod
    const parsed = toolDef.inputSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const msg = parsed.error.errors
        .map((e: { path: (string | number)[]; message: string }) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return {
        content: [{ type: "text", text: `Input validation error: ${msg}` }],
        isError: true,
      };
    }

    // Resolve token — from config or from per-call _token override (HTTP mode)
    const token =
      (parsed.data as Record<string, unknown>)._token as string | undefined ??
      config.githubToken;

    const octokit = createOctokit(token, config.githubApiUrl);

    try {
      const result = await toolDef.handler(octokit, parsed.data as Record<string, unknown>);
      logger.debug(`Tool ${name} completed successfully`);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`Tool ${name} failed`, { error: msg });
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  });

  // ── Transport selection ─────────────────────────────────────────────────────
  if (config.transport === "http") {
    await startHttpTransport(server, config);
  } else {
    await startStdioTransport(server);
  }
}

async function startStdioTransport(server: Server): Promise<void> {
  logger.info("Starting stdio transport");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server connected via stdio — ready");
}

async function startHttpTransport(
  server: Server,
  config: ReturnType<typeof loadConfig>
): Promise<void> {
  const express = (await import("express")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  ) as { StreamableHTTPServerTransport: any };

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // CORS — allow any origin for self-hosted use
  app.use((_req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-GitHub-Token, Mcp-Session-Id");
    if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  // Session store for Streamable HTTP
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = new Map<string, any>();

  // ── POST /mcp  (new session or existing)
  app.post("/mcp", async (req: import("express").Request, res: import("express").Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Token from Authorization or X-GitHub-Token header takes priority over config
    const authHeader = req.headers["authorization"] as string | undefined;
    const xGithubToken = req.headers["x-github-token"] as string | undefined;
    const requestToken = xGithubToken ||
      (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined) ||
      config.githubToken;

    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId);
      await transport.handleRequest(req, res);
      return;
    }

    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onsessioninitialized: (id: string) => {
        sessions.set(id, transport);
        logger.info(`HTTP session opened: ${id} (token present: ${!!requestToken})`);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) {
        sessions.delete(id);
        logger.info(`HTTP session closed: ${id}`);
      }
    };

    // Store the per-session token so tool handlers can pick it up
    transport._githubToken = requestToken;

    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  // ── GET /mcp  (SSE stream for an existing session)
  app.get("/mcp", async (req: import("express").Request, res: import("express").Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing Mcp-Session-Id header" });
      return;
    }
    await sessions.get(sessionId).handleRequest(req, res);
  });

  // ── DELETE /mcp  (close session)
  app.delete("/mcp", async (req: import("express").Request, res: import("express").Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId).close();
      sessions.delete(sessionId);
    }
    res.sendStatus(204);
  });

  // ── Health check
  app.get("/health", (_req: import("express").Request, res: import("express").Response) => {
    res.json({
      status: "ok",
      name: "codex-github-mcp",
      version: "1.0.0",
      transport: "http",
      activeSessions: sessions.size,
      toolCount: Object.keys(TOOLS).length,
    });
  });

  // ── Tool list endpoint (no session required — handy for inspection)
  app.get("/tools", (_req: import("express").Request, res: import("express").Response) => {
    const tools = Object.entries(TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
    }));
    res.json({ tools, count: tools.length });
  });

  app.listen(config.port, config.host, () => {
    logger.info(`HTTP MCP server listening on http://${config.host}:${config.port}`);
    logger.info(`  MCP endpoint:  POST/GET/DELETE  http://${config.host}:${config.port}/mcp`);
    logger.info(`  Health check:  http://${config.host}:${config.port}/health`);
    logger.info(`  Tool list:     http://${config.host}:${config.port}/tools`);
  });
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
