import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { okJSON } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── search_repositories ──────────────────────────────────────────────────────
export const searchRepositoriesSchema = z.object({
  q: z.string().describe("Search query (GitHub search syntax supported, e.g. 'language:typescript stars:>100')"),
  sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function searchRepositories(octokit: Octokit, args: z.infer<typeof searchRepositoriesSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.search.repos({ q: args.q, sort: args.sort, order: args.order, per_page: args.per_page, page: args.page })
  );
  return okJSON({
    total_count: data.total_count,
    incomplete_results: data.incomplete_results,
    items: data.items.map(r => ({
      full_name: r.full_name, description: r.description,
      html_url: r.html_url, language: r.language,
      stargazers_count: r.stargazers_count, forks_count: r.forks_count,
      open_issues_count: r.open_issues_count, topics: r.topics,
      updated_at: r.updated_at, pushed_at: r.pushed_at,
    })),
  });
}

// ─── search_code ──────────────────────────────────────────────────────────────
export const searchCodeSchema = z.object({
  q: z.string().describe("Search query (e.g. 'addClass in:file language:js repo:jquery/jquery')"),
  sort: z.enum(["indexed"]).optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function searchCode(octokit: Octokit, args: z.infer<typeof searchCodeSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.search.code({ q: args.q, sort: args.sort, order: args.order, per_page: args.per_page, page: args.page })
  );
  return okJSON({
    total_count: data.total_count,
    incomplete_results: data.incomplete_results,
    items: data.items.map(i => ({
      name: i.name, path: i.path,
      sha: i.sha, html_url: i.html_url,
      repository: i.repository.full_name,
    })),
  });
}

// ─── search_issues ────────────────────────────────────────────────────────────
export const searchIssuesSchema = z.object({
  q: z.string().describe("Search query (e.g. 'is:issue is:open label:bug repo:owner/repo')"),
  sort: z.enum(["comments", "reactions", "reactions-+1", "reactions--1", "reactions-smile", "reactions-thinking_face", "reactions-heart", "reactions-tada", "interactions", "created", "updated"]).optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function searchIssues(octokit: Octokit, args: z.infer<typeof searchIssuesSchema>): Promise<ToolResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await call(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (octokit.search.issuesAndPullRequests as any)({ q: args.q, sort: args.sort, order: args.order, per_page: args.per_page, page: args.page })
  ) as { data: any };
  const data = result.data;
  return okJSON({
    total_count: data.total_count,
    incomplete_results: data.incomplete_results,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: data.items.map((i: any) => ({
      number: i.number, title: i.title, state: i.state,
      html_url: i.html_url, repository_url: i.repository_url,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: i.user?.login, labels: i.labels.map((l: any) => l.name),
      created_at: i.created_at, updated_at: i.updated_at,
      pull_request: !!i.pull_request,
    })),
  });
}

// ─── search_commits ───────────────────────────────────────────────────────────
export const searchCommitsSchema = z.object({
  q: z.string().describe("Search query (e.g. 'fix bug repo:owner/repo author:username')"),
  sort: z.enum(["author-date", "committer-date"]).optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function searchCommits(octokit: Octokit, args: z.infer<typeof searchCommitsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.search.commits({ q: args.q, sort: args.sort, order: args.order, per_page: args.per_page, page: args.page })
  );
  return okJSON({
    total_count: data.total_count,
    incomplete_results: data.incomplete_results,
    items: data.items.map(c => ({
      sha: c.sha, message: c.commit.message,
      author: c.commit.author?.name, date: c.commit.author?.date,
      html_url: c.html_url,
      repository: c.repository.full_name,
    })),
  });
}

// ─── search_users ─────────────────────────────────────────────────────────────
export const searchUsersSchema = z.object({
  q: z.string().describe("Search query (e.g. 'fullname:John Doe location:London')"),
  sort: z.enum(["followers", "repositories", "joined"]).optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function searchUsers(octokit: Octokit, args: z.infer<typeof searchUsersSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.search.users({ q: args.q, sort: args.sort, order: args.order, per_page: args.per_page, page: args.page })
  );
  return okJSON({
    total_count: data.total_count,
    items: data.items.map(u => ({
      login: u.login, id: u.id, type: u.type,
      html_url: u.html_url, score: u.score,
    })),
  });
}
