import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CallGraph, CallGraphEntry, ControllerState, FunctionState } from "./types.ts";
import { runCommand } from "./process.ts";

export function normalizeVram(value: string): string {
  const parsed = Number.parseInt(value, 16);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid VRAM address: ${value}`);
  return `0x${parsed.toString(16).toUpperCase().padStart(8, "0")}`;
}

export function loadCallGraph(projectRoot: string): CallGraph {
  const path = join(projectRoot, "build", "callGraph.json");
  if (!existsSync(path)) throw new Error(`Missing call graph: ${path}`);
  const graph = JSON.parse(readFileSync(path, "utf8")) as CallGraph;
  if (!Array.isArray(graph.functions)) throw new Error(`Invalid call graph: ${path}`);
  for (const entry of graph.functions) {
    if (typeof entry.dead !== "boolean") throw new Error(`Call graph entry ${entry.name} has no dead classification`);
    entry.vram = normalizeVram(entry.vram);
  }
  return graph;
}

export async function rebuildCallGraph(projectRoot: string, timeoutMs = 120_000): Promise<CallGraph> {
  const result = await runCommand("npx", ["tsx", "tools/agent/callGraph.ts"], { cwd: projectRoot, timeoutMs });
  if (result.code !== 0) throw new Error(`Call graph regeneration failed:\n${result.stderr || result.stdout}`);
  return loadCallGraph(projectRoot);
}

export function graphHash(graph: CallGraph): string {
  const stable = graph.functions
    .map((entry) => ({
      vram: normalizeVram(entry.vram),
      name: entry.name,
      decompiled: entry.decompiled,
      dead: entry.dead,
      handwritten: entry.handwritten,
      calls: [...entry.calls].sort(),
      calledBy: [...entry.calledBy].sort(),
    }))
    .sort((a, b) => a.vram.localeCompare(b.vram));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function eligible(entry: CallGraphEntry): boolean {
  return entry.dead === false && entry.handwritten === false;
}

export function reconcileState(state: ControllerState, graph: CallGraph): void {
  const seen = new Set<string>();
  for (const entry of graph.functions) {
    const vram = normalizeVram(entry.vram);
    seen.add(vram);
    const current = state.functions[vram];
    if (!current) {
      state.functions[vram] = {
        vram,
        currentName: entry.name,
        previousNames: [],
        status: entry.dead ? "dead" : entry.handwritten !== false ? "handwritten" : "pending",
        priority: entry.priority,
        tier: entry.tier,
        graphDecompiled: entry.decompiled,
        dead: entry.dead,
        handwritten: entry.handwritten,
        attempts: [],
        attemptsThisEpoch: 0,
      };
      continue;
    }

    if (current.currentName !== entry.name) {
      if (!current.previousNames.includes(current.currentName)) current.previousNames.push(current.currentName);
      current.currentName = entry.name;
    }
    current.priority = entry.priority;
    current.tier = entry.tier;
    current.graphDecompiled = entry.decompiled;
    current.dead = entry.dead;
    current.handwritten = entry.handwritten;

    if (entry.dead) current.status = "dead";
    else if (entry.handwritten !== false) current.status = "handwritten";
    else if (current.status === "dead" || current.status === "handwritten") current.status = "pending";
  }

  for (const [vram, current] of Object.entries(state.functions)) {
    if (!seen.has(vram) && current.status !== "matched") {
      current.status = "manually-skipped";
      current.parkedReason = "Function disappeared from the regenerated call graph";
    }
  }
  state.graphHash = graphHash(graph);
}

function namesToVrams(graph: CallGraph): Map<string, string> {
  return new Map(graph.functions.map((entry) => [entry.name, normalizeVram(entry.vram)]));
}

export function matchedNeighborHash(vram: string, state: ControllerState, graph: CallGraph): { hash?: string; count: number } {
  const entry = graph.functions.find((candidate) => normalizeVram(candidate.vram) === normalizeVram(vram));
  if (!entry) return { count: 0 };
  const byName = namesToVrams(graph);
  const neighbors = [...new Set([...entry.calls, ...entry.calledBy])]
    .map((name) => byName.get(name))
    .filter((neighbor): neighbor is string => Boolean(neighbor && state.functions[neighbor]?.status === "matched"))
    .sort();
  if (neighbors.length === 0) return { count: 0 };
  return {
    count: neighbors.length,
    hash: createHash("sha256").update(neighbors.join("\n")).digest("hex"),
  };
}

export function updateNeighborHashes(state: ControllerState, graph: CallGraph, reactivateParked: boolean): void {
  for (const fn of Object.values(state.functions)) {
    if (!eligibleState(fn)) continue;
    const previous = fn.lastNeighborHash;
    const current = matchedNeighborHash(fn.vram, state, graph);
    fn.lastNeighborHash = current.hash;
    if (reactivateParked && fn.status === "parked" && current.hash && previous && current.hash !== previous) {
      fn.status = "retry-ready";
      fn.attemptsThisEpoch = 0;
      fn.parkedReason = undefined;
    }
  }
}

export function eligibleState(fn: FunctionState): boolean {
  return !fn.dead && fn.handwritten === false && !fn.manuallySkipped;
}
