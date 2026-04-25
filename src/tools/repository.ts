import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { call } from "../utils/octokit.js";
import { ok, okJSON, err } from "../types/index.js";
import type { ToolResult } from "../types/index.js";

// ─── list_repos ─────────────────────────────────────────────────────────────
export const listReposSchema = z.object({
  owner: z.string().optional().describe("User or org login. Defaults to the authenticated user."),
  type: z.enum(["all", "owner", "member", "public", "private"]).optional().default("all"),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).optional().default("updated"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listRepos(octokit: Octokit, args: z.infer<typeof listReposSchema>): Promise<ToolResult> {
  if (args.owner) {
    const { data } = await call(() =>
      octokit.repos.listForUser({
        username: args.owner!,
        type: args.type as "all" | "owner" | "member" | undefined,
        sort: args.sort,
        per_page: args.per_page,
        page: args.page,
      })
    );
    return okJSON(data.map(r => ({
      id: r.id, name: r.name, full_name: r.full_name,
      private: r.private, description: r.description,
      html_url: r.html_url, default_branch: r.default_branch,
      stargazers_count: r.stargazers_count, forks_count: r.forks_count,
      language: r.language, pushed_at: r.pushed_at, updated_at: r.updated_at,
    })));
  }
  const { data } = await call(() =>
    octokit.repos.listForAuthenticatedUser({
      type: args.type as "all" | "owner" | "member" | "public" | "private" | undefined,
      sort: args.sort,
      per_page: args.per_page,
      page: args.page,
    })
  );
  return okJSON(data.map(r => ({
    id: r.id, name: r.name, full_name: r.full_name,
    private: r.private, description: r.description,
    html_url: r.html_url, default_branch: r.default_branch,
    stargazers_count: r.stargazers_count, forks_count: r.forks_count,
    language: r.language, pushed_at: r.pushed_at, updated_at: r.updated_at,
  })));
}

// ─── get_repo ────────────────────────────────────────────────────────────────
export const getRepoSchema = z.object({
  owner: z.string().describe("Repository owner (user or org)"),
  repo: z.string().describe("Repository name"),
});

export async function getRepo(octokit: Octokit, args: z.infer<typeof getRepoSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.repos.get({ owner: args.owner, repo: args.repo }));
  return okJSON({
    id: data.id, name: data.name, full_name: data.full_name,
    private: data.private, description: data.description,
    html_url: data.html_url, clone_url: data.clone_url, ssh_url: data.ssh_url,
    default_branch: data.default_branch, language: data.language,
    stargazers_count: data.stargazers_count, forks_count: data.forks_count,
    open_issues_count: data.open_issues_count,
    topics: data.topics, visibility: data.visibility,
    created_at: data.created_at, updated_at: data.updated_at, pushed_at: data.pushed_at,
    size: data.size, license: data.license?.name,
    has_issues: data.has_issues, has_wiki: data.has_wiki, has_projects: data.has_projects,
    archived: data.archived, disabled: data.disabled,
  });
}

// ─── create_repo ─────────────────────────────────────────────────────────────
export const createRepoSchema = z.object({
  name: z.string().describe("Repository name"),
  description: z.string().optional(),
  private: z.boolean().optional().default(false),
  auto_init: z.boolean().optional().default(true),
  gitignore_template: z.string().optional().describe("e.g. 'Node', 'Python'"),
  license_template: z.string().optional().describe("e.g. 'mit', 'apache-2.0'"),
  org: z.string().optional().describe("Create under this org instead of the authenticated user"),
});

export async function createRepo(octokit: Octokit, args: z.infer<typeof createRepoSchema>): Promise<ToolResult> {
  const payload = {
    name: args.name,
    description: args.description,
    private: args.private,
    auto_init: args.auto_init,
    gitignore_template: args.gitignore_template,
    license_template: args.license_template,
  };
  const { data } = args.org
    ? await call(() => octokit.repos.createInOrg({ org: args.org!, ...payload }))
    : await call(() => octokit.repos.createForAuthenticatedUser(payload));
  return ok(`Repository created: ${data.full_name}\nURL: ${data.html_url}\nClone: ${data.clone_url}`);
}

// ─── fork_repo ────────────────────────────────────────────────────────────────
export const forkRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  organization: z.string().optional().describe("Fork into this org instead of your account"),
  default_branch_only: z.boolean().optional().default(false),
});

export async function forkRepo(octokit: Octokit, args: z.infer<typeof forkRepoSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.createFork({
      owner: args.owner, repo: args.repo,
      organization: args.organization,
      default_branch_only: args.default_branch_only,
    })
  );
  return ok(`Fork created: ${data.full_name}\nURL: ${data.html_url}`);
}

// ─── delete_repo ─────────────────────────────────────────────────────────────
export const deleteRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  confirm: z.literal(true).describe("Must explicitly pass true to confirm deletion"),
});

export async function deleteRepo(octokit: Octokit, args: z.infer<typeof deleteRepoSchema>): Promise<ToolResult> {
  await call(() => octokit.repos.delete({ owner: args.owner, repo: args.repo }));
  return ok(`Repository ${args.owner}/${args.repo} has been deleted.`);
}

// ─── list_branches ───────────────────────────────────────────────────────────
export const listBranchesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  protected: z.boolean().optional(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listBranches(octokit: Octokit, args: z.infer<typeof listBranchesSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.listBranches({
      owner: args.owner, repo: args.repo,
      protected: args.protected,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(b => ({ name: b.name, sha: b.commit.sha, protected: b.protected })));
}

// ─── create_branch ───────────────────────────────────────────────────────────
export const createBranchSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  branch: z.string().describe("New branch name"),
  from_branch: z.string().optional().describe("Source branch (defaults to repo default branch)"),
  from_sha: z.string().optional().describe("Source commit SHA (overrides from_branch)"),
});

export async function createBranch(octokit: Octokit, args: z.infer<typeof createBranchSchema>): Promise<ToolResult> {
  let sha = args.from_sha;
  if (!sha) {
    const sourceBranch = args.from_branch || (await call(() => octokit.repos.get({ owner: args.owner, repo: args.repo }))).data.default_branch;
    const { data: ref } = await call(() =>
      octokit.git.getRef({ owner: args.owner, repo: args.repo, ref: `heads/${sourceBranch}` })
    );
    sha = ref.object.sha;
  }
  const { data } = await call(() =>
    octokit.git.createRef({
      owner: args.owner, repo: args.repo,
      ref: `refs/heads/${args.branch}`,
      sha,
    })
  );
  return ok(`Branch '${args.branch}' created at ${data.object.sha}`);
}

// ─── delete_branch ───────────────────────────────────────────────────────────
export const deleteBranchSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  branch: z.string(),
});

export async function deleteBranch(octokit: Octokit, args: z.infer<typeof deleteBranchSchema>): Promise<ToolResult> {
  await call(() =>
    octokit.git.deleteRef({ owner: args.owner, repo: args.repo, ref: `heads/${args.branch}` })
  );
  return ok(`Branch '${args.branch}' deleted from ${args.owner}/${args.repo}.`);
}

// ─── list_commits ─────────────────────────────────────────────────────────────
export const listCommitsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  sha: z.string().optional().describe("Branch, tag, or commit SHA. Defaults to default branch."),
  path: z.string().optional().describe("Filter commits touching this path"),
  author: z.string().optional().describe("GitHub username or email"),
  since: z.string().optional().describe("ISO 8601 date — only commits after this"),
  until: z.string().optional().describe("ISO 8601 date — only commits before this"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listCommits(octokit: Octokit, args: z.infer<typeof listCommitsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.listCommits({
      owner: args.owner, repo: args.repo,
      sha: args.sha, path: args.path,
      author: args.author, since: args.since, until: args.until,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(c => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name,
    date: c.commit.author?.date,
    html_url: c.html_url,
  })));
}

// ─── get_commit ───────────────────────────────────────────────────────────────
export const getCommitSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string().describe("Commit SHA, branch, or tag"),
});

export async function getCommit(octokit: Octokit, args: z.infer<typeof getCommitSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.repos.getCommit({ owner: args.owner, repo: args.repo, ref: args.ref }));
  return okJSON({
    sha: data.sha, message: data.commit.message,
    author: data.commit.author, committer: data.commit.committer,
    html_url: data.html_url,
    stats: data.stats,
    files: data.files?.map(f => ({
      filename: f.filename, status: f.status,
      additions: f.additions, deletions: f.deletions,
      changes: f.changes, patch: f.patch?.slice(0, 2000),
    })),
    parents: data.parents.map(p => p.sha),
  });
}

// ─── compare_commits ──────────────────────────────────────────────────────────
export const compareCommitsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  base: z.string().describe("Base branch, tag, or SHA"),
  head: z.string().describe("Head branch, tag, or SHA"),
});

export async function compareCommits(octokit: Octokit, args: z.infer<typeof compareCommitsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.compareCommitsWithBasehead({
      owner: args.owner, repo: args.repo,
      basehead: `${args.base}...${args.head}`,
    })
  );
  return okJSON({
    status: data.status,
    ahead_by: data.ahead_by, behind_by: data.behind_by,
    total_commits: data.total_commits,
    commits: data.commits.map(c => ({ sha: c.sha, message: c.commit.message, date: c.commit.author?.date })),
    files: data.files?.map(f => ({
      filename: f.filename, status: f.status,
      additions: f.additions, deletions: f.deletions, changes: f.changes,
    })),
  });
}

// ─── list_tags ────────────────────────────────────────────────────────────────
export const listTagsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listTags(octokit: Octokit, args: z.infer<typeof listTagsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.listTags({ owner: args.owner, repo: args.repo, per_page: args.per_page, page: args.page })
  );
  return okJSON(data.map(t => ({ name: t.name, sha: t.commit.sha })));
}

// ─── create_tag ───────────────────────────────────────────────────────────────
export const createTagSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  tag: z.string().describe("Tag name"),
  message: z.string().describe("Tag message / annotation"),
  sha: z.string().describe("The SHA of the object being tagged"),
  type: z.enum(["commit", "tree", "blob"]).optional().default("commit"),
});

export async function createTag(octokit: Octokit, args: z.infer<typeof createTagSchema>): Promise<ToolResult> {
  const { data: tagObj } = await call(() =>
    octokit.git.createTag({
      owner: args.owner, repo: args.repo,
      tag: args.tag, message: args.message,
      object: args.sha, type: args.type,
    })
  );
  await call(() =>
    octokit.git.createRef({
      owner: args.owner, repo: args.repo,
      ref: `refs/tags/${args.tag}`, sha: tagObj.sha,
    })
  );
  return ok(`Tag '${args.tag}' created at ${tagObj.sha}`);
}

// ─── list_releases ────────────────────────────────────────────────────────────
export const listReleasesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  per_page: z.number().int().min(1).max(100).optional().default(10),
  page: z.number().int().min(1).optional().default(1),
});

export async function listReleases(octokit: Octokit, args: z.infer<typeof listReleasesSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.listReleases({ owner: args.owner, repo: args.repo, per_page: args.per_page, page: args.page })
  );
  return okJSON(data.map(r => ({
    id: r.id, tag_name: r.tag_name, name: r.name,
    draft: r.draft, prerelease: r.prerelease,
    html_url: r.html_url, published_at: r.published_at,
    body: r.body?.slice(0, 1000),
  })));
}

// ─── create_release ───────────────────────────────────────────────────────────
export const createReleaseSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  tag_name: z.string(),
  name: z.string().optional(),
  body: z.string().optional().describe("Release notes (Markdown)"),
  draft: z.boolean().optional().default(false),
  prerelease: z.boolean().optional().default(false),
  target_commitish: z.string().optional().describe("Branch or SHA — defaults to default branch"),
  generate_release_notes: z.boolean().optional().default(false),
});

export async function createRelease(octokit: Octokit, args: z.infer<typeof createReleaseSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.createRelease({
      owner: args.owner, repo: args.repo,
      tag_name: args.tag_name, name: args.name, body: args.body,
      draft: args.draft, prerelease: args.prerelease,
      target_commitish: args.target_commitish,
      generate_release_notes: args.generate_release_notes,
    })
  );
  return ok(`Release '${data.tag_name}' created.\nURL: ${data.html_url}`);
}

// ─── get_repo_topics ──────────────────────────────────────────────────────────
export const getRepoTopicsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

export async function getRepoTopics(octokit: Octokit, args: z.infer<typeof getRepoTopicsSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.repos.getAllTopics({ owner: args.owner, repo: args.repo }));
  return okJSON({ topics: data.names });
}

// ─── replace_repo_topics ──────────────────────────────────────────────────────
export const replaceRepoTopicsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  names: z.array(z.string()).describe("Complete list of topics to set"),
});

export async function replaceRepoTopics(octokit: Octokit, args: z.infer<typeof replaceRepoTopicsSchema>): Promise<ToolResult> {
  const { data } = await call(() => octokit.repos.replaceAllTopics({ owner: args.owner, repo: args.repo, names: args.names }));
  return ok(`Topics updated: ${data.names.join(", ")}`);
}

// ─── list_collaborators ───────────────────────────────────────────────────────
export const listCollaboratorsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  affiliation: z.enum(["outside", "direct", "all"]).optional().default("all"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  page: z.number().int().min(1).optional().default(1),
});

export async function listCollaborators(octokit: Octokit, args: z.infer<typeof listCollaboratorsSchema>): Promise<ToolResult> {
  const { data } = await call(() =>
    octokit.repos.listCollaborators({
      owner: args.owner, repo: args.repo,
      affiliation: args.affiliation,
      per_page: args.per_page, page: args.page,
    })
  );
  return okJSON(data.map(u => ({ login: u.login, id: u.id, permissions: u.permissions, role_name: u.role_name })));
}
