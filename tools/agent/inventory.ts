#!/usr/bin/env npx tsx
/**
 * inventory.ts — order-independent content comparison between a target
 * function and the current source's compiled output.
 *
 * The exact instruction diff is a single global score that only moves when
 * everything upstream is right, so at 25% it cannot distinguish "my struct
 * layout is wrong" from "my statement order is wrong". These three multisets
 * can: they are invariant to scheduling and register allocation, so they read
 * out SEMANTIC content while ordering work is still churning.
 *
 *   memory offsets   which struct fields are touched, and how wide
 *   constants        mask/magic values, lui+ori folded
 *   shift amounts    scaling and field extraction
 *
 * Born from func_80016C08 (2026-08-02). Three defects that cost a session
 * each show up here immediately: a missing `tpage` store (target writes
 * offset 0x16, source never does), an array index written as `counter * 2`
 * when the `sll 1` was the compiler's own halfword scaling, and a reported
 * "target uses sll 10" that appears nowhere in the target at all.
 *
 * $sp-relative accesses are excluded: those are frame layout, which
 * frameMap.ts decomposes properly.
 *
 * Usage:
 *   npx tsx tools/agent/inventory.ts func_80016C08
 *   npx tsx tools/agent/inventory.ts func_80016C08 --src /tmp/candidate.c
 *   npx tsx tools/agent/inventory.ts func_80016C08 --json
 */

import { rmSync } from "fs";
import { join } from "path";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  compileSource,
  disassembleObject,
  normalizeFunctionName,
  resolveSource,
} from "./decompToolchain.js";
import { defUse } from "./webAnalysis.js";

/** Immediates below this are loop counters and indices — noise, not content. */
const NOTABLE_CONSTANT = 8;

const CONSTANT_SOURCES = new Set([
  "andi", "ori", "xori", "li", "lui", "addiu", "addi", "slti", "sltiu",
]);
const SHIFTS = new Set(["sll", "sra", "srl"]);

export interface Inventory {
  memory: Map<string, number>;
  constants: Map<number, number>;
  shifts: Map<string, number>;
  /** Target-side context: which offsets are reached through which base. */
  byBase: Map<string, Set<number>>;
}

function parseImmediate(text: string): number | null {
  const m = text.trim().match(/^(-?)(?:0x([0-9a-fA-F]+)|(\d+))$/);
  if (!m) return null;
  const value = m[2] !== undefined ? parseInt(m[2], 16) : parseInt(m[3], 10);
  return m[1] === "-" ? -value : value;
}

function memoryOperand(operand: string): { offset: number; base: string } | null {
  const m = operand.trim().match(/^(-?(?:0x)?[0-9a-fA-F]+)?\(\$?(\w+)\)$/);
  if (!m) return null;
  return { offset: m[1] ? parseImmediate(m[1]) ?? 0 : 0, base: m[2] };
}

function registerOf(operand: string): string | null {
  const m = operand.trim().match(/^\$?(\w+)$/);
  return m && !/^\d+$/.test(m[1]) ? m[1] : null;
}

function bump<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function inventory(instructions: DisassembledInstruction[]): Inventory {
  const memory = new Map<string, number>();
  const constants = new Map<number, number>();
  const shifts = new Map<string, number>();
  const byBase = new Map<string, Set<number>>();

  /* Fold the lui/ori pair GCC uses for wide constants, so 0xFFFFFF is one
   * value rather than an 0xFF and an 0xFFFF that mean nothing apart. */
  const pendingLui = new Map<string, number>();

  instructions.forEach((insn) => {
    const mnemonic = insn.mnemonic.toLowerCase();
    const { isLoad, isStore } = defUse(insn);

    if (isLoad || isStore) {
      const operand = memoryOperand(insn.operands[insn.operands.length - 1] ?? "");
      if (operand && operand.base !== "sp") {
        bump(memory, `${mnemonic}@${hex(operand.offset)}`);
        if (!byBase.has(operand.base)) byBase.set(operand.base, new Set());
        byBase.get(operand.base)!.add(operand.offset);
      }
      return;
    }

    if (SHIFTS.has(mnemonic)) {
      const amount = parseImmediate(insn.operands[2] ?? "");
      if (amount !== null) bump(shifts, `${mnemonic} ${amount}`);
      return;
    }

    if (!CONSTANT_SOURCES.has(mnemonic)) return;

    const destination = registerOf(insn.operands[0] ?? "");
    const value = parseImmediate(insn.operands[insn.operands.length - 1] ?? "");
    if (value === null) return;

    /* Frame adjustment, not content. */
    if (mnemonic === "addiu" && destination === "sp") return;
    if (mnemonic === "addiu" && registerOf(insn.operands[1] ?? "") === "sp") return;

    if (mnemonic === "lui" && destination) {
      pendingLui.set(destination, (value << 16) >>> 0);
      return;
    }
    if (mnemonic === "ori" && destination) {
      const high = pendingLui.get(registerOf(insn.operands[1] ?? "") ?? "");
      if (high !== undefined) {
        pendingLui.delete(destination);
        bump(constants, (high | value) >>> 0);
        return;
      }
    }
    if (Math.abs(value) >= NOTABLE_CONSTANT) bump(constants, value);
  });

  /* A lui with no folding partner still carried a real high half. */
  for (const value of pendingLui.values()) bump(constants, value);

  return { memory, constants, shifts, byBase };
}

export interface InventoryDelta {
  key: string;
  target: number;
  compiled: number;
}

function diffCounts<K>(target: Map<K, number>, compiled: Map<K, number>, render: (key: K) => string): InventoryDelta[] {
  const deltas: InventoryDelta[] = [];
  for (const key of new Set([...target.keys(), ...compiled.keys()])) {
    const left = target.get(key) ?? 0;
    const right = compiled.get(key) ?? 0;
    if (left !== right) deltas.push({ key: render(key), target: left, compiled: right });
  }
  return deltas.sort((a, b) =>
    (b.target - b.compiled === 0 ? 0 : Math.abs(b.target - b.compiled)) -
    (a.target - a.compiled === 0 ? 0 : Math.abs(a.target - a.compiled)));
}

export interface InventoryReport {
  memory: InventoryDelta[];
  constants: InventoryDelta[];
  shifts: InventoryDelta[];
  targetByBase: Map<string, Set<number>>;
}

export function compareInventories(
  target: DisassembledInstruction[],
  compiled: DisassembledInstruction[],
): InventoryReport {
  const left = inventory(target);
  const right = inventory(compiled);
  return {
    memory: diffCounts(left.memory, right.memory, (key) => key),
    constants: diffCounts(left.constants, right.constants, (key) => hex(key)),
    shifts: diffCounts(left.shifts, right.shifts, (key) => key),
    targetByBase: left.byBase,
  };
}

export function hex(value: number): string {
  return `${value < 0 ? "-" : ""}0x${Math.abs(value).toString(16).toUpperCase()}`;
}

function renderSection(title: string, deltas: InventoryDelta[], limit: number, note: string): string[] {
  if (deltas.length === 0) return [`${title}: identical`];
  const lines = [`${title}: ${deltas.length} difference(s) — ${note}`];
  for (const delta of deltas.slice(0, limit)) {
    const verdict = delta.compiled === 0 ? "  TARGET ONLY" : delta.target === 0 ? "  YOURS ONLY" : "";
    lines.push(`    ${delta.key.padEnd(14)} target ${delta.target}  yours ${delta.compiled}${verdict}`);
  }
  if (deltas.length > limit) lines.push(`    ... and ${deltas.length - limit} more`);
  return lines;
}

export function renderReport(report: InventoryReport, limit = 12): string[] {
  return [
    ...renderSection("memory offsets", report.memory, limit,
      "a missing offset is a struct field you never read or write"),
    "",
    ...renderSection("constants", report.constants, limit,
      "masks and magic numbers; lui+ori folded"),
    "",
    ...renderSection("shift amounts", report.shifts, limit,
      "scaling and field extraction; array index scaling is the compiler's, not the source's"),
  ];
}

/* --- CLI --- */

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const srcFlag = args.indexOf("--src");
  const srcOverride = srcFlag >= 0 ? args[srcFlag + 1] : undefined;
  const positional = args.filter(
    (a, i) => !a.startsWith("--") && !(srcFlag >= 0 && i === srcFlag + 1));
  if (positional.length !== 1) {
    console.error("Usage: npx tsx tools/agent/inventory.ts <func_name> [--src <path.c>] [--json]");
    process.exit(1);
  }

  const name = normalizeFunctionName(positional[0]);
  const scratch = join(ROOT, "build/triage", `${name}-inventory`);
  try {
    const target = disassembleObject(assembleTarget(name, scratch));
    const artifacts = compileSource(resolveSource(name, srcOverride), scratch, name, { assemble: true });
    const compiled = disassembleObject(artifacts.object!);
    const report = compareInventories(target, compiled);

    if (json) {
      console.log(JSON.stringify({
        memory: report.memory, constants: report.constants, shifts: report.shifts,
        targetByBase: Object.fromEntries(
          [...report.targetByBase].map(([base, offsets]) => [base, [...offsets].sort((a, b) => a - b).map(hex)])),
      }, null, 2));
      return;
    }

    console.log(`inventory ${name} — target vs your compiled source\n`);
    for (const line of renderReport(report)) console.log(`  ${line}`);
    console.log("\n  target struct access, by base register:");
    for (const [base, offsets] of report.targetByBase) {
      if (offsets.size < 2) continue;
      console.log(`    $${base}: ${[...offsets].sort((a, b) => a - b).map(hex).join(" ")}`);
    }
  } catch (error) {
    console.error(`inventory: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
