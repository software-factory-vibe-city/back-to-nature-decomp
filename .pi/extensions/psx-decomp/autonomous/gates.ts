import { basename, extname } from "node:path";
import type { AutodecompConfig, DiffResult, GateResult, WorkMode } from "./types.ts";
import { runCommand } from "./process.ts";
import { checkSourcePolicy } from "./source-policy.ts";

/**
 * The oracle's summary lines.
 *
 * The word count is a progress reading; the verdict is the decision. They come
 * out of one comparison, so a missing verdict means the tool did not get far
 * enough to have an opinion — `unknown`, never a silent pass.
 */
export function parseFunctionDiffSummary(output: string): Pick<DiffResult, "matchedInstructions" | "totalInstructions" | "matchPercent" | "verdict"> {
  const matches = [...output.matchAll(/^Match:\s*(\d+)\/(\d+)\s+words\s+\(([\d.]+)%/gim)];
  const match = matches.at(-1);
  const verdicts = [...output.matchAll(/^VERDICT:\s*(MATCH|MISMATCH|UNDETERMINED)\b/gim)];
  const verdict = verdicts.at(-1)?.[1].toLowerCase() as DiffResult["verdict"] | undefined;
  return {
    matchedInstructions: match ? Number.parseInt(match[1], 10) : 0,
    totalInstructions: match ? Number.parseInt(match[2], 10) : 0,
    matchPercent: match ? Number.parseFloat(match[3]) : 0,
    verdict: verdict ?? "unknown",
  };
}

export async function runFunctionDiff(projectRoot: string, functionName: string, timeoutMs = 60_000, signal?: AbortSignal): Promise<DiffResult> {
  const command = await runCommand("npx", ["tsx", "tools/agent/diffFunc.ts", functionName], {
    cwd: projectRoot,
    timeoutMs,
    maxCaptureBytes: 4 * 1024 * 1024,
    signal,
  });
  const output = [command.stdout, command.stderr].filter(Boolean).join("\n");
  const { matchedInstructions, totalInstructions, matchPercent, verdict } = parseFunctionDiffSummary(output);
  const countLine = output.match(/target:\s*(\d+)\s+instrs,\s*candidate:\s*(\d+)\s+instrs/);
  const instructionCountDelta = countLine
    ? Number.parseInt(countLine[2], 10) - Number.parseInt(countLine[1], 10)
    : 0;
  return {
    functionName,
    matchedInstructions,
    totalInstructions,
    matchPercent,
    verdict,
    /* The verdict decides. A word count of N/N is what the oracle counted, not
     * what it concluded — an undetermined word leaves the count full. */
    exact: command.code === 0 && verdict === "match",
    instructionCountDelta,
    output,
    command,
  };
}

export async function runBuildCheck(projectRoot: string, timeoutMs = 5 * 60_000, signal?: AbortSignal) {
  return runCommand("make", ["check"], { cwd: projectRoot, timeoutMs, signal, maxCaptureBytes: 4 * 1024 * 1024 });
}

function sourceNames(changedFiles: string[]): string[] {
  return changedFiles
    .filter((file) => file.startsWith("src/") && extname(file) === ".c")
    .map((file) => basename(file, ".c"));
}

export async function runGate(options: {
  projectRoot: string;
  config: AutodecompConfig;
  mode: WorkMode;
  functionName?: string;
  functionVram?: string;
  changedFiles: string[];
  patch: string;
  runBuild?: boolean;
  signal?: AbortSignal;
}): Promise<GateResult> {
  const failures: string[] = [];
  const scanFunctions = options.mode === "project-refinement"
    ? sourceNames(options.changedFiles)
    : options.functionName ? [options.functionName] : [];
  const policy = checkSourcePolicy({
    projectRoot: options.projectRoot,
    config: options.config,
    functionName: options.functionName,
    functionVram: options.functionVram,
    scanFunctions,
    changedFiles: options.changedFiles,
    patch: options.patch,
  });
  if (!policy.pass) failures.push(...policy.hardFailures.map((finding) => `${finding.file}: ${finding.message}`));

  let diff: DiffResult | undefined;
  if (options.functionName && options.mode !== "project-refinement") {
    diff = await runFunctionDiff(options.projectRoot, options.functionName, 60_000, options.signal);
    if (!diff.exact) failures.push(`Function oracle verdict is ${diff.verdict.toUpperCase()}, not MATCH (${diff.matchedInstructions}/${diff.totalInstructions} words)`);
  } else if (options.mode === "project-refinement") {
    for (const name of scanFunctions) {
      const touched = await runFunctionDiff(options.projectRoot, name, 60_000, options.signal);
      if (!touched.exact) failures.push(`${name}: function oracle verdict is ${touched.verdict.toUpperCase()}, not MATCH (${touched.matchedInstructions}/${touched.totalInstructions} words)`);
    }
  }

  const build = options.runBuild === false ? undefined : await runBuildCheck(options.projectRoot, 5 * 60_000, options.signal);
  if (build && build.code !== 0) failures.push(`Full build verification failed with exit code ${build.code}`);

  return {
    pass: failures.length === 0,
    mode: options.mode,
    functionName: options.functionName,
    diff,
    build,
    policy,
    failures,
    checkedAt: new Date().toISOString(),
  };
}
