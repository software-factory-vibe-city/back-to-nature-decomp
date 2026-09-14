/**
 * nearMissRepair.ts — turn a residual into a source move.
 *
 * A near-miss report that says "seven words differ" leaves the reader to work
 * out which part of the function those words belong to, which construction
 * produced them, and what could be written differently. Each of those has an
 * answer this repository can compute, and none of them is a guess:
 *
 *   - **Where.** Every differing word is at an address, every address is in a
 *     basic block, and every block is in a region of the machine IR. The
 *     residual localises to a region — a loop body, one arm of a branch, a
 *     shared tail — rather than to "the function".
 *   - **What produced it.** The recipe atlas holds constructions this exact
 *     toolchain compiled, indexed by the shape of the words they produce. A
 *     region whose shape it recognises comes back with a construction that
 *     realizes it, and with the constants that differ.
 *   - **What to change.** The two together are a move: "the loop at 0x8010 37c0
 *     is a countdown over a global table with a stride of 14, and the draft
 *     writes an index loop" is something a reader can act on. A byte score is
 *     not.
 *
 * What this deliberately does not do is rank source spellings by how many
 * words they match. The residual is useful inside a fixed interpretation; it
 * is not evidence that the interpretation is right, and an edit that fixes the
 * cause of a difference can match fewer words while standing closer. The
 * output is alternatives with their evidence, not an ordering.
 *
 * Usage:
 *   npx tsx tools/agent/nearMissRepair.ts <functionName> [--json]
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./decompToolchain.js";
import { requireFunctionLocation } from "../lib/symbolIndex.js";
import { buildMachineIr, type MachineIrReport } from "./machine-ir/index.js";
import { decodeFunctionWords } from "./family-transfer/signature.js";
import { buildAtlas, loadAtlas, queryAtlasRegions, type AtlasRegionHit } from "./recipe-atlas/atlas.js";
import { isRefusal, loadResult, type LoadedResult } from "./matching-reconstruction/result-contract.js";
import { donorNamesFor } from "./family-transfer/replay.js";

export interface ImplicatedRegion {
  /** Block the differing words fall in. */
  block: number;
  vram: number;
  /** How many of the residual's words land here. */
  differingWords: number;
  /** The block's role in the recovered structure. */
  role: string;
  /** Whether the block is inside a loop, and which. */
  loopHeader?: number;
  /** Whether more than one path reaches it. */
  sharedTail: boolean;
}

export interface RepairReport {
  functionName: string;
  /** Where the draft came from, and how far off it is. */
  draft?: { kind: "winner" | "best-effort"; matchedWords?: number; totalWords?: number; differingCount?: number };
  /** The residual, localised to blocks of the target's own graph. */
  implicated: ImplicatedRegion[];
  /** Constructions the atlas recognises in the implicated regions. */
  constructions: Array<{ vram: number; recipeId: string; note: string; differences: AtlasRegionHit["differences"] }>;
  /** Family members whose C could be transferred instead of repaired. */
  donors: string[];
  /** The next bounded moves, in the order they should be tried. */
  moves: string[];
  notes: string[];
}

/* ---- localising the residual ------------------------------------------------ */

/**
 * Map differing addresses onto the target's own blocks.
 *
 * The addresses come from the byte oracle, which compares the candidate
 * against the target word by word; a differing word's address is the target's,
 * so it indexes directly into the target's graph. No correspondence has to be
 * guessed.
 */
function localise(report: MachineIrReport, differing: number[]): ImplicatedRegion[] {
  const start = report.vram;
  const byBlock = new Map<number, number>();
  for (const vram of differing) {
    const index = (vram - start) / 4;
    if (!Number.isInteger(index) || index < 0 || index >= report.ir.cfg.insns.length) continue;
    const block = report.ir.cfg.blockOf[index];
    if (block === undefined || block < 0) continue;
    byBlock.set(block, (byBlock.get(block) ?? 0) + 1);
  }

  const loopOf = new Map<number, number>();
  for (const loop of report.regions.loops) {
    for (const member of loop.body) {
      const existing = loopOf.get(member);
      /* Innermost wins: `loops` is smallest-body-first. */
      if (existing === undefined) loopOf.set(member, loop.header);
    }
  }
  const sharedTails = new Set(report.regions.sharedTails);

  return [...byBlock.entries()]
    .map(([block, differingWords]) => {
      const record = report.ir.cfg.blocks[block]!;
      const loopHeader = loopOf.get(block);
      const role = record.terminator === "branch" ? "a branch's test"
        : record.terminator === "dispatch" ? "a dispatch"
        : record.terminator === "return" ? "the return path"
        : loopHeader !== undefined ? "a loop body" : "straight-line work";
      return {
        block,
        vram: record.vram,
        differingWords,
        role,
        ...(loopHeader !== undefined ? { loopHeader } : {}),
        sharedTail: sharedTails.has(block),
      };
    })
    .sort((left, right) => right.differingWords - left.differingWords || left.vram - right.vram);
}

/* ---- the report -------------------------------------------------------------- */

export function repairReport(functionName: string): RepairReport {
  const notes: string[] = [];
  const location = requireFunctionLocation(functionName);
  const report = buildMachineIr(functionName);

  const loaded = loadResult(functionName);
  let differing: number[] = [];
  let draft: RepairReport["draft"];
  if (isRefusal(loaded)) {
    notes.push(`${loaded.detail} — run the reconstruction engine first to produce a draft`);
  } else {
    const bundle = (loaded as LoadedResult).bundle;
    if ((loaded as LoadedResult).stale) {
      notes.push(`the stored result is stale (${(loaded as LoadedResult).stale}); its residual describes an earlier tree`);
    }
    const outcome = bundle.winner ?? bundle.bestEffort;
    if (outcome) {
      draft = {
        kind: bundle.winner ? "winner" : "best-effort",
        ...(outcome.matchedWords !== undefined ? { matchedWords: outcome.matchedWords } : {}),
        ...(outcome.totalWords !== undefined ? { totalWords: outcome.totalWords } : {}),
        ...(outcome.differingCount !== undefined ? { differingCount: outcome.differingCount } : {}),
      };
      differing = outcome.differingVram ?? [];
      if (outcome.differingCount !== undefined && differing.length < outcome.differingCount) {
        notes.push(
          `the result records ${outcome.differingCount} differing word(s) and keeps ${differing.length} address(es); ` +
          "the localisation below covers the sample, not all of them",
        );
      }
    } else {
      notes.push(`${functionName}: the result carries no draft, so there is no residual to localise`);
    }
  }

  const implicated = localise(report, differing);

  /* Constructions the atlas recognises anywhere in the function. Reported
   * whether or not the residual falls inside them: a region the draft got
   * right is still evidence about what the rest of it should look like. */
  const atlas = loadAtlas(location.container.kind) ?? buildAtlas(location.container.kind);
  const { insns } = decodeFunctionWords(functionName);
  const hits = queryAtlasRegions(atlas, insns).slice(0, 8);
  const constructions = hits.map((hit) => ({
    vram: hit.at.vram,
    recipeId: hit.entry.recipeId,
    note: hit.entry.note,
    differences: hit.differences,
  }));

  let donors: string[] = [];
  try {
    donors = donorNamesFor(functionName).slice(0, 4);
  } catch {
    notes.push("the family index could not be built in this tree; donor retrieval was skipped");
  }

  return {
    functionName,
    ...(draft ? { draft } : {}),
    implicated,
    constructions,
    donors,
    moves: moves(functionName, report, implicated, hits, donors),
    notes,
  };
}

/**
 * The next bounded moves, in the order they should be tried.
 *
 * Ordered by how much they change: a transfer from a family donor replaces the
 * whole body and is decided by one compile; a construction swap in one region
 * is a local edit; changing a control frame is the largest move and comes
 * last. Nothing here is scored — each move is a hypothesis the byte oracle
 * settles, and the ordering is by cost, not by predicted likelihood.
 */
function moves(
  functionName: string,
  report: MachineIrReport,
  implicated: ImplicatedRegion[],
  hits: AtlasRegionHit[],
  donors: string[],
): string[] {
  const moves: string[] = [];

  if (donors.length > 0) {
    moves.push(
      `transfer from the family donor ${donors[0]} — one compile decides it: ` +
      `npx tsx tools/agent/familyTransfer.ts ${functionName}`,
    );
  }

  for (const hit of hits.slice(0, 3)) {
    const changes = hit.differences.length === 0
      ? "with the same constants"
      : `with ${hit.differences.map((difference) => `${difference.kind} 0x${(difference.queryValue >>> 0).toString(16)}`).join(", ")}`;
    moves.push(
      `write the region at 0x${hit.at.vram.toString(16)} as ${hit.entry.note}, ${changes} ` +
      `(recipe ${hit.entry.recipeId})`,
    );
  }

  const inLoop = implicated.filter((region) => region.loopHeader !== undefined);
  if (inLoop.length > 0) {
    const loop = report.regions.loops.find((candidate) => candidate.header === inLoop[0]!.loopHeader);
    moves.push(
      `the residual is inside the loop headed at B${inLoop[0]!.loopHeader} ` +
      `(${loop ? loop.exits.length : "?"} exit edge(s), ${loop ? loop.latches.length : "?"} latch(es)): ` +
      "try the other loop form — index against cursor, entry-guarded against do-while — before touching anything else",
    );
  }

  const shared = implicated.filter((region) => region.sharedTail);
  if (shared.length > 0) {
    moves.push(
      `B${shared.map((region) => region.block).join(", B")} ${shared.length === 1 ? "is a" : "are"} shared tail(s): ` +
      "try the factored form (compute into one variable, then one exit) against the duplicated form",
    );
  }

  if (report.unmodelled.length > 0) {
    const kinds = [...new Set(report.unmodelled.map((item) => item.op))];
    moves.push(
      `${report.unmodelled.length} word(s) are outside the model (${kinds.join(", ")}); ` +
      "no source edit reaches them until that capability exists — see the recovered operations instead",
    );
  }

  if (moves.length === 0) {
    moves.push("no construction in the atlas covers this function's regions, and it has no family donor: this is a new representative");
  }
  return moves;
}

/* ---- CLI --------------------------------------------------------------------- */

function main(): void {
  const args = process.argv.slice(2);
  const functionName = args.find((argument) => !argument.startsWith("--"));
  if (!functionName) {
    console.error("usage: npx tsx tools/agent/nearMissRepair.ts <functionName> [--json]");
    process.exit(2);
  }

  const report = repairReport(functionName);
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`${report.functionName}: near-miss repair`);
  if (report.draft) {
    console.log(
      `  draft: ${report.draft.kind}` +
      `${report.draft.matchedWords !== undefined ? ` (${report.draft.matchedWords}/${report.draft.totalWords} words)` : ""}` +
      `${report.draft.differingCount !== undefined ? `, ${report.draft.differingCount} differing` : ""}`,
    );
  }
  if (report.implicated.length > 0) {
    console.log("  the residual lands in:");
    for (const region of report.implicated) {
      console.log(
        `    B${region.block} @ 0x${region.vram.toString(16)}: ${region.differingWords} word(s), ${region.role}` +
        `${region.loopHeader !== undefined ? `, inside the loop at B${region.loopHeader}` : ""}` +
        `${region.sharedTail ? ", shared tail" : ""}`,
      );
    }
  }
  if (report.constructions.length > 0) {
    console.log("  constructions this toolchain is known to compile to these words:");
    for (const construction of report.constructions) {
      console.log(`    0x${construction.vram.toString(16)}: ${construction.note} (${construction.recipeId})`);
      for (const difference of construction.differences.slice(0, 4)) {
        console.log(
          `        ${difference.kind} 0x${(difference.recipeValue >>> 0).toString(16)} → ` +
          `0x${(difference.queryValue >>> 0).toString(16)}`,
        );
      }
    }
  }
  if (report.donors.length > 0) console.log(`  family donors: ${report.donors.join(", ")}`);
  console.log("  next moves, cheapest first:");
  for (const move of report.moves) console.log(`    - ${move}`);
  for (const note of report.notes) console.log(`  note: ${note}`);
}

if (process.argv[1]?.endsWith("nearMissRepair.ts")) main();

export { existsSync, join, ROOT };
