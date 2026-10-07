import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { prepareM2c } from "../build/prepareM2c.js";
import { validateVariantSource } from "./variant-lab/manifest.js";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { recordedCommand, commandText, type CommandRecord } from "../lib/recordedCommand.js";
import { requireFunctionLocation, loadSymbolIndex, withSymbolMetadata } from "../lib/symbolIndex.js";
import { Timings, digest, snapshot, readCache, writeCache } from "../lib/contentCache.js";
import { cachedPreprocess, withPreprocessorMetadata } from "./preprocessedCache.js";
import { containerTargetPath, loadContainers, type Container } from "../lib/container.js";
import { compareFunction } from "../lib/functionOracle.js";
import { ROOT, configuredCppFlags, configuredCompilerPath, configuredMaspsxFlags, configuredAsFlagsForContainer,
  configuredCc1FlagsForContainer, configuredToolchainIdentity, loadFlagOverrides,
  resolveAsmSource, sourceDependencyFiles, rejectionFromDiagnostics } from "./decompToolchain.js";
import { analyzeCSource } from "./cSourceGuard.js";
import { extractSignaturesFromSource } from "./sdkTypes.js";
import { sdkPrototypes, scopeFromPreprocessed, targetWitness, contradictionsAgainst, prototypesIn } from "./calleeTruth.js";
import { emptyDeclarationIndex, indexDeclarations, globalViews, projectDeclarations, type Declaration } from "./declarationContext.js";
import { namedChildren, parseC } from "./residual-source-search/tree-sitter-c.js";
import { renameTypeTokens } from "./scopedTypes.js";
import { auditM2cArithmetic } from "./m2cLimits.js";
import { discoverStatic, selectDataDefinitions } from "./staticDiscovery.js";
import { packetOpening, packetEvidence, type PreparationPacket, type UnknownFact } from "./campaign/packet.js";
import { buildEvidenceGraph } from "./type-propagation/graph.js";
import { seedOracle } from "./type-propagation/seeds.js";
import { propagate, inferenceInput } from "./type-propagation/solve.js";
import { originalAssembly } from "./type-propagation/assembly.js";
import { unspecifiedParameters, layoutFields } from "./type-propagation/c-types.js";
import { injectStaticChain, verifyChainInjection } from "./staticChainInjection.js";
import type { ChainRow } from "../diagnostics/nestedFunctionScan.js";

export const hashText = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
export const hashFile = (path: string) => existsSync(path) ? hashText(readFileSync(path)) : "absent";
export function packetIsFresh(packet: PreparationPacket, root = ROOT): boolean {
  try {
    if (packet.schemaVersion !== 1) return false;
    return Object.entries(packet.identity.memberships ?? {}).every(([path, members]) =>
      JSON.stringify(allFiles(join(root, path)).map((p) => relative(root, p)).sort()) === JSON.stringify(members)) &&
      Object.entries(packet.identity.inputs).every(([path, hash]) => hashFile(join(root, path)) === hash) &&
      (!packet.primary || hashFile(join(root, packet.primary.path)) === packet.primary.sha256) &&
      JSON.stringify(packet.identity.tools) === JSON.stringify(configuredToolchainIdentity()) &&
      [packet.compilation.preprocessed, packet.compilation.assembly, packet.compilation.object].every((a) => !a || hashFile(join(root, a.path)) === a.sha256) &&
      (!packet.generation.raw || !packet.generation.rawHash || hashFile(join(root, packet.generation.raw)) === packet.generation.rawHash);
  } catch { return false; } /* malformed/interrupted packets are never fresh */
}
function savePacket(root: string, directory: string, packet: PreparationPacket): void {
  const path = join(directory, "packet.json");
  writeFileSync(`${path}.tmp`, JSON.stringify(packet, null, 2) + "\n"); renameSync(`${path}.tmp`, path);
  writeFileSync(join(directory, "handoff.md"), packetOpening(packet, relative(root, path)) + "\n");
  writeFileSync(join(directory, "evidence.md"), packetEvidence(packet) + "\n");
  writeFileSync(join(directory, "diagnostics.txt"), packet.compilation.diagnostics + "\n");
  writeFileSync(join(directory, "discovery.json"), JSON.stringify(packet.discovery.report, null, 2) + "\n");
}
function allFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((e) => e.isDirectory() ?
    allFiles(join(root, e.name)) : [join(root, e.name)]);
}
function unknown(subject: string, missing: string, evidence: string[], strength: UnknownFact["strength"] = "unknown"): UnknownFact {
  return { subject, strength, constraints: [], evidence, missing, attempted: "faithful context projection",
    bound: "one target, selected callee scopes and transitive declarations", stoppedBecause: missing, inspectNext: evidence };
}

/** Safe staging only: never publish declarations, guess a type, or repair a body.
 * This is the library used by the CLI, interactive command, and both controllers.
 */
interface PreflightReport { macroIdentity: PreparationPacket["discovery"]["macroIdentity"]; findings?: Array<{ severity: string; summary?: string }> }
interface PreparationOptions { root?: string; signal?: AbortSignal; alternative?: boolean; contextFile?: string;
  inferenceView?: { withhold?: string[]; disableSeeds?: string[]; permittedSeeds?: string[]; disableTransfers?: boolean } }
export function prepareFunction(functionName: string, options: PreparationOptions = {}): Promise<{ packet: PreparationPacket; path: string }> {
  return withSymbolMetadata(() => withPreprocessorMetadata(() => prepareFunctionInView(functionName, options)));
}
async function prepareFunctionInView(functionName: string, options: PreparationOptions): Promise<{ packet: PreparationPacket; path: string }> {
  const timings = new Timings();
  options.signal?.throwIfAborted();
  const root = options.root ?? ROOT;
  const discoveryStart = performance.now();
  const location = requireFunctionLocation(functionName);
  const container = location.container;
  const destination = join(container.paths.srcDir, `${functionName}.c`);
  const originalDirectory = join(root, "build/preparation/originals", functionName, hashFile(containerTargetPath(container)));
  mkdirSync(originalDirectory, { recursive: true });
  const original = originalAssembly(functionName, originalDirectory);
  const assembly = original.path;
  const source = readFileSync(join(root, destination), "utf8");
  const guard = analyzeCSource(source);
  const definitions = extractSignaturesFromSource(source);
  const existing = definitions.some((d) => d.name === functionName) && !guard.includeAsm.some((s) => s.symbol === functionName);
  const asmText = readFileSync(assembly, "utf8");
  const jtables = [...new Set([...asmText.matchAll(/\bjtbl_[\w]+/g)].map((m) => m[0]))];
  const referenced = [...new Set([...asmText.matchAll(/\b(?:D_[A-Fa-f0-9]{8}|ovl_\d+_D_[A-Fa-f0-9]{8})\b/g)].map((m) => m[0]))];
  const data = allFiles(join(root, container.paths.asmDir, "data")).filter((p) => p.endsWith(".s") &&
    [...jtables, ...referenced].some((s) => new RegExp(`\\b(?:dlabel|glabel)\\s+${s}\\b`).test(readFileSync(p, "utf8"))));
  const inputs: Record<string, string> = {};
  const ledger = join(root, "build/experimentLedger", `${functionName}.jsonl`);
  const input = (path: string) => { const key = relative(root, path); inputs[key] = hashFile(path); };
  /* Complete declaration/config/decompiler sources, plus actual transitive compile inputs.
     Deliberately content hashes: timestamp and Git HEAD are not input identities. */
  for (const path of [assembly, join(root, destination), containerTargetPath(container), join(root, "Makefile"),
    ...loadContainers().map(containerTargetPath), ...original.inputs,
    ...allFiles(join(root, "configs")), ...allFiles(join(root, "include")), ...allFiles(join(root, "src")),
    ...allFiles(join(root, "tools/vendor/m2c/m2c")).filter((p) => p.endsWith(".py")),
    ...allFiles(join(root, "tools/vendor/m2c/m2c_pycparser")).filter((p) => p.endsWith(".py")),
    ...allFiles(join(root, "tools/vendor/maspsx/maspsx")).filter((p) => p.endsWith(".py")),
    ...allFiles(join(root, "tools/vendor/tree-sitter-c")),
    ...allFiles(join(root, "tools/diagnostics")).filter((p) => /\/macro[^/]*\.ts$/.test(p) && !p.endsWith(".test.ts")),
    join(root, "tools/diagnostics/nestedFunctionScan.ts"),
    join(root, ".pi/autoloop.json"), join(root, ".pi/extensions/shared/source-policy.ts"), join(root, ".pi/extensions/shared/types.ts"),
    join(root, "tools/build/prepareM2c.ts"), join(root, "package-lock.json"),
    ...["web-tree-sitter.js", "web-tree-sitter.wasm"].map((p) => join(root, "node_modules/web-tree-sitter", p)),
    join(root, "tools/vendor/m2c/m2c.py"), ...["tools/agent", "tools/lib"].flatMap((p) => allFiles(join(root, p))).filter((p) => p.endsWith(".ts") && !p.endsWith(".test.ts")),
    ...data, ...[container.paths.splat, container.paths.symbolAddrs, container.paths.undefinedFuncs, container.paths.undefinedSyms,
      container.paths.ldScript, container.paths.functionsCsv, container.paths.sectionLayout, "build/engine_syms.txt", "build/callGraph.json"].map((p) => join(root, p))]) input(path);
  for (const path of sourceDependencyFiles(join(root, destination))) input(path);
  const m2c = prepareM2c(root);
  for (const path of [...m2c.identity.inputs, ...m2c.sources]) input(path);
  const tools = configuredToolchainIdentity();
  input(join(root, tools.compiler.path)); input(join(root, tools.assemblerShim.path));
  for (const command of ["python3", "mips-linux-gnu-cpp", "mips-linux-gnu-as", "mips-linux-gnu-objdump"]) {
    input(execFileSync("which", [command], { cwd: root, encoding: "utf8" }).trim());
  }
  input(process.execPath);
  const flags = [...configuredCc1FlagsForContainer(container.kind), ...(loadFlagOverrides().get(functionName) ?? [])];
  if (options.contextFile) input(join(root, options.contextFile));
  const memberships = Object.fromEntries(["src", "include", "configs", ...loadContainers().map((c) => c.paths.asmDir)]
    .map((p) => [p, allFiles(join(root, p)).map((f) => relative(root, f)).sort()]));
  const fingerprint = hashText(JSON.stringify({ inputs, memberships, tools, flags, alternative: options.alternative ?? false, inferenceView: options.inferenceView ?? {} }));
  timings.phases.push({ phase: "discovery-fingerprinting", durationMs: performance.now() - discoveryStart });
  const baseDirectory = join(root, "build/preparation", functionName, fingerprint);
  let directory = baseDirectory;
  let packetPath = join(directory, "packet.json");
  type DraftContinuation = Pick<PreparationPacket, "primary" | "generation">;
  type Latest = { packet: string; continuation?: DraftContinuation };
  let resumedDraft: DraftContinuation | undefined;
  const latestPath = join(root, "build/preparation", functionName, `latest-${hashText(JSON.stringify(options.inferenceView ?? {}))}.json`);
  if (!existing && !options.alternative && existsSync(latestPath)) {
    try {
      const latest = readCache<Latest>(latestPath, "latest");
      if (!latest) throw new Error("interrupted latest index");
      let prior = latest.continuation;
      try { prior = JSON.parse(readFileSync(join(root, latest.packet), "utf8")) as PreparationPacket; }
      catch { /* the checksummed continuation preserves edits through a broken packet */ }
      if (!prior) throw new Error("no surviving draft metadata");
      if (prior.primary?.origin === "m2c" && hashFile(join(root, prior.primary.path)) !== (prior.generation.draftHash ?? prior.primary.sha256) && existsSync(join(root, prior.primary.path))) {
        const text = readFileSync(join(root, prior.primary.path), "utf8");
        resumedDraft = { ...prior, generation: { ...prior.generation, draftHash: prior.generation.draftHash ?? prior.primary.sha256 },
          primary: { ...prior.primary, text, sha256: hashText(text) } };
      }
    } catch { /* interrupted indexes are misses; original drafts are untouched */ }
  }
  mkdirSync(dirname(baseDirectory), { recursive: true });
  for (let retry = 1; ; retry++) {
    if (!existsSync(directory)) {
      try { mkdirSync(directory); break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
    }
    let packet: PreparationPacket | undefined;
    try { if (existsSync(packetPath)) packet = JSON.parse(readFileSync(packetPath, "utf8")) as PreparationPacket; }
    catch { /* interrupted publication owns this directory; retry elsewhere */ }
    if (packet && !packetIsFresh(packet, root)) {
      /* Cache repair uses a new directory. Preserve user edits as the primary
         candidate, rather than replacing them with regenerated m2c output. */
      if (packet.primary?.origin === "m2c" && existsSync(join(root, packet.primary.path))) {
        const text = readFileSync(join(root, packet.primary.path), "utf8");
        resumedDraft = { ...packet, generation: { ...packet.generation, draftHash: packet.generation.draftHash ?? packet.primary.sha256 },
          primary: { ...packet.primary, text, sha256: hashText(text) } };
      }
      directory = join(baseDirectory, `retry-${retry}`); packetPath = join(directory, "packet.json");
      continue;
    }
    if (packet) {
      const commands = [...packet.compilation.commands, ...packet.discovery.preflight, ...(packet.generation.command ? [packet.generation.command] : [])];
      if (packet.preparationState !== "running" && !commands.some((c) => c.cancelled || c.timedOut)) {
        if (packet.diagnosticsIdentity !== hashFile(ledger)) {
          const refresh = await recordedCommand("npx", ["tsx", "tools/agent/triage.ts", functionName, "--src", packet.primary?.path ?? destination, "--prepared", relative(root, packetPath), "--json"],
            root, directory, `refresh-${Date.now()}-triage`, options.signal, 120_000, false);
          packet.discovery.preflight.push(refresh);
          if (refresh.status !== 0) packet.integration.blockers.push("refreshed mandatory preflight failed");
          else {
            const report = JSON.parse(readFileSync(refresh.stdout, "utf8")) as PreflightReport;
            packet.discovery.macroIdentity = report.macroIdentity ?? null;
            for (const f of report.findings ?? []) if (f.severity === "blocker") packet.integration.blockers.push(f.summary ?? JSON.stringify(f));
          }
          packet.diagnosticsIdentity = hashFile(ledger);
        }
        packet.performance = { phases: timings.phases, totalMs: timings.totalMs, cache: "hit", reason: "generation/analysis inputs unchanged; ledger diagnostics checked separately" };
        savePacket(root, directory, packet);
        return { packet, path: relative(root, packetPath) };
      }
      if (packet.primary?.origin === "m2c") resumedDraft = packet;
    }
    /* A crashed/concurrent attempt owns its files, even without a final packet. */
    directory = join(baseDirectory, `retry-${retry}`); packetPath = join(directory, "packet.json");
  }
  const packet: PreparationPacket = {
    schemaVersion: 1, preparationState: "running", identity: { functionName, container: container.id, destination, assembly: relative(root, assembly),
      data: data.map((p) => relative(root, p)), inputs, memberships, fingerprint, tools, flags }, primary: existing && !options.alternative ? {
      origin: "existing-attempt", path: destination, sha256: hashText(source), text: source, declarationsRequired: [],
    } : null,
    context: { index: emptyDeclarationIndex(), projection: "", excluded: [], unknown: [], headers: ["common.h"] },
    generation: { status: "not-attempted" }, compilation: { status: "not-attempted", commands: [], diagnostics: "" },
    comparison: { status: "not-available" }, integration: { state: existing && !options.alternative ? "live" : "staged", changes: [destination], blockers: [], destinationHash: hashText(source) },
    discovery: { unknowns: [], report: null, priorExperiments: [], preflight: [] }, finalization: { status: "not-attempted" },
  };
  let sequence = 0;
  const command = (exe: string, args: string[], label: string, cwd = root, timeout = 120_000) =>
    /* The outer preparation command owns the group; nested commands must
       stay in it so cancellation also stops a currently running compiler. */
    timings.measure(label, () => recordedCommand(exe, args, cwd, directory, `${sequence++}-${label}`, options.signal, timeout, false));
  const indexPreprocessed = (text: string, scope: string) => {
    const preprocessed = scopeFromPreprocessed(text);
    const tree = parseC(preprocessed.source);
    try {
      for (const node of namedChildren(tree.rootNode)) {
        const origin = preprocessed.lineOf(node.startPosition.row).file;
        const isHeader = origin.endsWith(".h");
        indexDeclarations(packet.context.index, node.text, origin, isHeader ? "public" : scope, isHeader ? "public-header" : "source-local");
      }
    } finally { tree.delete(); }
  };
  const preprocess = async (path: string, scope: string) => {
    options.signal?.throwIfAborted();
    try {
      const bundle = timings.measureSync("context-cpp", () => cachedPreprocess(path, root));
      for (const dep of bundle.dependencies) input(dep);
      timings.phases.push({ phase: "context-cpp-cache", durationMs: 0, cache: bundle.cache, reason: "source, include and search identity" });
      indexPreprocessed(bundle.text, scope);
    } catch (error) { packet.integration.blockers.push(`Context preprocessing failed: ${path}: ${String(error)}`); }
  };
  savePacket(root, directory, packet);
  try {
    if (options.signal?.aborted) throw new Error("Preparation cancelled");
    if (packet.primary) await timings.measure("existing-source-measurement", () => measurePreparation(packet, root, directory, container, command));
    const heldOut = [...new Set([functionName, ...(options.inferenceView?.withhold ?? []), ...(options.inferenceView?.disableSeeds ?? [])])];
    const seeds = seedOracle(join(directory, "seeds"), heldOut, options.inferenceView?.permittedSeeds);
    const analysisKey = hashText(JSON.stringify({ functionName, heldOut, view: options.inferenceView ?? {}, inputs: Object.fromEntries(Object.entries(inputs)
      .filter(([p]) => !p.startsWith("src/"))),
      sourceMembership: allFiles(join(root, "src")).map((p) => relative(root, p)).sort(),
      asmMembership: loadContainers().map((c) => allFiles(join(root, c.paths.asmDir)).filter((p) => p.endsWith(".s")).sort()) }));
    type Analysis = { graph: ReturnType<typeof buildEvidenceGraph>; propagation: ReturnType<typeof propagate>;
      observed: Record<string, string>; seeds: typeof seeds.records };
    const analysisPath = join(root, "build/cache/preparation-analysis", functionName, `${hashText(JSON.stringify(options.inferenceView ?? {}))}.json`);
    const cachedAnalysis = readCache<Analysis>(analysisPath, analysisKey);
    let analysisHit = !!cachedAnalysis && Object.entries(cachedAnalysis.observed).every(([p, hash]) => hashFile(join(root, p)) === hash);
    if (analysisHit) {
      for (const record of cachedAnalysis!.seeds) seeds.get(record.name);
      const contracts = (records: typeof seeds.records) => records.map(({ name, status, prototype }) => ({ name, status, prototype }));
      analysisHit = JSON.stringify(contracts(seeds.records)) === JSON.stringify(contracts(cachedAnalysis!.seeds));
    }
    const evidenceGraph = analysisHit ? cachedAnalysis!.graph : timings.measureSync("dependency-graph", () =>
      buildEvidenceGraph(functionName, { seed: seeds.get, ...(options.signal ? { signal: options.signal } : {}) }));
    for (const path of evidenceGraph.inputs) input(path);
    if (options.inferenceView?.disableTransfers) evidenceGraph.relations = [];
    const propagation = analysisHit ? cachedAnalysis!.propagation : timings.measureSync("type-propagation", () => propagate(evidenceGraph, seeds.get));
    if (!analysisHit && !options.signal?.aborted) {
      const observed: Record<string, string> = {};
      for (const record of seeds.records) {
        let source: string;
        try { const loc = requireFunctionLocation(record.name); source = join(root, loc.container.paths.srcDir, `${record.name}.c`); }
        catch { continue; }
        observed[relative(root, source)] = hashFile(source);
        if (!existsSync(source)) for (const p of allFiles(dirname(source)).filter((p) => p.endsWith(".c"))) observed[relative(root, p)] = hashFile(p);
        const bundle = seeds.bundle(record.name);
        if (bundle) Object.assign(observed, bundle.inputs);
      }
      for (const p of evidenceGraph.inputs) observed[relative(root, p)] = hashFile(p);
      writeCache(analysisPath, analysisKey, { graph: evidenceGraph, propagation, observed, seeds: structuredClone(seeds.records) } satisfies Analysis);
    }
    timings.phases.push(...seeds.timings, { phase: "analysis-cache", durationMs: 0, cache: analysisHit ? "hit" : "miss",
      reason: analysisHit ? "original analysis and observed declaration inputs unchanged" : "absent, corrupt, discovery membership or relevant declaration change" });
    const inference = inferenceInput(evidenceGraph, propagation);
    const graphPath = join(directory, "type-graph.json"), propagationPath = join(directory, "propagation.json"), constraintsPath = join(directory, "inference.json");
    writeFileSync(graphPath, JSON.stringify(evidenceGraph, null, 2));
    writeFileSync(propagationPath, JSON.stringify({ ...propagation, seeds: seeds.records, inferenceView: options.inferenceView ?? {}, heldOut }, null, 2));
    packet.discovery.propagation = { graph: relative(root, graphPath), report: relative(root, propagationPath), input: relative(root, constraintsPath),
      graphComplete: evidenceGraph.indexComplete && !evidenceGraph.frontier.length, convergence: propagation.status,
      visited: evidenceGraph.nodes.length, facts: propagation.facts.length, steps: propagation.steps };
    for (const conflict of propagation.conflicts) packet.discovery.unknowns.push(unknown(conflict.endpoint,
      "incompatible uncast type-use representations; a conversion or separate storage view is required, not a blanket source-type equality", [relative(root, propagationPath), ...conflict.facts], "conditional"));
    for (const unresolved of propagation.unresolved.filter((u) => u.node === evidenceGraph.root)) {
      const item = unknown(`${unresolved.node}:ABI ${unresolved.slot}`, unresolved.reason, [relative(root, propagationPath), relative(root, graphPath)], unresolved.outcome === "unsupported" ? "unsupported" : "unknown");
      item.bound = `${evidenceGraph.nodes.length}/${evidenceGraph.bounds.functions} original functions; ${propagation.steps}/${evidenceGraph.bounds.propagationSteps} propagation steps; graph coverage and convergence are separate`;
      item.stoppedBecause = unresolved.outcome;
      packet.discovery.unknowns.push(item);
    }
    packet.discovery.report = discoverStatic(functionName, root, evidenceGraph);
    packet.discovery.unknowns.push(...(packet.discovery.report as ReturnType<typeof discoverStatic>).unknowns);
    const symbolIndex = loadSymbolIndex(container);
    const discovery = packet.discovery.report as ReturnType<typeof discoverStatic>;
    for (const access of discovery.accesses.filter((a) => a.functionName === functionName && a.originalStorage)) {
      const item = unknown(access.originalStorage!.symbol, "original byte-offset storage access; retain the base/offset even when another alias names the destination", access.evidence, "witnessed");
      item.constraints = [`${access.access} ${access.width} bytes at +0x${access.originalStorage!.offset.toString(16)}`, JSON.stringify(access.originalStorage)];
      packet.discovery.unknowns.push(item);
    }
    const callbacks = [...new Set(discovery.callbackTables.flatMap((t) => t.entries.map((e) => e.functionName)))];
    const calls = [...new Set([...asmText.matchAll(/\bjal\s+([A-Za-z_]\w*)/g)].map((m) => m[1]!).concat(callbacks,
      evidenceGraph.nodes.flatMap((n) => n.calls.flatMap((c) => c.targets.map((t) => t.split(":").slice(1).join(":"))))))];
    const sdk = sdkPrototypes();
    const baseContext = join(directory, "headers.c");
    const headers = ["common.h", "game_types.h", "psyq/stddef.h", "psyq/libgte.h", ...calls.flatMap((c) => sdk.has(c) ? [sdk.get(c)!.where.replace(/^include\//, "")] : [])]
      .filter((h) => existsSync(join(root, "include", h)));
    packet.context.headers = [...new Set(headers)];
    writeFileSync(baseContext, packet.context.headers.map((h) => `#include "${h}"`).join("\n") + "\n");
    await preprocess(baseContext, "preparation");
    if (options.contextFile) await preprocess(join(root, options.contextFile), "public");
    const viewModel = globalViews(readFileSync(join(root, "include/globals_override.h"), "utf8"), "include/globals_override.h");
    const generatedViews = globalViews(readFileSync(join(root, "include/globals.h"), "utf8"), "include/globals.h");
    packet.context.index.views = [...viewModel.views, ...generatedViews.views];
    for (const view of packet.context.index.views) indexDeclarations(packet.context.index, view.declaration, view.origin, "public", "public-header");
    for (const u of [...viewModel.unsupported, ...generatedViews.unsupported]) {
      if (referenced.some((r) => u.text.includes(r))) packet.discovery.unknowns.push(unknown(u.text, u.reason, [u.origin], "unsupported"));
    }
    const projectionNames = [...referenced.filter((r) => !discovery.callbackTables.some((t) => t.symbol === r)), ...calls.filter((c) => sdk.has(c)),
      ...discovery.accesses.filter((a) => a.functionName === functionName && a.base.startsWith("storage:")).map((a) => a.base.split(":").at(-1)!)];
    const projections: string[] = [];
    const wrapperTypes: string[] = [];
    const requiredDeclarations: Declaration[] = [];
    const scopeRenames = new Map<string, Map<string, string>>();
    for (const callee of [...new Set([...(existing && !options.alternative ? [functionName] : []), ...calls])]) {
      const contract = heldOut.includes(callee) ? undefined : seeds.get(callee);
      const definition = contract?.kind === "definition" ? contract : undefined;
      const witness = callbacks.includes(callee) ? targetWitness(callee, join(directory, "witnesses")) : undefined;
      for (const table of discovery.callbackTables) for (const entry of table.entries.filter((e) => e.functionName === callee)) {
        const prototype = definition ?? sdk.get(callee);
        if (prototype) entry.prototype = prototype;
        if (witness) entry.witness = witness;
        entry.evidence.push(...[definition?.where, sdk.get(callee)?.where, witness?.where,
          resolveAsmSource(callee), join(requireFunctionLocation(callee).container.paths.srcDir, `${callee}.c`)].filter((p): p is string => !!p));
      }
      if (definition) {
        const path = join(root, definition.where); input(path);
        for (const dep of sourceDependencyFiles(path)) input(dep);
        const bundle = seeds.bundle(callee);
        if (bundle) indexPreprocessed(bundle.preprocessed, definition.where);
        else await preprocess(path, definition.where);
        const projected = projectDeclarations(packet.context.index, [callee], definition.where);
        const privateTypes = projected.selected.filter((d) => d.visibility === "source-local" && d.kind === "type");
        requiredDeclarations.push(...privateTypes);
        const scopeId = hashText(definition.where).slice(0, 12);
        const renames = new Map(privateTypes.map((d) => [d.name.replace(/^(struct|union) /, ""), `M2C_${scopeId}_${d.name.replace(/^(struct|union) /, "")}`]));
        scopeRenames.set(definition.where, renames);
        const projection = definition.usedParameters?.some((used) => !used) ? unspecifiedParameters(projected.text, callee) : projected.text;
        projections.push(renameTypeTokens(projection, renames)); packet.context.unknown.push(...projected.unknown);
        if (privateTypes.length) {
          const privateProjection = projectDeclarations(packet.context.index, privateTypes.map((d) => d.name), definition.where, { omitPublicTypes: true });
          wrapperTypes.push(renameTypeTokens(privateProjection.text, renames));
        }
        if (sdk.has(callee)) {
          const disagreements = contradictionsAgainst(definition, { kind: "sdk", where: sdk.get(callee)!.where, prototype: sdk.get(callee)! }, true);
          for (const d of disagreements) packet.discovery.unknowns.push(unknown(callee, d.message, [definition.where, sdk.get(callee)!.where], "conflict"));
        }
        if (witness) for (const d of contradictionsAgainst(definition, witness, true)) packet.discovery.unknowns.push(unknown(callee, d.message, [definition.where, witness.where], "conflict"));
      } else if (!sdk.has(callee)) {
        const callback = discovery.callbackTables.find((t) => t.entries.some((e) => e.functionName === callee));
        const item = unknown(callee, "complete source signature unavailable; ABI facts are bounds, not a prototype",
          [callback?.evidence, resolveAsmSource(callee), join(requireFunctionLocation(callee).container.paths.srcDir, `${callee}.c`), witness?.where].filter((p): p is string => !!p));
        item.constraints = witness ? [JSON.stringify(witness)] : []; packet.discovery.unknowns.push(item);
      }
    }
    /* Retain public views of each selected storage type, without replacing its
       declaration or pretending that the view is the complete object layout. */
    for (const name of referenced) {
      const object = packet.context.index.declarations.find((d) => d.name === name && d.scope === "public" && d.kind === "object");
      if (!object) continue;
      const tree = parseC(object.text);
      const tags = tree.rootNode.descendantsOfType("struct_specifier").map((n) => n.childForFieldName("name")?.text).filter(Boolean);
      tree.delete();
      const accesses = discovery.accesses.filter((a) => a.functionName === functionName && a.originalStorage?.symbol === name);
      for (const declaration of packet.context.index.declarations) {
        if (declaration.kind !== "type" || !tags.some((tag) => declaration.name.startsWith(`struct ${tag}_`))) continue;
        const tree = parseC(declaration.text);
        const body = tree.rootNode.descendantsOfType("field_declaration_list")[0];
        let text = body?.text.slice(1, -1) ?? "";
        /* The existing layout helper takes decimal fixed dimensions. Convert
           numeric AST tokens only, not text inside comments or identifiers. */
        for (const literal of (body?.descendantsOfType("number_literal") ?? []).sort((a, b) => b.startIndex - a.startIndex)) {
          const value = Number(literal.text);
          if (Number.isSafeInteger(value)) {
            const start = literal.startIndex - body!.startIndex - 1;
            text = text.slice(0, start) + value + text.slice(start + literal.text.length);
          }
        }
        const layout = layoutFields(text);
        tree.delete();
        if (layout?.fields.some((f) => !/^(?:pad|unk)/.test(f.name) && accesses.some((a) => a.originalStorage!.offset === f.offset && a.width === f.size)))
          projectionNames.push(declaration.name);
      }
    }
    for (const table of discovery.callbackTables) {
      const signatures = table.entries.map((e) => e.prototype?.signature ?? "unresolved");
      const contracts = new Set(table.entries.filter((e) => e.prototype).map((e) => JSON.stringify([e.prototype!.returnType, e.prototype!.paramTypes, e.prototype!.parameters, e.prototype!.variadic])));
      const conflicting = contracts.size > 1;
      const item = unknown(table.symbol, conflicting ? "callback entries have differing declared contracts; no uniform prototype assumed" : "callback entries examined independently; no uniform prototype assumed",
        [table.evidence, ...table.entries.flatMap((e) => e.evidence)], conflicting ? "conflict" : signatures.includes("unresolved") ? "unknown" : "witnessed");
      item.constraints = table.entries.map((e, i) => `${e.offset}: ${e.functionName}: ${signatures[i]}${e.witness ? `; ${JSON.stringify(e.witness)}` : ""}`);
      packet.discovery.unknowns.push(item);
      if ((!existing || options.alternative) && (conflicting || signatures.includes("unresolved")))
        packet.integration.blockers.push(`Callback table ${table.symbol}: ${conflicting ? "differing declared contracts" : `contracts unavailable for ${table.entries.filter((e) => !e.prototype).map((e) => e.functionName).join(", ")}`}; no uniform prototype justified`);
    }
    /* Held-out function declarations are removed from EVERY scope, including
       generated headers and caller-local copies. Bodies never reach inference. */
    packet.context.index.declarations = packet.context.index.declarations.filter((d) => d.kind !== "function" || !heldOut.includes(d.name));
    const carrierDeclarations: string[] = [];
    for (const carrier of inference.carriers) {
      /* A carrier holds one known type only. It is not a prototype for ANY
         original function; inference.json names exactly where it is consumed. */
      indexDeclarations(packet.context.index, `void ${carrier.name}(${carrier.type});`, relative(root, propagationPath), carrier.scope, "source-local");
      const projectedTypes = projectDeclarations(packet.context.index, [carrier.name], carrier.scope);
      carrierDeclarations.push(renameTypeTokens(projectedTypes.text, scopeRenames.get(carrier.scope) ?? new Map()));
      packet.context.unknown.push(...projectedTypes.unknown);
    }
    const projected = projectDeclarations(packet.context.index, projectionNames.filter((n) => !heldOut.includes(n)), existing && !options.alternative ? destination : "preparation");
    packet.context.unknown.push(...projected.unknown);
    packet.context.excluded = projected.excluded;
    packet.context.projection = relative(root, join(directory, "context.c"));
    const tableNotes = discovery.callbackTables.map((t) => `/* Original callback table ${t.symbol}: ${t.entries.map((e) => `${e.functionName}: ${e.prototype?.signature ?? "contract unresolved"}`).join("; ")} */`);
    writeFileSync(join(root, packet.context.projection), [...new Set([...projected.text.split(/\n\n/), ...projections.flatMap((p) => p.split(/\n\n/)), ...carrierDeclarations, ...tableNotes])].join("\n\n"));
    /* Give m2c only the selected original data definitions, not every unrelated
       declaration in the section. Callback code establishes function identities;
       -f still decompiles just the requested target. */
    const selectedData = relative(root, join(directory, "referenced-data.s"));
    const dataSections = data.flatMap((p) => selectDataDefinitions(readFileSync(p, "utf8"), [...jtables, ...discovery.callbackTables.map((t) => t.symbol)]));
    writeFileSync(join(root, selectedData), dataSections.join("\n"));
    input(join(root, packet.context.projection)); input(join(root, selectedData));
    const relatedAssembly = evidenceGraph.nodes.filter((n) => n.name !== functionName && (!n.seed || n.calls.some((c) =>
      c.targets.some((target) => evidenceGraph.nodes.some((callee) => callee.id === target && !callee.seed))))).map((n) => originalAssembly(n.name, directory));
    for (const original of relatedAssembly) for (const path of original.inputs) input(path);
    writeFileSync(constraintsPath, JSON.stringify(inference.input, null, 2));
    input(constraintsPath); input(graphPath); input(propagationPath);
    const declarations = prototypesIn(readFileSync(join(root, packet.context.projection), "utf8"), packet.context.projection);
    for (const use of (packet.discovery.report as ReturnType<typeof discoverStatic>).returnUses) {
      const declaration = declarations.find((d) => d.name === use.callee && d.returnsVoid);
      if (!declaration) continue;
      const origins = packet.context.index.declarations.filter((d) => d.name === use.callee).map((d) => d.origin);
      const item = unknown(use.callee, "void declaration conflicts with original caller dereferencing returned $v0", [...use.evidence, ...origins], "conflict");
      item.constraints = [declaration.signature, `caller ${use.caller}: ${use.width}-byte access at returned address + ${use.offset}`];
      packet.discovery.unknowns.push(item);
    }
    for (const name of packet.context.unknown) packet.discovery.unknowns.push(unknown(name, "missing or conflicting transitive type/declaration",
      [relative(root, assembly), packet.context.projection, ...packet.context.index.declarations.filter((d) => d.name === name).map((d) => d.origin)]));
    for (const name of jtables) if (!data.some((p) => readFileSync(p, "utf8").includes(name))) packet.integration.blockers.push(`Jump-table data unavailable: ${name}`);
    void symbolIndex; /* Resolution establishes this container's symbol/alias model. */
    if (existing && !options.alternative) {
      packet.primary = { origin: "existing-attempt", path: destination, sha256: hashText(source), text: source, declarationsRequired: [] };
      packet.integration.state = "live";
    } else if (resumedDraft?.primary) {
      packet.primary = resumedDraft.primary;
      packet.generation = resumedDraft.generation;
    } else {
      const generationKey = digest(JSON.stringify({ functionName, context: hashFile(join(root, packet.context.projection)), data: dataSections,
        assembly: hashFile(assembly), related: relatedAssembly.map((p) => hashFile(p.path)), inference: inference.input,
        m2c: m2c.identity, sources: m2c.sources.map(hashFile), headers: packet.context.headers, wrapperTypes, declarations: declarations.map((p) => p.signature),
        requiredDeclarations, tools, python: inputs[relative(root, execFileSync("which", ["python3"], { encoding: "utf8" }).trim())],
        implementation: snapshot(root, ["tools/agent/prepareFunction.ts", "tools/lib/recordedCommand.ts", "tools/lib/contentCache.ts"]) }));
      type Generated = { generation: PreparationPacket["generation"]; primary: PreparationPacket["primary"] };
      const generationPath = join(root, "build/cache/preparation-generation", functionName, `${generationKey}.json`);
      const cachedGeneration = readCache<Generated>(generationPath, generationKey);
      const generationHit = cachedGeneration?.primary && cachedGeneration.generation.raw && cachedGeneration.generation.rawHash &&
        hashFile(join(root, cachedGeneration.primary.path)) === cachedGeneration.primary.sha256 &&
        hashFile(join(root, cachedGeneration.generation.raw)) === cachedGeneration.generation.rawHash;
      if (generationHit) {
        packet.primary = cachedGeneration.primary; packet.generation = cachedGeneration.generation;
        timings.phases.push({ phase: "generation-cache", durationMs: 0, cache: "hit", reason: "projected declarations, constraints and original code unchanged" });
      } else {
        const generation = await command("python3", [relative(root, m2c.script), "--target", "mipsel-gcc-c", "--no-cache", "-f", functionName,
          "--context", packet.context.projection, relative(root, assembly), ...(dataSections.length ? [selectedData] : []),
          ...relatedAssembly.map((p) => relative(root, p.path)), "--infer-related", "--passes", "4", "--graph-constraints", relative(root, constraintsPath)], "m2c");
        packet.generation.command = generation;
        packet.generation.raw = relative(root, generation.stdout);
        packet.generation.rawHash = hashFile(generation.stdout);
        const raw = readFileSync(generation.stdout, "utf8");
        packet.generation.status = generation.status === 0 && !raw.includes("Decompilation failure:") ? "generated" : "failed";
        if (packet.generation.status === "generated") {
          /* Mechanical wrapper only: suppressed callee contracts and their
             independently verified private type dependencies must be visible.
             Never transplant object declarations, aliases or inferred layouts. */
          const callDeclarations = declarations.filter((p) => calls.includes(p.name)).map((p) => p.signature);
          const wrapped = packet.context.headers.map((h) => `#include "${h}"`).join("\n") + "\n\n" +
            [...new Set(wrapperTypes)].join("\n") + "\n" + callDeclarations.join("\n") + "\n\n" + raw.trim() + "\n";
          const path = relative(root, join(directory, "draft.c")); writeFileSync(join(root, path), wrapped);
          packet.generation.draftHash = hashText(wrapped);
          packet.primary = { origin: "m2c", path, sha256: packet.generation.draftHash, text: wrapped,
            declarationsRequired: requiredDeclarations };
        } else packet.compilation.diagnostics = commandText(generation);
        if (packet.primary && !generation.cancelled && !generation.timedOut) writeCache(generationPath, generationKey, { generation: packet.generation, primary: packet.primary } satisfies Generated);
        timings.phases.push({ phase: "generation-cache", durationMs: 0, cache: "miss", reason: "absent, interrupted or changed generation inputs" });
      }
    }
    /* The old scanner wire discarded every successful finding. Run it before
       the first draft measurement, parse its byte/census routing, and edit
       only a build/ copy; raw output and existing live attempts stay primary. */
    const beforeDefinition = await command("npx", ["tsx", "tools/agent/scanReadBeforeDef.ts", functionName, "--json"], "read-before-definition");
    packet.discovery.preflight.push(beforeDefinition);
    if (beforeDefinition.status !== 0) packet.integration.blockers.push("read-before-definition preflight unavailable; inspect preserved streams");
    else {
      const scan = JSON.parse(readFileSync(beforeDefinition.stdout, "utf8")) as { findings: Array<{ guidance?: string; register: string; vram: string }>; staticChain: ChainRow | null; censusComplete: boolean | null };
      packet.discovery.readBeforeDefinition = scan;
      if (packet.primary?.origin === "m2c") {
        const injection = injectStaticChain(packet.primary.text, scan.staticChain, readFileSync(join(root, packet.context.projection), "utf8"));
        packet.discovery.staticChain = injection;
        if (injection.changed) {
          const path = relative(root, join(directory, "static-chain-draft.c"));
          writeFileSync(join(root, path), injection.source);
          packet.primary = { ...packet.primary, path, text: injection.source, sha256: hashText(injection.source) };
          if (!resumedDraft || resumedDraft.primary?.sha256 === resumedDraft.generation.draftHash) packet.generation.draftHash = packet.primary.sha256;
          packet.compilation = { status: "not-attempted", commands: [], diagnostics: "" };
          packet.comparison = { status: "not-available" };
        }
        if (injection.status === "incomplete") packet.integration.blockers.push(...injection.findings);
      }
      for (const finding of scan.findings) if (finding.guidance && !scan.staticChain) packet.discovery.unknowns.push(unknown(`hard $${finding.register} @ ${finding.vram}`, finding.guidance, [relative(root, assembly)], "witnessed"));
    }
    savePacket(root, directory, packet); /* retain source identity before measurement */
    if (packet.primary) {
      if (packet.primary.origin === "m2c") packet.discovery.unknowns.push(...auditM2cArithmetic(packet.primary.text, packet.primary.path));
      const witness = targetWitness(functionName, join(directory, "witnesses"));
      const definition = prototypesIn(packet.primary.text, packet.primary.path).find((p) => p.name === functionName && p.kind === "definition");
      if (witness && definition) {
        for (const conflict of contradictionsAgainst(definition, witness, true)) {
          const item = unknown(functionName, conflict.message, [witness.where, packet.primary.path], conflict.proven ? "conflict" : "conditional");
          item.span = { path: packet.primary.path, start: 0, end: packet.primary.text.indexOf("{") };
          packet.discovery.unknowns.push(item);
        }
      }
      const draftTree = parseC(packet.primary.text);
      try {
        for (const n of draftTree.rootNode.descendantsOfType("ERROR")) {
          const item = unknown(functionName, "unresolved emitted C construct; original draft retained", [packet.primary.path], "unsupported");
          item.span = { path: packet.primary.path, start: n.startIndex, end: n.endIndex };
          item.constraints = [n.text]; packet.discovery.unknowns.push(item);
        }
      } finally { draftTree.delete(); }
      const candidate = join(root, packet.primary.path);
      const candidateGuard = analyzeCSource(packet.primary.text);
      if (!candidateGuard.parses) packet.integration.blockers.push(...candidateGuard.reasons);
      if (packet.primary.origin === "m2c") packet.integration.blockers.push(...validateVariantSource(packet.primary.text).map((f) => f.message));
      if (!extractSignaturesFromSource(packet.primary.text).some((s) => s.name === functionName) || candidateGuard.includeAsm.length) packet.integration.blockers.push("no clean-C target definition");
      if (packet.compilation.status === "not-attempted") await timings.measure("draft-measurement", () => measurePreparation(packet, root, directory, container, command));
    }
    /* Target-side frame/SDK/flag evidence remains applicable when generation
       or compilation fails. Triage itself separates unavailable compiled facts. */
    savePacket(root, directory, packet);
    const preflight = await command("npx", ["tsx", "tools/agent/triage.ts", functionName, "--src", packet.primary?.path ?? destination, "--prepared", relative(root, packetPath), "--json"], "triage");
    packet.discovery.preflight.push(preflight);
    if (preflight.status !== 0) packet.integration.blockers.push("mandatory preflight failed; inspect preserved triage streams");
    else {
      const report = JSON.parse(readFileSync(preflight.stdout, "utf8")) as PreflightReport;
      /* Triage already scans the original bytes. Surface its full result in
         both prep and matching handoffs without a second detector run. */
      packet.discovery.macroIdentity = report.macroIdentity ?? null;
      for (const f of report.findings ?? []) if (f.severity === "blocker") packet.integration.blockers.push(f.summary ?? JSON.stringify(f));
    }
    if (packet.discovery.staticChain?.status === "pending-oracle") {
      packet.discovery.staticChain.status = "failed";
      packet.discovery.staticChain.findings.push("Static-chain oracle gate unavailable: candidate did not compile/compare");
      packet.integration.blockers.push("Static-chain claims unverified; inspect preserved draft and diagnostics before staging");
    }
    if (existsSync(ledger)) { packet.discovery.priorExperiments.push(relative(root, ledger)); }
    if (packet.discovery.unknowns.some((u) => u.strength === "conflict")) packet.integration.blockers.push("unresolved declaration/interface conflicts");
    if (packet.primary?.declarationsRequired.length) packet.integration.blockers.push("source-local types require explicit declaration integration");
  } catch (error) {
    packet.integration.blockers.push(String(error));
    if (!packet.primary && packet.generation.status === "not-attempted") packet.generation.status = "unsupported";
  }
  /* Dependencies discovered from defining-source preprocessing join the manifest
     without changing the artifact directory or its original generation identity. */
  packet.preparationState = "complete";
  packet.diagnosticsIdentity = hashFile(ledger);
  packet.performance = { phases: timings.phases, totalMs: timings.totalMs, cache: "miss", reason: "absent packet, interrupted attempt or changed generation/analysis inputs" };
  savePacket(root, directory, packet);
  if (!options.alternative) writeCache(latestPath, "latest", { packet: relative(root, packetPath),
    continuation: { primary: packet.primary, generation: packet.generation } } satisfies Latest);
  return { packet, path: relative(root, packetPath) };
}

/** Compare-and-swap integration. Only an unchanged, clean committed target stub
 * is eligible, and only the preparer's own source is changed. No header publication. */
export function stagePrepared(packet: PreparationPacket, root = ROOT): { staged: boolean; reason?: string } {
  if (!packet.primary || packet.primary.origin !== "m2c" || packet.compilation.status !== "succeeded" || packet.integration.blockers.length)
    return { staged: false, reason: "candidate is not eligible for safe staging" };
  if (packet.discovery.staticChain && !["verified", "not-needed"].includes(packet.discovery.staticChain.status))
    return { staged: false, reason: "static-chain claims or scaffold are not verified" };
  if (!packetIsFresh(packet, root)) return { staged: false, reason: "input or draft drift" };
  const path = join(root, packet.identity.destination);
  const dirty = execFileSync("git", ["status", "--porcelain", "--", packet.identity.destination], { cwd: root, encoding: "utf8" });
  if (dirty.trim()) return { staged: false, reason: "destination contains existing uncommitted work" };
  const current = readFileSync(path, "utf8");
  const guard = analyzeCSource(current);
  if (!guard.parses || guard.includeAsm.length !== 1 || guard.includeAsm[0]?.symbol !== packet.identity.functionName || extractSignaturesFromSource(current).length)
    return { staged: false, reason: "destination is not an exclusive target stub" };
  if (hashText(current) !== packet.integration.destinationHash) return { staged: false, reason: "concurrent source modification" };
  writeFileSync(path, packet.primary.text);
  packet.integration.state = "live"; packet.integration.stagedHash = packet.primary.sha256;
  return { staged: true };
}

/** Measurement is independent of inference. Preserved C is measured first;
 * the same artifacts remain the baseline for its mandatory diagnostics. */
async function measurePreparation(packet: PreparationPacket, root: string, directory: string, container: Container,
  command: (exe: string, args: string[], label: string) => Promise<CommandRecord>): Promise<void> {
  if (!packet.primary) return;
  const name = packet.identity.functionName;
  const preprocessed = join(directory, `${name}.i`), assembly = join(directory, `${name}.s`), object = join(directory, `${name}.o`);
  const cpp = await command("mips-linux-gnu-cpp", [...configuredCppFlags(), join(root, packet.primary.path), "-o", preprocessed], "cpp");
  packet.compilation.commands.push(cpp);
  let front: CommandRecord | undefined, assembler: CommandRecord | undefined;
  if (cpp.status === 0) {
    packet.compilation.preprocessed = { path: relative(root, preprocessed), sha256: hashFile(preprocessed) };
    front = await command(configuredCompilerPath(), [...packet.identity.flags, preprocessed, "-o", assembly], "cc1");
    packet.compilation.commands.push(front);
    if (front.status === 0) {
      assembler = await command("python3", ["tools/vendor/maspsx/maspsx.py", ...configuredMaspsxFlags(), "--gnu-as-path", "mips-linux-gnu-as", "-o", object,
        ...configuredAsFlagsForContainer(container.kind), assembly], "assembler");
      packet.compilation.commands.push(assembler);
    }
  }
  packet.compilation.diagnostics = [cpp, front, assembler].filter((c): c is CommandRecord => !!c).map(commandText).join("\n");
  packet.compilation.status = assembler?.status === 0 ? "succeeded" : "failed";
  const rejection = rejectionFromDiagnostics(packet.compilation.diagnostics);
  if (rejection) packet.integration.blockers.push(rejection);
  if (packet.compilation.status !== "succeeded") return;
  packet.compilation.assembly = { path: relative(root, assembly), sha256: hashFile(assembly) };
  packet.compilation.object = { path: relative(root, object), sha256: hashFile(object) };
  const comparison = compareFunction(name, { objectPath: object, container });
  if (packet.discovery.staticChain?.claims.length) {
    verifyChainInjection(packet.discovery.staticChain, comparison);
    if (packet.discovery.staticChain.status !== "verified") packet.integration.blockers.push(...packet.discovery.staticChain.findings);
  }
  const report = relative(root, join(directory, "comparison.json"));
  writeFileSync(join(root, report), JSON.stringify(comparison, null, 2));
  packet.comparison = { status: comparison.verdict === "match" ? "exact" : comparison.verdict === "mismatch" ? "mismatching" : "undetermined", report };
  if (comparison.verdict === "mismatch") {
    const residual = await command("npx", ["tsx", "tools/agent/residualObjective.ts", name, "--source", packet.primary.path, "--json"], "residual");
    if (residual.status === 0) { try { packet.comparison.residual = JSON.parse(readFileSync(residual.stdout, "utf8")); } catch { /* original streams remain explicit */ } }
  }
}

