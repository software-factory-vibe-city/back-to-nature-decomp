/** Standalone macro census and reusable API consumed by agent routing. Makes
 * no source edits. Run `npx tsx tools/diagnostics/macroIdentity.ts --help`.
 * Import detectMacroIdentities or tileMacroFunction for future agent tools. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseC, walk } from "../agent/residual-source-search/tree-sitter-c.js";
import { ROOT } from "../lib/psxExeInfo.js";
import { containerPath, containerTargetPath, loadContainers, unresolvedCodeMembers, type Container } from "../lib/container.js";
import { loadFunctionSpans, loadSymbolIndex } from "../lib/symbolIndex.js";
import { readGroups, type FileGroup } from "../agent/fileGroupings.js";
import { hex } from "./macroInstructions.js";
import { deriveRepoMacroEncodings, type RepoEncodingReport } from "./macroEncodings.js";
import { extractMacroTemplates, loadMacroHeaders, type TemplateLibrary } from "./macroTemplates.js";
import { tileMacroFunction, type MacroFunction, type MacroFunctionReport, type TilerOptions } from "./macroTiler.js";
import { mineMacroCandidates, type MinerOptions, type MiningReport } from "./macroMiner.js";
import { collectMacroCoverage, loadMacroTextRanges, type MacroScanCoverage, type MacroPresence } from "./macroCoverage.js";
export { scanMacroPresence, loadMacroTextRanges } from "./macroCoverage.js";
export { tileMacroFunction, extractMacroTemplates, loadMacroHeaders, mineMacroCandidates, deriveRepoMacroEncodings };
export type { MacroFunction, MacroFunctionReport, TilerOptions, TemplateLibrary, MinerOptions, MiningReport };

export interface CensusFinding { container: string; function: string | null; reason: string }
export interface MacroIdentityOptions {
  /** Supplying functions bypasses original binary/function-table loading.
   * Command encoding still uses the production toolchain unless disabled. */
  functions?: readonly MacroFunction[];
  containers?: readonly Container[];
  /** Includes unenabled extracted overlays in coverage and presence-only scope. */
  containerIds?: readonly string[];
  functionNames?: readonly string[];
  overlayDirectory?: string;
  headerPaths?: readonly string[];
  /** Default true: resolve SDK commands through the real production pipeline.
   * False is explicitly raw-header-only, useful for isolated extraction tests. */
  resolveCommands?: boolean;
  library?: TemplateLibrary;
  tiler?: TilerOptions;
  /** Mining is opt-in; known-template census is cheap enough for agent use. */
  mine?: MinerOptions;
  groups?: readonly FileGroup[];
  symbols?: ReadonlyMap<string, ReadonlyMap<number, string>>;
}
export interface MacroIdentityReport {
  schemaVersion: 3;
  coverage: MacroScanCoverage;
  presenceCensus: MacroPresence[];
  commandEncodingMode: "production-toolchain" | "raw-header-only";
  encodingToolchains: RepoEncodingReport[];
  censusComplete: boolean;
  functions: MacroFunctionReport[];
  detectedFunctions: string[];
  templateCount: number;
  templateDiagnostics: TemplateLibrary["diagnostics"];
  censusFindings: CensusFinding[];
  translationUnits: Array<{ heading: string; functions: string[]; vintages: string[]; ambiguousFunctions: string[]; families: MacroFunctionReport["headerVintages"]["families"]; finding: "mixed-vintages" | "single-vintage" | "undetermined" }>;
  mining: MiningReport | null;
  conversionQueue: Array<{ function: string; container: string; sourceRepresentation: MacroFunctionReport["sourceRepresentation"]; coverage: MacroFunctionReport["coverage"]; verdict: MacroFunctionReport["verdict"]; headerVintages: MacroFunctionReport["headerVintages"]; oracleStatus: "not-converted" }>;
}

/** Load c/asm extents from splat, plus EXE library functions from the original
 * disassembler table, bounded by configured text. Never decode overlay data
 * (random data readily manufactures COP2 instructions). Invalid/truncated
 * function extents are findings; they are not silently clamped. */
export function loadMacroFunctions(containers: readonly Container[]): { functions: MacroFunction[]; findings: CensusFinding[] } {
  const functions: MacroFunction[] = [], findings: CensusFinding[] = [];
  for (const container of containers) {
    if (!existsSync(containerTargetPath(container))) { findings.push({ container: container.id, function: null, reason: "Original binary missing" }); continue; }
    if (!existsSync(containerPath(container, "splat"))) { findings.push({ container: container.id, function: null, reason: "Splat configuration missing; no safe code bounds" }); continue; }
    const bytes = readFileSync(containerTargetPath(container));
    const spans = loadFunctionSpans(container);
    const extents = new Map(spans.map(s => [s.rom, { name: s.name, rom: s.rom, vram: s.vram, size: s.size }]));
    // The executable links SDK objects, not individual splat c/asm entries.
    // Its original function table supplies those interior function boundaries.
    if (container.kind === "exe") {
      const text = loadMacroTextRanges(container, false);
      const csvPath = containerPath(container, "functionsCsv");
      if (!existsSync(csvPath)) findings.push({ container: container.id, function: null, reason: "Function table missing; SDK object interiors not scanned" });
      else for (const line of readFileSync(csvPath, "utf8").split("\n").slice(1)) {
        if (!line.trim()) continue;
        const fields = line.split(",");
        const rom = Number(fields[0]), vram = Number(fields[1]), size = Number(fields[4]), name = fields[2] ?? "";
        if (!text.some(s => s.startOffset <= rom && rom + size <= s.endOffset)) continue;
        if (!extents.has(rom)) extents.set(rom, { name, rom, vram, size });
      }
    }
    for (const span of [...extents.values()].sort((a, b) => a.rom - b.rom)) {
      if (!span.name || ![span.rom, span.vram, span.size].every(Number.isSafeInteger) || span.size <= 0 || span.size % 4 || span.rom % 4 || span.vram % 4 || span.rom < container.payloadOffset || span.rom + span.size > Math.min(bytes.length, container.payloadOffset + container.payloadSize)) {
        findings.push({ container: container.id, function: span.name, reason: "Invalid or truncated configured function extent" }); continue;
      }
      if (span.vram !== container.loadAddr + span.rom - container.payloadOffset) {
        findings.push({ container: container.id, function: span.name, reason: "Function table/config VRAM contradicts container mapping" }); continue;
      }
      functions.push({ name: span.name, container: container.id, vram: span.vram, bytes: bytes.subarray(span.rom, span.rom + span.size) });
    }
  }
  return { functions, findings };
}

function sourceRepresentation(path: string): MacroFunctionReport["sourceRepresentation"] {
  if (!existsSync(path)) return "missing";
  const tree = parseC(readFileSync(path, "utf8"));
  let stub = false, topAsm = false;
  try { walk(tree.rootNode, node => {
    if (node.type === "preproc_if" && node.childForFieldName("condition")?.text === "0") return false;
    if (node.type === "call_expression" && node.childForFieldName("function")?.text === "INCLUDE_ASM") stub = true;
    if (node.type === "gnu_asm_expression") {
      let parent = node.parent;
      while (parent && parent.type !== "function_definition" && parent.type !== "translation_unit") parent = parent.parent;
      if (parent?.type === "translation_unit") topAsm = true;
    }
    return true;
  }); } finally { tree.delete(); }
  return stub ? "INCLUDE_ASM" : topAsm ? "top-level-asm" : "compiled-C";
}

/** Complete structured census. Reusable with an injected header library,
 * function table/bytes and grouping/symbol evidence for other projects. */
export function detectMacroIdentities(options: MacroIdentityOptions = {}): MacroIdentityReport {
  if ("commandEncodingHeaders" in options) throw new Error("Replacement C-header encoding inputs were removed; use the production GAS encoding oracle");
  const library = options.library ?? extractMacroTemplates(loadMacroHeaders(options.headerPaths ?? [join(ROOT, "include/psyq"), join(ROOT, "include/debughook.h"), join(ROOT, "include/scratchpad.h")]));
  const containers = options.functions ? [] : (options.containers ?? loadContainers()).filter(c => !options.containerIds || options.containerIds.includes(c.id));
  const loaded = options.functions ? { functions: options.functions, findings: [] as CensusFinding[] } : loadMacroFunctions(containers);
  if (options.functionNames) loaded.functions = loaded.functions.filter(f => options.functionNames!.some(n => n.toLowerCase() === f.name.toLowerCase()));
  if (!options.functions && !options.containers && !options.containerIds) {
    for (const member of unresolvedCodeMembers()) loaded.findings.push({ container: member.id, function: null, reason: "Code member base unresolved; not scanned" });
    const configured = join(ROOT, "configs/splat");
    if (existsSync(configured)) for (const file of readdirSync(configured).filter(f => f.endsWith(".yaml")).sort()) {
      const id = file.slice(0, -5);
      if (!containers.some(c => c.id === id) && !loaded.findings.some(f => f.container === id)) loaded.findings.push({ container: id, function: null, reason: "Configured container unavailable in active manifest; not scanned" });
    }
  }
  const scanned = collectMacroCoverage(containers, loaded.functions, loaded.findings, { scope: options.functions ? "injected-functions" : options.functionNames ? "selected-functions" : options.containers || options.containerIds ? "selected-containers" : "project", ...(options.overlayDirectory ? { overlayDirectory: options.overlayDirectory } : {}), ...(options.containerIds ? { requestedIds: options.containerIds } : {}) });
  const kindOf = (fn: MacroFunction): "exe" | "overlay" => containers.find(c => c.id === fn.container)?.kind ?? (fn.container.startsWith("ovl_") ? "overlay" : "exe");
  const encodingToolchains: RepoEncodingReport[] = [];
  const libraries = new Map<"exe" | "overlay", TemplateLibrary>();
  for (const kind of new Set(loaded.functions.map(kindOf))) {
    if (options.resolveCommands === false) libraries.set(kind, library);
    else {
      const encoded = deriveRepoMacroEncodings(library, kind);
      libraries.set(kind, encoded.library); encodingToolchains.push(encoded.report);
    }
  }
  const libraryOf = (fn: MacroFunction): TemplateLibrary => libraries.get(kindOf(fn)) ?? library;
  const functions = loaded.functions.map(fn => tileMacroFunction(fn, libraryOf(fn), options.tiler, options.symbols?.get(fn.container)));
  // Most containers have no asm-macro detections. Resolve symbol feeds only
  // where a tile actually needs them, rather than crawling thousands of
  // unrelated generated .s files on every census.
  if (!options.symbols) {
    const detectedContainers = new Set(functions.filter(f => f.tiling.length).map(f => f.container));
    const symbols = new Map(containers.filter(c => detectedContainers.has(c.id)).map(c => [c.id, loadSymbolIndex(c).byAddress]));
    functions.forEach((report, index) => {
      if (report.tiling.length && symbols.has(report.container)) functions[index] = tileMacroFunction(loaded.functions[index]!, libraryOf(loaded.functions[index]!), options.tiler, symbols.get(report.container));
    });
  }
  if (!options.functions) for (const f of functions) {
    const container = containers.find(c => c.id === f.container)!;
    f.sourceRepresentation = sourceRepresentation(join(ROOT, container.paths.srcDir, `${f.name}.c`));
  }
  const conversionQueue: MacroIdentityReport["conversionQueue"] = functions.filter(f => f.cop2.count && ["INCLUDE_ASM", "top-level-asm"].includes(f.sourceRepresentation)).sort((a, b) => Number(b.sourceRepresentation === "top-level-asm") - Number(a.sourceRepresentation === "top-level-asm") || b.coverage.fraction - a.coverage.fraction || (a.end - a.start) - (b.end - b.start) || a.name.localeCompare(b.name)).map(f => ({ function: f.name, container: f.container, sourceRepresentation: f.sourceRepresentation, coverage: f.coverage, verdict: f.verdict, headerVintages: f.headerVintages, oracleStatus: "not-converted" }));
  const byName = new Map(functions.map(f => [f.name, f]));
  const translationUnits: MacroIdentityReport["translationUnits"] = [];
  for (const group of options.groups ?? (options.functions ? [] : readGroups())) {
    const members = group.members.map(n => byName.get(n)).filter((f): f is MacroFunctionReport => f !== undefined && f.tiling.length > 0);
    if (!members.length) continue;
    // Ambiguous alternative vintages are not proof of mixing. Only tiles with
    // a single compatible vintage establish a per-TU vintage witness.
    const vintages = [...new Set(members.flatMap(f => f.tiling.filter(t => !t.alternatives.some(a => a.vintage !== t.vintage)).map(t => t.vintage)))].sort();
    const ambiguousFunctions = members.filter(f => f.tiling.some(t => t.alternatives.some(a => a.vintage !== t.vintage))).map(f => f.name);
    const families = [...new Set(members.flatMap(f => f.headerVintages.families.map(v => v.family)))].sort().map(family => ({ family, witnessed: [...new Set(members.flatMap(f => f.headerVintages.families.filter(v => v.family === family).flatMap(v => v.witnessed)))].sort(), compatible: [...new Set(members.flatMap(f => f.headerVintages.families.filter(v => v.family === family).flatMap(v => v.compatible)))].sort() }));
    translationUnits.push({ heading: group.heading, functions: members.map(f => f.name), vintages, ambiguousFunctions, families, finding: families.some(f => f.witnessed.length > 1) ? "mixed-vintages" : vintages.length ? "single-vintage" : "undetermined" });
  }
  const mining = options.mine ? mineMacroCandidates(loaded.functions, functions, options.mine) : null;
  const minedFunctions = new Set([
    ...(mining?.candidates.flatMap(c => c.occurrences.map(o => `${o.container}:${o.function}`)) ?? []),
    ...(mining?.identicalFunctions.flatMap(c => c.occurrences.map(o => `${o.container}:${o.function}`)) ?? []),
  ]);
  const templateDiagnostics = [...new Map([...libraries.values()].flatMap(l => l.diagnostics).map(d => [JSON.stringify(d), d])).values()];
  return { schemaVersion: 3, coverage: scanned.coverage, presenceCensus: scanned.presence, commandEncodingMode: options.resolveCommands === false ? "raw-header-only" : "production-toolchain", encodingToolchains, censusComplete: scanned.coverage.complete, functions, detectedFunctions: functions.filter(f => f.cop2.count || f.tiling.length || minedFunctions.has(`${f.container}:${f.name}`)).map(f => `${f.container}:${f.name}`), templateCount: library.templates.length, templateDiagnostics, censusFindings: loaded.findings, translationUnits, mining, conversionQueue };
}

/** Target-byte push for triage; works identically for C and INCLUDE_ASM sources. */
export function detectFunctionMacroIdentity(functionName: string): { function: MacroFunctionReport; encodingToolchains: RepoEncodingReport[] } | null {
  const containers = loadContainers();
  const loaded = loadMacroFunctions(containers);
  const fn = loaded.functions.find(f => f.name.toLowerCase() === functionName.toLowerCase());
  if (!fn) return null;
  const container = containers.find(c => c.id === fn.container)!;
  fn.sourceRepresentation = sourceRepresentation(join(ROOT, container.paths.srcDir, `${fn.name}.c`));
  const report = detectMacroIdentities({ functions: [fn], symbols: new Map([[container.id, loadSymbolIndex(container).byAddress]]) });
  return { function: report.functions[0]!, encodingToolchains: report.encodingToolchains };
}

export function formatMacroIdentityReport(report: MacroIdentityReport, all = false): string {
  const lines = [`Macro identity census: ${report.functions.length} functions, ${report.templateCount} header templates, ${report.detectedFunctions.length} detected functions.`, "Compatibility only: all C statements require byte-oracle verification."];
  lines.push(`Command encodings: ${report.commandEncodingMode}`);
  for (const oracle of report.encodingToolchains) lines.push(`  ${oracle.containerKind}: ${oracle.commands.length} GAS commands verified through cpp/cc1/maspsx/GAS; ${oracle.probeObject}`);
  lines.push(`Coverage (${report.coverage.scope}): ${report.coverage.functionByteSource}; ${report.coverage.sourceEligibility}`);
  for (const c of report.coverage.containersScanned) lines.push(`  SCANNED ${c.container}: ${c.functionCount} functions; ${c.textRanges.length} splat text ranges`);
  for (const c of report.coverage.containersSkipped) lines.push(`  NOT TILED ${c.container} (${c.targetPath}): ${c.reason}`);
  if (!report.censusComplete) lines.push("CENSUS INCOMPLETE: skipped containers have unknown macro identity, not zero macros.");
  lines.push("Presence-only census: opcode hits, NOT macro identities; clusters require >=3 ops per 32-word window.");
  for (const p of report.presenceCensus) {
    lines.push(`  ${p.container}: ${p.counts.total} COP2-family words ${JSON.stringify(p.counts)}, ${p.clusters.length} clusters; ${p.bounds}; ${p.containerEnabled ? "enabled" : "container not enabled"}`);
    if (p.bounds === "unbounded") lines.push(`    CAUTION: ${p.caveat}`);
    for (const c of p.clusters) lines.push(`    cluster file ${hex(c.startOffset)}–${hex(c.endOffset)}${c.startVram === null ? "; VRAM unresolved" : `; VRAM ${hex(c.startVram)}–${hex(c.endVram!)}`} (${c.opCount} ops)`);
  }
  for (const f of report.functions) {
    if (!all && !f.cop2.count && !f.tiling.length) continue;
    lines.push("", `${f.container}:${f.name} ${hex(f.start)}–${hex(f.end)} ${f.verdict} ${f.classification}; source=${f.sourceRepresentation}`, `  COP2 ${f.coverage.explained}/${f.coverage.total} explained (fraction=${f.coverage.fraction.toFixed(4)}) ${JSON.stringify(f.cop2.mnemonics)}`, `  Vintage: ${f.headerVintages.finding}; witnessed=${f.headerVintages.witnessed.join(", ") || "none"}; compatible=${f.headerVintages.compatible.join(", ") || "none"}; absorbed nops=${f.absorbedNops}`);
    if (f.headerVintages.families.length) lines.push(`  Vintage families: ${JSON.stringify(f.headerVintages.families)}`);
    if (f.tiling.length) lines.push("  Candidate C — ORACLE-UNVERIFIED macro islands; not a complete function:", ...f.candidateC.statements.map(s => `    ${s}`));
    for (const tile of f.tiling) {
      lines.push(`  ${hex(tile.start)}–${hex(tile.end)} ${tile.macro} [${tile.header}:${tile.line}; ${tile.vintage}] nops absorbed=${tile.nopsAbsorbed}, compiler gaps=${tile.gaps.length}`, `    CANDIDATE: ${tile.candidateC}`);
      for (const e of tile.encodingEvidence) lines.push(`    PRODUCTION ENCODING: ${hex(e.from)} → ${hex(e.to)} via '${e.assemblerStatement}' from ${e.header}:${e.line}; ${e.containerKind} probe ${e.probeObject}+${e.probeOffset}. Candidate requires this GAS substitution, not the raw SDK .word.`);
      for (const b of tile.operands) lines.push(`    ${b.parameter}=${b.machine} → ${b.expression ?? "unresolved"} (${b.resolution})`);
      for (const alt of tile.alternatives) lines.push(`    ALSO COMPATIBLE: ${alt.macro} [${alt.header}:${alt.line}; ${alt.vintage}] ${alt.candidateC}`);
    }
    if (f.unmatchedCop2.length) lines.push(`  Unmatched COP2: ${f.unmatchedCop2.map(hex).join(", ")}`);
    for (const limitation of f.limitations.filter(s => s.includes("bound"))) lines.push(`  LIMIT: ${limitation}`);
  }
  for (const tu of report.translationUnits) lines.push(`\nTU ${tu.heading}: ${tu.finding} (${tu.vintages.join(", ") || "ambiguous"}); families=${JSON.stringify(tu.families)}`);
  for (const finding of report.censusFindings) lines.push(`\nNOT SCANNED ${finding.container}:${finding.function ?? "*"}: ${finding.reason}`);
  const reasons = [...new Set(report.templateDiagnostics.map(d => d.reason))];
  lines.push(`\nTemplate diagnostics: ${report.templateDiagnostics.length} (per-definition details in --json).`);
  for (const reason of reasons) lines.push(`  ${reason}`);
  if (report.mining) {
    lines.push(`\nMining: ${report.mining.candidates.length} candidates; ${report.mining.completeWithinBounds ? "complete within stated bounds" : "INCOMPLETE: pattern/candidate bound reached"}.`, `  Bounds: ${JSON.stringify(report.mining.bounds)}`, `  Pattern coverage: ${JSON.stringify(report.mining.patternCoverage)}`);
    for (const candidate of report.mining.candidates) {
      lines.push(`\n${candidate.tier} ${candidate.id}: ${candidate.verdict} (${candidate.claim})`, `  ${candidate.template.join("; ")}`, `  Signals: ${JSON.stringify(candidate.signals)}`);
      for (const site of candidate.occurrences) lines.push(`  ${site.container}:${site.function} ${hex(site.start)}–${hex(site.end)} params=${JSON.stringify(site.parameters)} feeds=${JSON.stringify(site.feeds)}`);
    }
    for (const pair of report.mining.identicalFunctions) lines.push(`\nIDENTICAL FUNCTION BYTES (${pair.size} bytes): ${pair.occurrences.map(s => `${s.container}:${s.function}@${hex(s.start)}`).join(", ")} — shared-header-static hypothesis only`);
  }
  if (report.conversionQueue.length) {
    lines.push("\nConversion queue — not converted/oracle-verified; asm bodies first, then tiling fraction and size:");
    for (const c of report.conversionQueue) lines.push(`  ${c.container}:${c.function}: ${c.verdict}, ${c.coverage.explained}/${c.coverage.total} (${c.coverage.fraction.toFixed(4)}); ${c.sourceRepresentation}; witnessed vintage ${c.headerVintages.witnessed.join(", ") || "undetermined"}`);
  }
  return lines.join("\n");
}

function main(args: string[]): void {
  if (args.includes("--help")) {
    console.log("Usage: npx tsx tools/diagnostics/macroIdentity.ts [--json] [--all] [--container ID] [--function NAME] [--headers PATH ...] [--raw-headers] [--mine tier-a|tier-b|all]\nDefault: tile every configured EXE/overlay function including INCLUDE_ASM; inventory skipped extracted overlays and report presence-only clusters.\n--all includes clean no-cop2 functions. --json includes the full census and diagnostics.\n--headers is repeatable and replaces default header paths; supports files/directories.\nSDK command encodings use production cpp/cc1/maspsx/GAS and the repo's active .inc include graph.\n--raw-headers disables that oracle for raw extraction diagnostics (not a production census).\nPresence is splat-text-bounded when enabled and unbounded/data-contaminable otherwise. Mining is opt-in, bounded, and reports incompleteness. No source edits or policy grants.");
    return;
  }
  const headerPaths: string[] = [];
  let containerId: string | undefined, functionName: string | undefined, mine: MinerOptions | undefined;
  let json = false, all = false, rawHeaders = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === "--json") json = true;
    else if (arg === "--all") all = true;
    else if (arg === "--raw-headers") rawHeaders = true;
    else if (["--container", "--function", "--headers", "--mine"].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (arg === "--headers") headerPaths.push(resolve(value));
      else if (arg === "--container") containerId = value;
      else if (arg === "--function") functionName = value;
      else {
        if (!["tier-a", "tier-b", "all"].includes(value)) throw new Error("--mine must be tier-a, tier-b or all");
        mine = { tier: value as "tier-a" | "tier-b" | "all" };
      }
    } else throw new Error(`Unknown argument ${arg}`);
  }
  const containers = containerId ? loadContainers().filter(c => c.id === containerId) : undefined;
  if (containers && !containers.length && !existsSync(join(ROOT, "extracted/overlays", `${containerId}.bin`))) throw new Error(`Unknown container ${containerId}`);
  const options: MacroIdentityOptions = { ...(containerId ? { containerIds: [containerId] } : {}), ...(headerPaths.length ? { headerPaths } : {}), ...(rawHeaders ? { resolveCommands: false } : {}), ...(mine ? { mine } : {}) };
  if (functionName) {
    const loaded = loadMacroFunctions(containers ?? loadContainers());
    const functions = loaded.functions.filter(f => f.name.toLowerCase() === functionName.toLowerCase());
    if (!functions.length) throw new Error(`Unknown or unscannable function ${functionName}`);
    options.functionNames = functions.map(f => f.name);
    options.containerIds = [...new Set(functions.map(f => f.container))];
    options.symbols = new Map((containers ?? loadContainers()).filter(c => functions.some(f => f.container === c.id)).map(c => [c.id, loadSymbolIndex(c).byAddress]));
  }
  const report = detectMacroIdentities(options);
  console.log(json ? JSON.stringify(report, null, 2) : formatMacroIdentityReport(report, all));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Macro identity: ${(error as Error).message}`); process.exitCode = 1; }
}
