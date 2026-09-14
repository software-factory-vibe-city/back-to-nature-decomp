/**
 * machineIr.ts — the CFG / SSA / region view of one function's original words.
 *
 * What it answers that the relation-shaped route cannot: *what shape is this
 * function*, for a function whose paths multiply faster than its code does.
 * A scan with twenty guards has a million paths and twenty blocks; a
 * path-shaped model pays the first number and a graph-shaped one pays the
 * second, and every size this prints is the second.
 *
 * It reads target-side artifacts only — the container image, splat configs and
 * symbol tables — so it works on a bare `INCLUDE_ASM` stub with no seed and no
 * C of its own. It constructs nothing and compiles nothing: the product is the
 * representation, and the constructors are separate.
 *
 * Read it when a function is refused for a control-shaped reason (a state or
 * step budget, a decision depth, a nested loop), when you need to know where
 * the loops and their exits are before writing a body, or when you want to see
 * which instructions are outside the model and what the recovery did around
 * them.
 *
 * Usage:
 *   npx tsx tools/agent/machineIr.ts <functionName>            # sizes, CFG, structure
 *   npx tsx tools/agent/machineIr.ts <functionName> --values   # with the SSA listing
 *   npx tsx tools/agent/machineIr.ts <functionName> --json
 */

import { buildMachineIr, renderMachineIr } from "./machine-ir/index.js";

function main(): void {
  const args = process.argv.slice(2);
  const functionName = args.find((arg) => !arg.startsWith("--"));
  if (!functionName) {
    console.error("usage: npx tsx tools/agent/machineIr.ts <functionName> [--values] [--json]");
    process.exit(2);
  }

  let report;
  try {
    report = buildMachineIr(functionName);
  } catch (error) {
    console.error(`${functionName}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (args.includes("--json")) {
    /* The IR itself is large and mostly numeric; the JSON view carries the
     * sizes, the structure and the unmodelled list, which is what a consumer
     * decides on. */
    console.log(JSON.stringify({
      functionName: report.functionName,
      containerId: report.containerId,
      vram: report.vram,
      sizeBytes: report.sizeBytes,
      size: report.size,
      blocks: report.ir.cfg.blocks.map((block) => ({
        index: block.index,
        vram: block.vram,
        instructions: block.instructions.length,
        terminator: block.terminator,
        successors: block.successors,
      })),
      loops: report.regions.loops.map((loop) => ({
        header: loop.header,
        latches: loop.latches,
        body: [...loop.body].sort((a, b) => a - b),
        exits: loop.exits,
        depth: loop.depth,
      })),
      irreducible: report.regions.irreducible,
      sharedTails: report.regions.sharedTails,
      notes: report.regions.notes,
      unmodelled: report.unmodelled,
    }, null, 2));
    return;
  }

  console.log(renderMachineIr(report, { values: args.includes("--values") }).join("\n"));
}

if (process.argv[1]?.endsWith("machineIr.ts")) main();
