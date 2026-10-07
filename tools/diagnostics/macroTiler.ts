/** Conservative bounded tiling over original words. A tile proves expansion
 * compatibility, never historical provenance or a byte-matching C solution. */
import { cop2Mnemonic, decodeMacroBytes, hex, isCop2, registerNumber, type MacroInstruction } from "./macroInstructions.js";
import type { CommandEncodingEvidence, InstructionPattern, MacroTemplate, TemplateLibrary } from "./macroTemplates.js";

export interface MacroFunction {
  name: string;
  container: string;
  vram: number;
  bytes: Buffer;
  /** Metadata only; never a filter on target-byte decoding/tiling. */
  sourceRepresentation?: "compiled-C" | "INCLUDE_ASM" | "top-level-asm" | "missing" | "not-inspected";
  /** Independent adjudication only; disassembler 'handwritten' comments do
   * not qualify. No COP2 heuristic may populate this field. */
  handwrittenEvidence?: string[];
}
export interface OperandBinding {
  parameter: string;
  kind: string;
  value: number;
  at: number;
  machine: string;
  expression: string | null;
  resolution: "stack" | "absolute" | "argument" | "constant" | "unresolved";
}
export interface MacroAlternative { macro: string; header: string; headerSha256: string; line: number; vintage: string; vintageFamily: string; candidateC: string; encodingEvidence: CommandEncodingEvidence[] }
export interface MacroTile extends MacroAlternative {
  start: number;
  end: number;
  instructionAddresses: number[];
  cop2Addresses: number[];
  nopsAbsorbed: number;
  gaps: number[];
  operands: OperandBinding[];
  alternatives: MacroAlternative[];
}
export interface MacroFunctionReport {
  name: string;
  container: string;
  start: number;
  end: number;
  sourceRepresentation: NonNullable<MacroFunction["sourceRepresentation"]>;
  cop2: { count: number; mnemonics: Record<string, number>; addresses: number[] };
  tiling: MacroTile[];
  coverage: { explained: number; total: number; fraction: number };
  verdict: "fully-tiled" | "partially-tiled" | "no-template-match" | "no-cop2";
  classification: "handwritten-asm" | "compiled-with-asm-macros" | "undetermined";
  classificationEvidence: string[];
  unmatchedCop2: number[];
  headerVintages: { witnessed: string[]; compatible: string[]; ambiguousSites: number[]; families: Array<{ family: string; witnessed: string[]; compatible: string[] }>; finding: "single-vintage" | "mixed-vintages" | "undetermined" };
  absorbedNops: number;
  candidateC: { oracleStatus: "unverified"; scope: "macro-islands-only"; statements: string[]; calls: Array<{ start: number; end: number; macro: string; header: string; vintage: string; statement: string; operandsResolved: boolean }> };
  limitations: string[];
}
export type MacroRouteSummary = Pick<MacroFunctionReport, "verdict" | "classification" | "sourceRepresentation" | "coverage" | "headerVintages" | "absorbedNops" | "candidateC"> & { cop2Count: number };
export function macroRouteSummary(report: MacroFunctionReport): MacroRouteSummary {
  return { verdict: report.verdict, classification: report.classification, sourceRepresentation: report.sourceRepresentation, cop2Count: report.cop2.count, coverage: report.coverage, headerVintages: report.headerVintages, absorbedNops: report.absorbedNops, candidateC: report.candidateC };
}

export interface TilerOptions { maxGap?: number; maxNops?: number; maxSearchStates?: number }
interface Binding { kind: string; value: number; index: number }
interface Match { template: MacroTemplate; indices: number[]; bindings: Map<string, Binding>; nops: number; gaps: number[] }

function patternMatches(p: InstructionPattern, insn: MacroInstruction, bindings: Map<string, Binding>, index: number): Map<string, Binding> | null {
  if (p.op === "literal-word") {
    return p.args[0]?.value === insn.word ? new Map(bindings) : null;
  }
  if (p.op !== insn.op || p.args.length !== insn.args.length) return null;
  const next = new Map(bindings);
  for (let a = 0; a < p.args.length; a++) {
    const expected = p.args[a]!, actual = insn.args[a]!;
    if (expected.kind !== actual.kind) return null;
    if (typeof expected.value === "number") { if (actual.value !== expected.value) return null; }
    else {
      const prior = next.get(expected.value);
      if (prior && (prior.value !== actual.value || prior.kind !== actual.kind)) return null;
      next.set(expected.value, prior ?? { kind: actual.kind, value: actual.value, index });
    }
  }
  return next;
}

function tryMatch(template: MacroTemplate, insns: MacroInstruction[], start: number, targets: Set<number>, options: Required<TilerOptions>): { match: Match | null; limited: boolean } {
  const patterns = template.blocks.flatMap((b, block) => b.instructions.map(p => ({ p, block })));
  if (start > 0 && insns[start - 1]?.control && patterns.length > 1) return { match: null, limited: false };
  const fixed = new Set(patterns.flatMap(({ p }) => p.args.filter(a => a.kind === "gpr" && typeof a.value === "number").map(a => a.value as number)));
  let states = 0, limited = false;
  function visit(pi: number, pos: number, bindings: Map<string, Binding>, indices: number[], nops: number, gaps: number[]): Match | null {
    if (++states > options.maxSearchStates) { limited = true; return null; }
    if (pi === patterns.length) return { template, bindings, indices, nops, gaps };
    const current = patterns[pi]!;
    const between = pi > 0 && current.block !== patterns[pi - 1]!.block;
    let skippedNops = 0, skippedGaps = 0;
    const localGaps: number[] = [];
    for (let at = pos; at < insns.length; at++) {
      const insn = insns[at]!;
      if (at > start && targets.has(insn.vram)) break;
      const next = patternMatches(current.p, insn, bindings, at);
      const hardClobbers = template.blocks[current.block]!.clobbers.map(c => registerNumber(c) ?? -1);
      const impossibleOperand = next && current.p.args.some(a => typeof a.value === "string" && next.get(a.value)?.kind === "gpr" && hardClobbers.includes(next.get(a.value)!.value));
      if (next && !impossibleOperand) {
        const found = visit(pi + 1, at + 1, next, [...indices, at], nops + skippedNops, [...gaps, ...localGaps]);
        if (found) return found;
      }
      if (pi === 0) break; // Anchor exactly at start; never silently widen.
      if (insn.op === "nop") {
        if (++skippedNops > options.maxNops) break;
      } else {
        if (!between || insn.control || insn.memory || isCop2(insn) || insn.op === "unknown" || ++skippedGaps > options.maxGap) break;
        const protectedRegs = new Set([...fixed, ...[...bindings.values()].filter(b => b.kind === "gpr").map(b => b.value)]);
        // A compiler instruction cannot be moved through an opaque asm's hard
        // register effects, even if it happens to match a later pattern.
        if ([...insn.writes, ...insn.reads].some(r => r !== 0 && protectedRegs.has(r))) break;
        localGaps.push(insn.vram);
      }
      if (limited) break;
    }
    return null;
  }
  return { match: visit(0, start, new Map(), [], 0, []), limited };
}

interface Value { expression: string; resolution: OperandBinding["resolution"]; number?: number; stackOffset?: number }
/** Best-effort straight-line operand feeds. Joins, calls, loads and unknown
 * effects kill facts. It deliberately does not invent C local types/names. */
function operandStates(insns: MacroInstruction[], targets: Set<number>, symbols: ReadonlyMap<number, string>): Map<number, Value>[] {
  let state = new Map<number, Value>();
  for (let reg = 4; reg <= 7; reg++) state.set(reg, { expression: `arg${reg - 4}`, resolution: "argument" });
  const snapshots: Map<number, Value>[] = [];
  let clearAfter = -1;
  for (let index = 0; index < insns.length; index++) {
    const insn = insns[index]!;
    if (targets.has(insn.vram) || clearAfter === index) state.clear();
    state.set(0, { expression: "0", resolution: "constant", number: 0 });
    state.set(29, { expression: "&stack_0x0", resolution: "stack", stackOffset: 0 });
    snapshots.push(new Map(state));
    const a = insn.args.map(x => x.value);
    const source = state.get(a[1] ?? -1);
    let value: Value | undefined;
    if (insn.op === "lui") value = { expression: hex(a[1]! << 16), resolution: "constant", number: (a[1]! << 16) >>> 0 };
    else if (["addiu", "addi", "ori"].includes(insn.op) && source) {
      if (source.number !== undefined) {
        const number = (insn.op === "ori" ? source.number | a[2]! : source.number + a[2]!) >>> 0;
        const symbol = symbols.get(number);
        value = { number, expression: symbol ? `&${symbol}` : hex(number), resolution: symbol ? "absolute" : "constant" };
      } else if (insn.op !== "ori" && source.stackOffset !== undefined) {
        const offset = source.stackOffset + a[2]!;
        value = { stackOffset: offset, expression: offset < 0 ? `((char *)&stack_0x0 - ${-offset})` : `&stack_0x${offset.toString(16)}`, resolution: "stack" };
      } else if (insn.op !== "ori") value = { expression: `((char *)${source.expression} + ${a[2]})`, resolution: source.resolution };
    } else if ((insn.op === "addu" || insn.op === "or") && (a[1] === 0 || a[2] === 0)) value = state.get(a[1] === 0 ? a[2]! : a[1]!);
    if (insn.writes.includes(29)) {
      // Existing stack-derived pointers refer to the *previous* SP. Without a
      // full frame/CFG model they cannot be renamed against the new SP safely.
      for (const [reg, fact] of state) if (fact.resolution === "stack") state.delete(reg);
    }
    for (const reg of insn.writes) state.delete(reg);
    if (value && insn.writes[0] !== undefined && insn.writes[0] !== 29) state.set(insn.writes[0], value);
    if (insn.control) clearAfter = index + 2; // include the delay slot, then kill all facts
    if (insn.op === "unknown") state.clear();
  }
  return snapshots;
}

function alternative(template: MacroTemplate, operands: OperandBinding[]): MacroAlternative {
  const args = template.parameters.map(p => {
    const binding = operands.find(b => b.parameter === p);
    return binding?.expression ?? `/* unresolved ${binding?.machine ?? p} */ ${p}`;
  });
  return { macro: template.macro, header: template.header, headerSha256: template.headerSha256, line: template.line, vintage: template.vintage, vintageFamily: template.vintageFamily, candidateC: `${template.macro}(${args.join(", ")});`, encodingEvidence: template.encodingEvidence };
}

/** Pure single-function API for future agent-tool integration. No compilation,
 * writes, call-graph mutations or source-policy changes occur here. */
export function tileMacroFunction(fn: MacroFunction, library: TemplateLibrary, options: TilerOptions = {}, symbols: ReadonlyMap<number, string> = new Map()): MacroFunctionReport {
  const limits = { maxGap: options.maxGap ?? 16, maxNops: options.maxNops ?? 8, maxSearchStates: options.maxSearchStates ?? 4096 };
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < (key === "maxSearchStates" ? 1 : 0)) throw new Error(`Invalid ${key}`);
  const insns = decodeMacroBytes(fn.bytes, fn.vram);
  const targets = new Set(insns.filter(i => i.target !== null && i.op !== "jal").map(i => i.target!));
  const snapshots = operandStates(insns, targets, symbols);
  const cop = insns.filter(isCop2);
  const mnemonics: Record<string, number> = {};
  for (const insn of cop) {
    const mnemonic = cop2Mnemonic(insn);
    mnemonics[mnemonic] = (mnemonics[mnemonic] ?? 0) + 1;
  }
  const matches: Match[] = [];
  let limited = false;
  // Anchor by opcode, avoiding a templates × instructions quadratic census.
  const anchors = new Map<string, MacroTemplate[]>();
  const presentWords = new Set(insns.map(i => i.word));
  for (const t of library.templates) {
    const first = t.blocks[0]?.instructions[0];
    if (!first || t.blocks.every(b => b.instructions.every(p => p.op === "nop"))) continue;
    // A required literal command absent from the whole function cannot match.
    // This also keeps unadapted DMPSX templates from competing at every nop.
    if (t.blocks.some(b => b.instructions.some(p => p.args.some(a => a.kind === "word" && typeof a.value === "number" && !presentWords.has(a.value))))) continue;
    anchors.set(first.op, [...(anchors.get(first.op) ?? []), t]);
  }
  for (let index = 0; index < insns.length; index++) {
    const templates = [...(anchors.get(insns[index]!.op) ?? []), ...(anchors.get("literal-word") ?? [])];
    for (const t of templates) {
      const tested = tryMatch(t, insns, index, targets, limits);
      limited ||= tested.limited;
      if (tested.match) matches.push(tested.match);
    }
  }
  // Longest evidence first. Overlaps are alternatives, never double coverage.
  // Only matched instruction addresses (not compiler gaps) occupy a tile.
  matches.sort((a, b) => b.indices.filter(i => isCop2(insns[i]!)).length - a.indices.filter(i => isCop2(insns[i]!)).length || b.indices.length - a.indices.length || a.indices[0]! - b.indices[0]! || a.template.id.localeCompare(b.template.id));
  const occupied = new Set<number>(), tiling: MacroTile[] = [];
  for (const match of matches) {
    const addresses = match.indices.map(i => insns[i]!.vram);
    const operands: OperandBinding[] = [...match.bindings].map(([parameter, binding]) => {
      const value = binding.kind === "gpr" ? snapshots[binding.index]?.get(binding.value) : undefined;
      return { parameter, kind: binding.kind, value: binding.value, at: insns[binding.index]!.vram, machine: binding.kind === "gpr" ? `$${binding.value}` : hex(binding.value), expression: value?.expression ?? (binding.kind === "word" || binding.kind === "imm" ? hex(binding.value) : null), resolution: value?.resolution ?? (binding.kind !== "gpr" ? "constant" : "unresolved") };
    });
    const alt = alternative(match.template, operands);
    if (addresses.some(a => occupied.has(a))) {
      const same = tiling.find(t => t.instructionAddresses.length === addresses.length && t.instructionAddresses.every((a, i) => a === addresses[i]));
      if (same) same.alternatives.push(alt);
      continue;
    }
    addresses.forEach(a => occupied.add(a));
    tiling.push({ ...alt, start: addresses[0]!, end: addresses[addresses.length - 1]! + 4, instructionAddresses: addresses, cop2Addresses: match.indices.filter(i => isCop2(insns[i]!)).map(i => insns[i]!.vram), nopsAbsorbed: match.nops, gaps: match.gaps, operands, alternatives: [] });
  }
  tiling.sort((a, b) => a.start - b.start);
  const unmatchedCop2 = cop.filter(i => !occupied.has(i.vram)).map(i => i.vram);
  const explained = cop.length - unmatchedCop2.length;
  const verdict = !cop.length ? "no-cop2" : !unmatchedCop2.length ? "fully-tiled" : explained ? "partially-tiled" : "no-template-match";
  const classification = fn.handwrittenEvidence?.length ? "handwritten-asm" : tiling.length && !unmatchedCop2.length ? "compiled-with-asm-macros" : "undetermined";
  const limitations = ["Matches and C statements are candidates for byte-oracle verification, not historical provenance.", "Stack names and argument expressions are symbolic; recover their C declarations/types before use."];
  if (limited) limitations.push("Template search-state bound reached; absence of a match is not exhaustive.");
  const ambiguousSites = tiling.filter(t => t.alternatives.some(a => a.vintage !== t.vintage)).map(t => t.start);
  const witnessed = [...new Set(tiling.filter(t => !ambiguousSites.includes(t.start)).map(t => t.vintage))].sort();
  const compatible = [...new Set(tiling.flatMap(t => [t.vintage, ...t.alternatives.map(a => a.vintage)]))].sort();
  const familyNames = [...new Set(tiling.flatMap(t => [t.vintageFamily, ...t.alternatives.map(a => a.vintageFamily)]))].sort();
  const families = familyNames.map(family => ({ family, witnessed: [...new Set(tiling.filter(t => t.vintageFamily === family && !ambiguousSites.includes(t.start)).map(t => t.vintage))].sort(), compatible: [...new Set(tiling.flatMap(t => [t, ...t.alternatives]).filter(t => t.vintageFamily === family).map(t => t.vintage))].sort() }));
  const headerVintages: MacroFunctionReport["headerVintages"] = { witnessed, compatible, ambiguousSites, families, finding: families.some(f => f.witnessed.length > 1) ? "mixed-vintages" : witnessed.length ? "single-vintage" : "undetermined" };
  const candidateC: MacroFunctionReport["candidateC"] = { oracleStatus: "unverified", scope: "macro-islands-only", statements: tiling.map(t => t.candidateC), calls: tiling.map(t => ({ start: t.start, end: t.end, macro: t.macro, header: t.header, vintage: t.vintage, statement: t.candidateC, operandsResolved: t.operands.every(o => o.resolution !== "unresolved") })) };
  return { name: fn.name, container: fn.container, start: fn.vram, end: fn.vram + fn.bytes.length, sourceRepresentation: fn.sourceRepresentation ?? "not-inspected", cop2: { count: cop.length, mnemonics, addresses: cop.map(i => i.vram) }, tiling, coverage: { explained, total: cop.length, fraction: cop.length ? explained / cop.length : 0 }, verdict, classification, classificationEvidence: fn.handwrittenEvidence?.length ? fn.handwrittenEvidence : classification === "compiled-with-asm-macros" ? ["Header expansion compatibility covers all observed COP2 instructions (or a non-COP2 asm island)."] : ["COP2 content or failure to tile alone cannot establish handwritten origin."], unmatchedCop2, headerVintages, absorbedNops: tiling.reduce((sum, t) => sum + t.nopsAbsorbed, 0), candidateC, limitations };
}
