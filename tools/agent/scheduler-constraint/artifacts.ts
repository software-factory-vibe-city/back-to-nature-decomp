import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { projectPath, sha256, stableJson, writeStableJson } from "../variant-lab/artifacts.js";
import type { SchedulerSourceHandoff } from "./handoff.js";
import type { SchedulerConstraintInput, SchedulerConstraintResult } from "./types.js";

export function schedulerConstraintRunId(input: SchedulerConstraintInput): string {
  return sha256(stableJson(input)).slice(0, 16);
}

export function writeSchedulerConstraintArtifacts(
  directory: string,
  input: SchedulerConstraintInput,
  result: SchedulerConstraintResult,
  summary: string,
  handoff?: SchedulerSourceHandoff,
): void {
  mkdirSync(directory, { recursive: true });
  writeStableJson(join(directory, "input.json"), input);
  writeStableJson(join(directory, "model.json"), input.model);
  writeStableJson(join(directory, "domain.json"), input.domain);
  writeStableJson(join(directory, "assertion.json"), input.assertion);
  writeStableJson(join(directory, "result.json"), result);
  writeStableJson(join(directory, "model-replay.json"), result.modelReplay);
  if (result.witness) writeStableJson(join(directory, "witness.json"), result.witness);
  if (result.unsatCertificate) writeStableJson(join(directory, "unsat-certificate.json"), result.unsatCertificate);
  if (handoff) {
    writeStableJson(join(directory, "source-synthesis-plan.json"), handoff.plan);
    writeStableJson(join(directory, "source-search-spec.json"), handoff.searchSpec);
    writeStableJson(join(directory, "source-handoff.json"), { evidence: handoff.evidence, plan: "source-synthesis-plan.json", searchSpec: "source-search-spec.json" });
  }
  writeStableJson(join(directory, "manifest.json"), {
    schemaVersion: 1,
    function: input.model.function,
    stage: input.model.stage,
    block: input.model.block,
    inputHash: sha256(stableJson(input)),
    status: result.status,
    deterministicReplay: `npx tsx tools/agent/searchSchedulerState.ts --input ${projectPath(join(directory, "input.json"))}`,
    files: [
      "input.json", "model.json", "domain.json", "assertion.json", "result.json", "model-replay.json", "summary.txt", "solver.log",
      ...(result.witness ? ["witness.json"] : []),
      ...(result.unsatCertificate ? ["unsat-certificate.json"] : []),
      ...(handoff ? ["source-synthesis-plan.json", "source-search-spec.json", "source-handoff.json"] : []),
    ],
  });
  writeFileSync(join(directory, "summary.txt"), summary.endsWith("\n") ? summary : `${summary}\n`);
  const log = [
    `status=${result.status}`,
    `baseline=${result.modelReplay.matchedSelections}/${result.modelReplay.totalSelections}`,
    `assignments=${result.exploredAssignments}`,
    `structures=${result.structuralAlternatives}`,
    `inputHash=${sha256(stableJson(input))}`,
    result.witness ? `witnessPhantoms=${result.witness.phantoms.length}` : "witness=none",
    result.unsatCertificate ? `exhaustive=${result.unsatCertificate.exhaustive}` : "",
  ].filter(Boolean).join("\n");
  writeFileSync(join(directory, "solver.log"), `${log}\n`);
}
