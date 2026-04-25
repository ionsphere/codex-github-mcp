import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { okJSON } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── get_authenticated_user ───────────────────────────────────────────────────
export const getAuthenticatedUserSchema = z.object({});

export async function getAuthenticatedUser(octokit: Octokit, _args: z.infer<typeof getAuthenticatedUserSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.users.getAuthenticated());
  return okJSON({
    login: data.login, id: data.id, name: data.name,
    email: data.email, bio: data.bio,
    public_repos: data.public_repos, private_repos: (data as Record<string, unknown>).total_private_repos,
    followers: data.followers, following: data.following,
    html_url: data.html_url, created_at: data.created_at,
    plan: (data as Record<string, unknown>).plan,
  });
}

// ─── get_user ─────────────────────────────────────────────────────────────────
export const getUserSchema = z.object({
  username: z.string(),
});

export async function getUser(octokit: Octokit, args: z.infer<typeof getUserSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.users.getByUsername({ username: args.username }));
  return okJSON({
    login: data.login, id: data.id, type: data.type, name: data.name,
    company: data.company, blog: data.blog, location: data.location,
    email: data.email, bio: data.bio,
    public_repos: data.public_repos, public_gists: data.public_gists,
    followers: data.followers, following: data.following,
    html_url: data.html_url, created_at: data.created_at,
  });
}

// ─── list_user_orgs ───────────────────────────────────────────────────────────
export const listUserOrgsSchema = z.object({
  username: z.string().optional().describe("Omit to list orgs for authenticated user"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listUserOrgs(octokit: Octokit, args: z.infer<typeof listUserOrgsSchema>): Promise<ToolResult> {
  if (args.username) {
    const { data } = await call(() =>
      octokit.orgs.listForUser({ username: args.username!, per_page: args.per_page, page: args.page })
    );
    return okJSON(data.map(o => ({ login: o.login, id: o.id, description: o.description, url: o.url })));
  }
  const { data } = await call(() =>
    octokit.orgs.listForAuthenticatedUser({ per_page: args.per_page, page: args.page })
  );
  return okJSON(data.map(o => ({ login: o.login, id: o.id, description: o.description, url: o.url })));
}

// ─── get_org ──────────────────────────────────────────────────────────────────
export const getOrgSchema = z.object({
  org: z.string(),
});

export async function getOrg(octokit: Octokit, args: z.infer<typeof getOrgSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.orgs.get({ org: args.org }));
  return okJSON({
    login: data.login, id: data.id, name: data.name,
    description: data.description, email: data.email,
    public_repos: data.public_repos, followers: data.followers,
    html_url: data.html_url, created_at: data.created_at,
    plan: (data as Record<string, unknown>).plan,
  });
}

// ─── list_org_members ─────────────────────────────────────────────────────────
export const listOrgMembersSchema = z.object({
  org: z.string(),
  filter: z.enum(["2fa_disabled", "all"]).optional().default("all"),
  role: z.enum(["all", "admin", "member"]).optional().default("all"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listOrgMembers(octokit: Octokit, args: z.infer<typeof listOrgMembersSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.orgs.listMembers({ org: args.org, filter: args.filter, role: args.role, per_page: args.per_page, page: args.page })
  );
  return okJSON(data.map(m => ({ login: m.login, id: m.id, html_url: m.html_url })));
}

// ─── list_followers ───────────────────────────────────────────────────────────
export const listFollowersSchema = z.object({
  username: z.string().optional().describe("Omit to list followers of authenticated user"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listFollowers(octokit: Octokit, args: z.infer<typeof listFollowersSchema>): Promise<ToolResult> {
  if (args.username) {
    const { data } = await call(() =>
      octokit.users.listFollowersForUser({ username: args.username!, per_page: args.per_page, page: args.page })
    );
    return okJSON(data.map(u => ({ login: u.login, id: u.id, html_url: u.html_url })));
  }
  const { data } = await call(() =>
    octokit.users.listFollowersForAuthenticatedUser({ per_page: args.per_page, page: args.page })
  );
  return okJSON(data.map(u => ({ login: u.login, id: u.id, html_url: u.html_url })));
}
