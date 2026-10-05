/** Frozen known-dependency acceptance, never writes src/ or exports declarations.
 * Exploratory preparations are not inference acceptance. Freeze before running.
 * npx tsx tools/diagnostics/typePropagationAcceptance.ts --freeze | --run
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareFunction, hashFile, hashText, packetIsFresh } from "../agent/prepareFunction.js";
import { ROOT, sourcePathFor, compileSource } from "../agent/decompToolchain.js";
import { requireFunctionLocation, loadFunctionSpans } from "../lib/symbolIndex.js";
import { loadContainers, containerTargetPath } from "../lib/container.js";
import { compareFunction } from "../lib/functionOracle.js";
import { definitionPrototype, sdkPrototypes, prototypesIn, type Prototype } from "../agent/calleeTruth.js";
import { inspectType, slotsWithTypedefs } from "../agent/type-propagation/c-types.js";
import type { EvidenceGraph, Propagation, Fact } from "../agent/type-propagation/model.js";
import type { SeedRecord } from "../agent/type-propagation/seeds.js";
import type { PreparationPacket } from "../agent/campaign/packet.js";
import { parseC, field } from "../agent/residual-source-search/tree-sitter-c.js";

interface Expectation { kind: "call" | "type-chain" | "type-at-call" | "indirect-stack"; at?: string; target?: string; node?: string; slot?: number; type?: string; seed?: string; via?: string }
interface Member { name: string; withhold: string[]; controlSeed: string; expected: Expectation[] }
interface Plan { version: number; cohort: Member[]; smoke: string[]; required: unknown }
interface Freeze { version: 1; planHash: string; roots: Record<string, { sourceHash: string; targetHash: string; baseline: string }>;
  permittedSeeds: string[]; seedHashes: Record<string, string> }
const PLAN = "configs/static-decompilation/type-propagation-acceptance.json";
const DIRECTORY = "build/type-propagation/acceptance";
const FROZEN = `${DIRECTORY}/frozen.json`;
function plan(): Plan { return JSON.parse(readFileSync(join(ROOT, PLAN), "utf8")); }

export function freezeAcceptance(): Freeze {
  if (existsSync(join(ROOT, FROZEN))) throw new Error("Frozen acceptance already exists; preserve it. Drift is a failure, not an automatic re-freeze.");
  mkdirSync(join(ROOT, DIRECTORY), { recursive: true });
  const spec = plan(), roots: Freeze["roots"] = {};
  for (const member of spec.cohort) {
    const location = requireFunctionLocation(member.name), source = sourcePathFor(member.name);
    const compiled = compileSource(source, join(ROOT, DIRECTORY, "baseline", member.name), member.name, { assemble: true, containerKind: location.container.kind });
    const baseline = compareFunction(member.name, { objectPath: compiled.object!, container: location.container });
    if (baseline.verdict !== "match") throw new Error(`${member.name}: reference baseline is ${baseline.verdict}`);
    const path = join(DIRECTORY, "baseline", `${member.name}.json`); writeFileSync(join(ROOT, path), JSON.stringify(baseline, null, 2));
    roots[member.name] = { sourceHash: hashFile(source), targetHash: hashFile(containerTargetPath(location.container)), baseline: path };
  }
  /* Freeze the permissible independent contracts before observing preparations.
     The root's defining C is evaluation-only and withheld from inference. */
  const permittedSeeds: string[] = [], seedHashes: Record<string, string> = {};
  for (const prototype of sdkPrototypes().values()) {
    permittedSeeds.push(prototype.name); seedHashes[prototype.name] = hashText(JSON.stringify(prototype) + hashFile(join(ROOT, prototype.where)));
  }
  for (const container of loadContainers()) for (const span of loadFunctionSpans(container)) {
    const prototype = definitionPrototype(span.name); if (!prototype) continue;
    permittedSeeds.push(span.name); seedHashes[span.name] = hashText(JSON.stringify(prototype) + hashFile(sourcePathFor(span.name)));
  }
  const frozen: Freeze = { version: 1, planHash: hashFile(join(ROOT, PLAN)), roots, permittedSeeds: [...new Set(permittedSeeds)].sort(), seedHashes };
  writeFileSync(join(ROOT, FROZEN), JSON.stringify(frozen, null, 2)); return frozen;
}
function legacySlotProjection(prototype: Prototype): Prototype {
  let incomplete = false;
  const slots = (prototype.paramTypes ?? []).map((type, i) => {
    const tree = parseC(`void M2C_legacy(${type});`);
    try {
      const parameter = tree.rootNode.descendantsOfType("parameter_declaration")[0];
      const base = parameter ? field(parameter, "type") : null;
      if (base && (base.text === "signed" || base.text === "unsigned") && !inspectType(type).pointer) incomplete = true;
      return incomplete ? null : prototype.slots?.[i] ?? null;
    } finally { tree.delete(); }
  });
  return { ...prototype, slots };
}
function checkExpected(graph: EvidenceGraph, propagation: Propagation, expected: Expectation): { expected: Expectation; met: boolean; facts: string[]; reason?: string } {
  const root = graph.nodes.find((n) => n.id === graph.root)!;
  const call = expected.at ? root?.calls.find((c) => c.at === Number(expected.at)) : undefined;
  if (expected.kind === "call") return { expected, met: !!call?.targets.includes(expected.target!), facts: call ? [call.id] : [] };
  if (expected.kind === "indirect-stack") return { expected, met: !!call && call.kind === "indirect" && call.args[expected.slot!] !== undefined && call.args[expected.slot!] !== null, facts: call ? [call.id, `ABI ${expected.slot}: v${call.args[expected.slot!]}`] : [] };
  const node = graph.nodes.find((n) => n.id === (expected.node ?? graph.root));
  const value = expected.kind === "type-chain" ? node?.slots.find((s) => s.slot === expected.slot)?.value : call?.args[expected.slot!];
  const facts = propagation.facts.filter((f) => f.endpoint.function === node?.id && f.endpoint.value === value && f.constraint.kind === "type-use" &&
    inspectType(f.constraint.type).key === inspectType(expected.type!).key && f.seed.includes(expected.seed!));
  const chain = (fact: Fact): boolean => {
    if (!expected.via) return true;
    const seen = new Set<string>();
    while (fact.via && !seen.has(fact.id)) {
      seen.add(fact.id);
      if (fact.endpoint.function === expected.via) return true;
      const parent = propagation.facts.find((f) => f.id === fact.via!.parent); if (!parent) return false; fact = parent;
    }
    return fact.endpoint.function === expected.via;
  };
  const selected = facts.filter(chain);
  return { expected, met: selected.length > 0, facts: selected.map((f) => f.id), ...(selected.length ? {} : { reason: "expected independent seed-to-value provenance chain did not reach this fact" }) };
}
function artifacts(packet: PreparationPacket): { graph: EvidenceGraph; propagation: Propagation & { seeds: SeedRecord[] } } {
  const p = packet.discovery.propagation!;
  return { graph: JSON.parse(readFileSync(join(ROOT, p.graph), "utf8")), propagation: JSON.parse(readFileSync(join(ROOT, p.report), "utf8")) };
}

export async function runAcceptance(): Promise<unknown> {
  const frozen: Freeze = JSON.parse(readFileSync(join(ROOT, FROZEN), "utf8")), spec = plan();
  if (hashFile(join(ROOT, PLAN)) !== frozen.planHash) throw new Error("Expected-fact manifest drift");
  const sdk = sdkPrototypes(), frozenProjectionCompatibility: string[] = [];
  for (const name of frozen.permittedSeeds) {
    const prototype = sdk.get(name) ?? definitionPrototype(name);
    if (!prototype) throw new Error(`Dependent contract drift: ${name}`);
    const sourceHash = hashFile(sdk.has(name) ? join(ROOT, prototype.where) : sourcePathFor(name));
    if (hashText(JSON.stringify(prototype) + sourceHash) !== frozen.seedHashes[name]) {
      /* Version-1 freezes included an inherited ABI projection bug: implicit
         signed/unsigned int stopped slot numbering. Accept ONLY the exact old
         digest, with unchanged declaration spelling and original file hash.
         Expected facts, permitted seeds, source and target hashes stay frozen. */
      if (hashText(JSON.stringify(legacySlotProjection(prototype)) + sourceHash) !== frozen.seedHashes[name]) throw new Error(`Dependent contract drift: ${name}`);
      frozenProjectionCompatibility.push(name);
    }
  }
  const names = [...new Set([...spec.cohort.map((m) => m.name), ...spec.smoke])];
  const before = Object.fromEntries(names.map((name) => [name, hashFile(sourcePathFor(name))]));
  const rows: unknown[] = [], measured = new Map<string, { packet: PreparationPacket; path: string }>();
  for (const member of spec.cohort) {
    const location = requireFunctionLocation(member.name);
    if (hashFile(sourcePathFor(member.name)) !== frozen.roots[member.name]!.sourceHash || hashFile(containerTargetPath(location.container)) !== frozen.roots[member.name]!.targetHash) throw new Error(`Frozen reference drift: ${member.name}`);
    const inferenceView = { withhold: member.withhold, permittedSeeds: frozen.permittedSeeds };
    const result = await prepareFunction(member.name, { alternative: true, inferenceView }); measured.set(member.name, result);
    const { graph, propagation } = artifacts(result.packet);
    const expected = member.expected.map((e) => checkExpected(graph, propagation, e));
    const control = await prepareFunction(member.name, { alternative: true, inferenceView: { ...inferenceView, disableSeeds: [member.controlSeed] } });
    const controlArtifacts = artifacts(control.packet);
    const resumed = await prepareFunction(member.name, { alternative: true, inferenceView });
    const restoredArtifacts = artifacts(resumed.packet);
    const controlled = member.expected.filter((e) => e.seed === member.controlSeed).map((e) => ({ expected: e,
      absentWithoutSeed: !checkExpected(controlArtifacts.graph, controlArtifacts.propagation, e).met,
      restored: checkExpected(restoredArtifacts.graph, restoredArtifacts.propagation, e).met }));
    const raw = result.packet.generation.raw ? readFileSync(join(ROOT, result.packet.generation.raw), "utf8") : "";
    const tree = parseC(raw), rawHasParseErrors = tree.rootNode.hasError;
    const definition = prototypesIn(raw, "raw-output").find((p) => p.name === member.name && p.kind === "definition");
    const emittedSlots = slotsWithTypedefs(definition?.paramTypes ?? [], raw);
    const root = graph.nodes.find((n) => n.id === graph.root)!;
    const requiredSlots = root.slots.filter((s) => s.used).map((s) => s.slot);
    const slotFloor = emittedSlots.length ? Math.max(...emittedSlots.filter((s): s is number => s !== null)) + 1 : 0;
    const abiSlotsPreserved = !!definition && requiredSlots.every((s) => s < slotFloor);
    const stackCallsPreserved = member.expected.filter((e) => e.kind === "indirect-stack").every((e) => tree.rootNode.descendantsOfType("call_expression")
      .some((call) => (field(call, "arguments")?.namedChildCount ?? 0) > e.slot!));
    tree.delete();
    const preflight = result.packet.discovery.preflight.map((c) => JSON.parse(readFileSync(c.stdout, "utf8")) as { findings?: Array<{ detector: string; severity: string; summary: string }> });
    const declarationBlockers = preflight.flatMap((p) => p.findings ?? []).filter((f) => f.severity === "blocker" && (f.detector.includes("callee") || f.detector.includes("arity")));
    rows.push({ name: member.name, packet: result.path, control: control.path, heldOut: [member.name, ...member.withhold], expected, controlled,
      inputRefreshes: result.path !== control.path, restoredPreparationSame: resumed.path === result.path, restoredPreparationFresh: packetIsFresh(resumed.packet),
      graphCoverage: result.packet.discovery.propagation, admittedSeeds: propagation.seeds, unresolved: propagation.unresolved,
      rawHasParseErrors, abiSlotsPreserved, requiredSlots, emittedSlots, stackCallsPreserved, declarationBlockers, generation: result.packet.generation.status, compilation: result.packet.compilation.status, bytes: result.packet.comparison.status,
      residual: result.packet.comparison.residual ?? null, handoffBytes: readFileSync(join(ROOT, dirname(result.path), "handoff.md")).length,
      pass: result.path !== control.path && packetIsFresh(resumed.packet) && expected.every((e) => e.met) && controlled.every((c) => c.absentWithoutSeed && c.restored) && result.packet.compilation.status === "succeeded" && !rawHasParseErrors && abiSlotsPreserved && stackCallsPreserved && !declarationBlockers.length && !!result.packet.comparison.report,
      blockers: result.packet.integration.blockers });
    writeFileSync(join(ROOT, DIRECTORY, "progress.json"), JSON.stringify(rows, null, 2));
  }
  const smoke = [];
  for (const name of spec.smoke) {
    const result = measured.get(name) ?? await prepareFunction(name, { alternative: true, inferenceView: { permittedSeeds: frozen.permittedSeeds } });
    smoke.push({ name, packet: result.path, graphCoverage: result.packet.discovery.propagation, generation: result.packet.generation.status,
      compilation: result.packet.compilation.status, bytes: result.packet.comparison.status, blockers: result.packet.integration.blockers,
      handoffBytes: readFileSync(join(ROOT, dirname(result.path), "handoff.md")).length });
  }
  const normal = await prepareFunction(spec.cohort[3]!.name);
  const unchanged = names.every((name) => before[name] === hashFile(sourcePathFor(name)));
  const report = { frozen: FROZEN, frozenProjectionCompatibility, cohort: rows, smoke, liveSourcesUnchanged: unchanged, liveSourceHashes: before,
    normalResumePrimary: normal.packet.primary?.origin, normalResumeGeneration: normal.packet.generation.status };
  writeFileSync(join(ROOT, DIRECTORY, "report.json"), JSON.stringify(report, null, 2)); return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--freeze")) console.log(JSON.stringify(freezeAcceptance(), null, 2));
  else if (process.argv.includes("--run")) {
    const report = await runAcceptance(); console.log(JSON.stringify(report, null, 2));
    const checked = report as { cohort: Array<{ pass: boolean }>; liveSourcesUnchanged: boolean; normalResumePrimary: string };
    if (!checked.cohort.every((r) => r.pass) || !checked.liveSourcesUnchanged || checked.normalResumePrimary !== "existing-attempt") process.exitCode = 1;
  } else throw new Error("Choose --freeze or --run (never changes live C)");
}
