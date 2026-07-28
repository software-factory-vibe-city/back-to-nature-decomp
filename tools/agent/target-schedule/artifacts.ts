import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeStableJson } from "../variant-lab/artifacts.js";
import type { TargetScheduleAnalysis } from "./types.js";

export function writeTargetScheduleArtifacts(directory: string, analysis: TargetScheduleAnalysis, summary: string): void {
  mkdirSync(directory, { recursive: true });
  writeStableJson(join(directory, "analysis.json"), analysis);
  writeStableJson(join(directory, "target.json"), { schemaVersion: 2, function: analysis.function, instructions: analysis.target });
  writeStableJson(join(directory, "candidate.json"), { schemaVersion: 2, function: analysis.function, instructions: analysis.candidate });
  writeStableJson(join(directory, "correspondence.json"), {
    schemaVersion: 2,
    function: analysis.function,
    correspondence: analysis.correspondence,
    registerRoles: analysis.registerRoles,
  });
  writeStableJson(join(directory, "emission-alignment.json"), {
    schemaVersion: 2,
    function: analysis.function,
    alignment: analysis.emissionAlignment,
    links: analysis.machineUidLinks,
  });
  writeStableJson(join(directory, "scheduler-ties.json"), {
    schemaVersion: 2,
    function: analysis.function,
    selections: analysis.schedulerSelections,
    baselineReplay: analysis.baselineReplay,
  });
  writeStableJson(join(directory, "counterfactual-replay.json"), {
    schemaVersion: 2,
    function: analysis.function,
    constraints: analysis.targetOrderConstraints,
    replays: analysis.targetOrderReplays,
    interventionSets: analysis.interventionSets,
  });
  writeFileSync(join(directory, "summary.txt"), summary.endsWith("\n") ? summary : `${summary}\n`);
}
