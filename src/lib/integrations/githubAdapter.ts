import { listFiles, readFile } from "../storage";
import { tokenVault } from "./tokenVault";

const REST = "https://api.github.com";
const GRAPHQL = "https://api.github.com/graphql";
export interface GitHubFileChange { path: string; content: string; }
export interface GitHubCommitResult { sha: string; url: string; }
export interface GitHubPullRequest { number: number; url: string; title: string; }
export interface GitHubIssue { number: number; url: string; title: string; state: string; }

export class GitHubAdapter {
  async cloneRepository(owner: string, repo: string, branch = "main"): Promise<GitHubFileChange[]> { const tree = await this.rest<{ tree: Array<{ path: string; type: string; sha: string }> }>(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`); const files: GitHubFileChange[] = []; for (const item of tree.tree.filter((entry) => entry.type === "blob")) { const blob = await this.rest<{ content: string; encoding: string }>(`/repos/${owner}/${repo}/git/blobs/${item.sha}`); files.push({ path: item.path, content: blob.encoding === "base64" ? decodeBase64(blob.content) : blob.content }); } return files; }

  async commitVfs(owner: string, repo: string, branch: string, message: string): Promise<GitHubCommitResult> { const files = await listFiles(); if (!files.length) throw new Error("Cannot commit an empty VFS."); const head = await this.rest<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`); const baseCommit = await this.rest<{ tree: { sha: string } }>(`/repos/${owner}/${repo}/git/commits/${head.object.sha}`); const tree = await this.rest<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, "POST", { base_tree: baseCommit.tree.sha, tree: files.map((file) => ({ path: file.path, mode: "100644", type: "blob", content: file.content })) }); const commit = await this.rest<{ sha: string; html_url: string }>(`/repos/${owner}/${repo}/git/commits`, "POST", { message, tree: tree.sha, parents: [head.object.sha] }); await this.rest(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, "PATCH", { sha: commit.sha, force: false }); return { sha: commit.sha, url: commit.html_url }; }

  async createBranch(owner: string, repo: string, branch: string, fromBranch = "main"): Promise<void> { const ref = await this.rest<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`); await this.rest(`/repos/${owner}/${repo}/git/refs`, "POST", { ref: `refs/heads/${branch}`, sha: ref.object.sha }); }
  async openPullRequest(owner: string, repo: string, head: string, base: string, title: string, body: string): Promise<GitHubPullRequest> { return this.rest<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls`, "POST", { title, body, head, base }); }
  async listIssues(owner: string, repo: string, state = "open"): Promise<GitHubIssue[]> { return this.rest<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?state=${encodeURIComponent(state)}`); }
  async createIssue(owner: string, repo: string, title: string, body = ""): Promise<GitHubIssue> { return this.rest<GitHubIssue>(`/repos/${owner}/${repo}/issues`, "POST", { title, body }); }
  async graphql<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> { const response = await this.request(GRAPHQL, "POST", { query, variables }); return response.data as T; }

  private async rest<T = unknown>(path: string, method: string = "GET", body?: unknown): Promise<T> { return this.request(`${REST}${path}`, method, body) as Promise<T>; }
  private async request(url: string, method: string, body?: unknown): Promise<any> { const token = await tokenVault.read("github"); if (!token) throw new Error("GitHub token is not configured in the local Integration Vault."); const response = await fetch(url, { method, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`); return response.json(); }
}

function decodeBase64(value: string): string { const binary = atob(value.replace(/\s/g, "")); return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))); }
export const githubAdapter = new GitHubAdapter();
