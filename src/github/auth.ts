import { Octokit } from "@octokit/rest";

/**
 * Create an authenticated Octokit instance.
 * Uses GITHUB_TOKEN environment variable.
 */
export function createOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN environment variable is required for GitHub operations. " +
      "Set it via: export GITHUB_TOKEN=ghp_your_token"
    );
  }

  return new Octokit({ auth: token });
}

/**
 * Parse an "owner/repo" string into its parts.
 */
export function parseRepo(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid repository format: "${repo}". Expected "owner/repo".`
    );
  }
  return { owner: parts[0], repo: parts[1] };
}
