/**
 * The machine-IR entry point: words in, a graph-sized representation out.
 *
 * This is the spine the plan asks for — a CFG, SSA values with phis, explicit
 * memory versions and effects, and a region tree — built for a whole function
 * whatever it contains. It does not replace the symbolic executor: that route
 * recovers a *relation* and reaches byte-exact candidates today, and it stays
 * the fast path. What this adds is the representation the executor cannot
 * have, for the functions whose paths multiply faster than their code does.
 *
 * The measurable claim, and the one the tests hold, is proportionality: the
 * size of everything here is a function of the instruction and block counts.
 * A function whose relation has a million paths has a graph with a few dozen
 * nodes, and the difference is the whole reason to build this.
 */

import { readFileSync } from "node:fs";
import { containerTargetPath, vramToRom, type Container } from "../../lib/container.js";
import { loadSymbolIndex, requireFunctionLocation, resolveAddress } from "../../lib/symbolIndex.js";
import { decodeBytes } from "../matching-reconstruction/exec.js";
import type { DecodedInsn } from "../matching-reconstruction/decode.js";
import { buildCfg, renderCfg, type Cfg } from "./cfg.js";
import { computeDominators } from "./dominance.js";
import { buildRegions, distinctRegionCount, regionCount, renderRegions, type RegionTree } from "./regions.js";
import { liftToSsa, type LiftResult } from "./ssa.js";
import { renderIr } from "./ir.js";

export interface MachineIrReport {
  functionName: string;
  containerId: string;
  vram: number;
  sizeBytes: number;
  ir: LiftResult;
  regions: RegionTree;
  /** The sizes the proportionality claim is about. */
  size: {
    instructions: number;
    blocks: number;
    edges: number;
    values: number;
    phis: number;
    memoryVersions: number;
    effects: number;
    /** Distinct regions stored — the representation's own size. */
    regions: number;
    /** Regions a tail-duplicating emitter would produce; the sharing gap. */
    expandedRegions: number;
    loops: number;
  };
  /** What is present but unmodelled, named rather than omitted. */
  unmodelled: LiftResult["opaque"];
}

/**
 * A jump-table resolver over the container image.
 *
 * Reading the table is what turns a `jr $v0` from an exit with no successors
 * into a dispatch with its real cases; without the image the graph says so
 * rather than guessing.
 */
function dispatchResolver(
  insns: DecodedInsn[],
  image: Buffer,
  container: Container,
): (instructionIndex: number) => number[] | undefined {
  const start = insns[0]?.vram ?? 0;
  const end = start + insns.length * 4;
  return (instructionIndex: number) => {
    /* The table's base is materialised into the jumped-through register by a
     * `lui`/`addiu` pair a few instructions back; scanning a short window is
     * enough for every form this backend emits. */
    const insn = insns[instructionIndex];
    if (!insn) return undefined;
    let base: number | undefined;
    for (let index = instructionIndex - 1; index >= Math.max(0, instructionIndex - 12); index--) {
      const candidate = insns[index]!;
      if (candidate.op === "lui") {
        const low = insns.slice(index + 1, instructionIndex).find((later) =>
          (later.op === "addiu" || later.op === "ori") && later.rs === candidate.rt);
        base = ((candidate.uimm << 16) + (low ? (low.op === "ori" ? low.uimm : low.simm) : 0)) >>> 0;
        break;
      }
    }
    if (base === undefined) return undefined;
    const targets: number[] = [];
    for (let entry = 0; entry < 64; entry++) {
      const rom = vramToRom(container, base + entry * 4);
      if (rom < 0 || rom + 4 > image.length) break;
      const word = image.readUInt32LE(rom) >>> 0;
      if (word < start || word >= end) break;
      targets.push(word);
    }
    return targets.length >= 2 ? targets : undefined;
  };
}

/** Build the machine IR for one named function. */
export function buildMachineIr(functionName: string): MachineIrReport {
  const location = requireFunctionLocation(functionName);
  const container = location.container;
  const span = location.span;
  const image = readFileSync(containerTargetPath(container));
  const rom = vramToRom(container, span.vram);
  const insns = decodeBytes(image.subarray(rom, rom + span.size), span.vram);
  return buildMachineIrFrom(functionName, insns, {
    containerId: container.id,
    vram: span.vram,
    sizeBytes: span.size,
    gpValue: container.gpValue || undefined,
    resolveDispatch: dispatchResolver(insns, image, container),
  });
}

/** The pure half, for fixtures and for a caller that already has the words. */
export function buildMachineIrFrom(
  functionName: string,
  insns: DecodedInsn[],
  options: {
    containerId?: string;
    vram?: number;
    sizeBytes?: number;
    gpValue?: number | undefined;
    resolveDispatch?: ((instructionIndex: number) => number[] | undefined) | undefined;
  } = {},
): MachineIrReport {
  const cfg: Cfg = buildCfg(insns, { resolveDispatch: options.resolveDispatch });
  const ir = liftToSsa(functionName, cfg, {
    gpValue: options.gpValue,
    resolveDispatch: options.resolveDispatch,
  });
  const regions = buildRegions(cfg, computeDominators(cfg));

  const edges = cfg.blocks.reduce((sum, block) => sum + block.successors.length, 0);
  const phis = ir.values.filter((value) => value.op.kind === "phi").length;

  return {
    functionName,
    containerId: options.containerId ?? "fixture",
    vram: options.vram ?? insns[0]?.vram ?? 0,
    sizeBytes: options.sizeBytes ?? insns.length * 4,
    ir,
    regions,
    size: {
      instructions: insns.length,
      blocks: cfg.blocks.length,
      edges,
      values: ir.values.length,
      phis,
      memoryVersions: ir.memory.length,
      effects: ir.effects.length,
      regions: distinctRegionCount(regions.root),
      expandedRegions: regionCount(regions.root),
      loops: regions.loops.length,
    },
    unmodelled: ir.opaque,
  };
}

/** Symbol resolution for a report's call targets, when the tables are present. */
export function resolveCallTargets(report: MachineIrReport): Map<number, string> {
  const names = new Map<number, string>();
  try {
    const index = loadSymbolIndex(report.containerId);
    for (const effect of report.ir.effects) {
      if (effect.op.kind !== "call" || effect.op.target === undefined) continue;
      const resolved = resolveAddress(index, effect.op.target);
      if (resolved) names.set(effect.op.target, resolved.symbol);
    }
  } catch {
    /* No symbol tables in this tree: addresses stay addresses. */
  }
  return names;
}

/** A readable report: sizes, CFG, regions, and what was not modelled. */
export function renderMachineIr(report: MachineIrReport, options: { values?: boolean } = {}): string[] {
  const lines: string[] = [];
  const size = report.size;
  lines.push(`${report.functionName} @ 0x${report.vram.toString(16)} (${report.sizeBytes} B, ${report.containerId})`);
  lines.push(
    `  size: ${size.instructions} insn → ${size.blocks} block(s), ${size.edges} edge(s), ` +
    `${size.values} value(s) (${size.phis} phi), ${size.memoryVersions} memory version(s), ` +
    `${size.effects} effect(s), ${size.regions} region(s) ` +
    `(${size.expandedRegions} if tail-duplicated), ${size.loops} loop(s)`,
  );
  lines.push("  control flow:");
  for (const line of renderCfg(report.ir.cfg)) lines.push(`    ${line}`);
  lines.push("  structure:");
  for (const line of renderRegions(report.regions.root, "    ")) lines.push(line);
  if (report.regions.sharedTails.length > 0) {
    lines.push(`  shared tails: B${report.regions.sharedTails.join(", B")}`);
  }
  for (const note of report.regions.notes) lines.push(`  note: ${note}`);
  if (report.unmodelled.length > 0) {
    const byOp = new Map<string, number>();
    for (const item of report.unmodelled) byOp.set(item.op, (byOp.get(item.op) ?? 0) + 1);
    lines.push(`  unmodelled: ${[...byOp].map(([op, count]) => `${op}×${count}`).join(", ")}`);
    lines.push(`    (each keeps its location and blocks proofs through it; the rest of the function is still recovered)`);
  }
  if (options.values) {
    lines.push("  values:");
    for (const line of renderIr(report.ir)) lines.push(`    ${line}`);
  }
  return lines;
}

export { buildCfg, renderCfg } from "./cfg.js";
export { computeDominators, computePostDominators, findNaturalLoops, irreducibleBlocks } from "./dominance.js";
export { buildRegions, distinctRegionCount, regionCount, renderRegions } from "./regions.js";
export { liftToSsa } from "./ssa.js";
export type { Cfg, BasicBlock } from "./cfg.js";
export type { Region, RegionTree } from "./regions.js";
export type { LiftResult } from "./ssa.js";
