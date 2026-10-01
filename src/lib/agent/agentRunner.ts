import { createFile, listFiles, readFile, updateFile } from "../storage";
import { callWithFailover } from "./failoverHandler";
import { executeWorkspaceTool, workspaceTools } from "./workspaceTools";
import type { AgentStateDocument, ModelMessage, ModelState, ProviderConfig, ProviderId, SessionHistoryEntry } from "./types";

export interface AgentTurnResult { text: string; modelState: ModelState; history: SessionHistoryEntry[]; toolCalls: number; }
export interface AgentTurnOptions { onToolOperation?: (call: import("./types").ToolCall) => Promise<void> | void; }

export async function runAgentTurn(task: string, providers: ProviderConfig[], activeProviderId: ProviderId, agentState: AgentStateDocument, onStateChange?: (state: ModelState) => void, options: AgentTurnOptions = {}): Promise<AgentTurnResult> {
  const history: SessionHistoryEntry[] = [{ id: crypto.randomUUID(), role: "user", content: task, createdAt: Date.now() }];
  const messages: ModelMessage[] = [{ role: "system", content: "You are the workspace agent. Use the provided tools to inspect and modify the device-local project. You may write files, execute POSIX commands, or execute_code with node or python3 inside the Wasm sandbox. Ecosystem tools can read GitHub/Google context; GitHub branch/commit/PR and Google Drive export operations are external mutations and require explicit confirm: true. Never invent confirmation. Make the requested change, verify it with tools when useful, then summarize the completed work." }, { role: "user", content: `${task}\n\nCurrent agent ledger:\n${JSON.stringify(agentState)}` }];
  let toolCalls = 0;
  let result = await callWithFailover(providers, messages, activeProviderId, onStateChange, workspaceTools);
  for (let round = 0; round < 5 && result.response.toolCalls?.length; round += 1) {
    const calls = result.response.toolCalls;
    toolCalls += calls.length;
    for (const call of calls) {
      try {
        const output = await executeWorkspaceTool(call);
        messages.push({ role: "tool", name: call.name, toolCallId: call.id, content: output });
        history.push({ id: crypto.randomUUID(), role: "system", content: `${call.name}: ${output}`, createdAt: Date.now() });
        await options.onToolOperation?.(call);
      } catch (error: unknown) {
        const output = error instanceof Error ? `Tool error: ${error.message}` : "Tool error: operation failed";
        messages.push({ role: "tool", name: call.name, toolCallId: call.id, content: output });
        history.push({ id: crypto.randomUUID(), role: "system", content: output, createdAt: Date.now() });
        await options.onToolOperation?.(call);
      }
    }
    result = await callWithFailover(providers, messages, result.state.providerId, onStateChange, workspaceTools);
  }
  const text = result.response.text || "The agent completed its tool work.";
  history.push({ id: crypto.randomUUID(), role: "assistant", content: text, createdAt: Date.now() });
  await recordCompletedTurn(agentState, history, result.state.providerId);
  return { text, modelState: result.state, history, toolCalls };
}

async function recordCompletedTurn(agentState: AgentStateDocument, history: SessionHistoryEntry[], providerId: ProviderId): Promise<void> {
  const state: AgentStateDocument = { ...agentState, last_updated: new Date().toISOString(), session_history: history, last_agent_turn: { provider: providerId, completedAt: new Date().toISOString(), summary: history.at(-1)?.content ?? "", toolCalls: history.filter((entry) => entry.role === "system").length } };
  const serialized = JSON.stringify(state, null, 2);
  const existing = await readFile(".agent_state.json");
  if (existing) await updateFile(".agent_state.json", serialized); else await createFile(".agent_state.json", serialized);
}
