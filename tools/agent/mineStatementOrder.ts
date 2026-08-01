#!/usr/bin/env npx tsx
/**
 * mineStatementOrder.ts — read suspected SOURCE statement order off a target
 * function's emission order.
 *
 * GCC 2.95 births RTL in source statement order, and several downstream
 * orders survive to the final stream: hi16 address-formation order tracks
 * first-use order of globals (first-use CSE places shared subexpressions in
 * the FIRST statement that needs them), stack-slot store order tracks
 * assignment order, and the delay-slot occupant is usually the last-born
 * statement of its block. Mining these gives concrete evidence for how the
 * original source ordered its statements — the same doctrine as the
 * store-block rule, generalized (func_800241EC: the else-branch emission
 * order proved `var_s0 = &sp14;` was the FIRST statement of the branch).
 *
 * Usage:
 *   npx tsx tools/agent/mineStatementOrder.ts func_800241EC
 *   npx tsx tools/agent/mineStatementOrder.ts func_800241EC --json
 *   npx tsx tools/agent/mineStatementOrder.ts --obj build/some.o [--json]
 *
 * Output is EVIDENCE, not a verdict: emission order constrains but does not
 * uniquely determine statement order (the scheduler may interleave within
 * dependence limits). Treat each block's first-touch sequence as a prior to
 * test with the compile-and-diff loop.
 */

import { join } from "path";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
} from "./decompToolchain.js";
import { BRANCH_MNEMONICS, buildBlocks, registersIn } from "./webAnalysis.js";

const LOADS = new Set(["lbu", "lb", "lhu", "lh", "lw", "lwl", "lwr"]);
const STORES = new Set(["sb", "sh", "sw", "swl", "swr"]);

interface BlockEvent {
  index: number;
  address: number;
  kind: string;
  object: string; /* the symbol / local slot / call target the event touches */
  text: string;
  delaySlot: boolean;
}

interface BlockReport {
  block: number;
  startAddress: number;
  endAddress: number;
  terminator?: string;
  delaySlot?: string;
  events: BlockEvent[];
  firstTouch: string[];
}

function relocationSymbol(symbol: string): string {
  return symbol.replace(/\s*[+-]\s*0x[0-9a-f]+$/i, "");
}

function spOffset(operand: string): string | null {
  const match = operand.match(/^(-?(?:0x[0-9a-f]+|\d+))\(sp\)$/i);
  if (!match) return null;
  const value = match[1].toLowerCase();
  const parsed = value.startsWith("0x") || value.startsWith("-0x")
    ? parseInt(value, 16)
    : parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed < 0 ? `sp-0x${(-parsed).toString(16)}` : `sp+0x${parsed.toString(16)}`;
}

const SAVE_RESTORE_REGISTERS = new Set(["ra", "fp", "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7"]);

function localSlot(value: number): string {
  return value < 0 ? `sp-0x${(-value).toString(16)}` : `sp+0x${value.toString(16)}`;
}

function classify(instruction: DisassembledInstruction): { kind: string; object: string } | null {
  const mnemonic = instruction.mnemonic;
  const relocation = instruction.relocation;
  const type = relocation?.type.toUpperCase() ?? "";
  const symbol = relocation ? relocationSymbol(relocation.symbol) : "";

  if (type.includes("HI16")) return { kind: "form-address", object: symbol };
  if (type.includes("LO16") || type.includes("GPREL")) {
    const via = type.includes("GPREL") ? " (gp)" : "";
    if (LOADS.has(mnemonic)) return { kind: `load${via}`, object: symbol };
    if (STORES.has(mnemonic)) return { kind: `store${via}`, object: symbol };
    return { kind: "materialize", object: `&${symbol}` };
  }
  if (type.includes("26")) {
    /* Local jumps relocate against the section symbol — not calls. */
    if (symbol.startsWith(".")) return null;
    return { kind: "call", object: symbol };
  }
  if (mnemonic === "jalr") {
    const registers = registersIn(instruction.operandText);
    return { kind: "call via", object: `$${registers[registers.length - 1] ?? "?"}` };
  }

  /* Stack-local traffic (no relocation). Callee-save spill/restore of
     ra/fp/s-registers is prologue/epilogue noise, not statement order. */
  for (const operand of instruction.operands) {
    const slot = spOffset(operand);
    if (!slot) continue;
    const moved = registersIn(instruction.operands[0] || "")[0];
    if (moved && SAVE_RESTORE_REGISTERS.has(moved)) return null;
    if (LOADS.has(mnemonic)) return { kind: "read local", object: slot };
    if (STORES.has(mnemonic)) return { kind: "write local", object: slot };
  }
  if (mnemonic === "addiu" && instruction.operands.length === 3) {
    const destination = registersIn(instruction.operands[0] || "")[0];
    const base = registersIn(instruction.operands[1] || "")[0];
    if (base === "sp" && destination !== "sp") {
      const raw = instruction.operands[2].toLowerCase();
      const value = raw.startsWith("0x") || raw.startsWith("-0x") ? parseInt(raw, 16) : parseInt(raw, 10);
      if (!Number.isNaN(value)) return { kind: "take &local", object: localSlot(value) };
    }
  }
  return null;
}

export function mineStatementOrder(instructions: DisassembledInstruction[]): BlockReport[] {
  const indexByAddress = new Map(instructions.map((instruction, index) => [instruction.address, index]));
  const branchTargetOf = (index: number): number | undefined => {
    const instruction = instructions[index];
    if (!BRANCH_MNEMONICS.has(instruction.mnemonic)) return undefined;
    for (let operand = instruction.operands.length - 1; operand >= 0; operand--) {
      const text = instruction.operands[operand].replace(/\s*<[^>]*>$/, "");
      if (/^[0-9a-f]+$/i.test(text)) {
        const target = indexByAddress.get(parseInt(text, 16));
        if (target !== undefined) return target;
      }
    }
    return undefined;
  };

  const blocks = buildBlocks(instructions, branchTargetOf);
  const reports: BlockReport[] = [];
  blocks.forEach((block, blockNumber) => {
    const events: BlockEvent[] = [];
    let terminator: string | undefined;
    let delaySlot: string | undefined;
    let terminatorIndex = -1;
    for (let index = block.start; index <= block.end; index++) {
      if (BRANCH_MNEMONICS.has(instructions[index].mnemonic) && index >= block.end - 1) {
        terminatorIndex = index;
      }
    }
    if (terminatorIndex >= 0) {
      terminator = instructions[terminatorIndex].raw.replace(/^\s*[0-9a-f]+:\s*/, "");
      if (terminatorIndex + 1 <= block.end) {
        delaySlot = instructions[terminatorIndex + 1].raw.replace(/^\s*[0-9a-f]+:\s*/, "");
      }
    }

    for (let index = block.start; index <= block.end; index++) {
      const classified = classify(instructions[index]);
      if (!classified) continue;
      events.push({
        index,
        address: instructions[index].address,
        kind: classified.kind,
        object: classified.object,
        text: `${instructions[index].mnemonic} ${instructions[index].operandText}`,
        delaySlot: terminatorIndex >= 0 && index === terminatorIndex + 1,
      });
    }

    const seen = new Set<string>();
    const firstTouch: string[] = [];
    for (const event of events) {
      if (seen.has(event.object)) continue;
      seen.add(event.object);
      firstTouch.push(event.object);
    }

    const report: BlockReport = {
      block: blockNumber,
      startAddress: instructions[block.start].address,
      endAddress: instructions[block.end].address,
      events,
      firstTouch,
    };
    if (terminator) report.terminator = terminator;
    if (delaySlot) report.delaySlot = delaySlot;
    reports.push(report);
  });
  return reports;
}

function printHuman(name: string, reports: BlockReport[]): void {
  console.log(`Statement-order evidence: ${name}`);
  console.log("(emission order constrains source statement order; hi16 formation order ≈");
  console.log(" first-use order of globals, store order ≈ assignment order, delay slot ≈");
  console.log(" last-born statement of the block. Evidence, not a verdict.)\n");
  for (const report of reports) {
    const range = `0x${report.startAddress.toString(16)}..0x${report.endAddress.toString(16)}`;
    console.log(`block ${report.block} [${range}]`);
    for (const event of report.events) {
      const marker = event.delaySlot ? " [delay]" : "";
      console.log(`  [${event.address.toString(16).padStart(4, " ")}] ${event.kind} ${event.object}${marker}  — ${event.text}`);
    }
    if (report.terminator) {
      console.log(`  ends: ${report.terminator}${report.delaySlot ? `  (delay: ${report.delaySlot})` : ""}`);
    }
    if (report.firstTouch.length > 0) {
      console.log(`  first-touch order: ${report.firstTouch.join(" → ")}`);
    }
    console.log("");
  }
}

function usage(): never {
  console.error("Usage: npx tsx tools/agent/mineStatementOrder.ts <func> [--json]");
  console.error("       npx tsx tools/agent/mineStatementOrder.ts --obj <object.o> [--json]");
  process.exit(1);
}

const isCLI = process.argv[1]?.endsWith("mineStatementOrder.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const objIndex = args.indexOf("--obj");
  try {
    let name: string;
    let object: string;
    if (objIndex >= 0) {
      object = args[objIndex + 1] || usage();
      name = object;
    } else {
      const positional = args.filter((arg) => !arg.startsWith("--"));
      if (positional.length !== 1) usage();
      name = normalizeFunctionName(positional[0]);
      object = assembleTarget(name, join(ROOT, "build/mineStatementOrder", name));
    }
    const reports = mineStatementOrder(disassembleObject(object));
    if (json) console.log(JSON.stringify({ function: name, blocks: reports }, null, 2));
    else printHuman(name, reports);
  } catch (error: any) {
    console.error(`mineStatementOrder: ${error.message}`);
    process.exit(1);
  }
}
