/**
 * getPrompt.ts — Build the full agent prompt for a given function
 *
 * Reads the prompt template, injects per-function context (assembly,
 * m2c output, call graph entry), and prints the result to stdout.
 *
 * Usage:
 *   npx tsx tools/getPrompt.ts func_80011F08
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname;

const TEMPLATE = join(ROOT, "prompts/decompilation-cleanup-agent.md");
const CALL_GRAPH = join(ROOT, "build/callGraph.json");

interface CallGraphEntry {
  name: string;
  vram: string;
  size: number;
  tier: number;
  priority: number;
  callerCount: number;
  calls: string[];
  calledBy: string[];
  sdkCalls: string[];
  instructionCount: number;
  decompiled: boolean;
  handwritten: false | "asm" | "gte";
}

function resolveAsmFile(funcName: string): string | null {
  const asmDir = join(ROOT, "build/asm/nonmatchings", funcName);
  const expected = join(asmDir, `${funcName}.s`);
  if (existsSync(expected)) return expected;
  if (existsSync(asmDir)) {
    const files = readdirSync(asmDir).filter((f) => f.endsWith(".s"));
    if (files.length === 1) return join(asmDir, files[0]);
  }
  return null;
}

export function getDecompilationCleanupAgentPrompt(funcName: string): string {
  const template = readFileSync(TEMPLATE, "utf-8");
  const srcFile = join(ROOT, "src", `${funcName}.c`);

  /* Assembly */
  const sFile = resolveAsmFile(funcName);
  const assembly = sFile && existsSync(sFile)
    ? readFileSync(sFile, "utf-8").trim()
    : "(assembly file not found)";

  /* m2c output */
  const m2cOutput = existsSync(srcFile)
    ? readFileSync(srcFile, "utf-8").trim()
    : "(m2c output not found — run m2cFunc.ts --write first)";

  /* Call graph entry */
  let callGraphEntry = "(callGraph.json not found — run callGraph.ts first)";
  if (existsSync(CALL_GRAPH)) {
    const graph = JSON.parse(readFileSync(CALL_GRAPH, "utf-8"));
    const entry = graph.functions.find((f: CallGraphEntry) => f.name === funcName);
    callGraphEntry = entry
      ? JSON.stringify(entry, null, 2)
      : "(function not found in callGraph.json)";
  }

  /* Build context block */
  const context = `## Context for this run

FUNC_NAME = \`${funcName}\`

### Original assembly

\`\`\`asm
${assembly}
\`\`\`

### Current m2c output (in src/${funcName}.c)

\`\`\`c
${m2cOutput}
\`\`\`

### Call graph entry

\`\`\`json
${callGraphEntry}
\`\`\``;

  return template.replace("{{CONTEXT}}", context);
}

/* --- CLI --- */

if (process.argv[1]?.includes("getPrompt")) {
  const funcName = process.argv[2];
  if (!funcName) {
    console.error("Usage: npx tsx tools/getPrompt.ts <func_name>");
    process.exit(1);
  }
  process.stdout.write(getDecompilationCleanupAgentPrompt(funcName));
}
