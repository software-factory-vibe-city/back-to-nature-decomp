#!/usr/bin/env npx tsx
/**
 * fuzzVariants.ts — side-by-side hypothesis testing for one function.
 *
 * Compiles several complete variant .c shapes for a single function through
 * the project toolchain and reports each variant's diff class, exact-match
 * count, and first divergence against the original assembly.
 *
 * This is a HYPOTHESIS TESTER, not a hill-climber. Its value is the
 * comparative view: reading first divergences across variants reveals which
 * RTL web shapes survive which compiler passes (e.g. cse commutative
 * canonicalization). Name the compiler mechanism a winning shape exercises
 * before promoting it to src/ — do not random-walk source permutations.
 *
 * Usage:
 *   npx tsx tools/agent/fuzzVariants.ts <func> <variant.c> [variant2.c ...]
 *   npx tsx tools/agent/fuzzVariants.ts <func> --dir <dir-with-.c-variants>
 *   npx tsx tools/agent/fuzzVariants.ts <func> <variants...> --show <stem>
 *   npx tsx tools/agent/fuzzVariants.ts <func> <variants...> --cc1-only
 *   npx tsx tools/agent/fuzzVariants.ts <func> <variants...> --json
 *
 * Variants are complete compilable units using the project's include/
 * headers, so a winner can be copied straight over src/<func>.c. Each
 * variant is compiled with the target function's flag overrides (if any).
 * Artifacts go to build/fuzz/<func>/<variant-stem>/ (gitignored).
 *
 * Default mode runs the full cc1 → maspsx → as → objdump pipeline per
 * variant and classifies with explainDiff's structural analyzer.
 * --cc1-only is fast triage: it stops after cc1 and compares normalized
 * compiler output; alias coverage is best-effort, so confirm any finalist
 * in full mode before promoting.
 */

import { existsSync, readdirSync, readFileSync, rmSync } from "fs";
import { basename, isAbsolute, join, relative } from "path";
import {
  ROOT,
  assembleTarget,
  compileSource,
  disassembleObject,
  normalizeFunctionName,
  splitOperands,
  type DisassembledInstruction,
} from "./decompToolchain.js";
import { analyzeInstructionSets } from "./explainDiff.js";

/* ----------------------------------------------------------------------- */
/* cc1-only mode: parse cc1 .s output and normalize into a token space     */
/* comparable with objdump disassembly of the target object.               */
/* ----------------------------------------------------------------------- */

const HARD_REGISTER_NAMES = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
];

interface LightInstruction {
  mnemonic: string;
  canonical: string;
  display: string;
}

/** Canonicalize numeric literals (not digits inside symbols) to decimal. */
function canonicalNumbers(operand: string): string {
  return operand.replace(/(?<![A-Za-z0-9_])-?(0x[0-9a-f]+|\d+)/gi, (match) => String(Number(match)));
}

function canonicalSymbol(symbol: string): string {
  const normalized = symbol.toLowerCase().replace(/\s*[+-]\s*0x[0-9a-f]+$/, "");
  const address = normalized.match(/([0-9a-f]{8})$/);
  return address ? address[1] : normalized;
}

function parseCc1Assembly(path: string): LightInstruction[] {
  const instructions: LightInstruction[] = [];
  for (const rawLine of readFileSync(path, "utf-8").split("\n")) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line || line.startsWith(".") || line.endsWith(":")) continue;
    const match = line.match(/^([a-z][a-z0-9.]*)\s*(.*?)\s*$/i);
    if (!match) continue;

    let mnemonic = match[1].toLowerCase();
    let operands = (match[2] ? splitOperands(match[2]) : []).map((operand) =>
      operand.toLowerCase().replace(/\s+/g, "").replace(/\$(\d+|[a-z][a-z0-9]*)/g, (_whole, reg: string) =>
        /^\d+$/.test(reg) ? HARD_REGISTER_NAMES[Number(reg)] ?? `$${reg}` : reg,
      ),
    );
    /* cc1 prints the return jump as `j $31`; objdump prints `jr ra`. */
    if (mnemonic === "j" && operands.length === 1 && operands[0] === "ra") mnemonic = "jr";
    /* cc1 prints variable shifts as sll/srl/sra with a register amount; objdump prints sllv/srlv/srav. */
    if ((mnemonic === "sll" || mnemonic === "srl" || mnemonic === "sra") &&
        operands.length === 3 && HARD_REGISTER_NAMES.includes(operands[2])) {
      mnemonic = `${mnemonic}v`;
    }

    operands = operands.map((operand) => {
      const reloc = operand.match(/^%(hi|lo)\((.+)\)$/);
      if (reloc) return `%${reloc[1]}(${canonicalSymbol(reloc[2])})`;
      return canonicalNumbers(operand);
    });

    instructions.push({
      mnemonic,
      canonical: `${mnemonic} ${operands.join(",")}`,
      display: `${mnemonic}${operands.length ? ` ${operands.join(",")}` : ""}`,
    });
  }
  return instructions;
}

/** Normalize one objdump-disassembled target instruction into cc1 token space. */
function targetAsLight(instruction: DisassembledInstruction): LightInstruction {
  let operands = instruction.operands.map((operand) =>
    operand.toLowerCase().replace(/\s+/g, "").replace(/\$/g, ""),
  );
  if (instruction.relocation) {
    const kind = /hi/i.test(instruction.relocation.type) ? "hi" : "lo";
    const symbol = canonicalSymbol(instruction.relocation.symbol);
    operands = operands.map((operand) =>
      /^-?(0x[0-9a-f]+|\d+)(\(.+\))?$/.test(operand)
        ? operand.replace(/^-?(0x[0-9a-f]+|\d+)/, `%${kind}(${symbol})`)
        : operand,
    );
  }
  operands = operands.map((operand) =>
    operand.startsWith("%") ? operand : canonicalNumbers(operand),
  );
  return {
    mnemonic: instruction.mnemonic,
    canonical: `${instruction.mnemonic} ${operands.join(",")}`,
    display: `${instruction.mnemonic}${operands.length ? ` ${operands.join(",")}` : ""}`,
  };
}

/* ----------------------------------------------------------------------- */
/* Variant handling                                                        */
/* ----------------------------------------------------------------------- */

interface VariantResult {
  stem: string;
  source: string;
  status: "exact" | "mismatch" | "compile-error";
  category?: string;
  exact?: number;
  total?: number;
  firstDivergence?: string;
  error?: string;
  targetLight?: LightInstruction[];
  compiledLight?: LightInstruction[];
  targetFull?: DisassembledInstruction[];
  compiledFull?: DisassembledInstruction[];
}

function usage(): never {
  console.error("Usage: npx tsx tools/agent/fuzzVariants.ts <func> <variant.c> [more.c ...] [--cc1-only] [--show <stem>] [--json]");
  console.error("       npx tsx tools/agent/fuzzVariants.ts <func> --dir <dir> [--cc1-only] [--show <stem>] [--json]");
  process.exit(1);
}

function resolveVariants(args: string[]): { funcName: string; variants: string[]; cc1Only: boolean; json: boolean; show?: string } {
  const cc1Only = args.includes("--cc1-only");
  const json = args.includes("--json");
  const showIndex = args.indexOf("--show");
  const show = showIndex >= 0 ? args[showIndex + 1] : undefined;
  const dirIndex = args.indexOf("--dir");
  const flagValues = new Set<string>();
  if (showIndex >= 0) flagValues.add(args[showIndex + 1]);
  if (dirIndex >= 0) flagValues.add(args[dirIndex + 1]);

  const positional = args.filter((arg) => !arg.startsWith("--") && !flagValues.has(arg));
  if (positional.length < 1) usage();
  const funcName = normalizeFunctionName(positional[0]);

  let variants: string[] = [];
  if (dirIndex >= 0) {
    const dir = args[dirIndex + 1];
    const absoluteDir = isAbsolute(dir) ? dir : join(ROOT, dir);
    if (!existsSync(absoluteDir)) {
      console.error(`fuzzVariants: variant directory not found: ${dir}`);
      process.exit(1);
    }
    variants = readdirSync(absoluteDir)
      .filter((file) => file.endsWith(".c"))
      .sort()
      .map((file) => join(absoluteDir, file));
  } else {
    variants = positional.slice(1);
  }
  if (variants.length === 0) usage();

  return { funcName, variants, cc1Only, json, show };
}

function compareLight(target: LightInstruction[], compiled: LightInstruction[]): Pick<VariantResult, "exact" | "total" | "firstDivergence" | "category"> {
  const total = Math.max(target.length, compiled.length);
  let exact = 0;
  let firstDivergence: string | undefined;
  let category: string | undefined;
  for (let index = 0; index < total; index++) {
    const left = target[index];
    const right = compiled[index];
    if (left && right && left.canonical === right.canonical) {
      exact++;
      continue;
    }
    if (!firstDivergence) {
      firstDivergence = `[${index}] ${left?.display ?? "<missing>"}  vs  ${right?.display ?? "<missing>"}`;
      category = !left || !right ? "instruction-selection"
        : left.mnemonic !== right.mnemonic ? "scheduling/selection"
        : "operands";
    }
  }
  return { exact, total, firstDivergence, category: category ?? "exact" };
}

function main(): void {
  const { funcName, variants, cc1Only, json, show } = resolveVariants(process.argv.slice(2));
  const fuzzRoot = join(ROOT, "build/fuzz", funcName);

  /* Resolve the original instructions once. */
  let targetFull: DisassembledInstruction[] | undefined;
  let targetLight: LightInstruction[] | undefined;
  try {
    targetFull = disassembleObject(assembleTarget(funcName, fuzzRoot));
    if (cc1Only) targetLight = targetFull.map(targetAsLight);
  } catch (error: any) {
    console.error(`fuzzVariants: cannot obtain original assembly for ${funcName}: ${error.message}`);
    process.exit(1);
  }

  const results: VariantResult[] = [];
  const seenStems = new Set<string>();
  for (const variant of variants) {
    const absoluteSource = isAbsolute(variant) ? variant : join(ROOT, variant);
    const stem = basename(variant, ".c");
    const result: VariantResult = { stem, source: absoluteSource, status: "mismatch" };
    results.push(result);

    if (seenStems.has(stem)) {
      result.status = "compile-error";
      result.error = `duplicate variant stem "${stem}"; rename one file`;
      continue;
    }
    seenStems.add(stem);

    if (!existsSync(absoluteSource)) {
      result.status = "compile-error";
      result.error = `file not found: ${variant}`;
      continue;
    }

    const outputDir = join(fuzzRoot, stem);
    rmSync(outputDir, { recursive: true, force: true });
    try {
      /* Compile with the TARGET function's stem so its flag overrides apply. */
      const artifacts = compileSource(absoluteSource, outputDir, funcName, { assemble: !cc1Only });

      if (cc1Only) {
        const compiledLight = parseCc1Assembly(artifacts.assembly);
        const comparison = compareLight(targetLight!, compiledLight);
        result.exact = comparison.exact;
        result.total = comparison.total;
        result.category = comparison.category;
        result.firstDivergence = comparison.firstDivergence;
        result.status = comparison.exact === comparison.total ? "exact" : "mismatch";
        result.targetLight = targetLight;
        result.compiledLight = compiledLight;
      } else {
        const compiledFull = disassembleObject(artifacts.object!);
        const report = analyzeInstructionSets(targetFull!, compiledFull);
        result.exact = report.exactMatches;
        result.total = report.targetCount;
        result.category = report.category;
        result.status = report.category === "exact" ? "exact" : "mismatch";
        const first = report.differences[0];
        if (first) {
          result.firstDivergence = `[${first.index}] ${first.target}  vs  ${first.compiled}  (${first.kind})`;
        }
        result.targetFull = targetFull;
        result.compiledFull = compiledFull;
      }
    } catch (error: any) {
      result.status = "compile-error";
      result.error = String(error.message || error).split("\n")[0];
    }
  }

  /* Exact matches first, then by exact-instruction count. */
  const ranked = [...results].sort((a, b) =>
    (b.status === "exact" ? 1 : 0) - (a.status === "exact" ? 1 : 0) ||
    (b.exact ?? -1) - (a.exact ?? -1),
  );

  if (json) {
    console.log(JSON.stringify({
      function: funcName,
      mode: cc1Only ? "cc1-only" : "full",
      targetInstructions: targetFull!.length,
      artifacts: relative(ROOT, fuzzRoot),
      results: ranked.map(({ targetLight: _a, compiledLight: _b, targetFull: _c, compiledFull: _d, ...rest }) => rest),
    }, null, 2));
    return;
  }

  console.log(`Fuzz variants: ${funcName}`);
  console.log(`target: ${targetFull!.length} instructions (archived original assembly)`);
  console.log(`mode:   ${cc1Only ? "cc1-only triage (confirm finalists in full mode)" : "full (cc1 → maspsx → as → objdump)"}`);
  console.log("");
  for (const result of ranked) {
    const score = result.exact !== undefined && result.total !== undefined
      ? `${result.exact}/${result.total}`
      : "—";
    const category = result.status === "compile-error" ? "compile-error" : result.category ?? "?";
    console.log(`${result.stem.padEnd(28)} ${category.padEnd(24)} ${String(score).padEnd(8)} ${result.firstDivergence ?? result.error ?? ""}`);
  }

  const shown = show ? results.find((result) => result.stem === show) : undefined;
  if (show && !shown) {
    console.log(`\n--show: no variant named "${show}"`);
  }
  if (shown && shown.status !== "compile-error") {
    const left = cc1Only ? shown.targetLight! : shown.targetFull!.map(targetAsLight);
    const right = cc1Only ? shown.compiledLight! : shown.compiledFull!.map(targetAsLight);
    console.log(`\n--- ${shown.stem}: target vs compiled ---`);
    const count = Math.max(left.length, right.length);
    for (let index = 0; index < count; index++) {
      const l = left[index]?.display ?? "";
      const r = right[index]?.display ?? "";
      const marker = l === r ? "  " : "* ";
      console.log(`${marker}${String(index).padStart(3)} ${l.padEnd(36)} ${r}`);
    }
  }

  const winners = ranked.filter((result) => result.status === "exact");
  console.log("");
  if (winners.length > 0) {
    for (const winner of winners) console.log(`exact match: ${winner.source}`);
    console.log(`Promote: copy the winner over src/${funcName}.c, then verify with:`);
    console.log(`  npx tsx tools/agent/diffFunc.ts ${funcName} && make check`);
    if (cc1Only) console.log("(cc1-only match — re-run without --cc1-only before promoting.)");
  } else {
    console.log("no exact match among variants");
  }
  console.log("Reminder: read divergences comparatively to name the compiler mechanism;");
  console.log("do not hill-climb match percentages into a shape you cannot explain.");

  if (results.every((result) => result.status === "compile-error")) process.exit(1);
}

main();
