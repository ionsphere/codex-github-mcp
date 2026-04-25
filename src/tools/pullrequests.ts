import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON, err } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── list_pull_requests ───────────────────────────────────────────────────────
export const listPullRequestsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
  head: z.string().optional().describe("Filter by head user/org and branch: 'user:branch-name'"),
  base: z.string().optional().describe("Filter by base branch name"),
  sort: z.enum(["created", "updated", "popularity", "long-running"]).optional().default("created"),
  direction: z.enum(["asc", "desc"]).optional().default("desc"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listPullRequests(octokit: Octokit, args: z.infer<typeof listPullRequestsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.list({
      owner: args.owner, repo: args.repo,
      state: args.state, head: args.head, base: args.base,
      sort: args.sort, direction: args.direction,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(pr => ({
    number: pr.number, title: pr.title, state: pr.state,
    draft: pr.draft, user: pr.user?.login,
    head: { ref: pr.head.ref, sha: pr.head.sha },
    base: { ref: pr.base.ref, sha: pr.base.sha },
    labels: pr.labels.map(l => l.name),
    assignees: pr.assignees?.map(a => a.login),
    requested_reviewers: pr.requested_reviewers?.map(r => r.login),
    mergeable_state: (pr as Record<string, unknown>).mergeable_state,
    comments: (pr as Record<string, unknown>).comments,
    review_comments: (pr as Record<string, unknown>).review_comments,
    commits: (pr as Record<string, unknown>).commits,
    additions: (pr as Record<string, unknown>).additions,
    deletions: (pr as Record<string, unknown>).deletions,
    changed_files: (pr as Record<string, unknown>).changed_files,
    created_at: pr.created_at, updated_at: pr.updated_at, merged_at: pr.merged_at,
    html_url: pr.html_url,
  })));
}

// ─── get_pull_request ─────────────────────────────────────────────────────────
export const getPullRequestSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
});

export async function getPullRequest(octokit: Octokit, args: z.infer<typeof getPullRequestSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.get({ owner: args.owner, repo: args.repo, pull_number: args.pull_number })
  );
  return okJSON({
    number: data.number, title: data.title, state: data.state,
    draft: data.draft, user: data.user?.login, body: data.body,
    head: { ref: data.head.ref, sha: data.head.sha, repo: data.head.repo?.full_name },
    base: { ref: data.base.ref, sha: data.base.sha, repo: data.base.repo?.full_name },
    labels: data.labels.map(l => l.name),
    assignees: data.assignees?.map(a => a.login),
    requested_reviewers: data.requested_reviewers?.map(r => r.login),
    mergeable: data.mergeable, mergeable_state: data.mergeable_state,
    merged: data.merged, merged_by: data.merged_by?.login,
    comments: (data as Record<string, unknown>).comments,
    review_comments: (data as Record<string, unknown>).review_comments,
    commits: (data as Record<string, unknown>).commits,
    additions: (data as Record<string, unknown>).additions,
    deletions: (data as Record<string, unknown>).deletions,
    changed_files: (data as Record<string, unknown>).changed_files,
    created_at: data.created_at, updated_at: data.updated_at,
    merged_at: data.merged_at, closed_at: data.closed_at,
    html_url: data.html_url,
  });
}

// ─── create_pull_request ──────────────────────────────────────────────────────
export const createPullRequestSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  head: z.string().describe("The branch containing changes (e.g. 'feature-branch' or 'user:branch')"),
  base: z.string().describe("The branch to merge changes into (e.g. 'main')"),
  draft: z.boolean().optional().default(false),
  maintainer_can_modify: z.boolean().optional().default(true),
});

export async function createPullRequest(octokit: Octokit, args: z.infer<typeof createPullRequestSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.create({
      owner: args.owner, repo: args.repo,
      title: args.title, body: args.body,
      head: args.head, base: args.base,
      draft: args.draft, maintainer_can_modify: args.maintainer_can_modify,
    })
  );
  return ok(`PR #${data.number} created: ${data.title}\nURL: ${data.html_url}`);
}

// ─── update_pull_request ──────────────────────────────────────────────────────
export const updatePullRequestSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(["open", "closed"]).optional(),
  base: z.string().optional().describe("Change the base branch"),
  maintainer_can_modify: z.boolean().optional(),
});

export async function updatePullRequest(octokit: Octokit, args: z.infer<typeof updatePullRequestSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.update({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      title: args.title, body: args.body, state: args.state,
      base: args.base, maintainer_can_modify: args.maintainer_can_modify,
    })
  );
  return ok(`PR #${data.number} updated.\nURL: ${data.html_url}`);
}

// ─── merge_pull_request ───────────────────────────────────────────────────────
export const mergePullRequestSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  commit_title: z.string().optional(),
  commit_message: z.string().optional(),
  merge_method: z.enum(["merge", "squash", "rebase"]).optional().default("merge"),
  sha: z.string().optional().describe("SHA that pull request head must match to allow merge"),
});

export async function mergePullRequest(octokit: Octokit, args: z.infer<typeof mergePullRequestSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.merge({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      commit_title: args.commit_title, commit_message: args.commit_message,
      merge_method: args.merge_method, sha: args.sha,
    })
  );
  return ok(`PR #${args.pull_number} merged.\nSHA: ${data.sha}\nMessage: ${data.message}`);
}

// ─── list_pr_files ────────────────────────────────────────────────────────────
export const listPrFilesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listPrFiles(octokit: Octokit, args: z.infer<typeof listPrFilesSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.listFiles({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(f => ({
    filename: f.filename, status: f.status,
    additions: f.additions, deletions: f.deletions, changes: f.changes,
    sha: f.sha, blob_url: f.blob_url,
    patch: f.patch?.slice(0, 3000),
  })));
}

// ─── list_pr_commits ──────────────────────────────────────────────────────────
export const listPrCommitsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listPrCommits(octokit: Octokit, args: z.infer<typeof listPrCommitsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.listCommits({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(c => ({
    sha: c.sha, message: c.commit.message,
    author: c.commit.author?.name, date: c.commit.author?.date, html_url: c.html_url,
  })));
}

// ─── list_pr_reviews ──────────────────────────────────────────────────────────
export const listPrReviewsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listPrReviews(octokit: Octokit, args: z.infer<typeof listPrReviewsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.listReviews({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(r => ({
    id: r.id, user: r.user?.login, state: r.state,
    body: r.body, submitted_at: r.submitted_at, html_url: r.html_url,
  })));
}

// ─── create_pr_review ─────────────────────────────────────────────────────────
export const createPrReviewSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  body: z.string().optional().describe("The body text of the review"),
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).describe("Review action"),
  commit_id: z.string().optional().describe("The SHA of the commit that needs a review"),
  comments: z.array(z.object({
    path: z.string().describe("The relative path to the file being commented on"),
    position: z.number().int().optional().describe("Line index in the diff"),
    line: z.number().int().optional().describe("Line number in the file"),
    side: z.enum(["LEFT", "RIGHT"]).optional(),
    body: z.string().describe("Comment text"),
  })).optional().describe("Line-level comments to include with the review"),
});

export async function createPrReview(octokit: Octokit, args: z.infer<typeof createPrReviewSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.createReview({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      body: args.body, event: args.event, commit_id: args.commit_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comments: args.comments as any,
    })
  );
  return ok(`Review ${data.state} submitted on PR #${args.pull_number}.\nURL: ${data.html_url}`);
}

// ─── list_review_comments ─────────────────────────────────────────────────────
export const listReviewCommentsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  sort: z.enum(["created", "updated"]).optional().default("created"),
  direction: z.enum(["asc", "desc"]).optional().default("asc"),
  since: z.string().optional(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listReviewComments(octokit: Octokit, args: z.infer<typeof listReviewCommentsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.listReviewComments({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      sort: args.sort, direction: args.direction, since: args.since,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(c => ({
    id: c.id, user: c.user?.login, path: c.path,
    line: c.line, side: c.side, body: c.body,
    created_at: c.created_at, updated_at: c.updated_at, html_url: c.html_url,
  })));
}

// ─── create_review_comment ────────────────────────────────────────────────────
export const createReviewCommentSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  body: z.string(),
  commit_id: z.string().describe("The SHA of the commit to comment on"),
  path: z.string().describe("The relative path to the file"),
  line: z.number().int().optional().describe("Line number in the file"),
  side: z.enum(["LEFT", "RIGHT"]).optional().default("RIGHT"),
  start_line: z.number().int().optional().describe("For multi-line comments: start line"),
  start_side: z.enum(["LEFT", "RIGHT"]).optional(),
  in_reply_to: z.number().int().optional().describe("Reply to an existing comment by ID"),
});

export async function createReviewComment(octokit: Octokit, args: z.infer<typeof createReviewCommentSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.pulls.createReviewComment({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      body: args.body, commit_id: args.commit_id, path: args.path,
      line: args.line, side: args.side as "LEFT" | "RIGHT" | undefined,
      start_line: args.start_line,
      start_side: args.start_side as "LEFT" | "RIGHT" | undefined,
      in_reply_to: args.in_reply_to,
    })
  );
  return ok(`Review comment created on PR #${args.pull_number}.\nURL: ${data.html_url}`);
}

// ─── request_reviewers ────────────────────────────────────────────────────────
export const requestReviewersSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pull_number: z.number().int(),
  reviewers: z.array(z.string()).optional().describe("List of user logins"),
  team_reviewers: z.array(z.string()).optional().describe("List of team slugs"),
});

export async function requestReviewers(octokit: Octokit, args: z.infer<typeof requestReviewersSchema>): Promise<ToolResult> {
  await call(() =>
    octokit.pulls.requestReviewers({
      owner: args.owner, repo: args.repo, pull_number: args.pull_number,
      reviewers: args.reviewers, team_reviewers: args.team_reviewers,
    })
  );
  return ok(`Review requested for PR #${args.pull_number}.`);
}
