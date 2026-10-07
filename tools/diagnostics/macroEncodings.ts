/** Project-owned GTE command encoding oracle. Discover the GAS definitions
 * included by a real common.h compile, then compile probes with the SAME
 * cpp -> configured cc1 -> maspsx -> GAS pipeline as production C. No foreign
 * replacement header, copied opcode table or target-dependent choice is used.
 * SDK literals remain intact; the report records the required GAS substitution. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { compileSource, configuredAsFlagsForContainer, configuredCppFlags, configuredMaspsxFlags, configuredToolchainIdentity, ROOT } from "../agent/decompToolchain.js";
import { elf32SectionSizes } from "../lib/elfSections.js";
import type { CommandEncodingEvidence, MacroTemplate, TemplateLibrary } from "./macroTemplates.js";

const digest = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
const projectPath = (path: string): string => relative(ROOT, path).split("\\").join("/");
export interface GasMacroDefinition { header: string; headerSha256: string; line: number; macro: string; parameters: string[] }
export interface RepoEncodingReport {
  containerKind: "exe" | "overlay";
  toolchain: ReturnType<typeof configuredToolchainIdentity>;
  cppFlags: string[];
  cc1Flags: string[];
  maspsxFlags: string[];
  asFlags: string[];
  includes: Array<{ path: string; sha256: string }>;
  probeSource: string;
  probeAssembly: string;
  probeObject: string;
  probeObjectSha256: string;
  commands: Array<{ statement: string; word: number; offset: number }>;
  reconstructionHeaders: Array<{ vintage: string; path: string; sha256: string }>;
}

/** Assembly grammar only (not C). Blank comments without changing line numbers
 * so commented-out macros/encodings cannot become definitions. */
function assemblyWithoutComments(source: string): string {
  let block = false, quoted = false, escaped = false, lineComment = false, result = "";
  for (let index = 0; index < source.length; index++) {
    const ch = source[index]!, next = source[index + 1];
    if (ch === "\n") { result += ch; lineComment = false; escaped = false; continue; }
    if (lineComment) { result += " "; continue; }
    if (block) {
      if (ch === "*" && next === "/") { result += "  "; index++; block = false; }
      else result += " ";
      continue;
    }
    if (!quoted && ch === "/" && next === "*") { result += "  "; index++; block = true; continue; }
    if (!quoted && ch === "#") { result += " "; lineComment = true; continue; }
    result += ch;
    if (ch === '"' && !escaped) quoted = !quoted;
    escaped = ch === "\\" && !escaped;
  }
  if (block || quoted) throw new Error("Unterminated assembly comment/string");
  return result;
}

export function parseGasMacroDefinitions(source: string, header: string): GasMacroDefinition[] {
  const result: GasMacroDefinition[] = [];
  const lines = assemblyWithoutComments(source).split("\n");
  let open = false;
  lines.forEach((line, index) => {
    const start = line.match(/^\s*\.macro\s+([A-Za-z_.$][\w.$]*)(?:\s+(.*))?\s*$/);
    if (start) {
      if (open) throw new Error(`Nested GAS macro in ${header}:${index + 1}`);
      open = true;
      const parameters = (start[2] ?? "").split(",").map(p => p.trim()).filter(Boolean);
      result.push({ header, headerSha256: digest(source), line: index + 1, macro: start[1]!, parameters });
    } else if (/^\s*\.endm\s*$/.test(line)) {
      if (!open) throw new Error(`Unmatched .endm in ${header}:${index + 1}`);
      open = false;
    }
  });
  if (open) throw new Error(`Unterminated GAS macro in ${header}`);
  return result;
}

/** Follow the literal .include graph emitted by the real compiler. Resolution
 * uses production cwd/-I flags. We do not infer an include from a C comment. */
function includeClosure(assembly: string, asFlags: string[]): Array<{ path: string; source: string }> {
  const directories = [ROOT, ...asFlags.filter(f => f.startsWith("-I")).map(f => f.slice(2))];
  const seen = new Set<string>(), includes: Array<{ path: string; source: string }> = [];
  function visit(source: string): void {
    for (const match of assemblyWithoutComments(source).matchAll(/^\s*\.include\s+"([^"\n]+)"\s*$/gm)) {
      const name = match[1]!;
      const path = isAbsolute(name) ? name : directories.map(dir => resolve(dir, name)).find(existsSync);
      if (!path || !existsSync(path)) throw new Error(`Cannot resolve production assembler include ${name}`);
      const absolute = resolve(path);
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      const child = readFileSync(absolute, "utf8");
      includes.push({ path: absolute, source: child });
      visit(child);
    }
  }
  visit(assembly);
  return includes;
}

function commandOf(template: MacroTemplate): { from: number; statement: string } | null {
  if (template.parameters.length || template.dependencies.length || !template.macro.startsWith("gte_")) return null;
  const instructions = template.blocks.flatMap(b => b.instructions);
  const words = instructions.filter(i => i.op === "literal-word");
  if (words.length !== 1 || instructions.some(i => i.op !== "nop" && i.op !== "literal-word")) return null;
  const from = words[0]!.args[0]?.value;
  if (typeof from !== "number" || (from & 63) !== 63) return null;
  // SDK's documented gte_ prefix and no-nop _b suffix; no synonym/argument
  // guesses for names absent from the actual GAS include graph.
  return { from, statement: template.macro.slice(4).replace(/_b$/, "") };
}

/** Validate via the shared ELF reader, then read this probe's own section.
 * These are object bytes, not comments containing example hex words. */
export function readEncodingProbeSection(object: Buffer, sectionName = ".macro_identity_probe"): Buffer {
  const sizes = elf32SectionSizes(object);
  if (object[5] !== 1 || object.readUInt16LE(18) !== 8) throw new Error("Expected production little-endian MIPS ELF32");
  const table = object.readUInt32LE(32), stride = object.readUInt16LE(46), count = object.readUInt16LE(48);
  const namesHeader = table + object.readUInt16LE(50) * stride;
  const names = object.readUInt32LE(namesHeader + 16);
  for (let index = 0; index < count; index++) {
    const section = table + index * stride, start = names + object.readUInt32LE(section);
    const end = object.indexOf(0, start);
    const name = object.toString("utf8", start, end);
    if (name !== sectionName) continue;
    const offset = object.readUInt32LE(section + 16), size = object.readUInt32LE(section + 20);
    if (size !== sizes.get(name)) throw new Error("Probe section validation disagrees");
    return object.subarray(offset, offset + size);
  }
  throw new Error("Production compiler did not emit the macro probe section");
}

function substitutionLiteral(template: MacroTemplate, statement: string): string[] {
  return template.blocks.map(b => b.instructions.map(p => p.op === "literal-word" ? statement : p.literal).join(";"));
}

/** Pure transforms are intentionally insufficient here: command encodings must
 * have passed the actual project compiler/assembler path for this flag column.
 * Artifacts land only under build/. Failure is fatal, never a foreign fallback. */
export function deriveRepoMacroEncodings(library: TemplateLibrary, containerKind: "exe" | "overlay" = "exe"): { library: TemplateLibrary; report: RepoEncodingReport } {
  if (library.templates.some(t => t.encodingEvidence.length)) throw new Error("Production encoding derivation requires raw header templates, not previously translated libraries");
  const base = join(ROOT, "build/macroIdentity/repo-encodings", containerKind);
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, "probe-"));
  const contextSource = join(dir, "context.c");
  writeFileSync(contextSource, '#include "common.h"\n');
  const context = compileSource(contextSource, dir, "context", { assemble: false, useOverrides: false, containerKind });
  const asFlags = configuredAsFlagsForContainer(containerKind);
  const includes = includeClosure(readFileSync(context.assembly, "utf8"), asFlags);
  const gasDefs = includes.flatMap(input => parseGasMacroDefinitions(input.source, projectPath(input.path)));
  const available = new Map<string, GasMacroDefinition[]>();
  for (const def of gasDefs) available.set(def.macro, [...(available.get(def.macro) ?? []), def]);
  const primitives = library.templates.map(t => ({ template: t, command: commandOf(t) })).filter((entry): entry is { template: MacroTemplate; command: { from: number; statement: string } } => entry.command !== null);
  const diagnostics = [...library.diagnostics];
  const matched = primitives.filter(({ template, command }) => {
    const defs = available.get(command.statement) ?? [];
    if (defs.length === 1 && !defs[0]!.parameters.length) return true;
    diagnostics.push({ header: template.header, macro: template.macro, line: template.line, reason: `No unambiguous zero-argument production GAS macro '${command.statement}'; SDK sentinel not translated` });
    return false;
  });
  const statements = [...new Set(matched.map(p => p.command.statement))].sort();
  const probeSource = join(dir, "commands.c");
  // common.h supplies the actual configured macro.inc/labels.inc include;
  // nothing here directly injects a replacement header into that environment.
  const assembly = '.section .macro_identity_probe,"ax",@progbits\n.set noreorder\n' + statements.join("\n") + '\n.set reorder\n.text\n';
  writeFileSync(probeSource, `#include "common.h"\n__asm__(${JSON.stringify(assembly)});\n`);
  const probe = compileSource(probeSource, dir, "commands", { assemble: true, useOverrides: false, containerKind });
  const object = readFileSync(probe.object!), objectSha256 = digest(object), code = readEncodingProbeSection(object);
  if (code.length !== statements.length * 4) throw new Error("Production GAS command expansions are not exactly one word each; refusing positional mapping");
  const commands = statements.map((statement, index) => ({ statement, word: code.readUInt32LE(index * 4), offset: index * 4 }));
  if (commands.some(c => c.word >>> 26 !== 0x12 || ((c.word >>> 21) & 31) < 16)) throw new Error("A production GAS macro did not emit a GTE command; refusing mapping");
  const byStatement = new Map(commands.map(c => [c.statement, c]));
  const witnesses = new Map<number, CommandEncodingEvidence[]>();
  for (const { command } of matched) {
    const def = available.get(command.statement)![0]!, result = byStatement.get(command.statement)!;
    const evidence: CommandEncodingEvidence = { header: def.header, headerSha256: def.headerSha256, line: def.line, macro: def.macro, from: command.from, to: result.word, assemblerStatement: command.statement, containerKind, probeObject: projectPath(probe.object!), probeObjectSha256: objectSha256, probeOffset: result.offset };
    witnesses.set(command.from, [...(witnesses.get(command.from) ?? []), evidence]);
  }
  const accepted = new Map<number, CommandEncodingEvidence>();
  for (const [word, evidence] of witnesses) {
    if (new Set(evidence.map(e => e.to)).size === 1) accepted.set(word, evidence[0]!);
    else for (const { template, command } of matched.filter(p => p.command.from === word)) diagnostics.push({ header: template.header, macro: template.macro, line: template.line, reason: `Conflicting production GAS encodings for SDK sentinel ${command.from}; not translated` });
  }
  const templates = library.templates.map(template => {
    const encodingEvidence = [...template.encodingEvidence];
    const blocks = template.blocks.map(block => ({ ...block, instructions: block.instructions.map(p => {
      const evidence = p.op === "literal-word" && typeof p.args[0]?.value === "number" ? accepted.get(p.args[0].value) : undefined;
      if (!evidence) return p;
      if (!encodingEvidence.some(e => e.from === evidence.from)) encodingEvidence.push(evidence);
      return { ...p, op: "cop2", args: [{ kind: "word" as const, value: evidence.to }] };
    }) }));
    return { ...template, blocks, encodingEvidence };
  });
  // Emit separate vintage overrides: preserve the primitive asm block and
  // clobber boundaries. These are diagnostic candidate headers, never src edits.
  const reconstructionHeaders: RepoEncodingReport["reconstructionHeaders"] = [];
  for (const vintage of [...new Set(matched.map(p => p.template.vintage))].sort()) {
    const entries = matched.filter(p => p.template.vintage === vintage && accepted.has(p.command.from));
    const definitions = entries.map(({ template, command }) => {
      const literals = substitutionLiteral(template, command.statement);
      const body = template.blocks.map((block, index) => `__asm__ volatile(${JSON.stringify(literals[index])}${block.clobbers.length ? ` : : : ${block.clobbers.map(c => JSON.stringify(c)).join(",")}` : ""})`).join("; ");
      return `#undef ${template.macro}\n#define ${template.macro}() ${body}\n`;
    }).join("\n");
    const path = join(dir, `${vintage}.gas.h`);
    writeFileSync(path, `/* Generated diagnostic GAS substitutions; include after ${vintage}. */\n${definitions}`);
    reconstructionHeaders.push({ vintage, path: projectPath(path), sha256: digest(readFileSync(path)) });
  }
  const report: RepoEncodingReport = { containerKind, toolchain: configuredToolchainIdentity(), cppFlags: configuredCppFlags(), cc1Flags: probe.cc1Flags, maspsxFlags: configuredMaspsxFlags(), asFlags, includes: includes.map(input => ({ path: projectPath(input.path), sha256: digest(input.source) })), probeSource: projectPath(probeSource), probeAssembly: projectPath(probe.assembly), probeObject: projectPath(probe.object!), probeObjectSha256: objectSha256, commands, reconstructionHeaders };
  writeFileSync(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return { library: { templates, diagnostics: diagnostics.filter(d => !d.reason.startsWith("DMPSX sentinel") || templates.some(t => t.header === d.header && t.macro === d.macro && t.blocks.some(b => b.instructions.some(p => p.op === "literal-word")))) }, report };
}
