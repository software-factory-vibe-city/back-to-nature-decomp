import { runCommand } from "../autonomous/process.ts";
import type { CSourceReport } from "../../../../tools/agent/cSourceGuard.ts";

export type { CSourceReport };

/**
 * The loop's view of a C translation unit, taken from the AST.
 *
 * It shells out to `tools/agent/cSourceGuard.ts` rather than importing it: the
 * grammar is a pinned wasm module loaded with top-level await, and the project's
 * tools all run through `npx tsx`. Keeping the parser in a child process means
 * the extension loads without it and a grammar-pin failure degrades to
 * "unavailable" instead of taking the session down.
 */
export interface SourceFacts extends CSourceReport {
  /** False when the parser could not be reached at all. */
  available: boolean;
}

const UNAVAILABLE = (reason: string): SourceFacts => ({
  available: false,
  parses: false,
  embeddable: false,
  reasons: [reason],
  includeAsm: [],
});

export async function inspectSource(projectRoot: string, path: string): Promise<SourceFacts> {
  const result = await runCommand("npx", ["tsx", "tools/agent/cSourceGuard.ts", path], {
    cwd: projectRoot,
    timeoutMs: 120_000,
  });
  /* Exit 1 is a defective translation unit with a full report; only a crash or
     a missing grammar leaves nothing to read. */
  if (result.code !== 0 && result.code !== 1) {
    return UNAVAILABLE(`cSourceGuard exited ${result.code}: ${(result.stderr || result.stdout).trim().split("\n").at(-1) ?? ""}`);
  }
  try {
    return { available: true, ...(JSON.parse(result.stdout) as CSourceReport) };
  } catch {
    return UNAVAILABLE("cSourceGuard produced no readable report");
  }
}

export function declaresIncludeAsm(facts: SourceFacts, functionName: string): boolean {
  return facts.available && facts.includeAsm.some((site) => site.symbol === functionName);
}
