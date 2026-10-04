import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { prepareM2c } from "../build/prepareM2c.js";
import { validateVariantSource } from "./variant-lab/manifest.js";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { recordedCommand, commandText, type CommandRecord } from "../lib/recordedCommand.js";
import { requireFunctionLocation, loadSymbolIndex } from "../lib/symbolIndex.js";
import { containerTargetPath } from "../lib/container.js";
import { compareFunction } from "../lib/functionOracle.js";
import { ROOT, configuredCppFlags, configuredCc1FlagsForContainer, configuredCompilerPath,
  configuredAsFlagsForContainer, configuredMaspsxFlags, configuredToolchainIdentity, loadFlagOverrides,
  resolveAsmSource, rejectionFromDiagnostics, sourceDependencyFiles } from "./decompToolchain.js";
import { analyzeCSource } from "./cSourceGuard.js";
import { extractSignaturesFromSource } from "./sdkTypes.js";
import { sdkPrototypes, definitionPrototype, scopeFromPreprocessed, targetWitness, contradictionsAgainst, prototypesIn } from "./calleeTruth.js";
import { emptyDeclarationIndex, indexDeclarations, globalViews, projectDeclarations, type Declaration } from "./declarationContext.js";
import { namedChildren, parseC } from "./residual-source-search/tree-sitter-c.js";
import { renameTypeTokens } from "./scopedTypes.js";
import { auditM2cArithmetic } from "./m2cLimits.js";
import { discoverStatic } from "./staticDiscovery.js";
import { packetOpening, type PreparationPacket, type UnknownFact } from "./campaign/packet.js";

export const hashText = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
export const hashFile = (path: string) => existsSync(path) ? hashText(readFileSync(path)) : "absent";
export function packetIsFresh(packet: PreparationPacket, root = ROOT): boolean {
  return Object.entries(packet.identity.inputs).every(([path, hash]) => hashFile(join(root, path)) === hash) &&
    (!packet.primary || hashFile(join(root, packet.primary.path)) === packet.primary.sha256) &&
    JSON.stringify(packet.identity.tools) === JSON.stringify(configuredToolchainIdentity()) &&
    [packet.compilation.preprocessed, packet.compilation.object].every((a) => !a || hashFile(join(root, a.path)) === a.sha256) &&
    (!packet.generation.raw || !packet.generation.rawHash || hashFile(join(root, packet.generation.raw)) === packet.generation.rawHash);
}
function savePacket(root: string, directory: string, packet: PreparationPacket): void {
  const path = join(directory, "packet.json");
  writeFileSync(`${path}.tmp`, JSON.stringify(packet, null, 2) + "\n"); renameSync(`${path}.tmp`, path);
  writeFileSync(join(directory, "handoff.md"), packetOpening(packet, relative(root, path)) + "\n");
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
export async function prepareFunction(functionName: string, options: { root?: string; signal?: AbortSignal; alternative?: boolean; contextFile?: string } = {}): Promise<{ packet: PreparationPacket; path: string }> {
  const root = options.root ?? ROOT;
  const location = requireFunctionLocation(functionName);
  const container = location.container;
  const destination = join(container.paths.srcDir, `${functionName}.c`);
  const assembly = resolveAsmSource(functionName);
  if (!assembly) throw new Error(`Original assembly unavailable for ${functionName}`);
  const source = readFileSync(join(root, destination), "utf8");
  const guard = analyzeCSource(source);
  const definitions = extractSignaturesFromSource(source);
  const existing = definitions.some((d) => d.name === functionName) && !guard.includeAsm.some((s) => s.symbol === functionName);
  const asmText = readFileSync(assembly, "utf8");
  const jtables = [...new Set([...asmText.matchAll(/\bjtbl_[\w]+/g)].map((m) => m[0]))];
  const data = allFiles(join(root, container.paths.asmDir, "data")).filter((p) => p.endsWith(".s") && jtables.some((s) => readFileSync(p, "utf8").includes(s)));
  const inputs: Record<string, string> = {};
  const ledger = join(root, "build/experimentLedger", `${functionName}.jsonl`);
  const input = (path: string) => { const key = relative(root, path); inputs[key] = hashFile(path); };
  /* Complete declaration/config/decompiler sources, plus actual transitive compile inputs.
     Deliberately content hashes: timestamp and Git HEAD are not input identities. */
  for (const path of [assembly, join(root, destination), containerTargetPath(container), join(root, "Makefile"),
    ...allFiles(join(root, "configs")), ...allFiles(join(root, "include")), ...allFiles(join(root, "src")),
    ...allFiles(join(root, "tools/vendor/m2c/m2c")).filter((p) => p.endsWith(".py")),
    ...allFiles(join(root, "tools/vendor/m2c/m2c_pycparser")).filter((p) => p.endsWith(".py")),
    ...allFiles(join(root, "tools/vendor/maspsx/maspsx")).filter((p) => p.endsWith(".py")),
    ...allFiles(join(root, "tools/vendor/tree-sitter-c")),
    join(root, "tools/build/prepareM2c.ts"), join(root, "package-lock.json"),
    ...["web-tree-sitter.js", "web-tree-sitter.wasm"].map((p) => join(root, "node_modules/web-tree-sitter", p)),
    join(root, "tools/vendor/m2c/m2c.py"), ...allFiles(join(root, "tools/agent")).filter((p) => p.endsWith(".ts") && !p.endsWith(".test.ts")),
    ...data, ledger, ...[container.paths.splat, container.paths.symbolAddrs, container.paths.undefinedFuncs, container.paths.undefinedSyms,
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
  const fingerprint = hashText(JSON.stringify({ inputs, tools, flags, alternative: options.alternative ?? false }));
  const baseDirectory = join(root, "build/preparation", functionName, fingerprint);
  let directory = baseDirectory;
  let packetPath = join(directory, "packet.json");
  let resumedDraft: PreparationPacket | undefined;
  mkdirSync(dirname(baseDirectory), { recursive: true });
  for (let retry = 1; ; retry++) {
    if (!existsSync(directory)) {
      try { mkdirSync(directory); break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
    }
    const packet = existsSync(packetPath) ? JSON.parse(readFileSync(packetPath, "utf8")) as PreparationPacket : undefined;
    if (packet && !packetIsFresh(packet, root)) {
      /* An edited draft is user work. Never regenerate it over an existing path. */
      throw new Error(`Preparation artifacts changed: ${relative(root, directory)}; preserve/edit that draft or request a new alternative.`);
    }
    if (packet) {
      const commands = [...packet.compilation.commands, ...(packet.generation.command ? [packet.generation.command] : [])];
      if (packet.preparationState !== "running" && !commands.some((c) => c.cancelled || c.timedOut)) return { packet, path: relative(root, packetPath) };
      if (packet.primary?.origin === "m2c") resumedDraft = packet;
    }
    /* A crashed/concurrent attempt owns its files, even without a final packet. */
    directory = join(baseDirectory, `retry-${retry}`); packetPath = join(directory, "packet.json");
  }
  const packet: PreparationPacket = {
    schemaVersion: 1, preparationState: "running", identity: { functionName, container: container.id, destination, assembly: relative(root, assembly),
      data: data.map((p) => relative(root, p)), inputs, fingerprint, tools, flags }, primary: existing && !options.alternative ? {
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
    recordedCommand(exe, args, cwd, directory, `${sequence++}-${label}`, options.signal, timeout, false);
  const preprocess = async (path: string, scope: string) => {
    const result = await command("mips-linux-gnu-cpp", [...configuredCppFlags(), path], "context-cpp");
    packet.compilation.commands.push(result);
    if (result.status !== 0) { packet.integration.blockers.push(`Context preprocessing failed: ${path}`); return; }
    const preprocessed = scopeFromPreprocessed(readFileSync(result.stdout, "utf8"));
    const tree = parseC(preprocessed.source);
    try {
      for (const node of namedChildren(tree.rootNode)) {
        const origin = preprocessed.lineOf(node.startPosition.row).file;
        const isHeader = origin.endsWith(".h");
        indexDeclarations(packet.context.index, node.text, origin, isHeader ? "public" : scope, isHeader ? "public-header" : "source-local");
      }
    } finally { tree.delete(); }
  };
  savePacket(root, directory, packet);
  try {
    if (options.signal?.aborted) throw new Error("Preparation cancelled");
    packet.discovery.report = discoverStatic(functionName, root);
    packet.discovery.unknowns.push(...(packet.discovery.report as ReturnType<typeof discoverStatic>).unknowns);
    const symbolIndex = loadSymbolIndex(container);
    const calls = [...new Set([...asmText.matchAll(/\bjal\s+([A-Za-z_]\w*)/g)].map((m) => m[1]!))];
    const sdk = sdkPrototypes();
    const referenced = [...new Set([...asmText.matchAll(/\b(?:D_[A-Fa-f0-9]{8}|ovl_\d+_D_[A-Fa-f0-9]{8})\b/g)].map((m) => m[0]))];
    const baseContext = join(directory, "headers.c");
    const headers = ["common.h", "game_types.h", ...calls.flatMap((c) => sdk.has(c) ? [sdk.get(c)!.where.replace(/^include\//, "")] : [])]
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
    const projectionNames = [...referenced, ...calls.filter((c) => sdk.has(c))];
    const projections: string[] = [];
    const requiredDeclarations: Declaration[] = [];
    for (const callee of calls) {
      const definition = definitionPrototype(callee);
      const witness = targetWitness(callee, join(directory, "witnesses"));
      if (definition) {
        const path = join(root, definition.where); input(path);
        for (const dep of sourceDependencyFiles(path)) input(dep);
        await preprocess(path, definition.where);
        const projected = projectDeclarations(packet.context.index, [callee], definition.where);
        const privateTypes = projected.selected.filter((d) => d.visibility === "source-local" && d.kind === "type");
        requiredDeclarations.push(...privateTypes);
        const scopeId = hashText(definition.where).slice(0, 12);
        const renames = new Map(privateTypes.map((d) => [d.name.replace(/^(struct|union) /, ""), `M2C_${scopeId}_${d.name.replace(/^(struct|union) /, "")}`]));
        projections.push(renameTypeTokens(projected.text, renames)); packet.context.unknown.push(...projected.unknown);
        if (sdk.has(callee)) {
          const disagreements = contradictionsAgainst(definition, { kind: "sdk", where: sdk.get(callee)!.where, prototype: sdk.get(callee)! }, true);
          for (const d of disagreements) packet.discovery.unknowns.push(unknown(callee, d.message, [definition.where, sdk.get(callee)!.where], "conflict"));
        }
        if (witness) for (const d of contradictionsAgainst(definition, witness, true)) packet.discovery.unknowns.push(unknown(callee, d.message, [definition.where, witness.where], "conflict"));
      } else if (!sdk.has(callee)) {
        const item = unknown(callee, "complete source signature unavailable; ABI facts are bounds, not a prototype", [witness?.where ?? callee]);
        item.constraints = witness ? [JSON.stringify(witness)] : []; packet.discovery.unknowns.push(item);
      }
    }
    const projected = projectDeclarations(packet.context.index, projectionNames, "preparation");
    packet.context.unknown.push(...projected.unknown);
    packet.context.excluded = projected.excluded;
    packet.context.projection = relative(root, join(directory, "context.c"));
    writeFileSync(join(root, packet.context.projection), [...new Set([...projected.text.split(/\n\n/), ...projections.flatMap((p) => p.split(/\n\n/))])].join("\n\n"));
    const declarations = prototypesIn(readFileSync(join(root, packet.context.projection), "utf8"), packet.context.projection);
    for (const use of (packet.discovery.report as ReturnType<typeof discoverStatic>).returnUses) {
      const declaration = declarations.find((d) => d.name === use.callee && d.returnsVoid);
      if (!declaration) continue;
      const origins = packet.context.index.declarations.filter((d) => d.name === use.callee).map((d) => d.origin);
      const item = unknown(use.callee, "void declaration conflicts with original caller dereferencing returned $v0", [...use.evidence, ...origins], "conflict");
      item.constraints = [declaration.signature, `caller ${use.caller}: ${use.width}-byte access at returned address + ${use.offset}`];
      packet.discovery.unknowns.push(item);
    }
    for (const name of packet.context.unknown) packet.discovery.unknowns.push(unknown(name, "missing or conflicting transitive type/declaration", packet.context.index.declarations.filter((d) => d.name === name).map((d) => d.origin)));
    for (const name of jtables) if (!data.some((p) => readFileSync(p, "utf8").includes(name))) packet.integration.blockers.push(`Jump-table data unavailable: ${name}`);
    void symbolIndex; /* Resolution establishes this container's symbol/alias model. */
    if (existing && !options.alternative) {
      packet.primary = { origin: "existing-attempt", path: destination, sha256: hashText(source), text: source, declarationsRequired: [] };
      packet.integration.state = "live";
    } else if (resumedDraft?.primary) {
      packet.primary = resumedDraft.primary;
      packet.generation = resumedDraft.generation;
    } else {
      const generation = await command("python3", [relative(root, m2c.script), "--target", "mipsel-gcc-c", "--no-cache", "-f", functionName,
        "--context", packet.context.projection, relative(root, assembly), ...packet.identity.data], "m2c");
      packet.generation.command = generation;
      packet.generation.raw = relative(root, generation.stdout);
      packet.generation.rawHash = hashFile(generation.stdout);
      const raw = readFileSync(generation.stdout, "utf8");
      packet.generation.status = generation.status === 0 && !raw.includes("Decompilation failure:") ? "generated" : "failed";
      if (packet.generation.status === "generated") {
        const wrapped = packet.context.headers.map((h) => `#include "${h}"`).join("\n") + "\n\n" + raw.trim() + "\n";
        const path = relative(root, join(directory, "draft.c")); writeFileSync(join(root, path), wrapped);
        packet.primary = { origin: "m2c", path, sha256: hashText(wrapped), text: wrapped,
          declarationsRequired: requiredDeclarations };
      } else packet.compilation.diagnostics = commandText(generation);
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
      const preprocessed = join(directory, `${functionName}.i`);
      const compiledAssembly = join(directory, `${functionName}.s`);
      const object = join(directory, `${functionName}.o`);
      const cpp = await command("mips-linux-gnu-cpp", [...configuredCppFlags(), candidate, "-o", preprocessed], "cpp");
      packet.compilation.commands.push(cpp);
      let front: CommandRecord | undefined;
      let assembler: CommandRecord | undefined;
      if (cpp.status === 0) {
        packet.compilation.preprocessed = { path: relative(root, preprocessed), sha256: hashFile(preprocessed) };
        front = await command(configuredCompilerPath(), [...flags, preprocessed, "-o", compiledAssembly], "cc1"); packet.compilation.commands.push(front);
        if (front.status === 0) {
          assembler = await command("python3", ["tools/vendor/maspsx/maspsx.py", ...configuredMaspsxFlags(), "--gnu-as-path", "mips-linux-gnu-as", "-o", object,
            ...configuredAsFlagsForContainer(container.kind), compiledAssembly], "assembler"); packet.compilation.commands.push(assembler);
        }
      }
      packet.compilation.diagnostics = [cpp, front, assembler].filter((c): c is CommandRecord => !!c).map(commandText).join("\n");
      packet.compilation.status = assembler?.status === 0 ? "succeeded" : "failed";
      const rejection = rejectionFromDiagnostics(packet.compilation.diagnostics);
      if (rejection) packet.integration.blockers.push(rejection);
      if (packet.compilation.status === "succeeded") {
        packet.compilation.object = { path: relative(root, object), sha256: hashFile(object) };
        const comparison = compareFunction(functionName, { objectPath: object, container });
        const report = relative(root, join(directory, "comparison.json")); writeFileSync(join(root, report), JSON.stringify(comparison, null, 2));
        packet.comparison = { status: comparison.verdict === "match" ? "exact" : comparison.verdict === "mismatch" ? "mismatching" : "undetermined", report };
        if (comparison.verdict === "mismatch") {
          const residual = await command("npx", ["tsx", "tools/agent/residualObjective.ts", functionName, "--source", packet.primary.path, "--json"], "residual");
          if (residual.status === 0) { try { packet.comparison.residual = JSON.parse(readFileSync(residual.stdout, "utf8")); } catch { /* report preserved; unavailable is honest */ } }
        }
      }
    }
    /* Target-side frame/SDK/flag evidence remains applicable when generation
       or compilation fails. Triage itself separates unavailable compiled facts. */
    const preflight = await command("npx", ["tsx", "tools/agent/triage.ts", functionName, "--src", packet.primary?.path ?? destination, "--json"], "triage");
    packet.discovery.preflight.push(preflight);
    if (preflight.status !== 0) packet.integration.blockers.push("mandatory preflight failed; inspect preserved triage streams");
    else {
      const report = JSON.parse(readFileSync(preflight.stdout, "utf8")) as { findings?: Array<{ severity: string; summary?: string }> };
      for (const f of report.findings ?? []) if (f.severity === "blocker") packet.integration.blockers.push(f.summary ?? JSON.stringify(f));
    }
    const beforeDefinition = await command("npx", ["tsx", "tools/agent/scanReadBeforeDef.ts", functionName, "--json"], "read-before-definition");
    packet.discovery.preflight.push(beforeDefinition);
    if (beforeDefinition.status !== 0) packet.integration.blockers.push("read-before-definition preflight unavailable; inspect preserved streams");
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
  savePacket(root, directory, packet);
  return { packet, path: relative(root, packetPath) };
}

/** Compare-and-swap integration. Only an unchanged, clean committed target stub
 * is eligible, and only the preparer's own source is changed. No header publication. */
export function stagePrepared(packet: PreparationPacket, root = ROOT): { staged: boolean; reason?: string } {
  if (!packet.primary || packet.primary.origin !== "m2c" || packet.compilation.status !== "succeeded" || packet.integration.blockers.length)
    return { staged: false, reason: "candidate is not eligible for safe staging" };
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

