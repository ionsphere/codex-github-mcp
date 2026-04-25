import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── get_ref ──────────────────────────────────────────────────────────────────
export const getRefSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string().describe("The ref to get (e.g. 'heads/main' or 'tags/v1.0')"),
});

export async function getRef(octokit: Octokit, args: z.infer<typeof getRefSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.git.getRef({ owner: args.owner, repo: args.repo, ref: args.ref })
  );
  return okJSON({ ref: data.ref, sha: data.object.sha, type: data.object.type });
}

// ─── list_matching_refs ───────────────────────────────────────────────────────
export const listMatchingRefsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string().describe("Prefix to filter refs (e.g. 'heads/' or 'tags/')"),
});

export async function listMatchingRefs(octokit: Octokit, args: z.infer<typeof listMatchingRefsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.git.listMatchingRefs({ owner: args.owner, repo: args.repo, ref: args.ref })
  );
  return okJSON(data.map(r => ({ ref: r.ref, sha: r.object.sha, type: r.object.type })));
}

// ─── update_ref ───────────────────────────────────────────────────────────────
export const updateRefSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string().describe("The ref to update (e.g. 'heads/main')"),
  sha: z.string().describe("The SHA1 value to set this reference to"),
  force: z.boolean().optional().default(false).describe("Force update, even if not a fast-forward"),
});

export async function updateRef(octokit: Octokit, args: z.infer<typeof updateRefSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.git.updateRef({ owner: args.owner, repo: args.repo, ref: args.ref, sha: args.sha, force: args.force })
  );
  return okJSON({ ref: data.ref, sha: data.object.sha });
}

// ─── create_commit ────────────────────────────────────────────────────────────
export const createCommitSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  message: z.string().describe("Commit message"),
  tree: z.string().describe("SHA of the tree object this commit points to"),
  parents: z.array(z.string()).describe("SHAs of parent commits"),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
  author_date: z.string().optional().describe("ISO 8601 date"),
});

export async function createCommit(octokit: Octokit, args: z.infer<typeof createCommitSchema>): Promise<ToolResult> {
  const author = args.author_name && args.author_email
    ? { name: args.author_name, email: args.author_email, date: args.author_date }
    : undefined;
  const { data } = await call(() =>
    octokit.git.createCommit({
      owner: args.owner, repo: args.repo,
      message: args.message, tree: args.tree, parents: args.parents,
      author,
    })
  );
  return okJSON({ sha: data.sha, message: data.message, tree: data.tree.sha, html_url: data.html_url });
}

// ─── create_tree ──────────────────────────────────────────────────────────────
export const createTreeSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  base_tree: z.string().optional().describe("SHA of the base tree (for incremental updates)"),
  tree: z.array(z.object({
    path: z.string(),
    mode: z.enum(["100644", "100755", "040000", "160000", "120000"]).describe("File mode: 100644=file, 100755=executable, 040000=tree, 160000=submodule, 120000=symlink"),
    type: z.enum(["blob", "tree", "commit"]),
    sha: z.string().nullable().optional().describe("SHA of the object. Set to null to delete a file."),
    content: z.string().optional().describe("Content of the file (alternative to sha)"),
  })),
});

export async function createTree(octokit: Octokit, args: z.infer<typeof createTreeSchema>): Promise<ToolResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await call(() =>
    (octokit.git.createTree as any)({
      owner: args.owner, repo: args.repo,
      base_tree: args.base_tree,
      tree: args.tree,
    })
  ) as { data: any };
  const data = result.data;
  return okJSON({ sha: data.sha, truncated: data.truncated, size: data.tree?.length ?? 0 });
}

// ─── create_blob ──────────────────────────────────────────────────────────────
export const createBlobSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  content: z.string().describe("File content (UTF-8 text or base64 encoded)"),
  encoding: z.enum(["utf-8", "base64"]).optional().default("utf-8"),
});

export async function createBlob(octokit: Octokit, args: z.infer<typeof createBlobSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.git.createBlob({ owner: args.owner, repo: args.repo, content: args.content, encoding: args.encoding })
  );
  return okJSON({ sha: data.sha, url: data.url });
}

// ─── cherry_pick_simulate ─────────────────────────────────────────────────────
// Not a real cherry-pick but gives the diff needed to apply changes from one commit to another branch.
export const getDiffSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  base: z.string().describe("Base ref (branch, tag, or SHA)"),
  head: z.string().describe("Head ref (branch, tag, or SHA)"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function getDiff(octokit: Octokit, args: z.infer<typeof getDiffSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.compareCommitsWithBasehead({
      owner: args.owner, repo: args.repo,
      basehead: `${args.base}...${args.head}`,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON({
    status: data.status, ahead_by: data.ahead_by, behind_by: data.behind_by,
    total_commits: data.total_commits,
    files: data.files?.map(f => ({
      filename: f.filename, status: f.status,
      additions: f.additions, deletions: f.deletions, changes: f.changes,
      patch: f.patch?.slice(0, 4000),
    })),
  });
}
