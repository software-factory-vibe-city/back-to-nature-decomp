/**
 * callGraph.ts
 *
 * Builds a call graph from disassembled functions and outputs a prioritized
 * JSON file for the decompilation pipeline.
 *
 * Deliverable 10 of plans/overlay-decompilation-enablement.md extends it across
 * containers. Two things follow from that and neither is cosmetic.
 *
 * Depth must traverse the container boundary. An overlay function that calls
 * twenty engine functions computes as depth 1 if the edges stop at the seam,
 * and the bottom-up ordering that makes the whole strategy work silently stops
 * working. Edges are by symbol name, and an overlay's symbols carry their
 * container as a prefix, so a cross-container call is an ordinary edge here.
 *
 * And a matched engine callee is not the same kind of dependency as an
 * unmatched one: its signature is known and stable, so nothing is waiting
 * behind it, while an unmatched one is real work an overlay function has to
 * wait for. Tier is computed from resolved dependencies rather than from the
 * category of the call target.
 *
 * Usage:
 *   npx tsx tools/agent/callGraph.ts                      # every container
 *   npx tsx tools/agent/callGraph.ts --container ovl_11   # scope to one container
 *   npx tsx tools/agent/callGraph.ts --top 20             # also print the top 20
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { computeLiveness } from "../lib/liveness.js";
import { scanOverlayReferences } from "../lib/overlayReferences.js";
import { containerPath, loadContainers, requireContainer, type Container } from "../lib/container.js";
import { loadFunctionSpans } from "../lib/symbolIndex.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const OUT_FILE = join(ROOT, "build/callGraph.json");

const args = process.argv.slice(2);
const topIdx = args.indexOf("--top");
const topN = topIdx >= 0 ? parseInt(args[topIdx + 1], 10) : 0;

const containerIdx = args.indexOf("--container");
const onlyContainer = containerIdx >= 0 ? args[containerIdx + 1] : undefined;

/* Containers, in build order: the PS-X EXE first, then each overlay member.
   Scoping a run to one container is the scheduling shape the plan argues for —
   once the engine API is matched the overlays are worked independently. */
const containers: Container[] = onlyContainer
  ? [requireContainer(onlyContainer)]
  : loadContainers();

interface FuncEntry {
  name: string;
  /** Which binary defines this function. */
  container: string;
  /**
   * The project-relative C file that defines this function, whether or not it
   * exists yet. Emitted so that nothing downstream has to reconstruct a source
   * path from a container id and a layout convention — a reconstruction that is
   * silently wrong for every container it does not know about.
   */
  source: string;
  /**
   * The first argument this function's `INCLUDE_ASM` stub takes — its
   * container's assembly directory, not the executable's. Emitted for the same
   * reason as `source`: a stub written against a reconstructed path points at a
   * directory that does not exist, and the failure surfaces as a link error
   * about a symbol rather than as a wrong path.
   */
  includeAsmPath: string;
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
  /** false = normal C, "asm" = pure handwritten asm, "gte" = C with GTE coprocessor instructions */
  handwritten: false | "asm" | "gte";
  /** true if no jal or data/pointer reference exists in any container */
  dead: boolean;
  /** jal sites from overlay members targeting this function */
  overlayCallSites: number;
  /** overlay containers that call this function */
  overlayMembers: string[];
  /** calls this function makes into another container */
  crossContainerCalls: string[];
}

const funcMap = new Map<string, FuncEntry>();
const containerOf = new Map<string, Container>();

// Build initial function entries from every container's splat config
for (const container of containers) {
  for (const span of loadFunctionSpans(container)) {
    containerOf.set(span.name, container);
    funcMap.set(span.name, {
      name: span.name,
      container: container.id,
      source: join(container.paths.srcDir, `${span.name}.c`),
      includeAsmPath: join(container.paths.asmDir, "nonmatchings", span.name),
      vram: `0x${span.vram.toString(16)}`,
      size: span.size,
      tier: 1,
      priority: 0,
      callerCount: 0,
      calls: [],
      calledBy: [],
      sdkCalls: [],
      instructionCount: 0,
      decompiled: false,
      handwritten: false,
      dead: false,
      overlayCallSites: 0,
      overlayMembers: [],
      crossContainerCalls: [],
    });
  }
}

// --- Step 2: Parse .s files for call targets + instruction counts ---

const jalRegex = /^\s*\/\*.*\*\/\s+jal\s+(\S+)/;
const instrRegex = /^\s*\/\*\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+\*\//;
/* A project function is named for its address, optionally behind its
   container's prefix: `func_8001FABC` in the PS-X EXE, `ovl_11_func_800C1234`
   in an overlay. Anything else is a library symbol the project never
   decompiles. */
const gameFuncRegex = /^(?:[A-Za-z_][A-Za-z0-9_]*_)?func_[0-9A-Fa-f]{8}$/;

for (const [name, entry] of funcMap) {
  const container = containerOf.get(name)!;
  const asmDir = join(containerPath(container, "asmDir"), "nonmatchings");
  let sFile = join(asmDir, name, `${name}.s`);
  if (!existsSync(sFile)) {
    // Handle named symbols (e.g. __start) where .s file has a different name
    const dir = join(asmDir, name);
    if (existsSync(dir)) {
      const files = readdirSync(dir).filter((f) => f.endsWith(".s"));
      if (files.length === 1) {
        sFile = join(dir, files[0]!);
      }
    }
    if (!existsSync(sFile)) continue;
  }

  const rawContent = readFileSync(sFile, "utf-8");
  const content = rawContent.split("\n");
  const gameCalls = new Set<string>();
  const sdkCalls = new Set<string>();
  let instrCount = 0;

  // Detect handwritten assembly (marker from spimdisasm)
  if (rawContent.includes("Handwritten function")) {
    // Classify: GTE functions have COP2 instructions (cfc2, ctc2, lwc2, etc.)
    const gtePattern = /\b(cfc2|ctc2|lwc2|swc2|mfc2|mtc2|cop2)\b/;
    entry.handwritten = gtePattern.test(rawContent) ? "gte" : "asm";
  }

  for (const line of content) {
    if (instrRegex.test(line)) instrCount++;

    const jalMatch = line.match(jalRegex);
    if (jalMatch) {
      const target = jalMatch[1]!;
      if (gameFuncRegex.test(target)) {
        if (target !== name) gameCalls.add(target); // exclude self-recursion from calls
      } else {
        sdkCalls.add(target);
      }
    }
  }

  entry.calls = [...gameCalls];
  entry.sdkCalls = [...sdkCalls];
  entry.instructionCount = instrCount;
  entry.crossContainerCalls = entry.calls.filter(
    (target) => (containerOf.get(target)?.id ?? entry.container) !== entry.container
  );
}

// --- Step 3: Build reverse edges (calledBy) ---

for (const [name, entry] of funcMap) {
  for (const target of entry.calls) {
    const targetEntry = funcMap.get(target);
    if (targetEntry) {
      targetEntry.calledBy.push(name);
    }
  }
}

// Set callerCount
for (const entry of funcMap.values()) {
  entry.callerCount = entry.calledBy.length;
}

// --- Step 3b: Liveness across every container ---

/* Liveness must be judged against the raw images, not the residual call graph.
   The graph's calledBy edges cover only jals emitted by functions that still
   have a nonmatching .s on disk; once a caller is decompiled its .s is gone and
   every jal it made disappears with it, so a callee called only by matched code
   looks callerless and is misclassified dead.

   Deliverable 2 of plans/overlay-decompilation-enablement.md widened that scan
   past the PS-X EXE. Overlay members hold roughly five times as much code as
   the EXE's game region and call into it constantly; judged against the EXE
   alone, the overlay-facing engine API was classified dead, and the priority
   sort below then pushed exactly those functions to the end of the queue. The
   rule is shared with tools/diagnostics/progress.ts so the two cannot drift. */
const liveness = computeLiveness();
const overlayScan = scanOverlayReferences();

function applyLiveness(): void {
  for (const entry of funcMap.values()) {
    const addr = parseInt(entry.vram, 16);
    const overlay = overlayScan?.exeCallTargets.get(addr);
    entry.overlayCallSites = overlay?.sites ?? 0;
    entry.overlayMembers = overlay ? [...overlay.members].sort() : [];
    /* Only the PS-X EXE's functions are judged. An overlay is loaded and run as
       a unit and the engine dispatches into it through tables this scan cannot
       read, so "nothing references it" would be a statement about the scan. */
    entry.dead =
      entry.container === "exe" && entry.calledBy.length === 0 && !liveness.referenced.has(addr);
  }
}

applyLiveness();

// --- Step 4: Check decompilation status (tiers depend on it) ---

for (const entry of funcMap.values()) {
  const container = containerOf.get(entry.name)!;
  const cFile = join(containerPath(container, "srcDir"), `${entry.name}.c`);
  if (existsSync(cFile)) {
    const content = readFileSync(cFile, "utf-8");
    const hasIncludeAsm = content.includes("INCLUDE_ASM(");
    if (!hasIncludeAsm) {
      entry.decompiled = true;
    }
  }
}

// --- Step 5: Classify tiers on resolved dependencies ---

/*
 * A callee is a dependency only while it is unresolved. A matched function's
 * signature is known and stable — nothing is waiting behind it — so an overlay
 * function that calls ten matched engine functions and nothing else is a leaf
 * from the work queue's point of view, exactly like one that calls only the
 * SDK. Classifying by the *category* of the call target instead would put
 * every overlay function in tier 3 forever, because they all call the engine.
 */
function unresolvedCallees(entry: FuncEntry): string[] {
  return entry.calls.filter((target) => {
    const callee = funcMap.get(target);
    return callee !== undefined && !callee.decompiled && callee.handwritten !== "asm";
  });
}

for (const entry of funcMap.values()) {
  if (unresolvedCallees(entry).length > 0) {
    entry.tier = 3;
  } else if (entry.sdkCalls.length > 0 || entry.calls.length > 0) {
    entry.tier = 2;
  } else {
    entry.tier = 1;
  }
}

// --- Step 6: Compute Tier 3 depth ---

const depthMap = new Map<string, number>();

// Tier 1 and 2 are depth 0
for (const entry of funcMap.values()) {
  if (entry.tier <= 2) {
    depthMap.set(entry.name, 0);
  }
}

// BFS to resolve Tier 3 depths
let changed = true;
while (changed) {
  changed = false;
  for (const entry of funcMap.values()) {
    if (entry.tier !== 3 || depthMap.has(entry.name)) continue;

    let maxCalleeDepth = -1;
    let allResolved = true;

    /* Cross-container edges are ordinary edges here: an overlay's symbols carry
       their container as a prefix, so a call into the engine resolves by name
       like any other and the BFS crosses the seam without special handling. */
    for (const callee of unresolvedCallees(entry)) {
      const d = depthMap.get(callee);
      if (d === undefined) {
        allResolved = false;
        break;
      }
      if (d > maxCalleeDepth) maxCalleeDepth = d;
    }

    if (allResolved) {
      depthMap.set(entry.name, maxCalleeDepth + 1);
      changed = true;
    }
  }
}

// Functions in cycles get max depth
let maxDepth = 0;
for (const d of depthMap.values()) {
  if (d > maxDepth) maxDepth = d;
}
for (const entry of funcMap.values()) {
  if (entry.tier === 3 && !depthMap.has(entry.name)) {
    depthMap.set(entry.name, maxDepth + 1);
  }
}

// --- Step 7: Assign priority and sort ---

const entries = [...funcMap.values()];

/* The PS-X EXE comes first, and that is the dependency structure rather than a
   preference: no overlay translation unit compiles without correct declarations
   for the engine functions it calls, and a wrong callee declaration poisons the
   caller. Once the engine API is finished the overlays are independent of each
   other and a run is scoped to one with --container. */
const containerRank = new Map(containers.map((container, index) => [container.id, index]));

entries.sort((a, b) => {
  // Decompiled, pure-asm (not GTE), and dead code go to end
  const aSkip = a.decompiled || a.handwritten === "asm" || a.dead;
  const bSkip = b.decompiled || b.handwritten === "asm" || b.dead;
  if (aSkip !== bSkip) return aSkip ? 1 : -1;

  // Containers in dependency order: the engine API is the frontier
  const aRank = containerRank.get(a.container) ?? 99;
  const bRank = containerRank.get(b.container) ?? 99;
  if (aRank !== bRank) return aRank - bRank;

  // Sort by tier
  if (a.tier !== b.tier) return a.tier - b.tier;

  // Within Tier 3, sort by depth
  if (a.tier === 3) {
    const da = depthMap.get(a.name) ?? maxDepth + 1;
    const db = depthMap.get(b.name) ?? maxDepth + 1;
    if (da !== db) return da - db;
  }

  // Smaller instruction count first
  if (a.instructionCount !== b.instructionCount) return a.instructionCount - b.instructionCount;

  // Higher caller count first (breaks ties)
  return b.callerCount - a.callerCount;
});

// Assign sequential priority
entries.forEach((e, i) => {
  e.priority = i + 1;
});

// --- Step 8: Write JSON + print summary ---

const decomposable = entries.filter((e) => e.handwritten !== "asm");
const tier1 = decomposable.filter((e) => e.tier === 1).length;
const tier2 = decomposable.filter((e) => e.tier === 2).length;
const tier3 = decomposable.filter((e) => e.tier === 3).length;
const decompiledCount = entries.filter((e) => e.decompiled).length;
const gteCount = entries.filter((e) => e.handwritten === "gte").length;
const asmCount = entries.filter((e) => e.handwritten === "asm").length;
const deadCount = entries.filter((e) => e.dead).length;
const engineApiCount = entries.filter((e) => e.overlayCallSites > 0).length;
const engineApiStubs = entries.filter((e) => e.overlayCallSites > 0 && !e.decompiled && e.handwritten !== "asm");

const crossContainerEdges = entries.flatMap((e) =>
  e.crossContainerCalls.map((target) => ({
    from: e.container,
    to: funcMap.get(target)?.container ?? "unknown",
    caller: e.name,
    callee: target,
  }))
);
const crossPairs = new Map<string, number>();
for (const edge of crossContainerEdges) {
  const key = `${edge.from} -> ${edge.to}`;
  crossPairs.set(key, (crossPairs.get(key) ?? 0) + 1);
}

const perContainer = containers.map((container) => {
  const own = entries.filter((e) => e.container === container.id);
  return {
    id: container.id,
    kind: container.kind,
    total: own.length,
    decompiled: own.filter((e) => e.decompiled).length,
    tier1: own.filter((e) => e.tier === 1 && e.handwritten !== "asm").length,
    dead: own.filter((e) => e.dead).length,
  };
});

const output = {
  functions: entries,
  containers: perContainer,
  crossContainerEdges: [...crossPairs.entries()].map(([pair, count]) => ({ pair, count })),
  stats: {
    total: entries.length,
    tier1,
    tier2,
    tier3,
    decompiled: decompiledCount,
    gte: gteCount,
    asm: asmCount,
    dead: deadCount,
    engineApi: engineApiCount,
    engineApiStubs: engineApiStubs.length,
  },
  liveness: {
    basis: liveness.basis,
    overlaysIncluded: liveness.overlaysIncluded,
    exeAddressesReferencedFromOverlays: liveness.fromOverlays.size,
  },
};

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));

console.log(`Call graph: ${entries.length} functions`);
console.log(`  Tier 1 (pure leaf):    ${String(tier1).padStart(3)} functions`);
console.log(`  Tier 2 (SDK-only):     ${String(tier2).padStart(3)} functions`);
console.log(`  Tier 3 (game callers): ${String(tier3).padStart(3)} functions`);
console.log(`  Already decompiled:    ${String(decompiledCount).padStart(3)} functions`);
console.log(`  GTE (C + coprocessor): ${String(gteCount).padStart(3)} functions`);
if (asmCount > 0) {
  console.log(`  Pure asm (excluded):   ${String(asmCount).padStart(3)} functions`);
}
if (deadCount > 0) {
  console.log(`  Dead code (excluded):  ${String(deadCount).padStart(3)} functions`);
}
console.log(`Liveness: ${liveness.basis}`);
if (engineApiCount > 0) {
  console.log(`  Engine API (overlay-called): ${engineApiCount} functions, ${engineApiStubs.length} still stubs`);
}
console.log(`Wrote ${OUT_FILE}`);

if (perContainer.length > 1) {
  console.log();
  console.log(`${"CONTAINER".padEnd(10)} ${"FUNCS".padStart(6)} ${"MATCHED".padStart(8)} ${"TIER1".padStart(6)} ${"DEAD".padStart(5)}`);
  for (const c of perContainer) {
    console.log(
      `${c.id.padEnd(10)} ${String(c.total).padStart(6)} ${String(c.decompiled).padStart(8)} ${String(c.tier1).padStart(6)} ${String(c.dead).padStart(5)}`
    );
  }
}

if (crossPairs.size > 0) {
  console.log();
  console.log("Cross-container call edges:");
  for (const [pair, count] of [...crossPairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${pair}: ${count} edge(s)`);
  }
}

if (topN > 0) {
  console.log();
  console.log(`Top ${topN} priority functions:`);
  console.log(
    `${"#".padStart(4)}  ${"Tier".padEnd(4)}  ${"Instrs".padStart(6)}  ${"Callers".padStart(7)}  ${"Ovl".padStart(5)}  Name`
  );
  console.log("-".repeat(60));
  const top = entries.filter((e) => !e.decompiled && e.handwritten !== "asm" && !e.dead).slice(0, topN);
  for (const e of top) {
    console.log(
      `${String(e.priority).padStart(4)}  T${e.tier}    ${String(e.instructionCount).padStart(6)}  ${String(e.callerCount).padStart(7)}  ${String(e.overlayCallSites).padStart(5)}  ${e.name}`
    );
  }

  if (engineApiStubs.length > 0) {
    console.log();
    console.log("Engine API stubs, by overlay call sites — the overlay dependency frontier:");
    console.log(`${"#".padStart(4)}  ${"Sites".padStart(6)}  ${"Members".padStart(7)}  Name`);
    console.log("-".repeat(48));
    for (const e of [...engineApiStubs].sort((a, b) => b.overlayCallSites - a.overlayCallSites).slice(0, topN)) {
      console.log(
        `${String(e.priority).padStart(4)}  ${String(e.overlayCallSites).padStart(6)}  ${String(e.overlayMembers.length).padStart(7)}  ${e.name}`
      );
    }
  }
}
