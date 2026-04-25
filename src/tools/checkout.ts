import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON, err } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── checkout_repo ────────────────────────────────────────────────────────────
// Downloads the full repository as a recursive file tree with content.
// This is the "checkout" capability that lets Claude / Codex read an entire repo.

export const checkoutRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string().optional().describe("Branch, tag, or commit SHA. Defaults to default branch."),
  path_filter: z.string().optional().describe(
    "Optional glob-style prefix filter, e.g. 'src/' to only include files under src/."
  ),
  max_file_size: z.number().int().optional().default(100000).describe(
    "Skip files larger than this many bytes (default 100000 = ~100 KB)."
  ),
  max_files: z.number().int().optional().default(500).describe(
    "Maximum number of files to include (default 500)."
  ),
  include_binary: z.boolean().optional().default(false).describe(
    "If false (default), binary files are listed but their content is omitted."
  ),
  extensions: z.array(z.string()).optional().describe(
    "If provided, only include files with these extensions (e.g. ['.ts', '.js'])."
  ),
});

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".scala", ".swift",
  ".c", ".cpp", ".cc", ".h", ".hpp", ".cs", ".fs", ".fsx",
  ".php", ".lua", ".r", ".jl", ".zig", ".nim", ".d", ".ex", ".exs",
  ".html", ".htm", ".css", ".scss", ".sass", ".less",
  ".json", ".json5", ".jsonc", ".yaml", ".yml", ".toml", ".ini",
  ".xml", ".svg", ".md", ".mdx", ".rst", ".txt", ".env", ".env.*",
  ".sh", ".bash", ".zsh", ".fish", ".ps1", ".psm1", ".bat", ".cmd",
  ".sql", ".graphql", ".gql", ".proto",
  ".dockerfile", "dockerfile", ".makefile", "makefile", "gemfile", "rakefile",
  ".gitignore", ".gitattributes", ".editorconfig", ".npmrc", ".nvmrc",
  ".lock", ".sum", ".mod", ".gradle", ".pom",
]);

function isTextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot !== -1) {
    const ext = lower.slice(dot);
    if (TEXT_EXTENSIONS.has(ext)) return true;
  }
  // No-extension files that are typically text
  const base = lower.split("/").pop() ?? lower;
  return TEXT_EXTENSIONS.has(base);
}

export async function checkoutRepo(octokit: Octokit, args: z.infer<typeof checkoutRepoSchema>): Promise<ToolResult> {
  // 1. Resolve the ref to a tree SHA
  const repoInfo = await call(() => octokit.repos.get({ owner: args.owner, repo: args.repo }));
  const resolvedRef = args.ref ?? repoInfo.data.default_branch;

  let treeSha: string;
  try {
    const { data: refData } = await call(() =>
      octokit.git.getRef({ owner: args.owner, repo: args.repo, ref: `heads/${resolvedRef}` })
    );
    treeSha = refData.object.sha;
  } catch {
    // Maybe it's a tag or commit SHA, try commit directly
    try {
      const { data: commitData } = await call(() =>
        octokit.git.getCommit({ owner: args.owner, repo: args.repo, commit_sha: resolvedRef })
      );
      treeSha = commitData.tree.sha;
    } catch {
      // Fall back to tags
      const { data: tagRef } = await call(() =>
        octokit.git.getRef({ owner: args.owner, repo: args.repo, ref: `tags/${resolvedRef}` })
      );
      // Tags can be tag objects or commits
      if (tagRef.object.type === "tag") {
        const { data: tagObj } = await call(() =>
          octokit.git.getTag({ owner: args.owner, repo: args.repo, tag_sha: tagRef.object.sha })
        );
        const { data: commitData } = await call(() =>
          octokit.git.getCommit({ owner: args.owner, repo: args.repo, commit_sha: tagObj.object.sha })
        );
        treeSha = commitData.tree.sha;
      } else {
        const { data: commitData } = await call(() =>
          octokit.git.getCommit({ owner: args.owner, repo: args.repo, commit_sha: tagRef.object.sha })
        );
        treeSha = commitData.tree.sha;
      }
    }
  }

  // 2. Get the full recursive tree
  const { data: treeData } = await call(() =>
    octokit.git.getTree({ owner: args.owner, repo: args.repo, tree_sha: treeSha, recursive: "1" })
  );

  // 3. Filter to blobs only
  let blobs = treeData.tree.filter(item => item.type === "blob" && item.path);

  // Apply path_filter prefix
  if (args.path_filter) {
    const prefix = args.path_filter.endsWith("/") ? args.path_filter : args.path_filter + "/";
    blobs = blobs.filter(item => item.path!.startsWith(prefix) || item.path!.startsWith(args.path_filter!));
  }

  // Apply extension filter
  if (args.extensions && args.extensions.length > 0) {
    const exts = new Set(args.extensions.map(e => e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`));
    blobs = blobs.filter(item => {
      const path = item.path!.toLowerCase();
      const dot = path.lastIndexOf(".");
      return dot !== -1 && exts.has(path.slice(dot));
    });
  }

  // Skip oversized blobs
  blobs = blobs.filter(item => !item.size || item.size <= args.max_file_size);

  // Limit total files
  const truncated = blobs.length > args.max_files;
  if (truncated) {
    blobs = blobs.slice(0, args.max_files);
  }

  // 4. Fetch content for text files in parallel batches of 10
  const results: Array<{ path: string; content: string | null; size: number; skipped?: string }> = [];

  const batchSize = 10;
  for (let i = 0; i < blobs.length; i += batchSize) {
    const batch = blobs.slice(i, i + batchSize);
    const fetched = await Promise.all(
      batch.map(async (item) => {
        const path = item.path!;
        const size = item.size ?? 0;
        const looksText = isTextFile(path);

        if (!looksText && !args.include_binary) {
          return { path, content: null, size, skipped: "binary" };
        }

        try {
          const { data: blobData } = await call(() =>
            octokit.git.getBlob({ owner: args.owner, repo: args.repo, file_sha: item.sha! })
          );
          const raw = blobData.encoding === "base64"
            ? Buffer.from(blobData.content.replace(/\n/g, ""), "base64").toString("utf-8")
            : blobData.content;
          return { path, content: raw, size };
        } catch (e) {
          return { path, content: null, size, skipped: `fetch error: ${String(e)}` };
        }
      })
    );
    results.push(...fetched);
  }

  // 5. Produce a structured output
  const summary = {
    repo: `${args.owner}/${args.repo}`,
    ref: resolvedRef,
    tree_sha: treeSha,
    total_files: treeData.tree.filter(i => i.type === "blob").length,
    included_files: results.length,
    truncated_to: truncated ? args.max_files : undefined,
    path_filter: args.path_filter,
    extension_filter: args.extensions,
    files: results.map(f => ({
      path: f.path,
      size: f.size,
      ...(f.skipped ? { skipped: f.skipped } : { content: f.content }),
    })),
  };

  return okJSON(summary);
}

// ─── get_repo_archive_url ─────────────────────────────────────────────────────
// Returns a signed download URL for the zip/tarball of the repo.
// Useful for self-hosted Windows scenarios where you want to `Invoke-WebRequest` the archive.

export const getRepoArchiveUrlSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string().optional().describe("Branch, tag, or commit SHA"),
  format: z.enum(["zipball", "tarball"]).optional().default("zipball"),
});

export async function getRepoArchiveUrl(octokit: Octokit, args: z.infer<typeof getRepoArchiveUrlSchema>): Promise<ToolResult> {
  const repoInfo = await call(() => octokit.repos.get({ owner: args.owner, repo: args.repo }));
  const ref = args.ref ?? repoInfo.data.default_branch;
  const url = `${repoInfo.data.html_url}/archive/refs/heads/${ref}.zip`;
  const apiUrl = `https://api.github.com/repos/${args.owner}/${args.repo}/${args.format}/${ref}`;
  return ok(
    `Repository archive for ${args.owner}/${args.repo} @ ${ref}\n\n` +
    `Format: ${args.format}\n` +
    `API URL (requires auth header): ${apiUrl}\n` +
    `Browser/direct URL: ${url}\n\n` +
    `Download with curl:\n` +
    `  curl -L -H "Authorization: Bearer <token>" "${apiUrl}" -o repo.zip\n\n` +
    `Download with PowerShell:\n` +
    `  Invoke-WebRequest -Uri "${apiUrl}" -Headers @{Authorization="Bearer <token>"} -OutFile repo.zip`
  );
}
