import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── list_notifications ───────────────────────────────────────────────────────
export const listNotificationsSchema = z.object({
  all: z.boolean().optional().default(false).describe("If true, show notifications marked as read"),
  participating: z.boolean().optional().default(false).describe("If true, only show notifications where you directly participated"),
  since: z.string().optional().describe("ISO 8601 timestamp"),
  before: z.string().optional().describe("ISO 8601 timestamp"),
  owner: z.string().optional().describe("Filter to a specific repo owner"),
  repo: z.string().optional().describe("Filter to a specific repo (requires owner)"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listNotifications(octokit: Octokit, args: z.infer<typeof listNotificationsSchema>): Promise<ToolResult> {
  if (args.owner && args.repo) {
    const { data } = await call(() =>
      octokit.activity.listRepoNotificationsForAuthenticatedUser({
        owner: args.owner!, repo: args.repo!,
        all: args.all, participating: args.participating,
        since: args.since, before: args.before,
        per_page: args.per_page, page: args.page,
      })
    );
    return okJSON(data.map(n => ({
      id: n.id, reason: n.reason, unread: n.unread,
      subject: { title: n.subject.title, type: n.subject.type, url: n.subject.url },
      repository: n.repository.full_name,
      updated_at: n.updated_at,
    })));
  }
  const { data } = await call(() =>
    octokit.activity.listNotificationsForAuthenticatedUser({
      all: args.all, participating: args.participating,
      since: args.since, before: args.before,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(n => ({
    id: n.id, reason: n.reason, unread: n.unread,
    subject: { title: n.subject.title, type: n.subject.type, url: n.subject.url },
    repository: n.repository.full_name,
    updated_at: n.updated_at,
  })));
}

// ─── mark_notifications_read ──────────────────────────────────────────────────
export const markNotificationsReadSchema = z.object({
  last_read_at: z.string().optional().describe("ISO 8601 timestamp — mark all notifications before this as read"),
  read: z.boolean().optional().default(true),
});

export async function markNotificationsRead(octokit: Octokit, args: z.infer<typeof markNotificationsReadSchema>): Promise<ToolResult> {
  await call(() =>
    octokit.activity.markNotificationsAsRead({ last_read_at: args.last_read_at, read: args.read })
  );
  return ok("Notifications marked as read.");
}

// ─── get_thread ───────────────────────────────────────────────────────────────
export const getThreadSchema = z.object({
  thread_id: z.number().int(),
});

export async function getThread(octokit: Octokit, args: z.infer<typeof getThreadSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.activity.getThread({ thread_id: args.thread_id }));
  return okJSON({
    id: data.id, reason: data.reason, unread: data.unread,
    subject: data.subject, repository: data.repository.full_name,
    updated_at: data.updated_at,
  });
}

// ─── mark_thread_read ─────────────────────────────────────────────────────────
export const markThreadReadSchema = z.object({
  thread_id: z.number().int(),
});

export async function markThreadRead(octokit: Octokit, args: z.infer<typeof markThreadReadSchema>): Promise<ToolResult> {
  await call(() => octokit.activity.markThreadAsRead({ thread_id: args.thread_id }));
  return ok(`Thread ${args.thread_id} marked as read.`);
}
