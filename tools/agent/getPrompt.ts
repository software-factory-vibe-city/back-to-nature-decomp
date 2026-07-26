/**
 * getPrompt.ts — Legacy standalone prompt builder
 *
 * The active Pi commands and autonomous workers dispatch `.pi/skills/`
 * directly and do not call this module. It is retained for manual use and
 * historical reproducibility. It reads archived templates, injects context,
 * and prints the result to stdout.
 *
 * Usage:
 *   npx tsx tools/agent/getPrompt.ts func_80011F08
 *   npx tsx tools/agent/getPrompt.ts --refine func_80011F08
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = new URL("../..", import.meta.url).pathname;

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

function resolveAsmFile(funcName: string, rootDir: string = ROOT): string | null {
  const asmDir = join(rootDir, "build/asm/nonmatchings", funcName);
  const expected = join(asmDir, `${funcName}.s`);
  if (existsSync(expected)) return expected;
  if (existsSync(asmDir)) {
    const files = readdirSync(asmDir).filter((f) => f.endsWith(".s"));
    if (files.length === 1) return join(asmDir, files[0]);
  }
  return null;
}

function injectShared(template: string, rootDir: string = ROOT): string {
  const guide = readFileSync(join(rootDir, "prompts/c-style-guide.md"), "utf-8");
  const profilePath = join(rootDir, "configs/project-profile.md");
  const profile = existsSync(profilePath)
    ? readFileSync(profilePath, "utf-8")
    : "(no configs/project-profile.md found — toolchain specifics unknown; ask before assuming compiler version or flags)";
  return template
    .replace("{{C_STYLE_GUIDE}}", guide)
    .replace(/\{\{PROJECT_PROFILE\}\}/g, profile);
}

export function getDecompilationCleanupAgentPrompt(funcName: string, rootDir: string = ROOT): string {
  const template = injectShared(readFileSync(join(rootDir, "prompts/legacy/decompilation-cleanup-agent.md"), "utf-8"), rootDir);
  const srcFile = join(rootDir, "src", `${funcName}.c`);

  /* Assembly */
  const sFile = resolveAsmFile(funcName, rootDir);
  const assembly = sFile && existsSync(sFile)
    ? readFileSync(sFile, "utf-8").trim()
    : "(assembly file not found)";

  /* m2c output */
  const m2cOutput = existsSync(srcFile)
    ? readFileSync(srcFile, "utf-8").trim()
    : "(m2c output not found — run m2cFunc.ts --write first)";

  /* Call graph entry */
  const callGraphPath = join(rootDir, "build/callGraph.json");
  let callGraphEntry = "(callGraph.json not found — run callGraph.ts first)";
  if (existsSync(callGraphPath)) {
    const graph = JSON.parse(readFileSync(callGraphPath, "utf-8"));
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

/**
 * Build the global refinement agent prompt for a given function.
 *
 * Injects the target function's source, decompiled neighbor sources,
 * call graph entry, and current functions.h signatures.
 */
export function getGlobalRefinementAgentPrompt(funcName: string, rootDir: string = ROOT): string {
  const template = injectShared(readFileSync(join(rootDir, "prompts/legacy/global-refinement-agent.md"), "utf-8"), rootDir);

  const callGraphPath = join(rootDir, "build/callGraph.json");
  if (!existsSync(callGraphPath)) {
    throw new Error("callGraph.json not found — run callGraph.ts first");
  }

  const graph = JSON.parse(readFileSync(callGraphPath, "utf-8"));
  const entry = graph.functions.find((f: CallGraphEntry) => f.name === funcName);
  if (!entry) {
    throw new Error(`Function ${funcName} not found in callGraph.json`);
  }

  /* Target function source */
  const srcFile = join(rootDir, "src", `${funcName}.c`);
  const targetSource = existsSync(srcFile)
    ? readFileSync(srcFile, "utf-8").trim()
    : "(source not found)";

  /* Collect decompiled neighbor sources */
  const neighborNames = new Set<string>();
  for (const n of [...entry.calls, ...entry.calledBy]) {
    neighborNames.add(n);
  }

  const neighborSections: string[] = [];
  for (const n of neighborNames) {
    const nSrc = join(rootDir, "src", `${n}.c`);
    if (!existsSync(nSrc)) continue;
    const content = readFileSync(nSrc, "utf-8").trim();
    /* Skip stubs — they have no useful context */
    if (content.includes("INCLUDE_ASM(")) continue;
    const nEntry = graph.functions.find((f: CallGraphEntry) => f.name === n);
    const relationship = entry.calls.includes(n) ? "callee" : "caller";
    neighborSections.push(
      `#### ${n} (${relationship}${nEntry?.decompiled ? ", decompiled" : ""})\n\n\`\`\`c\n${content}\n\`\`\``
    );
  }

  /* functions.h */
  const functionsH = join(rootDir, "include/functions.h");
  const signatures = existsSync(functionsH)
    ? readFileSync(functionsH, "utf-8").trim()
    : "(include/functions.h not found)";

  /* Original assembly (useful for verifying type changes) */
  const sFile = resolveAsmFile(funcName, rootDir);
  const assembly = sFile && existsSync(sFile)
    ? readFileSync(sFile, "utf-8").trim()
    : "(assembly file not found)";

  const context = `## Context for this run

FUNC_NAME = \`${funcName}\`

### Current source (src/${funcName}.c)

\`\`\`c
${targetSource}
\`\`\`

### Original assembly

\`\`\`asm
${assembly}
\`\`\`

### Call graph entry

\`\`\`json
${JSON.stringify(entry, null, 2)}
\`\`\`

### Decompiled neighbors

${neighborSections.length > 0 ? neighborSections.join("\n\n") : "(no decompiled neighbors found)"}

### Current function signatures (include/functions.h)

\`\`\`c
${signatures}
\`\`\``;

  return template.replace("{{CONTEXT}}", context);
}

/**
 * Find decompiled functions that have at least one decompiled neighbor.
 * Returns them sorted by number of decompiled neighbors (most context first).
 */
export function findRefinementCandidates(rootDir: string = ROOT): Array<{ name: string; decompiledNeighborCount: number; neighbors: string[] }> {
  const graphPath = join(rootDir, "build/callGraph.json");
  if (!existsSync(graphPath)) return [];

  const graph = JSON.parse(readFileSync(graphPath, "utf-8"));
  const decompiledSet = new Set<string>(
    graph.functions.filter((f: CallGraphEntry) => f.decompiled).map((f: CallGraphEntry) => f.name)
  );

  const candidates: Array<{ name: string; decompiledNeighborCount: number; neighbors: string[] }> = [];

  for (const entry of graph.functions) {
    if (!entry.decompiled) continue;

    const allNeighbors = [...new Set([...entry.calls, ...entry.calledBy])];
    const decompiledNeighbors = allNeighbors.filter((n: string) => decompiledSet.has(n) && n !== entry.name);

    if (decompiledNeighbors.length > 0) {
      candidates.push({
        name: entry.name,
        decompiledNeighborCount: decompiledNeighbors.length,
        neighbors: decompiledNeighbors,
      });
    }
  }

  candidates.sort((a, b) => b.decompiledNeighborCount - a.decompiledNeighborCount);
  return candidates;
}

/**
 * Build the project-wide refinement agent prompt.
 *
 * Injects a summary of all decompiled files, the call graph stats,
 * global usage patterns, and current shared type definitions.
 */
export function getProjectRefinementAgentPrompt(rootDir: string = ROOT): string {
  const template = injectShared(readFileSync(join(rootDir, "prompts/legacy/project-refinement-agent.md"), "utf-8"), rootDir);

  const srcDir = join(rootDir, "src");
  const allSrcFiles = existsSync(srcDir)
    ? readdirSync(srcDir).filter((f) => f.endsWith(".c"))
    : [];

  /* Collect decompiled files (non-stubs) */
  const decompiledFiles: Array<{ name: string; source: string }> = [];
  for (const file of allSrcFiles) {
    const content = readFileSync(join(srcDir, file), "utf-8");
    if (!content.includes("INCLUDE_ASM(")) {
      decompiledFiles.push({ name: file.replace(/\.c$/, ""), source: content.trim() });
    }
  }

  /* Call graph stats */
  const callGraphPath = join(rootDir, "build/callGraph.json");
  let graphStats = "(callGraph.json not found)";
  if (existsSync(callGraphPath)) {
    const graph = JSON.parse(readFileSync(callGraphPath, "utf-8"));
    graphStats = JSON.stringify(graph.stats, null, 2);
  }

  /* functions.h */
  const functionsH = join(rootDir, "include/functions.h");
  const signatures = existsSync(functionsH)
    ? readFileSync(functionsH, "utf-8").trim()
    : "(not yet created)";

  /* game_types.h */
  const gameTypesH = join(rootDir, "include/game_types.h");
  const gameTypes = existsSync(gameTypesH)
    ? readFileSync(gameTypesH, "utf-8").trim()
    : "(not yet created)";

  /* Build file listing with sources */
  const fileSections = decompiledFiles
    .map((f) => `### ${f.name}\n\n\`\`\`c\n${f.source}\n\`\`\``)
    .join("\n\n");

  const context = `## Project state

### Call graph stats

\`\`\`json
${graphStats}
\`\`\`

### Decompiled functions (${decompiledFiles.length} files)

${fileSections}

### Current function signatures (include/functions.h)

\`\`\`c
${signatures}
\`\`\`

### Current shared types (include/game_types.h)

\`\`\`c
${gameTypes}
\`\`\``;

  return template.replace("{{CONTEXT}}", context);
}

/* --- CLI --- */

if (process.argv[1]?.includes("getPrompt")) {
  const args = process.argv.slice(2);
  const isRefine = args.includes("--refine");
  const isProject = args.includes("--project");
  const funcName = args.find((a) => !a.startsWith("--"));

  if (isProject) {
    process.stdout.write(getProjectRefinementAgentPrompt());
  } else if (!funcName) {
    console.error("Usage: npx tsx tools/agent/getPrompt.ts <func_name>");
    console.error("       npx tsx tools/agent/getPrompt.ts --refine <func_name>");
    console.error("       npx tsx tools/agent/getPrompt.ts --project");
    process.exit(1);
  } else if (isRefine) {
    process.stdout.write(getGlobalRefinementAgentPrompt(funcName));
  } else {
    process.stdout.write(getDecompilationCleanupAgentPrompt(funcName));
  }
}
