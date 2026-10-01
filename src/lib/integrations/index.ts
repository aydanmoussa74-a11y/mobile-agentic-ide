export { tokenVault, TokenVault } from "./tokenVault";
export type { IntegrationId } from "./tokenVault";
export { githubAdapter, GitHubAdapter } from "./githubAdapter";
export type { GitHubCommitResult, GitHubFileChange, GitHubPullRequest, GitHubIssue } from "./githubAdapter";
export { googleAdapter, GoogleAdapter } from "./googleAdapter";
export type { GoogleDocumentContext, GoogleDriveExport } from "./googleAdapter";
export { genericHttpAdapter, GenericHttpAdapter } from "./genericHttpAdapter";
export type { HttpRequest, HttpResponse } from "./genericHttpAdapter";
export { getIntegration, invokeIntegration, listIntegrations, registerIntegration, unregisterIntegration } from "./registry";
export type { IntegrationProvider } from "./registry";

import { githubAdapter } from "./githubAdapter";
import { googleAdapter } from "./googleAdapter";
import { genericHttpAdapter } from "./genericHttpAdapter";
import { registerIntegration } from "./registry";

registerIntegration({ id: "github", label: "GitHub", capabilities: ["repositories", "issues", "commits", "pull_requests", "graphql"], invoke: (operation, input) => { if (operation === "listIssues") return githubAdapter.listIssues(String(input.owner), String(input.repo), String(input.state ?? "open")); if (operation === "createIssue") return githubAdapter.createIssue(String(input.owner), String(input.repo), String(input.title), String(input.body ?? "")); throw new Error(`Unsupported GitHub registry operation: ${operation}`); } });
registerIntegration({ id: "google", label: "Google Workspace", capabilities: ["docs_read", "docs_write", "drive_export"], invoke: (operation, input) => { if (operation === "readDocument") return googleAdapter.readDocument(String(input.documentId)); if (operation === "writeDocument") return googleAdapter.writeDocument(String(input.documentId), String(input.text)); if (operation === "exportVfs") return googleAdapter.exportVfsToDrive(String(input.name)); throw new Error(`Unsupported Google registry operation: ${operation}`); } });
registerIntegration({ id: "generic-http", label: "Generic REST / Webhook", capabilities: ["rest", "webhooks"], invoke: (operation, input) => operation === "webhook" ? genericHttpAdapter.webhook(String(input.providerId), String(input.url), input.payload, input.headers as Record<string, string> | undefined) : genericHttpAdapter.request({ providerId: String(input.providerId), url: String(input.url), method: typeof input.method === "string" ? input.method : undefined, headers: input.headers as Record<string, string> | undefined, body: input.body }) });
