/** CLI + project adapter for the pure web-partition extractors.
 * Target-only needs original bytes/configs, never source or cc1. Candidate runs
 * retain fresh RTL dumps, hashes and effective flags under build/webPartition.
 * --audit reports pins; it never edits source, grants policy or retires a pin.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { compileSource, resolveSource, ROOT, configuredCompilerPath } from "../agent/decompToolchain.js";
import { compareFunction, type Verdict, type RenderedWord } from "../lib/functionOracle.js";
import { unpinDeclarations } from "./webPartitionAudit.js";
import { matchingConstructs, type MatchingConstructs } from "../agent/cSourceGuard.js";
import { requireFunctionLocation, loadSymbolIndex, loadFunctionSpans } from "../lib/symbolIndex.js";
import { containerTargetPath, loadContainers, vramToRom } from "../lib/container.js";
import { loadMacroTextRanges } from "./macroCoverage.js";
import { extractWebPartition, type WebPartition } from "./webPartition.js";
import { extractCandidatePartition, type CandidatePartition } from "./candidateWebPartition.js";
import { diffWebPartitions, renderWebDiff, type PartitionDiff } from "./webPartitionDiff.js";
import type { ResidualObjective } from "../agent/pipeline-reversal/objective.js";
const hash = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
export interface OracleEvidence {
  sameWords: number; totalWords: number; targetWords: number; candidateWords: number;
  /** Positional words at the same original address, NOT an LCS edit distance. */
  differences: Array<{ address: number; target: RenderedWord | null; candidate: RenderedWord | null }>;
  undeterminedWords: number;
}
export interface FingerprintReport {
  schemaVersion: 1; functionName: string; status: "target-only" | "compared" | "undetermined-relocations";
  target: WebPartition; candidate: CandidatePartition | null; diff: PartitionDiff | null; oracleVerdict: Verdict | null;
  oracleEvidence: OracleEvidence | null;
  provenance: { source: string | null; sourceHash: string | null; object: string | null; compilerHash: string | null; flags: string[]; dumpHashes: Record<string, string> };
  sourceConstructs: MatchingConstructs | null;
  reportArtifact: string | null;
  caveats: string[];
}
export interface PinProbe {
  status: "compared" | "unavailable";
  removedBindings: number;
  source: string;
  report: FingerprintReport | null;
  reason: string | null;
}
function context(name: string) {
  const location = requireFunctionLocation(name);
  const index = loadSymbolIndex(location.container);
  return { ...location, symbols: index.byAddress, addresses: new Map([...index.byAddress].map(([address, name]) => [name, address])) };
}
export function targetWebPartition(name: string): WebPartition {
  const ctx = context(name), { container, span } = ctx;
  const image = readFileSync(containerTargetPath(container)), rom = vramToRom(container, span.vram);
  if (rom < container.payloadOffset || rom + span.size > image.length || span.size <= 0 || span.size % 4) throw new Error("Invalid/truncated target function extent");
  const ranges = loadMacroTextRanges(container, false);
  if (!ranges.some(r => r.startOffset <= rom && rom + span.size <= r.endOffset)) throw new Error("Function extent outside configured text; refusing data-as-code web analysis");
  return extractWebPartition({ functionName: name, bytes: image.subarray(rom, rom + span.size), vram: span.vram, gp: container.gpValue, symbols: ctx.symbols });
}
export function fingerprintWebPartition(name: string, options: { source?: string; targetOnly?: boolean; outputDirectory?: string } = {}): FingerprintReport {
  const target = targetWebPartition(name);
  const report: FingerprintReport = { schemaVersion: 1, functionName: name, status: "target-only", target, candidate: null, diff: null, oracleVerdict: null, oracleEvidence: null, provenance: { source: null, sourceHash: null, object: null, compilerHash: null, flags: [], dumpHashes: {} }, sourceConstructs: null, reportArtifact: null, caveats: [] };
  if (options.targetOnly) return report;
  const source = resolveSource(name, options.source), sourceText = readFileSync(source, "utf8"), sourceHash = hash(sourceText);
  report.sourceConstructs = matchingConstructs(sourceText);
  const directory = options.outputDirectory ?? join(ROOT, "build/webPartition", name, sourceHash.slice(0, 16));
  mkdirSync(directory, { recursive: true });
  const artifacts = compileSource(source, directory, name, { dumps: true, assemble: true });
  const ctx = context(name), oracle = compareFunction(name, { objectPath: artifacts.object!, container: ctx.container });
  report.oracleVerdict = oracle.verdict;
  const length = Math.max(oracle.targetWords.length, oracle.candidateWords.length);
  report.oracleEvidence = { sameWords: oracle.same, totalWords: length, targetWords: oracle.targetWords.length, candidateWords: oracle.candidateWords.length, undeterminedWords: oracle.undetermined.length, differences: [] };
  for (let i = 0; i < length; i++) {
    const target = oracle.targetWords[i] ?? null, candidate = oracle.candidateWords[i] ?? null;
    if (target && candidate && !candidate.undetermined && target.raw === candidate.raw) continue;
    report.oracleEvidence.differences.push({ address: target?.vram ?? candidate!.vram, target, candidate });
  }
  report.provenance = { source, sourceHash, object: artifacts.object!, compilerHash: hash(readFileSync(configuredCompilerPath())), flags: artifacts.cc1Flags, dumpHashes: { preprocessed: hash(readFileSync(join(directory, `${name}.i`))) } };
  if (oracle.candidateWords.some(w => w.undetermined)) {
    report.status = "undetermined-relocations";
    report.caveats.push("Unresolved candidate relocations: no web directives emitted from guessed words.");
  } else {
    const buffer = Buffer.alloc(oracle.candidateWords.length * 4);
    oracle.candidateWords.forEach((w, i) => buffer.writeUInt32LE(w.raw >>> 0, i * 4));
    const observed = extractWebPartition({ functionName: name, bytes: buffer, vram: ctx.span.vram, side: "candidate", gp: ctx.container.gpValue, symbols: ctx.symbols });
    const dumps = { rtl: "", lreg: "", greg: "" };
    for (const stage of ["rtl", "lreg", "greg"] as const) {
      dumps[stage] = readFileSync(join(directory, `${name}.i.${stage}`), "utf8"); report.provenance.dumpHashes[stage] = hash(dumps[stage]);
    }
    report.candidate = extractCandidatePartition(observed, dumps, ctx.addresses);
    report.diff = diffWebPartitions(target, report.candidate);
    report.status = "compared";
  }
  report.reportArtifact = join(directory, "report.json");
  writeFileSync(report.reportArtifact, JSON.stringify(report, null, 2) + "\n");
  return report;
}
/** A byte-matched pinned source has no residual to diagnose. Test whether
 * the bindings themselves are still needed, rather than presenting its empty
 * diff as useful advice. This stages a separate AST-erased candidate only. */
export function probeRegisterPins(baseline: FingerprintReport): PinProbe | null {
  const source = baseline.provenance.source;
  if (!source || !baseline.sourceConstructs?.localRegisterBindings.length) return null;
  const directory = join(ROOT, "build/webPartition", baseline.functionName, baseline.provenance.sourceHash!.slice(0, 16), "pin-probe");
  const path = join(directory, "pin-erased.c");
  try {
    const sourceText = readFileSync(source, "utf8");
    if (hash(sourceText) !== baseline.provenance.sourceHash) throw new Error("Source changed after baseline measurement; refusing a stale pin probe");
    const variant = unpinDeclarations(sourceText);
    mkdirSync(directory, { recursive: true }); writeFileSync(path, variant.source);
    const report = fingerprintWebPartition(baseline.functionName, { source: path, outputDirectory: join(directory, "trace") });
    return { status: "compared", removedBindings: variant.removed, source: path, report, reason: null };
  } catch (error) { return { status: "unavailable", removedBindings: 0, source: path, report: null, reason: String(error) }; }
}

function renderOracleEvidence(report: FingerprintReport): string[] {
  const e = report.oracleEvidence;
  if (!e) return [];
  const lines = [`${e.sameWords}/${e.totalWords} oracle-aligned words identical; ${e.differences.length} same-address word difference(s)${e.undeterminedWords ? `; ${e.undeterminedWords} unresolved word(s)` : ""}.`];
  for (const d of e.differences.slice(0, 8)) lines.push(`  0x${d.address.toString(16)}: target ${d.target?.text ?? "<absent>"} | candidate ${d.candidate?.text ?? "<absent>"}${d.candidate?.undetermined ? ` [undetermined: ${d.candidate.undetermined}]` : ""}`);
  if (e.differences.length > 8) lines.push(`  ${e.differences.length - 8} further same-address differences retained in JSON (not a source-distance metric).`);
  return lines;
}
export function renderFingerprint(report: FingerprintReport, probe: PinProbe | null = null): string[] {
  const relativePath = (path: string): string => path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path;
  const lines = [`${report.functionName}: ${report.status}, ${report.target.webs.length} target web(s)`];
  if (report.provenance.source) lines.push(`Source: ${relativePath(report.provenance.source)}`, `Oracle: ${report.oracleVerdict?.toUpperCase() ?? "UNDETERMINED"}`, ...renderOracleEvidence(report));
  const constructs = report.sourceConstructs;
  if (constructs) {
    lines.push(`Source constructs: ${constructs.localRegisterBindings.length} local register binding(s), ${constructs.fileRegisterBindings.length} file-scope binding(s), ${constructs.otherAsm.length} other direct asm construct(s).`);
    for (const b of constructs.localRegisterBindings) lines.push(`  line ${b.line}: ${b.name} ${b.binding}`);
    for (const b of constructs.fileRegisterBindings) lines.push(`  line ${b.line}: file-scope ${b.name} ${b.binding} — TU/static-chain context; not erased.`);
    if (report.oracleVerdict === "match" && (constructs.localRegisterBindings.length || constructs.fileRegisterBindings.length)) lines.push("The pinned source already matches. Its empty web diff does NOT test whether the pins are necessary.");
  }
  if (report.diff) {
    lines.push(...renderWebDiff(report.diff));
    if (!report.diff.facts.length && !report.diff.assignments.length && !report.diff.exactObservedPartition) lines.push(...report.diff.undetermined.slice(0, 6).map(u => `  ${u.identity}: ${u.reason}`));
  } else for (const w of report.target.webs) lines.push(`  ${w.id} ${w.residences[0]!.register} [${w.birth},${w.death}] ${w.identity?.description ?? "undetermined"}; reads=${w.readCount}, weighted-estimate=${w.estimatedWeightedReferences}`);
  if (probe) {
    lines.push("", "PIN-REMOVAL PROBE (build/ candidate only)");
    if (!probe.report) lines.push(`  Unavailable: ${probe.reason}`);
    else {
      const r = probe.report, remaining = r.sourceConstructs!;
      lines.push(`  Removed ${probe.removedBindings} local binding(s). Oracle: ${r.oracleVerdict?.toUpperCase() ?? "UNDETERMINED"}.`, ...renderOracleEvidence(r).map(s => `  ${s}`), `  Candidate: ${relativePath(probe.source)}`);
      if (r.oracleVerdict === "match") {
        lines.push("  These local pins are unnecessary for THIS candidate under the current flags.");
        if (remaining.otherAsm.length || remaining.fileRegisterBindings.length) lines.push(`  NOT fully clean C: ${remaining.otherAsm.length} direct asm construct(s) and ${remaining.fileRegisterBindings.length} file-scope binding(s) remain. Their exceptions are not retired by this probe.`);
        lines.push("  No live source or allowlist was changed. Review the candidate, then verify before retiring the local bindings.");
      } else {
        lines.push("  Erasing these bindings did not produce a byte-exact candidate; no pin retirement is established.");
        if (r.diff) lines.push(...renderWebDiff(r.diff).map(s => `  ${s}`));
        if (!r.diff?.facts.length) lines.push("  No source lever is proven by this extraction; this result is not an impossibility proof.");
        if (r.diff?.assignments.length) lines.push(`  Focused next command: npx tsx tools/agent/inspectLocalAllocationVariant.ts ${r.functionName} ${relativePath(probe.source)}`);
      }
      if (r.reportArtifact) lines.push(`  Probe report: ${relativePath(r.reportArtifact)}`);
    }
  } else if (constructs?.localRegisterBindings.length) lines.push(`Pin probe: npm run web-partition -- ${report.functionName} --probe-pins`);
  if (report.diff?.assignments.length && report.provenance.source) lines.push(`Focused next command: npx tsx tools/agent/inspectLocalAllocationVariant.ts ${report.functionName} ${relativePath(report.provenance.source)}`);
  if (report.oracleVerdict === "match" && !probe) lines.push(`To diagnose a failing C attempt: npm run web-partition -- ${report.functionName} --src <attempt.c>`);
  if (report.reportArtifact) lines.push(`Report: ${relativePath(report.reportArtifact)}`);
  lines.push(...report.caveats.map(s => `  ${s}`));
  return lines;
}

export function allocationDominant(o: ResidualObjective): boolean {
  return !o.exact && !o.degraded && o.undetermined === 0 && o.controlFlow === 0 && o.population === 0 && o.allocation > 0 && o.allocation > o.schedule;
}
export function pinAuditNames(config: { sourcePolicy?: { allowlist?: Record<string, string[]> } }): string[] {
  const names = Object.keys(config.sourcePolicy?.allowlist ?? {}).filter(n => n.startsWith("ovl_11_") && config.sourcePolicy!.allowlist![n]!.includes("register-asm"));
  names.push("func_80020e38", "func_80021820");
  // Canonical address casing, then require the configured function extent.
  return [...new Set(names)].map(n => requireFunctionLocation(n.replace(/[a-f0-9]{8}$/, s => s.toUpperCase())).span.name).sort();
}
function main(): void {
  const args = process.argv.slice(2);
  let name: string | undefined, source: string | undefined, json = false, audit = false, targetOnly = false, probePins = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--json") json = true;
    else if (a === "--target-only") targetOnly = true;
    else if (a === "--probe-pins") probePins = true;
    else if (a === "--audit") audit = true;
    else if (a === "--src") { source = args[++i]; if (!source) throw new Error("--src needs a file"); }
    else if (a === "--help") { console.log("Usage: npx tsx tools/diagnostics/fingerprintWebPartition.ts <function> [--src file.c] [--target-only] [--probe-pins] [--json]\n       Matched pinned live sources automatically get a local pin-removal probe.\n       --audit [--json] (configured ovl_11 pins plus two grandfathered EXE pins)"); return; }
    else if (a.startsWith("--") || name) throw new Error(`Unexpected argument ${a}`);
    else name = a;
  }
  if (audit) {
    if (name || source || targetOnly || probePins) throw new Error("--audit does not take a function, source, --target-only or --probe-pins");
    const names = pinAuditNames(JSON.parse(readFileSync(join(ROOT, ".pi/autoloop.json"), "utf8")));
    const rows = names.map(functionName => {
      try {
        const source = resolveSource(functionName), variant = unpinDeclarations(readFileSync(source, "utf8"));
        const path = join(ROOT, "build/webPartition/pin-audit", functionName, "pin-erased.c");
        mkdirSync(join(ROOT, "build/webPartition/pin-audit", functionName), { recursive: true });
        writeFileSync(path, variant.source);
        const report = fingerprintWebPartition(functionName, { source: path });
        return { functionName, source: path, removedBindings: variant.removed, remainingDirectAsm: report.sourceConstructs?.otherAsm.length ?? null, remainingFileBindings: report.sourceConstructs?.fileRegisterBindings.length ?? null, status: report.status, oracleVerdict: report.oracleVerdict, oracleEvidence: report.oracleEvidence, reportArtifact: report.reportArtifact, facts: report.diff?.facts ?? [], assignments: report.diff?.assignments ?? [], undetermined: report.diff?.undetermined.length ?? 0, retirement: variant.removed === 0 ? "no-local-binding-erased" : report.oracleVerdict === "match" ? "exact-pin-erased-candidate-unintegrated" : "no-exact-pin-erased-candidate" };
      }
      catch (error) { return { functionName, status: "unavailable", reason: String(error), retirement: "not-attempted" }; }
    });
    const artifact = join(ROOT, "build/webPartition/pin-audit.json"); mkdirSync(join(ROOT, "build/webPartition"), { recursive: true }); writeFileSync(artifact, JSON.stringify(rows, null, 2) + "\n");
    console.log(json ? JSON.stringify(rows, null, 2) : rows.map(r => {
      if (!("facts" in r)) return `${r.functionName}: ${r.status} — ${r.reason}`;
      const words = r.oracleEvidence ? `${r.oracleEvidence.sameWords}/${r.oracleEvidence.totalWords}` : "unknown";
      const first = r.facts[0], assignments = r.assignments ?? [];
      const detail = first ? `${first.class} ${first.identity} [${first.confidence}]: ${first.evidence[0]} TRY (hypothesis): ${first.directive.text}`
        : assignments.length ? assignments.map(a => {
          const overlap = !a.pseudo ? "dump correspondence undetermined" : a.overlaps.length ? `${a.overlaps.length} reconstructed hard-register overlap(s)` : "no overlap reconstructed (not proof the register was free)";
          const order = a.overlaps.flatMap(o => o.requiredRelation ? [`UID ${o.requiredRelation.beforeUid} before UID ${o.requiredRelation.afterUid} in pre-allocation RTL`] : []).join("; ");
          return `${a.description}: $${a.targetRegister} -> $${a.candidateRegister}, ${overlap}; allocation, not web spelling${order ? `; experiment: ${order}` : ""}`;
        }).join("; ")
        : "No proven spelling lever.";
      const debt = r.remainingDirectAsm || r.remainingFileBindings ? ` Remaining debt: ${r.remainingDirectAsm} direct asm, ${r.remainingFileBindings} file-scope bindings.` : "";
      return `${r.functionName}: ${r.oracleVerdict?.toUpperCase()}, ${words} words; ${r.removedBindings} local pin(s) erased; ${r.retirement}\n  ${detail}${debt}`;
    }).join("\n") + `\n${artifact}`); return;
  }
  if (!name) throw new Error("Missing function (see --help)");
  if (targetOnly && probePins) throw new Error("--probe-pins requires a candidate, not --target-only");
  try { requireFunctionLocation(name); }
  catch {
    const distance = (a: string, b: string): number => {
      let row = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 0; i < a.length; i++) { const next = [i + 1]; for (let j = 0; j < b.length; j++) next.push(Math.min(next[j]! + 1, row[j + 1]! + 1, row[j]! + (a[i] === b[j] ? 0 : 1))); row = next; }
      return row[b.length]!;
    };
    const near = loadContainers().flatMap(c => loadFunctionSpans(c).map(s => s.name)).map(n => ({ name: n, distance: distance(name!.toLowerCase(), n.toLowerCase()) })).filter(n => n.distance <= 2).sort((a,b) => a.distance - b.distance || a.name.localeCompare(b.name)).slice(0, 3);
    throw new Error(`Unknown function: ${name}${near.length ? `. Did you mean ${near.map(n => n.name).join(", ")}?` : " (use the exact configured symbol)"}`);
  }
  const report = fingerprintWebPartition(name, { ...(source ? { source } : {}), targetOnly });
  const probe = !targetOnly && (probePins || (!source && report.oracleVerdict === "match")) ? probeRegisterPins(report) : null;
  if (json) console.log(JSON.stringify({ ...report, pinProbe: probe }, null, 2));
  else console.log(renderFingerprint(report, probe).join("\n"));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`webPartition: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; }
}
