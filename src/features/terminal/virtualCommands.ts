import { wasmContainer } from "../../lib/wasm";
import type { ProcessResult, WasmCommandOptions } from "../../lib/wasm";

export async function runVirtualCommand(command: string, options: WasmCommandOptions = {}): Promise<string> {
  const result = await wasmContainer.execute(command, options);
  if (result.exitCode !== 0) throw new Error(result.stderr || `${command}: exited with code ${result.exitCode}`);
  return result.stdout;
}

export async function executeCommandStream(command: string, options: WasmCommandOptions = {}): Promise<ProcessResult> {
  return wasmContainer.execute(command, options);
}
