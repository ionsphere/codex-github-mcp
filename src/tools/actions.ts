import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── list_workflows ───────────────────────────────────────────────────────────
export const listWorkflowsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listWorkflows(octokit: Octokit, args: z.infer<typeof listWorkflowsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.actions.listRepoWorkflows({ owner: args.owner, repo: args.repo, per_page: args.per_page, page: args.page })
  );
  return okJSON({
    total_count: data.total_count,
    workflows: data.workflows.map(w => ({
      id: w.id, name: w.name, state: w.state,
      path: w.path, html_url: w.html_url,
      created_at: w.created_at, updated_at: w.updated_at,
    })),
  });
}

// ─── list_workflow_runs ───────────────────────────────────────────────────────
export const listWorkflowRunsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  workflow_id: z.union([z.string(), z.number()]).optional().describe("Workflow ID or filename (e.g. 'ci.yml')"),
  branch: z.string().optional(),
  event: z.string().optional().describe("Event type: push, pull_request, schedule, workflow_dispatch, etc."),
  status: z.enum(["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting", "pending"]).optional(),
  actor: z.string().optional().describe("Username that triggered the run"),
  created: z.string().optional().describe("Date range, e.g. '>=2024-01-01'"),
  per_page: z.number().int().min(1).max(100).optional().default(20),
  page: z.number().int().min(1).optional().default(1),
});

export async function listWorkflowRuns(octokit: Octokit, args: z.infer<typeof listWorkflowRunsSchema>): Promise<ToolResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  if (args.workflow_id) {
    ({ data } = await call(() =>
      octokit.actions.listWorkflowRuns({
        owner: args.owner, repo: args.repo,
        workflow_id: args.workflow_id as string | number,
        branch: args.branch, event: args.event,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: args.status as any,
        actor: args.actor, created: args.created,
        per_page: args.per_page, page: args.page,
      })
    ));
  } else {
    ({ data } = await call(() =>
      octokit.actions.listWorkflowRunsForRepo({
        owner: args.owner, repo: args.repo,
        branch: args.branch, event: args.event,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: args.status as any,
        actor: args.actor, created: args.created,
        per_page: args.per_page, page: args.page,
      })
    ));
  }
  return okJSON({
    total_count: data.total_count,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workflow_runs: data.workflow_runs.map((r: any) => ({
      id: r.id, name: r.name, status: r.status, conclusion: r.conclusion,
      workflow_id: r.workflow_id, run_number: r.run_number,
      event: r.event, head_branch: r.head_branch, head_sha: r.head_sha,
      created_at: r.created_at, updated_at: r.updated_at,
      html_url: r.html_url, run_attempt: r.run_attempt,
    })),
  });
}

// ─── get_workflow_run ─────────────────────────────────────────────────────────
export const getWorkflowRunSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  run_id: z.number().int(),
});

export async function getWorkflowRun(octokit: Octokit, args: z.infer<typeof getWorkflowRunSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.actions.getWorkflowRun({ owner: args.owner, repo: args.repo, run_id: args.run_id })
  );
  return okJSON({
    id: data.id, name: data.name, status: data.status, conclusion: data.conclusion,
    workflow_id: data.workflow_id, run_number: data.run_number, run_attempt: data.run_attempt,
    event: data.event, head_branch: data.head_branch, head_sha: data.head_sha,
    head_commit: data.head_commit,
    created_at: data.created_at, updated_at: data.updated_at,
    run_started_at: data.run_started_at,
    html_url: data.html_url,
  });
}

// ─── trigger_workflow ─────────────────────────────────────────────────────────
export const triggerWorkflowSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  workflow_id: z.union([z.string(), z.number()]).describe("Workflow ID or filename (e.g. 'deploy.yml')"),
  ref: z.string().describe("Branch or tag to run the workflow on"),
  inputs: z.record(z.string()).optional().describe("Inputs for workflow_dispatch workflows"),
});

export async function triggerWorkflow(octokit: Octokit, args: z.infer<typeof triggerWorkflowSchema>): Promise<ToolResult> {
  await call(() =>
    octokit.actions.createWorkflowDispatch({
      owner: args.owner, repo: args.repo,
      workflow_id: args.workflow_id as string | number,
      ref: args.ref, inputs: args.inputs,
    })
  );
  return ok(`Workflow '${args.workflow_id}' triggered on ref '${args.ref}' in ${args.owner}/${args.repo}.`);
}

// ─── cancel_workflow_run ──────────────────────────────────────────────────────
export const cancelWorkflowRunSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  run_id: z.number().int(),
});

export async function cancelWorkflowRun(octokit: Octokit, args: z.infer<typeof cancelWorkflowRunSchema>): Promise<ToolResult> {
  await call(() =>
    octokit.actions.cancelWorkflowRun({ owner: args.owner, repo: args.repo, run_id: args.run_id })
  );
  return ok(`Workflow run ${args.run_id} cancellation requested.`);
}

// ─── rerun_workflow ───────────────────────────────────────────────────────────
export const rerunWorkflowSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  run_id: z.number().int(),
  enable_debug_logging: z.boolean().optional().default(false),
});

export async function rerunWorkflow(octokit: Octokit, args: z.infer<typeof rerunWorkflowSchema>): Promise<ToolResult> {
  await call(() =>
    octokit.actions.reRunWorkflow({
      owner: args.owner, repo: args.repo, run_id: args.run_id,
      enable_debug_logging: args.enable_debug_logging,
    })
  );
  return ok(`Workflow run ${args.run_id} rerun triggered.`);
}

// ─── list_workflow_run_jobs ───────────────────────────────────────────────────
export const listWorkflowRunJobsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  run_id: z.number().int(),
  filter: z.enum(["latest", "all"]).optional().default("latest"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listWorkflowRunJobs(octokit: Octokit, args: z.infer<typeof listWorkflowRunJobsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.actions.listJobsForWorkflowRun({
      owner: args.owner, repo: args.repo, run_id: args.run_id,
      filter: args.filter, per_page: args.per_page, page: args.page,
    })
  );
  return okJSON({
    total_count: data.total_count,
    jobs: data.jobs.map(j => ({
      id: j.id, name: j.name, status: j.status, conclusion: j.conclusion,
      started_at: j.started_at, completed_at: j.completed_at,
      runner_name: j.runner_name, html_url: j.html_url,
      steps: j.steps?.map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion, number: s.number })),
    })),
  });
}

// ─── get_workflow_run_logs ────────────────────────────────────────────────────
export const getWorkflowRunLogsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  run_id: z.number().int(),
});

export async function getWorkflowRunLogs(octokit: Octokit, args: z.infer<typeof getWorkflowRunLogsSchema>): Promise<ToolResult> {
  // Returns a redirect URL to download the logs ZIP
  const response = await call(() =>
    octokit.actions.downloadWorkflowRunLogs({ owner: args.owner, repo: args.repo, run_id: args.run_id })
  );
  const url = (response as { url?: string }).url ?? "Logs download initiated";
  return ok(`Logs archive download URL:\n${url}`);
}

// ─── list_artifacts ───────────────────────────────────────────────────────────
export const listArtifactsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  run_id: z.number().int().optional().describe("If provided, list artifacts for a specific run"),
  name: z.string().optional().describe("Filter by artifact name"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listArtifacts(octokit: Octokit, args: z.infer<typeof listArtifactsSchema>): Promise<ToolResult> {
  let data: { total_count: number; artifacts: Array<{ id: number; name: string; size_in_bytes: number; expired: boolean; created_at: string | null; expires_at: string | null; url: string }> };
  if (args.run_id) {
    ({ data } = await call(() =>
      octokit.actions.listWorkflowRunArtifacts({
        owner: args.owner, repo: args.repo, run_id: args.run_id!,
        name: args.name, per_page: args.per_page, page: args.page,
      }) as Promise<{ data: typeof data }>
    ));
  } else {
    ({ data } = await call(() =>
      octokit.actions.listArtifactsForRepo({
        owner: args.owner, repo: args.repo,
        name: args.name, per_page: args.per_page, page: args.page,
      }) as Promise<{ data: typeof data }>
    ));
  }
  return okJSON({
    total_count: data.total_count,
    artifacts: data.artifacts.map(a => ({
      id: a.id, name: a.name,
      size_in_bytes: a.size_in_bytes, expired: a.expired,
      created_at: a.created_at, expires_at: a.expires_at,
    })),
  });
}

// ─── list_repo_secrets ────────────────────────────────────────────────────────
export const listRepoSecretsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listRepoSecrets(octokit: Octokit, args: z.infer<typeof listRepoSecretsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.actions.listRepoSecrets({ owner: args.owner, repo: args.repo, per_page: args.per_page, page: args.page })
  );
  return okJSON({
    total_count: data.total_count,
    secrets: data.secrets.map(s => ({ name: s.name, created_at: s.created_at, updated_at: s.updated_at })),
  });
}
