import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeStableJson } from "../variant-lab/artifacts.js";
import type { ScheduleMechanismDelta, ScheduleMechanismProfile } from "./profile-types.js";

export function renderScheduleProfileDelta(
  profile: ScheduleMechanismProfile,
  delta?: ScheduleMechanismDelta,
): string {
  const lines = [
    `Schedule mechanism profile: ${profile.function} / ${profile.variantId}`,
    `trace bundle: ${profile.traceBundleHash}`,
    `baseline replay: ${profile.baselineReplay.map((item) => `${item.stage}/b${item.block}:${item.status}`).join(", ") || "none"}`,
    `target replay: ${profile.targetOrder.map((item) => `${item.stage}/b${item.block}:${item.status}${item.bestSupportedInterventionCount === undefined ? "" : `(${item.bestSupportedInterventionCount})`}`).join(", ") || "none"}`,
  ];
  if (delta) {
    lines.push(`delta: ${delta.verdict}${delta.finalAssemblyEquivalent ? " (assembly-equivalent)" : ""}`);
    for (const reason of delta.reasons) lines.push(`  - ${reason}`);
    for (const change of [...delta.preservationChanges, ...delta.replayChanges, ...delta.allocationChanges, ...delta.delaySlotChanges]) {
      lines.push(`  - ${change}`);
    }
  }
  return lines.join("\n");
}

export function writeScheduleProfileArtifacts(
  directory: string,
  profile: ScheduleMechanismProfile,
  delta?: ScheduleMechanismDelta,
): void {
  mkdirSync(directory, { recursive: true });
  writeStableJson(join(directory, "profile.json"), profile);
  if (delta) writeStableJson(join(directory, "delta.json"), delta);
  writeFileSync(join(directory, "profile-summary.txt"), `${renderScheduleProfileDelta(profile, delta)}\n`);
}
