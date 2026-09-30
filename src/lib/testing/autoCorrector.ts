import { runAgentTurn, type AgentTurnResult } from "../agent/agentRunner";
import type { AgentStateDocument, ModelState, ProviderConfig, ProviderId } from "../agent/types";
import { runVirtualTests, type TestRunResult } from "./testRunner";

export interface AutoCorrectionResult { agent: AgentTurnResult; tests: TestRunResult; iterations: number; }
export interface AutoCorrectionOptions { onStateChange?: (state: ModelState) => void; onToolOperation?: () => Promise<void> | void; onTestResult?: (result: TestRunResult) => void; }

export async function runWithAutoCorrection(task: string, providers: ProviderConfig[], activeProviderId: ProviderId, agentState: AgentStateDocument, options: AutoCorrectionOptions = {}): Promise<AutoCorrectionResult> {
  let prompt = task;
  let agent: AgentTurnResult | undefined;
  let tests = await runVirtualTests();
  options.onTestResult?.(tests);
  for (let iteration = 0; iteration <= 3; iteration += 1) {
    agent = await runAgentTurn(prompt, providers, activeProviderId, agentState, options.onStateChange, { onToolOperation: async () => { const result = await runVirtualTests(); options.onTestResult?.(result); await options.onToolOperation?.(); } });
    tests = await runVirtualTests();
    options.onTestResult?.(tests);
    if (tests.passed || iteration === 3) return { agent, tests, iterations: iteration, };
    prompt = `Self-correction iteration ${iteration + 1}/3. The previous task was: ${task}\nVerification failed:\n${tests.logs.join("\n")}\nInspect the affected files, correct the failures using workspace tools, and verify again.`;
  }
  throw new Error("Auto-correction stopped without a result.");
}
