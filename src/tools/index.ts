/**
 * Central registry of all tools.
 * Each entry maps a tool name to its Zod input schema and handler function.
 */
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import type { ToolResult } from "../types/index.js";

// Repository
import * as repo from "./repository.js";
// Contents / Files
import * as contents from "./contents.js";
// Issues
import * as issues from "./issues.js";
// Pull Requests
import * as prs from "./pullrequests.js";
// Search
import * as search from "./search.js";
// Actions / Workflows
import * as actions from "./actions.js";
// Users / Orgs
import * as users from "./users.js";
// Checkout (full repo download)
import * as checkout from "./checkout.js";
// Gists
import * as gists from "./gists.js";
// Notifications
import * as notifications from "./notifications.js";
// Low-level Git Data API
import * as git from "./git.js";

export interface ToolDef {
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (octokit: Octokit, args: Record<string, unknown>) => Promise<ToolResult>;
}

export const TOOLS: Record<string, ToolDef> = {
  // ── Repository management ────────────────────────────────────────────────
  list_repos: {
    description: "List repositories for a user/org or the authenticated user.",
    inputSchema: repo.listReposSchema,
    handler: (o, a) => repo.listRepos(o, a as z.infer<typeof repo.listReposSchema>),
  },
  get_repo: {
    description: "Get detailed information about a specific repository.",
    inputSchema: repo.getRepoSchema,
    handler: (o, a) => repo.getRepo(o, a as z.infer<typeof repo.getRepoSchema>),
  },
  create_repo: {
    description: "Create a new GitHub repository for the authenticated user or an org.",
    inputSchema: repo.createRepoSchema,
    handler: (o, a) => repo.createRepo(o, a as z.infer<typeof repo.createRepoSchema>),
  },
  fork_repo: {
    description: "Fork a repository into the authenticated user's account or an org.",
    inputSchema: repo.forkRepoSchema,
    handler: (o, a) => repo.forkRepo(o, a as z.infer<typeof repo.forkRepoSchema>),
  },
  delete_repo: {
    description: "Delete a repository. Requires confirm: true to prevent accidental deletion.",
    inputSchema: repo.deleteRepoSchema,
    handler: (o, a) => repo.deleteRepo(o, a as z.infer<typeof repo.deleteRepoSchema>),
  },
  list_branches: {
    description: "List branches in a repository.",
    inputSchema: repo.listBranchesSchema,
    handler: (o, a) => repo.listBranches(o, a as z.infer<typeof repo.listBranchesSchema>),
  },
  create_branch: {
    description: "Create a new branch from an existing branch or commit SHA.",
    inputSchema: repo.createBranchSchema,
    handler: (o, a) => repo.createBranch(o, a as z.infer<typeof repo.createBranchSchema>),
  },
  delete_branch: {
    description: "Delete a branch from a repository.",
    inputSchema: repo.deleteBranchSchema,
    handler: (o, a) => repo.deleteBranch(o, a as z.infer<typeof repo.deleteBranchSchema>),
  },
  list_commits: {
    description: "List commits on a branch or for a file path, with optional date/author filters.",
    inputSchema: repo.listCommitsSchema,
    handler: (o, a) => repo.listCommits(o, a as z.infer<typeof repo.listCommitsSchema>),
  },
  get_commit: {
    description: "Get full details of a commit including the diff/patch for each changed file.",
    inputSchema: repo.getCommitSchema,
    handler: (o, a) => repo.getCommit(o, a as z.infer<typeof repo.getCommitSchema>),
  },
  compare_commits: {
    description: "Compare two commits, branches, or tags and see the diff.",
    inputSchema: repo.compareCommitsSchema,
    handler: (o, a) => repo.compareCommits(o, a as z.infer<typeof repo.compareCommitsSchema>),
  },
  list_tags: {
    description: "List tags in a repository.",
    inputSchema: repo.listTagsSchema,
    handler: (o, a) => repo.listTags(o, a as z.infer<typeof repo.listTagsSchema>),
  },
  create_tag: {
    description: "Create an annotated tag pointing to a commit.",
    inputSchema: repo.createTagSchema,
    handler: (o, a) => repo.createTag(o, a as z.infer<typeof repo.createTagSchema>),
  },
  list_releases: {
    description: "List releases for a repository.",
    inputSchema: repo.listReleasesSchema,
    handler: (o, a) => repo.listReleases(o, a as z.infer<typeof repo.listReleasesSchema>),
  },
  create_release: {
    description: "Create a new release (optionally auto-generating release notes).",
    inputSchema: repo.createReleaseSchema,
    handler: (o, a) => repo.createRelease(o, a as z.infer<typeof repo.createReleaseSchema>),
  },
  get_repo_topics: {
    description: "Get all topics (tags) for a repository.",
    inputSchema: repo.getRepoTopicsSchema,
    handler: (o, a) => repo.getRepoTopics(o, a as z.infer<typeof repo.getRepoTopicsSchema>),
  },
  replace_repo_topics: {
    description: "Replace all topics for a repository.",
    inputSchema: repo.replaceRepoTopicsSchema,
    handler: (o, a) => repo.replaceRepoTopics(o, a as z.infer<typeof repo.replaceRepoTopicsSchema>),
  },
  list_collaborators: {
    description: "List collaborators for a repository.",
    inputSchema: repo.listCollaboratorsSchema,
    handler: (o, a) => repo.listCollaborators(o, a as z.infer<typeof repo.listCollaboratorsSchema>),
  },

  // ── File / Content operations ─────────────────────────────────────────────
  get_file_contents: {
    description: "Get the contents of a file or directory in a repository.",
    inputSchema: contents.getFileContentsSchema,
    handler: (o, a) => contents.getFileContents(o, a as z.infer<typeof contents.getFileContentsSchema>),
  },
  list_directory: {
    description: "List files and directories at a path in the repository.",
    inputSchema: contents.listDirectorySchema,
    handler: (o, a) => contents.listDirectory(o, a as z.infer<typeof contents.listDirectorySchema>),
  },
  get_raw_file: {
    description: "Get the raw UTF-8 text content of a file (truncated to max_chars). Ideal for reading source files.",
    inputSchema: contents.getRawFileSchema,
    handler: (o, a) => contents.getRawFile(o, a as z.infer<typeof contents.getRawFileSchema>),
  },
  create_or_update_file: {
    description: "Create a new file or update an existing file in a repository. Provide sha to update.",
    inputSchema: contents.createOrUpdateFileSchema,
    handler: (o, a) => contents.createOrUpdateFile(o, a as z.infer<typeof contents.createOrUpdateFileSchema>),
  },
  delete_file: {
    description: "Delete a file from a repository by providing its blob SHA.",
    inputSchema: contents.deleteFileSchema,
    handler: (o, a) => contents.deleteFile(o, a as z.infer<typeof contents.deleteFileSchema>),
  },
  get_tree: {
    description: "Get the Git tree for a commit/branch, optionally recursive (full directory listing with SHAs).",
    inputSchema: contents.getTreeSchema,
    handler: (o, a) => contents.getTree(o, a as z.infer<typeof contents.getTreeSchema>),
  },
  get_blob: {
    description: "Get the content of a Git blob by its SHA.",
    inputSchema: contents.getBlobSchema,
    handler: (o, a) => contents.getBlob(o, a as z.infer<typeof contents.getBlobSchema>),
  },
  push_files: {
    description: "Atomically commit multiple files to a branch in a single commit using the Git Data API.",
    inputSchema: contents.pushFilesSchema,
    handler: (o, a) => contents.pushFiles(o, a as z.infer<typeof contents.pushFilesSchema>),
  },

  // ── Full repo checkout ─────────────────────────────────────────────────────
  checkout_repo: {
    description:
      "Download the FULL content of a repository (all file paths + text content) as a structured JSON. " +
      "Supports filtering by path prefix, file extensions, and max file size. " +
      "This is the primary tool for Claude/Codex to read an entire codebase at once.",
    inputSchema: checkout.checkoutRepoSchema,
    handler: (o, a) => checkout.checkoutRepo(o, a as z.infer<typeof checkout.checkoutRepoSchema>),
  },
  get_repo_archive_url: {
    description: "Get a URL to download the repository as a zip or tarball archive.",
    inputSchema: checkout.getRepoArchiveUrlSchema,
    handler: (o, a) => checkout.getRepoArchiveUrl(o, a as z.infer<typeof checkout.getRepoArchiveUrlSchema>),
  },

  // ── Issues ────────────────────────────────────────────────────────────────
  list_issues: {
    description: "List issues in a repository with filtering by state, label, assignee, milestone.",
    inputSchema: issues.listIssuesSchema,
    handler: (o, a) => issues.listIssues(o, a as z.infer<typeof issues.listIssuesSchema>),
  },
  get_issue: {
    description: "Get full details of a specific issue.",
    inputSchema: issues.getIssueSchema,
    handler: (o, a) => issues.getIssue(o, a as z.infer<typeof issues.getIssueSchema>),
  },
  create_issue: {
    description: "Create a new issue in a repository.",
    inputSchema: issues.createIssueSchema,
    handler: (o, a) => issues.createIssue(o, a as z.infer<typeof issues.createIssueSchema>),
  },
  update_issue: {
    description: "Update an issue: title, body, state (open/close), labels, assignees, milestone.",
    inputSchema: issues.updateIssueSchema,
    handler: (o, a) => issues.updateIssue(o, a as z.infer<typeof issues.updateIssueSchema>),
  },
  add_issue_comment: {
    description: "Add a comment to an issue or pull request.",
    inputSchema: issues.addIssueCommentSchema,
    handler: (o, a) => issues.addIssueComment(o, a as z.infer<typeof issues.addIssueCommentSchema>),
  },
  list_issue_comments: {
    description: "List comments on an issue.",
    inputSchema: issues.listIssueCommentsSchema,
    handler: (o, a) => issues.listIssueComments(o, a as z.infer<typeof issues.listIssueCommentsSchema>),
  },
  update_issue_comment: {
    description: "Update the body of an issue comment.",
    inputSchema: issues.updateIssueCommentSchema,
    handler: (o, a) => issues.updateIssueComment(o, a as z.infer<typeof issues.updateIssueCommentSchema>),
  },
  delete_issue_comment: {
    description: "Delete an issue comment.",
    inputSchema: issues.deleteIssueCommentSchema,
    handler: (o, a) => issues.deleteIssueComment(o, a as z.infer<typeof issues.deleteIssueCommentSchema>),
  },
  list_labels: {
    description: "List all labels for a repository.",
    inputSchema: issues.listLabelsSchema,
    handler: (o, a) => issues.listLabels(o, a as z.infer<typeof issues.listLabelsSchema>),
  },
  create_label: {
    description: "Create a new label in a repository.",
    inputSchema: issues.createLabelSchema,
    handler: (o, a) => issues.createLabel(o, a as z.infer<typeof issues.createLabelSchema>),
  },
  list_milestones: {
    description: "List milestones in a repository.",
    inputSchema: issues.listMilestonesSchema,
    handler: (o, a) => issues.listMilestones(o, a as z.infer<typeof issues.listMilestonesSchema>),
  },
  create_milestone: {
    description: "Create a milestone in a repository.",
    inputSchema: issues.createMilestoneSchema,
    handler: (o, a) => issues.createMilestone(o, a as z.infer<typeof issues.createMilestoneSchema>),
  },

  // ── Pull Requests ─────────────────────────────────────────────────────────
  list_pull_requests: {
    description: "List pull requests in a repository.",
    inputSchema: prs.listPullRequestsSchema,
    handler: (o, a) => prs.listPullRequests(o, a as z.infer<typeof prs.listPullRequestsSchema>),
  },
  get_pull_request: {
    description: "Get full details of a specific pull request.",
    inputSchema: prs.getPullRequestSchema,
    handler: (o, a) => prs.getPullRequest(o, a as z.infer<typeof prs.getPullRequestSchema>),
  },
  create_pull_request: {
    description: "Create a new pull request.",
    inputSchema: prs.createPullRequestSchema,
    handler: (o, a) => prs.createPullRequest(o, a as z.infer<typeof prs.createPullRequestSchema>),
  },
  update_pull_request: {
    description: "Update a pull request: title, body, state, base branch.",
    inputSchema: prs.updatePullRequestSchema,
    handler: (o, a) => prs.updatePullRequest(o, a as z.infer<typeof prs.updatePullRequestSchema>),
  },
  merge_pull_request: {
    description: "Merge a pull request using merge, squash, or rebase strategy.",
    inputSchema: prs.mergePullRequestSchema,
    handler: (o, a) => prs.mergePullRequest(o, a as z.infer<typeof prs.mergePullRequestSchema>),
  },
  list_pr_files: {
    description: "List files changed in a pull request with diffs/patches.",
    inputSchema: prs.listPrFilesSchema,
    handler: (o, a) => prs.listPrFiles(o, a as z.infer<typeof prs.listPrFilesSchema>),
  },
  list_pr_commits: {
    description: "List commits in a pull request.",
    inputSchema: prs.listPrCommitsSchema,
    handler: (o, a) => prs.listPrCommits(o, a as z.infer<typeof prs.listPrCommitsSchema>),
  },
  list_pr_reviews: {
    description: "List reviews on a pull request.",
    inputSchema: prs.listPrReviewsSchema,
    handler: (o, a) => prs.listPrReviews(o, a as z.infer<typeof prs.listPrReviewsSchema>),
  },
  create_pr_review: {
    description: "Submit a review on a pull request (APPROVE, REQUEST_CHANGES, or COMMENT).",
    inputSchema: prs.createPrReviewSchema,
    handler: (o, a) => prs.createPrReview(o, a as z.infer<typeof prs.createPrReviewSchema>),
  },
  list_review_comments: {
    description: "List inline review comments on a pull request.",
    inputSchema: prs.listReviewCommentsSchema,
    handler: (o, a) => prs.listReviewComments(o, a as z.infer<typeof prs.listReviewCommentsSchema>),
  },
  create_review_comment: {
    description: "Create an inline comment on a specific line in a pull request diff.",
    inputSchema: prs.createReviewCommentSchema,
    handler: (o, a) => prs.createReviewComment(o, a as z.infer<typeof prs.createReviewCommentSchema>),
  },
  request_reviewers: {
    description: "Request reviews from specific users or teams on a pull request.",
    inputSchema: prs.requestReviewersSchema,
    handler: (o, a) => prs.requestReviewers(o, a as z.infer<typeof prs.requestReviewersSchema>),
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  search_repositories: {
    description: "Search GitHub repositories using GitHub's search syntax.",
    inputSchema: search.searchRepositoriesSchema,
    handler: (o, a) => search.searchRepositories(o, a as z.infer<typeof search.searchRepositoriesSchema>),
  },
  search_code: {
    description: "Search for code across GitHub repositories.",
    inputSchema: search.searchCodeSchema,
    handler: (o, a) => search.searchCode(o, a as z.infer<typeof search.searchCodeSchema>),
  },
  search_issues: {
    description: "Search GitHub issues and pull requests.",
    inputSchema: search.searchIssuesSchema,
    handler: (o, a) => search.searchIssues(o, a as z.infer<typeof search.searchIssuesSchema>),
  },
  search_commits: {
    description: "Search commits across GitHub.",
    inputSchema: search.searchCommitsSchema,
    handler: (o, a) => search.searchCommits(o, a as z.infer<typeof search.searchCommitsSchema>),
  },
  search_users: {
    description: "Search GitHub users and organizations.",
    inputSchema: search.searchUsersSchema,
    handler: (o, a) => search.searchUsers(o, a as z.infer<typeof search.searchUsersSchema>),
  },

  // ── GitHub Actions ─────────────────────────────────────────────────────────
  list_workflows: {
    description: "List GitHub Actions workflows in a repository.",
    inputSchema: actions.listWorkflowsSchema,
    handler: (o, a) => actions.listWorkflows(o, a as z.infer<typeof actions.listWorkflowsSchema>),
  },
  list_workflow_runs: {
    description: "List workflow runs for a repository or a specific workflow.",
    inputSchema: actions.listWorkflowRunsSchema,
    handler: (o, a) => actions.listWorkflowRuns(o, a as z.infer<typeof actions.listWorkflowRunsSchema>),
  },
  get_workflow_run: {
    description: "Get details of a specific workflow run.",
    inputSchema: actions.getWorkflowRunSchema,
    handler: (o, a) => actions.getWorkflowRun(o, a as z.infer<typeof actions.getWorkflowRunSchema>),
  },
  trigger_workflow: {
    description: "Trigger a workflow_dispatch event to manually run a workflow.",
    inputSchema: actions.triggerWorkflowSchema,
    handler: (o, a) => actions.triggerWorkflow(o, a as z.infer<typeof actions.triggerWorkflowSchema>),
  },
  cancel_workflow_run: {
    description: "Cancel a workflow run that is in progress.",
    inputSchema: actions.cancelWorkflowRunSchema,
    handler: (o, a) => actions.cancelWorkflowRun(o, a as z.infer<typeof actions.cancelWorkflowRunSchema>),
  },
  rerun_workflow: {
    description: "Re-run a workflow run (optionally with debug logging).",
    inputSchema: actions.rerunWorkflowSchema,
    handler: (o, a) => actions.rerunWorkflow(o, a as z.infer<typeof actions.rerunWorkflowSchema>),
  },
  list_workflow_run_jobs: {
    description: "List jobs for a workflow run with per-step status.",
    inputSchema: actions.listWorkflowRunJobsSchema,
    handler: (o, a) => actions.listWorkflowRunJobs(o, a as z.infer<typeof actions.listWorkflowRunJobsSchema>),
  },
  get_workflow_run_logs: {
    description: "Get a download URL for the logs of a workflow run.",
    inputSchema: actions.getWorkflowRunLogsSchema,
    handler: (o, a) => actions.getWorkflowRunLogs(o, a as z.infer<typeof actions.getWorkflowRunLogsSchema>),
  },
  list_artifacts: {
    description: "List GitHub Actions artifacts for a repository or a specific workflow run.",
    inputSchema: actions.listArtifactsSchema,
    handler: (o, a) => actions.listArtifacts(o, a as z.infer<typeof actions.listArtifactsSchema>),
  },
  list_repo_secrets: {
    description: "List Actions secrets for a repository (names only, not values).",
    inputSchema: actions.listRepoSecretsSchema,
    handler: (o, a) => actions.listRepoSecrets(o, a as z.infer<typeof actions.listRepoSecretsSchema>),
  },

  // ── Users / Orgs ───────────────────────────────────────────────────────────
  get_authenticated_user: {
    description: "Get the profile of the authenticated user.",
    inputSchema: users.getAuthenticatedUserSchema,
    handler: (o, a) => users.getAuthenticatedUser(o, a as z.infer<typeof users.getAuthenticatedUserSchema>),
  },
  get_user: {
    description: "Get public profile information for a GitHub user.",
    inputSchema: users.getUserSchema,
    handler: (o, a) => users.getUser(o, a as z.infer<typeof users.getUserSchema>),
  },
  list_user_orgs: {
    description: "List organizations for a user or the authenticated user.",
    inputSchema: users.listUserOrgsSchema,
    handler: (o, a) => users.listUserOrgs(o, a as z.infer<typeof users.listUserOrgsSchema>),
  },
  get_org: {
    description: "Get information about a GitHub organization.",
    inputSchema: users.getOrgSchema,
    handler: (o, a) => users.getOrg(o, a as z.infer<typeof users.getOrgSchema>),
  },
  list_org_members: {
    description: "List members of a GitHub organization.",
    inputSchema: users.listOrgMembersSchema,
    handler: (o, a) => users.listOrgMembers(o, a as z.infer<typeof users.listOrgMembersSchema>),
  },
  list_followers: {
    description: "List followers of a user or the authenticated user.",
    inputSchema: users.listFollowersSchema,
    handler: (o, a) => users.listFollowers(o, a as z.infer<typeof users.listFollowersSchema>),
  },

  // ── Gists ──────────────────────────────────────────────────────────────────
  list_gists: {
    description: "List gists for a user or the authenticated user.",
    inputSchema: gists.listGistsSchema,
    handler: (o, a) => gists.listGists(o, a as z.infer<typeof gists.listGistsSchema>),
  },
  get_gist: {
    description: "Get a specific gist by ID.",
    inputSchema: gists.getGistSchema,
    handler: (o, a) => gists.getGist(o, a as z.infer<typeof gists.getGistSchema>),
  },
  create_gist: {
    description: "Create a new gist.",
    inputSchema: gists.createGistSchema,
    handler: (o, a) => gists.createGist(o, a as z.infer<typeof gists.createGistSchema>),
  },
  update_gist: {
    description: "Update a gist's files or description.",
    inputSchema: gists.updateGistSchema,
    handler: (o, a) => gists.updateGist(o, a as z.infer<typeof gists.updateGistSchema>),
  },
  delete_gist: {
    description: "Delete a gist.",
    inputSchema: gists.deleteGistSchema,
    handler: (o, a) => gists.deleteGist(o, a as z.infer<typeof gists.deleteGistSchema>),
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  list_notifications: {
    description: "List GitHub notifications for the authenticated user.",
    inputSchema: notifications.listNotificationsSchema,
    handler: (o, a) => notifications.listNotifications(o, a as z.infer<typeof notifications.listNotificationsSchema>),
  },
  mark_notifications_read: {
    description: "Mark all notifications as read.",
    inputSchema: notifications.markNotificationsReadSchema,
    handler: (o, a) => notifications.markNotificationsRead(o, a as z.infer<typeof notifications.markNotificationsReadSchema>),
  },
  get_thread: {
    description: "Get a notification thread by ID.",
    inputSchema: notifications.getThreadSchema,
    handler: (o, a) => notifications.getThread(o, a as z.infer<typeof notifications.getThreadSchema>),
  },
  mark_thread_read: {
    description: "Mark a notification thread as read.",
    inputSchema: notifications.markThreadReadSchema,
    handler: (o, a) => notifications.markThreadRead(o, a as z.infer<typeof notifications.markThreadReadSchema>),
  },

  // ── Low-level Git Data API ─────────────────────────────────────────────────
  get_ref: {
    description: "Get a Git ref (branch or tag pointer) by name.",
    inputSchema: git.getRefSchema,
    handler: (o, a) => git.getRef(o, a as z.infer<typeof git.getRefSchema>),
  },
  list_matching_refs: {
    description: "List Git refs matching a prefix (e.g. 'heads/' for all branches).",
    inputSchema: git.listMatchingRefsSchema,
    handler: (o, a) => git.listMatchingRefs(o, a as z.infer<typeof git.listMatchingRefsSchema>),
  },
  update_ref: {
    description: "Update a Git ref to point to a different commit SHA.",
    inputSchema: git.updateRefSchema,
    handler: (o, a) => git.updateRef(o, a as z.infer<typeof git.updateRefSchema>),
  },
  create_commit: {
    description: "Create a Git commit object (low-level). Use push_files for a higher-level approach.",
    inputSchema: git.createCommitSchema,
    handler: (o, a) => git.createCommit(o, a as z.infer<typeof git.createCommitSchema>),
  },
  create_tree: {
    description: "Create a Git tree object from a list of tree items (low-level).",
    inputSchema: git.createTreeSchema,
    handler: (o, a) => git.createTree(o, a as z.infer<typeof git.createTreeSchema>),
  },
  create_blob: {
    description: "Create a Git blob from text or base64-encoded content (low-level).",
    inputSchema: git.createBlobSchema,
    handler: (o, a) => git.createBlob(o, a as z.infer<typeof git.createBlobSchema>),
  },
  get_diff: {
    description: "Get the diff between two refs (branches, tags, or commit SHAs).",
    inputSchema: git.getDiffSchema,
    handler: (o, a) => git.getDiff(o, a as z.infer<typeof git.getDiffSchema>),
  },
};


