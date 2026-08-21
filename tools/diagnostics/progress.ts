/**
 * progress.ts — how much of the project matches, per container and in total.
 *
 * Deliverables 2 and 9 of plans/overlay-decompilation-enablement.md. Two things
 * changed here and both change the number.
 *
 * Liveness is judged over every container. Judged against the PS-X EXE alone it
 * classified 97 overlay-facing engine functions dead and dropped them from the
 * denominator; the rule now lives in tools/lib/liveness.ts, shared with
 * tools/agent/callGraph.ts so the metric and the work queue cannot disagree.
 *
 * And the PS-X EXE is no longer the project. Its game code is roughly a sixth
 * of the target; the thirteen overlay code members hold the rest. A headline
 * that omits them overstates completion by about a factor of six.
 *
 * Usage:
 *   npx tsx tools/diagnostics/progress.ts                    # per container + total
 *   npx tsx tools/diagnostics/progress.ts --container exe    # one container
 *   npx tsx tools/diagnostics/progress.ts --list             # list all functions with status
 *   npx tsx tools/diagnostics/progress.ts --remaining        # only what is left
 *   npx tsx tools/diagnostics/progress.ts --done             # only what matches
 *   npx tsx tools/diagnostics/progress.ts --markdown         # markdown table
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { ROOT } from "../lib/psxExeInfo.js";
import { computeLiveness, isOverlayOnlyReference } from "../lib/liveness.js";
import { containerPath, loadContainers, requireContainer, type Container } from "../lib/container.js";
import { loadFunctionSpans } from "../lib/symbolIndex.js";

const args = process.argv.slice(2);
const showList = args.includes("--list");
const showRemaining = args.includes("--remaining");
const showDone = args.includes("--done");
const showMarkdown = args.includes("--markdown");
const containerIdx = args.indexOf("--container");
const onlyContainer = containerIdx >= 0 ? args[containerIdx + 1] : undefined;

interface FuncInfo {
  container: string;
  name: string;
  vram: string;
  offset: number;
  size: number;
  decompiled: boolean;
  handwritten: false | "asm" | "gte";
  dead: boolean;
  /** Referenced only from overlay members — the engine API this metric used to omit. */
  overlayOnly: boolean;
}

interface ContainerTotals {
  container: Container;
  funcs: FuncInfo[];
  totalFuncs: number;
  decompFuncs: number;
  totalBytes: number;
  decompBytes: number;
}

const liveness = computeLiveness();

function measure(container: Container): ContainerTotals {
  const asmDir = join(containerPath(container, "asmDir"), "nonmatchings");
  const srcDir = containerPath(container, "srcDir");
  const funcs: FuncInfo[] = [];
  let totalFuncs = 0;
  let decompFuncs = 0;
  let totalBytes = 0;
  let decompBytes = 0;

  for (const span of loadFunctionSpans(container)) {
    let decompiled = false;
    let handwritten: false | "asm" | "gte" = false;

    let sFile = join(asmDir, span.name, `${span.name}.s`);
    if (!existsSync(sFile)) {
      const dir = join(asmDir, span.name);
      if (existsSync(dir)) {
        const files = readdirSync(dir).filter((f: string) => f.endsWith(".s"));
        if (files.length === 1) sFile = join(dir, files[0]!);
      }
    }
    if (existsSync(sFile)) {
      const sContent = readFileSync(sFile, "utf-8");
      if (sContent.includes("Handwritten function")) {
        const gtePattern = /\b(cfc2|ctc2|lwc2|swc2|mfc2|mtc2|cop2)\b/;
        handwritten = gtePattern.test(sContent) ? "gte" : "asm";
      }
    }

    if (span.kind === "c" && handwritten !== "asm") {
      const cFile = join(srcDir, `${span.name}.c`);
      if (existsSync(cFile)) {
        const content = readFileSync(cFile, "utf-8");
        const hasIncludeAsm = content.includes("INCLUDE_ASM(") && content.includes(span.name);
        if (!hasIncludeAsm) decompiled = true;
      }
    }

    /* An overlay's own functions are live by construction: the member is loaded
       and run as a unit, and the engine reaches into it through dispatch tables
       this scan cannot see. Only the PS-X EXE's functions are judged. */
    const dead =
      container.kind === "exe" && liveness.referenced.size > 0 && !liveness.referenced.has(span.vram);
    const overlayOnly = container.kind === "exe" && isOverlayOnlyReference(liveness, span.vram);

    if (handwritten === false && !dead) {
      totalFuncs++;
      totalBytes += span.size;
      if (decompiled) {
        decompFuncs++;
        decompBytes += span.size;
      }
    }

    funcs.push({
      container: container.id,
      name: span.name,
      vram: `0x${span.vram.toString(16)}`,
      offset: span.rom,
      size: span.size,
      decompiled,
      handwritten,
      dead,
      overlayOnly,
    });
  }

  return { container, funcs, totalFuncs, decompFuncs, totalBytes, decompBytes };
}

const containers = onlyContainer ? [requireContainer(onlyContainer)] : loadContainers();
const measured = containers.map(measure);

function percent(part: number, whole: number): string {
  return whole > 0 ? ((part / whole) * 100).toFixed(2) : "0.00";
}

function reportContainer(totals: ContainerTotals): void {
  const { container, funcs } = totals;
  const gteCount = funcs.filter((f) => f.handwritten === "gte").length;
  const asmCount = funcs.filter((f) => f.handwritten === "asm").length;
  const deadCount = funcs.filter((f) => f.dead).length;
  const deadBytes = funcs.filter((f) => f.dead).reduce((s, f) => s + f.size, 0);
  const overlayOnlyFuncs = funcs.filter((f) => f.overlayOnly && f.handwritten === false);
  const overlayOnlyDone = overlayOnlyFuncs.filter((f) => f.decompiled).length;

  console.log(
    `${container.id} (${container.kind === "exe" ? "PS-X EXE game code" : `overlay member at 0x${container.loadAddr.toString(16)}`})`
  );
  console.log(
    `  Decompiled: ${totals.decompFuncs} / ${totals.totalFuncs} functions (${percent(totals.decompFuncs, totals.totalFuncs)}%)`
  );
  console.log(
    `  Decompiled: ${totals.decompBytes} / ${totals.totalBytes} bytes (${percent(totals.decompBytes, totals.totalBytes)}%)`
  );
  if (gteCount > 0) console.log(`  GTE functions (C + coprocessor): ${gteCount} (excluded from counts)`);
  if (asmCount > 0) console.log(`  Pure asm: ${asmCount} functions (excluded from counts)`);
  if (deadCount > 0) console.log(`  Dead code: ${deadCount} functions, ${deadBytes} bytes (excluded from counts)`);
  if (overlayOnlyFuncs.length > 0) {
    console.log(
      `  Engine API: ${overlayOnlyDone} / ${overlayOnlyFuncs.length} functions reached only from overlays ` +
        `(counted live; see tools/diagnostics/engineApi.ts)`
    );
  }
}

console.log(`Liveness basis: ${liveness.basis}`);
if (!liveness.overlaysIncluded) {
  console.log("WARNING: overlay evidence unavailable, so this denominator omits the overlay-facing engine API.");
}
console.log();

for (const totals of measured) reportContainer(totals);

if (measured.length > 1) {
  const totalFuncs = measured.reduce((s, m) => s + m.totalFuncs, 0);
  const decompFuncs = measured.reduce((s, m) => s + m.decompFuncs, 0);
  const totalBytes = measured.reduce((s, m) => s + m.totalBytes, 0);
  const decompBytes = measured.reduce((s, m) => s + m.decompBytes, 0);
  console.log();
  console.log(`TOTAL across ${measured.length} containers`);
  console.log(`  Decompiled: ${decompFuncs} / ${totalFuncs} functions (${percent(decompFuncs, totalFuncs)}%)`);
  console.log(`  Decompiled: ${decompBytes} / ${totalBytes} bytes (${percent(decompBytes, totalBytes)}%)`);
}

// Detailed list
if (showList || showRemaining || showDone || showMarkdown) {
  const filtered = measured
    .flatMap((m) => m.funcs)
    .filter((f) => {
      if (f.handwritten === "asm") return false;
      if (showRemaining) return !f.decompiled;
      if (showDone) return f.decompiled;
      return true;
    });

  if (showMarkdown) {
    console.log();
    console.log("| Status | Container | VRAM | Size | Source | ASM |");
    console.log("|--------|-----------|------|------|--------|-----|");
    for (const f of filtered) {
      const container = containers.find((c) => c.id === f.container)!;
      const status = f.dead ? "DEAD" : f.decompiled ? "OK" : f.overlayOnly ? "API" : "";
      const srcPath = `${container.paths.srcDir}/${f.name}.c`;
      const asmPath = `${container.paths.asmDir}/nonmatchings/${f.name}/${f.name}.s`;
      console.log(`| ${status} | ${f.container} | ${f.vram} | ${f.size} | [${f.name}.c](${srcPath}) | [${f.name}.s](${asmPath}) |`);
    }
    console.log();
    console.log(`${filtered.length} functions listed`);
  } else {
    console.log();
    const header = `${"STATUS".padEnd(6)} ${"CONTAINER".padEnd(9)} ${"VRAM".padEnd(12)} ${"SIZE".padStart(6)}  NAME`;
    console.log(header);
    console.log("-".repeat(header.length + 10));
    for (const f of filtered) {
      const status = f.dead ? " DEAD " : f.decompiled ? "  OK  " : f.overlayOnly ? " API  " : "      ";
      console.log(`${status} ${f.container.padEnd(9)} ${f.vram.padEnd(12)} ${f.size.toString().padStart(6)}  ${f.name}`);
    }
    console.log();
    console.log(`${filtered.length} functions listed`);
  }
}

export type { FuncInfo };
