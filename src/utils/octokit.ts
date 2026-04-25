import { Octokit } from "@octokit/rest";
import { logger } from "./logger.js";

export function createOctokit(token: string, baseUrl?: string): Octokit {
  return new Octokit({
    auth: token || undefined,
    baseUrl: baseUrl || "https://api.github.com",
    log: {
      debug: (msg: string) => logger.debug(`[octokit] ${msg}`),
      info: (msg: string) => logger.debug(`[octokit] ${msg}`),
      warn: (msg: string) => logger.warn(`[octokit] ${msg}`),
      error: (msg: string) => logger.error(`[octokit] ${msg}`),
    },
    throttle: undefined,
    retry: {
      doNotRetry: ["429"],
    },
  } as ConstructorParameters<typeof Octokit>[0]);
}

/**
 * Wraps an octokit call and produces a normalized error message.
 */
export async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    const er = e as { status?: number; message?: string };
    const status = er.status ?? 0;
    const msg = er.message ?? String(e);
    throw new Error(`GitHub API error (HTTP ${status}): ${msg}`);
  }
}
