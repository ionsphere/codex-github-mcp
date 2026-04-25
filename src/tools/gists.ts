import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── list_gists ───────────────────────────────────────────────────────────────
export const listGistsSchema = z.object({
  username: z.string().optional().describe("Omit for authenticated user's gists"),
  since: z.string().optional().describe("ISO 8601 timestamp"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listGists(octokit: Octokit, args: z.infer<typeof listGistsSchema>): Promise<ToolResult> {
  if (args.username) {
    const { data } = await call(() =>
      octokit.gists.listForUser({ username: args.username!, since: args.since, per_page: args.per_page, page: args.page })
    );
    return okJSON(data.map(g => ({ id: g.id, description: g.description, public: g.public, files: Object.keys(g.files ?? {}), html_url: g.html_url, created_at: g.created_at })));
  }
  const { data } = await call(() =>
    octokit.gists.list({ since: args.since, per_page: args.per_page, page: args.page })
  );
  return okJSON(data.map(g => ({ id: g.id, description: g.description, public: g.public, files: Object.keys(g.files ?? {}), html_url: g.html_url, created_at: g.created_at })));
}

// ─── get_gist ─────────────────────────────────────────────────────────────────
export const getGistSchema = z.object({
  gist_id: z.string(),
});

export async function getGist(octokit: Octokit, args: z.infer<typeof getGistSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.gists.get({ gist_id: args.gist_id }));
  const files = Object.fromEntries(
    Object.entries(data.files ?? {}).map(([name, f]) => [name, { filename: f?.filename, language: f?.language, size: f?.size, content: f?.content }])
  );
  return okJSON({ id: data.id, description: data.description, public: data.public, files, html_url: data.html_url, created_at: data.created_at, updated_at: data.updated_at });
}

// ─── create_gist ──────────────────────────────────────────────────────────────
export const createGistSchema = z.object({
  description: z.string().optional(),
  public: z.boolean().optional().default(false),
  files: z.record(z.object({ content: z.string() })).describe("Map of filename -> { content }"),
});

export async function createGist(octokit: Octokit, args: z.infer<typeof createGistSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.gists.create({ description: args.description, public: args.public, files: args.files })
  );
  return ok(`Gist created: ${data.id}\nURL: ${data.html_url}`);
}

// ─── update_gist ──────────────────────────────────────────────────────────────
export const updateGistSchema = z.object({
  gist_id: z.string(),
  description: z.string().optional(),
  files: z.record(z.union([z.object({ content: z.string() }), z.null()])).optional().describe("Map of filename -> { content } or null to delete"),
});

export async function updateGist(octokit: Octokit, args: z.infer<typeof updateGistSchema>): Promise<ToolResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await call(() =>
    (octokit.gists.update as any)({ gist_id: args.gist_id, description: args.description, files: args.files })
  ) as { data: { id: string; html_url: string } };
  const data = result.data;
  return ok(`Gist ${data.id} updated.\nURL: ${data.html_url}`);
}

// ─── delete_gist ──────────────────────────────────────────────────────────────
export const deleteGistSchema = z.object({
  gist_id: z.string(),
});

export async function deleteGist(octokit: Octokit, args: z.infer<typeof deleteGistSchema>): Promise<ToolResult> {
  await call(() => octokit.gists.delete({ gist_id: args.gist_id }));
  return ok(`Gist ${args.gist_id} deleted.`);
}
