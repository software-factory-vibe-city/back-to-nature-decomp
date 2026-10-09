/** Ledger evidence for the source-induction reading, without another compile. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { readLedger, type LedgerEntry } from "../experimentLedger.js";
import { computeProvenance, staleReason, type Provenance } from "../provenance.js";
import type { LoopTraceResult } from "../loopTrace.js";
import { checkRequirement, classifyCandidate, groupIdentity, type AddressOfSymbol, type PreheaderVerdict } from "./compare.js";
import { EmissionClass } from "./types.js";

export interface AlternativeMeasurement {
  source: string;
  sourceHash: string;
  key: number[];
  exact: boolean | undefined;
}

/** Only measurements of this reading; a residual key alone cannot identify it. */
export function sourceReadingMeasurements(
  current: PreheaderVerdict[], measured: PreheaderVerdict[], entry: LedgerEntry,
): Map<number, AlternativeMeasurement> {
  const result = new Map<number, AlternativeMeasurement>();
  for (const verdict of current) {
    const givIdentities = verdict.groups.filter((group) => group.actual === EmissionClass.Pass1GivInit || group.actual === EmissionClass.Pass2GivInit)
      .map((group) => groupIdentity(group.group));
    if (givIdentities.length === 0) continue;
    const other = measured.find((candidate) => candidate.preheader.block === verdict.preheader.block);
    if (!other?.loop || !givIdentities.every((identity) => other.groups.some((group) => groupIdentity(group.group) === identity
      && group.outcome !== "undetermined" && group.actual === EmissionClass.Source))) continue;
    result.set(verdict.preheader.block, { source: entry.sourcePath ?? entry.source, sourceHash: entry.sourceHash, key: entry.key, exact: entry.exact });
  }
  return result;
}

/** Fresh trace/ledger joins only. Missing or obsolete traces leave the reading open. */
export function alternativeLedgerEvidence(functionName: string, verdicts: PreheaderVerdict[], addressOf: AddressOfSymbol): void {
  if (!verdicts.some((verdict) => verdict.given?.length)) return;
  const directory = join(ROOT, "build/loopTrace", functionName);
  const paths: string[] = [];
  const visit = (path: string): void => {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(join(path, entry.name));
      else if (entry.name === "trace.json") paths.push(join(path, entry.name));
    }
  };
  visit(directory);
  const ledger = readLedger(functionName);
  const found = new Map<number, Map<string, AlternativeMeasurement>>();
  for (const path of paths) {
    try {
      const traced = JSON.parse(readFileSync(path, "utf8")) as LoopTraceResult & { provenance?: Provenance };
      if (!traced.provenance || traced.functionName !== functionName) continue;
      const fresh = computeProvenance(functionName, {
        files: [resolve(ROOT, traced.source), join(ROOT, "configs/flag_overrides.mk")], values: { dump: "-dL" },
        implementation: [join(ROOT, "tools/agent/decompToolchain.ts"), join(ROOT, "tools/agent/loopTrace.ts"), join(ROOT, "tools/agent/loop-trace")],
      });
      if (staleReason(traced.provenance, fresh)) continue;
      const sourceHash = traced.provenance.files[traced.source];
      const row = ledger.find((entry) => entry.sourceHash === sourceHash);
      if (!row) continue;
      const measured = checkRequirement(verdicts.map((verdict) => verdict.preheader), classifyCandidate(traced.trace, addressOf));
      for (const [block, measurement] of sourceReadingMeasurements(verdicts, measured, row)) {
        const entries = found.get(block) ?? new Map<string, AlternativeMeasurement>();
        entries.set(measurement.sourceHash, measurement); found.set(block, entries);
      }
    } catch { /* No attributable measurement, never a refutation of the reading. */ }
  }
  for (const verdict of verdicts) if (verdict.given?.length) {
    verdict.alternativeMeasurements = [...(found.get(verdict.preheader.block)?.values() ?? [])];
  }
}
