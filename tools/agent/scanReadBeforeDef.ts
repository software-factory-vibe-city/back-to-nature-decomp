#!/usr/bin/env npx tsx
/**
 * scanReadBeforeDef.ts — label-aware scanner for registers read before any
 * definition (or after call clobber) in target assembly.
 *
 * Fingerprint scanner for two anomaly classes that ordinary compiled C can
 * never produce, both established in this project's research notes:
 *
 *  - entry-liveness: a caller-saved register ($v0/$v1/$t*) is read on some
 *    path before ANY definition. GCC only allocates a pseudo read-before-set
 *    via global-alloc, which cannot produce the observed hard-register
 *    reuse — the practical source construct is a register variable
 *    (`register s32 x asm("$2")`), block-scope or file-scope
 *    (see notes/research/func_8001E878-dead-spill-allocation.md §9).
 *
 *  - call-clobbered read: a call-clobbered register is read after a call
 *    without an intervening definition (file-scope register variable across
 *    calls, or handwritten assembly; see notes/research/func_8001E9F8.md).
 *
 * Scans splat nonmatchings .s directly (no assembly step), with real basic
 * blocks and a must-defined dataflow — linear scans false-positive on any
 * function whose loop back-edge defines a register above its first read.
 *
 * Usage:
 *   npx tsx tools/agent/scanReadBeforeDef.ts func_8001E878
 *   npx tsx tools/agent/scanReadBeforeDef.ts path/to/file.s
 *   npx tsx tools/agent/scanReadBeforeDef.ts --all [--json]
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { BRANCH_MNEMONICS, buildBlocks, defUse, registersIn } from "./webAnalysis.js";

const ROOT = new URL("../..", import.meta.url).pathname;
const NONMATCHINGS = join(ROOT, "build/asm/nonmatchings");

/** Registers with no defined value at function entry under the MIPS ABI. */
const WATCHED = new Set(["v0", "v1", "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "hi", "lo"]);
const CALL_CLOBBERED = new Set(["a0", "a1", "a2", "a3", "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "hi", "lo"]);
const ALL_REGISTERS = new Set([
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra", "hi", "lo",
]);

interface AsmInstruction {
  mnemonic: string;
  operands: string[];
  vram: string;
  text: string;
  labelTarget?: string;
}

interface Finding {
  function: string;
  register: string;
  vram: string;
  instruction: string;
  kind: "entry-liveness" | "call-clobbered";
}

function parseAsm(content: string): { name: string; instructions: AsmInstruction[]; labels: Map<string, number> } {
  const instructions: AsmInstruction[] = [];
  const labels = new Map<string, number>();
  let name = "";
  for (const line of content.split("\n")) {
    const label = line.match(/^\s*(\.L[0-9A-Fa-f]+):/);
    if (label) {
      labels.set(label[1], instructions.length);
      continue;
    }
    const glabel = line.match(/^\s*g?label\s+(\S+)/) || line.match(/^\s*glabel\s+(\S+)/);
    if (glabel && !name) {
      name = glabel[1];
      continue;
    }
    const instruction = line.match(/^\s*\/\*\s*\S+\s+(\S+)\s+\S+\s*\*\/\s+(\S+)\s*(.*)$/);
    if (!instruction) continue;
    const mnemonic = instruction[2].toLowerCase();
    const operandText = instruction[3].trim();
    const operands = operandText.length > 0
      ? operandText.split(",").map((operand) => operand.trim())
      : [];
    const entry: AsmInstruction = {
      mnemonic,
      operands,
      vram: instruction[1],
      text: `${mnemonic} ${operandText}`,
    };
    const target = operands.find((operand) => /^\.L[0-9A-Fa-f]+$/.test(operand));
    if (target) entry.labelTarget = target;
    instructions.push(entry);
  }
  return { name, instructions, labels };
}

export function scanInstructions(name: string, instructions: AsmInstruction[], labels: Map<string, number>): Finding[] {
  const branchTargetOf = (index: number): number | undefined => {
    const instruction = instructions[index];
    if (!BRANCH_MNEMONICS.has(instruction.mnemonic)) return undefined;
    return instruction.labelTarget !== undefined ? labels.get(instruction.labelTarget) : undefined;
  };
  const blocks = buildBlocks(instructions, branchTargetOf);
  if (blocks.length === 0) return [];

  const blockOfStart = new Map(blocks.map((block, index) => [block.start, index]));
  const predecessors: number[][] = blocks.map(() => []);
  blocks.forEach((block, index) => {
    for (const successorStart of block.successors) {
      const successor = blockOfStart.get(successorStart);
      if (successor !== undefined) predecessors[successor].push(index);
    }
  });

  const entryDefined = new Set([...ALL_REGISTERS].filter((register) => !WATCHED.has(register)));

  const transfer = (defined: Set<string>, clobbered: Set<string>, block: { start: number; end: number },
    onUse?: (register: string, index: number) => void): void => {
    const applyInstruction = (index: number): void => {
      const { defs, uses } = defUse(instructions[index]);
      for (const register of uses) {
        if (onUse && !defined.has(register)) onUse(register, index);
      }
      for (const register of defs) {
        defined.add(register);
        clobbered.delete(register);
      }
    };
    const applyCallClobber = (): void => {
      for (const register of CALL_CLOBBERED) {
        if (defined.has(register)) {
          defined.delete(register);
          clobbered.add(register);
        }
      }
      defined.add("v0");
      defined.add("v1");
      defined.add("ra");
      clobbered.delete("v0");
      clobbered.delete("v1");
    };

    for (let index = block.start; index <= block.end; index++) {
      const { isCall } = defUse(instructions[index]);
      applyInstruction(index);
      if (isCall) {
        /* The delay slot executes before the call transfers: process it
           against pre-call state, then apply the callee clobber. */
        if (index + 1 <= block.end) applyInstruction(++index);
        applyCallClobber();
      }
    }
  };

  /* Must-defined forward dataflow (optimistic init, intersection meet);
     clobbered is a may-set carried alongside for finding classification. */
  const inDefined: Array<Set<string> | null> = blocks.map(() => null);
  const inClobbered: Array<Set<string>> = blocks.map(() => new Set());
  const outDefined: Array<Set<string> | null> = blocks.map(() => null);
  const outClobbered: Array<Set<string>> = blocks.map(() => new Set());
  inDefined[0] = new Set(entryDefined);

  let changed = true;
  let iterations = 0;
  while (changed && iterations++ < blocks.length * 8 + 16) {
    changed = false;
    blocks.forEach((block, index) => {
      let mergedDefined: Set<string> | null = index === 0 ? new Set(entryDefined) : null;
      const mergedClobbered = new Set<string>(index === 0 ? [] : []);
      for (const predecessor of predecessors[index]) {
        const predecessorOut = outDefined[predecessor];
        if (predecessorOut === null) continue; /* not yet computed: optimistic */
        mergedDefined = mergedDefined === null
          ? new Set(predecessorOut)
          : new Set([...mergedDefined].filter((register) => predecessorOut.has(register)));
        for (const register of outClobbered[predecessor]) mergedClobbered.add(register);
      }
      if (mergedDefined === null) return; /* unreachable so far */
      inDefined[index] = mergedDefined;
      inClobbered[index] = mergedClobbered;
      const defined = new Set(mergedDefined);
      const clobbered = new Set(mergedClobbered);
      transfer(defined, clobbered, block);
      const previous = outDefined[index];
      const same = previous !== null && previous.size === defined.size &&
        [...defined].every((register) => previous.has(register)) &&
        outClobbered[index].size === clobbered.size &&
        [...clobbered].every((register) => outClobbered[index].has(register));
      if (!same) {
        outDefined[index] = defined;
        outClobbered[index] = clobbered;
        changed = true;
      }
    });
  }

  const findings: Finding[] = [];
  const seen = new Set<string>();
  blocks.forEach((block, index) => {
    const defined = inDefined[index];
    if (!defined) return;
    const clobbered = new Set(inClobbered[index]);
    transfer(new Set(defined), clobbered, block, (register, instructionIndex) => {
      if (!WATCHED.has(register) && !clobbered.has(register)) return;
      const key = `${register}:${instructionIndex}`;
      if (seen.has(key)) return;
      seen.add(key);
      findings.push({
        function: name,
        register,
        vram: instructions[instructionIndex].vram,
        instruction: instructions[instructionIndex].text,
        kind: clobbered.has(register) ? "call-clobbered" : "entry-liveness",
      });
    });
  });
  return findings;
}

function scanFile(path: string): Finding[] {
  const parsed = parseAsm(readFileSync(path, "utf-8"));
  const name = parsed.name || path;
  return scanInstructions(name, parsed.instructions, parsed.labels);
}

function resolveFunctionAsm(functionName: string): string | null {
  const direct = join(NONMATCHINGS, functionName, `${functionName}.s`);
  if (existsSync(direct)) return direct;
  const directory = join(NONMATCHINGS, functionName);
  if (existsSync(directory)) {
    const candidates = readdirSync(directory).filter((file) => file.endsWith(".s"));
    if (candidates.length === 1) return join(directory, candidates[0]);
  }
  return null;
}

function usage(): never {
  console.error("Usage: npx tsx tools/agent/scanReadBeforeDef.ts <func|file.s> [--json]");
  console.error("       npx tsx tools/agent/scanReadBeforeDef.ts --all [--json]");
  process.exit(1);
}

const isCLI = process.argv[1]?.endsWith("scanReadBeforeDef.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const findings: Finding[] = [];
  let scanned = 0;

  if (args.includes("--all")) {
    if (!existsSync(NONMATCHINGS)) {
      console.error(`scanReadBeforeDef: ${NONMATCHINGS} not found (run the build/split first)`);
      process.exit(1);
    }
    for (const entry of readdirSync(NONMATCHINGS).sort()) {
      const directory = join(NONMATCHINGS, entry);
      for (const file of readdirSync(directory).filter((candidate) => candidate.endsWith(".s"))) {
        findings.push(...scanFile(join(directory, file)));
        scanned++;
      }
    }
  } else if (positional.length === 1) {
    const path = positional[0].endsWith(".s")
      ? positional[0]
      : resolveFunctionAsm(positional[0].replace(/^src\//, "").replace(/\.c$/, ""));
    if (!path || !existsSync(path)) {
      console.error(`scanReadBeforeDef: no assembly found for ${positional[0]}`);
      process.exit(1);
    }
    findings.push(...scanFile(path));
    scanned = 1;
  } else usage();

  if (json) {
    console.log(JSON.stringify({ scanned, findings }, null, 2));
  } else {
    console.log(`scanned ${scanned} function(s); ${findings.length} finding(s)`);
    for (const finding of findings) {
      console.log(`  ${finding.function} @ 0x${finding.vram}: $${finding.register} ${finding.kind} — ${finding.instruction}`);
    }
    if (findings.length > 0) {
      console.log("\nentry-liveness: read before any definition on some path — compiled C cannot");
      console.log("produce this; suspect a register variable (see CAPTURE_PREV_RET in common.h");
      console.log("and notes/research/func_8001E878-dead-spill-allocation.md §9).");
      console.log("call-clobbered: read after a call without redefinition — file-scope register");
      console.log("variable or handwritten assembly (notes/research/func_8001E9F8.md).");
    }
  }
}
