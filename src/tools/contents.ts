import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON, err } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── get_file_contents ────────────────────────────────────────────────────────
export const getFileContentsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  path: z.string().describe("File path within the repository"),
  ref: z.string().optional().describe("Branch, tag, or commit SHA. Defaults to default branch."),
});

export async function getFileContents(octokit: Octokit, args: z.infer<typeof getFileContentsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.getContent({ owner: args.owner, repo: args.repo, path: args.path, ref: args.ref })
  );
  if (Array.isArray(data)) {
    return okJSON(data.map(f => ({ name: f.name, path: f.path, type: f.type, size: f.size, sha: f.sha, html_url: f.html_url })));
  }
  if (data.type === "file" && "content" in data) {
    const content = Buffer.from(data.content as string, "base64").toString("utf-8");
    return okJSON({ path: data.path, sha: data.sha, size: data.size, encoding: "utf-8", content });
  }
  return okJSON(data);
}

// ─── list_directory ───────────────────────────────────────────────────────────
export const listDirectorySchema = z.object({
  owner: z.string(),
  repo: z.string(),
  path: z.string().optional().default("").describe("Directory path. Empty string = repo root."),
  ref: z.string().optional().describe("Branch, tag, or commit SHA."),
});

export async function listDirectory(octokit: Octokit, args: z.infer<typeof listDirectorySchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.getContent({ owner: args.owner, repo: args.repo, path: args.path, ref: args.ref })
  );
  if (!Array.isArray(data)) {
    return err("Path points to a file, not a directory. Use get_file_contents instead.");
  }
  return okJSON(data.map(f => ({ name: f.name, path: f.path, type: f.type, size: f.size, sha: f.sha })));
}

// ─── create_or_update_file ────────────────────────────────────────────────────
export const createOrUpdateFileSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  path: z.string().describe("File path within the repository"),
  message: z.string().describe("Commit message"),
  content: z.string().describe("UTF-8 text content of the file"),
  sha: z.string().optional().describe("Required when updating an existing file. The blob SHA of the file being replaced."),
  branch: z.string().optional().describe("Branch to commit to. Defaults to default branch."),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
});

export async function createOrUpdateFile(octokit: Octokit, args: z.infer<typeof createOrUpdateFileSchema>): Promise<ToolResult> {
  const encoded = Buffer.from(args.content, "utf-8").toString("base64");
  const author = args.author_name && args.author_email
    ? { name: args.author_name, email: args.author_email }
    : undefined;
  const { data } = await call(() =>
    octokit.repos.createOrUpdateFileContents({
      owner: args.owner, repo: args.repo, path: args.path,
      message: args.message, content: encoded,
      sha: args.sha, branch: args.branch, author,
    })
  );
  const c = data.commit;
  return ok(`File ${data.content?.path ?? args.path} ${args.sha ? "updated" : "created"}.\nCommit: ${c.sha}\nURL: ${c.html_url}`);
}

// ─── delete_file ──────────────────────────────────────────────────────────────
export const deleteFileSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  path: z.string().describe("File path within the repository"),
  message: z.string().describe("Commit message"),
  sha: z.string().describe("The blob SHA of the file to delete"),
  branch: z.string().optional(),
});

export async function deleteFile(octokit: Octokit, args: z.infer<typeof deleteFileSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.deleteFile({
      owner: args.owner, repo: args.repo, path: args.path,
      message: args.message, sha: args.sha, branch: args.branch,
    })
  );
  return ok(`File '${args.path}' deleted.\nCommit: ${data.commit.sha}`);
}

// ─── get_tree ─────────────────────────────────────────────────────────────────
export const getTreeSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  tree_sha: z.string().describe("The SHA1 value or ref (e.g. branch name) for the tree"),
  recursive: z.boolean().optional().default(false).describe("Set to true to recursively list all files in the tree"),
});

export async function getTree(octokit: Octokit, args: z.infer<typeof getTreeSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.git.getTree({
      owner: args.owner, repo: args.repo,
      tree_sha: args.tree_sha,
      recursive: args.recursive ? "1" : undefined,
    })
  );
  return okJSON({
    sha: data.sha,
    truncated: data.truncated,
    tree: data.tree.map(item => ({
      path: item.path, mode: item.mode, type: item.type,
      sha: item.sha, size: item.size,
    })),
  });
}

// ─── get_blob ─────────────────────────────────────────────────────────────────
export const getBlobSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  file_sha: z.string().describe("The SHA of the blob"),
});

export async function getBlob(octokit: Octokit, args: z.infer<typeof getBlobSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.git.getBlob({ owner: args.owner, repo: args.repo, file_sha: args.file_sha })
  );
  const content = data.encoding === "base64"
    ? Buffer.from(data.content, "base64").toString("utf-8")
    : data.content;
  return okJSON({ sha: data.sha, size: data.size, content });
}

// ─── push_files ───────────────────────────────────────────────────────────────
// Atomic multi-file commit via the Git Data API (create tree + commit)
export const pushFilesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  branch: z.string().describe("Branch to push to"),
  message: z.string().describe("Commit message"),
  files: z.array(z.object({
    path: z.string().describe("File path within the repository"),
    content: z.string().describe("UTF-8 text content"),
  })).min(1).describe("List of files to create or update"),
  author_name: z.string().optional(),
  author_email: z.string().optional(),
});

export async function pushFiles(octokit: Octokit, args: z.infer<typeof pushFilesSchema>): Promise<ToolResult> {
  // 1. Get current HEAD commit for branch
  const { data: refData } = await call(() =>
    octokit.git.getRef({ owner: args.owner, repo: args.repo, ref: `heads/${args.branch}` })
  );
  const parentSha = refData.object.sha;

  // 2. Get current tree
  const { data: commitData } = await call(() =>
    octokit.git.getCommit({ owner: args.owner, repo: args.repo, commit_sha: parentSha })
  );
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for each file
  const treeItems: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
  for (const file of args.files) {
    const { data: blob } = await call(() =>
      octokit.git.createBlob({
        owner: args.owner, repo: args.repo,
        content: file.content, encoding: "utf-8",
      })
    );
    treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  // 4. Create new tree
  const { data: newTree } = await call(() =>
    octokit.git.createTree({
      owner: args.owner, repo: args.repo,
      base_tree: baseTreeSha,
      tree: treeItems,
    })
  );

  // 5. Create commit
  const author = args.author_name && args.author_email
    ? { name: args.author_name, email: args.author_email, date: new Date().toISOString() }
    : undefined;
  const { data: newCommit } = await call(() =>
    octokit.git.createCommit({
      owner: args.owner, repo: args.repo,
      message: args.message,
      tree: newTree.sha,
      parents: [parentSha],
      author,
    })
  );

  // 6. Update branch ref
  await call(() =>
    octokit.git.updateRef({
      owner: args.owner, repo: args.repo,
      ref: `heads/${args.branch}`,
      sha: newCommit.sha,
    })
  );

  return ok(`Pushed ${args.files.length} file(s) to ${args.owner}/${args.repo}@${args.branch}.\nCommit: ${newCommit.sha}\nURL: ${newCommit.html_url}`);
}

// ─── get_raw_file ─────────────────────────────────────────────────────────────
// Returns raw content of a file, supporting large files via the raw API
export const getRawFileSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  path: z.string(),
  ref: z.string().optional(),
  max_chars: z.number().int().optional().default(100000).describe("Maximum characters to return (default 100000)"),
});

export async function getRawFile(octokit: Octokit, args: z.infer<typeof getRawFileSchema>): Promise<ToolResult> {
  try {
    const { data } = await call(() =>
      octokit.repos.getContent({ owner: args.owner, repo: args.repo, path: args.path, ref: args.ref })
    );
    if (Array.isArray(data)) return err("Path is a directory. Use list_directory.");
    if (data.type === "file" && "content" in data) {
      const raw = Buffer.from(data.content as string, "base64").toString("utf-8");
      const truncated = raw.length > args.max_chars;
      const content = truncated ? raw.slice(0, args.max_chars) : raw;
      return ok(truncated ? `${content}\n\n[Truncated — ${raw.length} total chars, showing first ${args.max_chars}]` : content);
    }
    return err("Unexpected content type.");
  } catch (e) {
    return err(String(e));
  }
}
