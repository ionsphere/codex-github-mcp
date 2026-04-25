import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON, err } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── list_issues ──────────────────────────────────────────────────────────────
export const listIssuesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
  labels: z.string().optional().describe("Comma-separated list of label names"),
  assignee: z.string().optional().describe("Username or 'none' or '*'"),
  milestone: z.string().optional().describe("Milestone number, 'none', or '*'"),
  sort: z.enum(["created", "updated", "comments"]).optional().default("created"),
  direction: z.enum(["asc", "desc"]).optional().default("desc"),
  since: z.string().optional().describe("ISO 8601 date"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listIssues(octokit: Octokit, args: z.infer<typeof listIssuesSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.listForRepo({
      owner: args.owner, repo: args.repo,
      state: args.state, labels: args.labels,
      assignee: args.assignee, milestone: args.milestone,
      sort: args.sort, direction: args.direction,
      since: args.since, per_page: args.per_page, page: args.page,
    })
  );
  // Exclude pull requests from results
  const issues = data.filter(i => !i.pull_request);
  return okJSON(issues.map(i => ({
    number: i.number, title: i.title, state: i.state,
    user: i.user?.login, labels: i.labels.map(l => typeof l === "string" ? l : l.name),
    assignees: i.assignees?.map(a => a.login),
    comments: i.comments, created_at: i.created_at, updated_at: i.updated_at,
    html_url: i.html_url, body: i.body?.slice(0, 500),
  })));
}

// ─── get_issue ────────────────────────────────────────────────────────────────
export const getIssueSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  issue_number: z.number().int(),
});

export async function getIssue(octokit: Octokit, args: z.infer<typeof getIssueSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.get({ owner: args.owner, repo: args.repo, issue_number: args.issue_number })
  );
  return okJSON({
    number: data.number, title: data.title, state: data.state,
    user: data.user?.login, body: data.body,
    labels: data.labels.map(l => typeof l === "string" ? l : l.name),
    assignees: data.assignees?.map(a => a.login),
    milestone: data.milestone?.title,
    comments: data.comments, reactions: data.reactions,
    created_at: data.created_at, updated_at: data.updated_at, closed_at: data.closed_at,
    html_url: data.html_url,
  });
}

// ─── create_issue ─────────────────────────────────────────────────────────────
export const createIssueSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  milestone: z.number().int().optional(),
});

export async function createIssue(octokit: Octokit, args: z.infer<typeof createIssueSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.create({
      owner: args.owner, repo: args.repo,
      title: args.title, body: args.body,
      assignees: args.assignees, labels: args.labels,
      milestone: args.milestone,
    })
  );
  return ok(`Issue #${data.number} created: ${data.title}\nURL: ${data.html_url}`);
}

// ─── update_issue ─────────────────────────────────────────────────────────────
export const updateIssueSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  issue_number: z.number().int(),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(["open", "closed"]).optional(),
  state_reason: z.enum(["completed", "not_planned", "reopened"]).optional(),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  milestone: z.number().int().nullable().optional(),
});

export async function updateIssue(octokit: Octokit, args: z.infer<typeof updateIssueSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.update({
      owner: args.owner, repo: args.repo,
      issue_number: args.issue_number,
      title: args.title, body: args.body,
      state: args.state, state_reason: args.state_reason,
      assignees: args.assignees, labels: args.labels,
      milestone: args.milestone ?? undefined,
    })
  );
  return ok(`Issue #${data.number} updated.\nURL: ${data.html_url}`);
}

// ─── add_issue_comment ────────────────────────────────────────────────────────
export const addIssueCommentSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  issue_number: z.number().int(),
  body: z.string().describe("Comment text (Markdown supported)"),
});

export async function addIssueComment(octokit: Octokit, args: z.infer<typeof addIssueCommentSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.createComment({ owner: args.owner, repo: args.repo, issue_number: args.issue_number, body: args.body })
  );
  return ok(`Comment added to issue #${args.issue_number}.\nURL: ${data.html_url}`);
}

// ─── list_issue_comments ──────────────────────────────────────────────────────
export const listIssueCommentsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  issue_number: z.number().int(),
  since: z.string().optional(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listIssueComments(octokit: Octokit, args: z.infer<typeof listIssueCommentsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.listComments({
      owner: args.owner, repo: args.repo, issue_number: args.issue_number,
      since: args.since, per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(c => ({
    id: c.id, user: c.user?.login, body: c.body,
    created_at: c.created_at, updated_at: c.updated_at, html_url: c.html_url,
  })));
}

// ─── update_issue_comment ─────────────────────────────────────────────────────
export const updateIssueCommentSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  comment_id: z.number().int(),
  body: z.string(),
});

export async function updateIssueComment(octokit: Octokit, args: z.infer<typeof updateIssueCommentSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.updateComment({ owner: args.owner, repo: args.repo, comment_id: args.comment_id, body: args.body })
  );
  return ok(`Comment ${args.comment_id} updated.\nURL: ${data.html_url}`);
}

// ─── delete_issue_comment ─────────────────────────────────────────────────────
export const deleteIssueCommentSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  comment_id: z.number().int(),
});

export async function deleteIssueComment(octokit: Octokit, args: z.infer<typeof deleteIssueCommentSchema>): Promise<ToolResult> {
  await call(() =>
    octokit.issues.deleteComment({ owner: args.owner, repo: args.repo, comment_id: args.comment_id })
  );
  return ok(`Comment ${args.comment_id} deleted.`);
}

// ─── list_labels ──────────────────────────────────────────────────────────────
export const listLabelsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listLabels(octokit: Octokit, args: z.infer<typeof listLabelsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.listLabelsForRepo({ owner: args.owner, repo: args.repo, per_page: args.per_page, page: args.page })
  );
  return okJSON(data.map(l => ({ id: l.id, name: l.name, color: l.color, description: l.description })));
}

// ─── create_label ─────────────────────────────────────────────────────────────
export const createLabelSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  name: z.string(),
  color: z.string().describe("6-character hex color code (without #)"),
  description: z.string().optional(),
});

export async function createLabel(octokit: Octokit, args: z.infer<typeof createLabelSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.createLabel({ owner: args.owner, repo: args.repo, name: args.name, color: args.color, description: args.description })
  );
  return ok(`Label '${data.name}' created.`);
}

// ─── list_milestones ──────────────────────────────────────────────────────────
export const listMilestonesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
  sort: z.enum(["due_on", "completeness"]).optional().default("due_on"),
  direction: z.enum(["asc", "desc"]).optional().default("asc"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listMilestones(octokit: Octokit, args: z.infer<typeof listMilestonesSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.listMilestones({ owner: args.owner, repo: args.repo, state: args.state, sort: args.sort, direction: args.direction, per_page: args.per_page, page: args.page })
  );
  return okJSON(data.map(m => ({
    number: m.number, title: m.title, state: m.state,
    open_issues: m.open_issues, closed_issues: m.closed_issues,
    due_on: m.due_on, created_at: m.created_at, updated_at: m.updated_at,
    html_url: m.html_url,
  })));
}

// ─── create_milestone ─────────────────────────────────────────────────────────
export const createMilestoneSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  description: z.string().optional(),
  due_on: z.string().optional().describe("ISO 8601 date"),
  state: z.enum(["open", "closed"]).optional().default("open"),
});

export async function createMilestone(octokit: Octokit, args: z.infer<typeof createMilestoneSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.issues.createMilestone({ owner: args.owner, repo: args.repo, title: args.title, description: args.description, due_on: args.due_on, state: args.state })
  );
  return ok(`Milestone #${data.number} '${data.title}' created.\nURL: ${data.html_url}`);
}
