/** Two recurrence tiers. These are bounded hypotheses, NOT macro identities.
 * Tier A requires asm-like evidence; Tier B only claims a shared source shape.
 * Identical whole-function bytes are reported separately, including pairs. */
import { createHash } from "node:crypto";
import { decodeMacroBytes, instructionKey, isCop2, type MacroInstruction } from "./macroInstructions.js";
import type { MacroFunction, MacroFunctionReport } from "./macroTiler.js";
import { mineCompiledEffects } from "./macroEffects.js";

export interface MacroOccurrence { function: string; container: string; start: number; end: number; parameters: Record<string, number>; feeds: Record<string, string> }
export interface MacroCandidate {
  id: string;
  tier: "asm-origin" | "compiled-idiom";
  representation: "instruction-window" | "effect-window";
  template: string[];
  parameters: string[];
  occurrences: MacroOccurrence[];
  signals: { cop2: boolean; registerRigidity: boolean; rigidRegisters: number[]; independentPairs: number; orderRigidity: "observed-in-occurrences" | "not-tested"; variantFeed: boolean; unusualInstructions: string[] };
  verdict: "macro-candidate" | "compiler-explainable" | "undetermined";
  claim: "asm-origin-hypothesis" | "shared-source-shape";
}
export interface MiningReport {
  candidates: MacroCandidate[];
  identicalFunctions: Array<{ sha256: string; size: number; occurrences: Array<{ function: string; container: string; start: number }> }>;
  bounds: Required<MinerOptions>;
  completeWithinBounds: boolean;
  patternCoverage: { instructionPatternsRetained: number; effectPatternsRetained: number; candidateCountBeforeOutputCap: number; candidatesTruncated: number; policy: string };
  limitations: string[];
}
export interface MinerOptions { tier?: "tier-a" | "tier-b" | "all"; minSupport?: number; minLength?: number; maxLength?: number; maxPatterns?: number; maxCandidates?: number }
interface Normalized { key: string; template: string[]; registers: Map<number, string> }
const hash = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");
const SCRATCH = new Set([8, 12, 13, 14, 15]);

function normalized(seq: MacroInstruction[], tier: "asm-origin" | "compiled-idiom"): Normalized {
  const registers = new Map<number, string>();
  const template = seq.map(insn => `${insn.op} ${insn.args.map((atom, index) => {
    if (atom.kind === "gpr") {
      if ([0, 28, 29, 31].includes(atom.value) || tier === "asm-origin" && SCRATCH.has(atom.value)) return `$${atom.value}`;
      if (!registers.has(atom.value)) registers.set(atom.value, `p${registers.size}`);
      return `%${registers.get(atom.value)}`;
    }
    if (tier === "compiled-idiom" && insn.memory && index === 1 && insn.args[2]?.value === 29) return "%stack_offset";
    return `${atom.kind}:${atom.value}`;
  }).join(",")}`);
  return { key: template.join(";"), template, registers };
}
function unusual(insn: MacroInstruction): string | null {
  if (insn.op === "ori" && insn.args[1]?.value === 29) return "ori-from-sp (not an ordinary GCC address add)";
  if (insn.op === "sw" && insn.args[0]?.value === 31 && insn.args[2]?.value !== 29) return "live-ra-store outside the stack frame";
  return null;
}
function independentPairs(seq: MacroInstruction[]): number {
  let count = 0;
  for (let a = 0; a < seq.length; a++) for (let b = a + 1; b < seq.length; b++) {
    const x = seq[a]!, y = seq[b]!;
    // Conservative: memory, unknown HI/LO effects and GTE commands may alias.
    if (x.control || y.control || x.memory || y.memory || x.op === "cop2" || y.op === "cop2" || /^(?:m[ft]|div)/.test(x.op) || /^(?:m[ft]|div)/.test(y.op)) continue;
    const touching = x.writes.some(r => r !== 0 && [...y.reads, ...y.writes].includes(r)) || y.writes.some(r => r !== 0 && x.reads.includes(r));
    const copWrites = (i: MacroInstruction): number[] => /^(?:mtc2|ctc2)$/.test(i.op) ? [i.args[1]!.value] : [];
    const copReads = (i: MacroInstruction): number[] => /^(?:mfc2|cfc2)$/.test(i.op) ? [i.args[1]!.value] : [];
    const copHazard = copWrites(x).some(r => [...copReads(y), ...copWrites(y)].includes(r)) || copWrites(y).some(r => copReads(x).includes(r));
    if (!touching && !copHazard) count++;
  }
  return count;
}
function feedsAt(insns: MacroInstruction[], start: number, regs: Map<number, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [reg, slot] of regs) {
    let feed = "incoming-or-unknown";
    for (let index = start - 1; index >= Math.max(0, start - 12); index--) {
      const insn = insns[index]!;
      if (insn.control || insn.op === "unknown") break;
      if (insn.writes.includes(reg)) { feed = instructionKey(insn); break; }
    }
    result[slot] = feed;
  }
  return result;
}

export function mineMacroCandidates(functions: readonly MacroFunction[], known: readonly MacroFunctionReport[] = [], options: MinerOptions = {}): MiningReport {
  const bounds: Required<MinerOptions> = { tier: options.tier ?? "all", minSupport: options.minSupport ?? 3, minLength: options.minLength ?? 2, maxLength: options.maxLength ?? 12, maxPatterns: options.maxPatterns ?? 200000, maxCandidates: options.maxCandidates ?? 500 };
  for (const [key, value] of Object.entries(bounds)) if (key !== "tier" && (!Number.isSafeInteger(value) || Number(value) < (key === "minSupport" ? 2 : 1))) throw new Error(`Invalid mining ${key}`);
  if (bounds.maxLength < bounds.minLength) throw new Error("maxLength must be >= minLength");
  const tiers: Array<"asm-origin" | "compiled-idiom"> = bounds.tier === "tier-a" ? ["asm-origin"] : bounds.tier === "tier-b" ? ["compiled-idiom"] : ["asm-origin", "compiled-idiom"];
  const covered = new Map(known.map(f => [`${f.container}:${f.name}`, new Set(f.tiling.flatMap(t => t.instructionAddresses))]));
  const repeats = new Map<string, { tier: "asm-origin" | "compiled-idiom"; template: string[]; seq: MacroInstruction[]; sites: Array<{ occurrence: MacroOccurrence }> }>();
  const twins = new Map<string, MacroFunction[]>();
  let completeWithinBounds = true;
  for (const fn of functions) {
    const digest = hash(fn.bytes);
    if (fn.bytes.length >= 8) twins.set(digest, [...(twins.get(digest) ?? []), fn]);
    const insns = decodeMacroBytes(fn.bytes, fn.vram);
    const knownAddresses = covered.get(`${fn.container}:${fn.name}`) ?? new Set<number>();
    for (const tier of tiers) {
      for (let start = 0; start < insns.length; start++) {
        for (let length = bounds.minLength; length <= bounds.maxLength && start + length <= insns.length; length++) {
          const seq = insns.slice(start, start + length);
          // Do not cross control transfers except a direct call and its delay
          // slot in Tier B. No unknown words or all-nop "patterns".
          if (seq.some(i => i.op === "unknown" || i.control && (tier === "asm-origin" || i.op !== "jal"))) break;
          if (seq.every(i => i.op === "nop")) continue;
          if (tier === "asm-origin" && (!seq.some(i => isCop2(i) || unusual(i)) || seq.some(i => knownAddresses.has(i.vram)))) continue;
          if (tier === "compiled-idiom" && seq.some(isCop2)) continue;
          const norm = normalized(seq, tier), key = `${tier}:${norm.key}`;
          let group = repeats.get(key);
          if (!group) {
            if (repeats.size >= bounds.maxPatterns) { completeWithinBounds = false; continue; }
            group = { tier, template: norm.template, seq, sites: [] }; repeats.set(key, group);
          }
          // Overlapping occurrences in one function are not independent sites.
          if (group.sites.some(s => s.occurrence.container === fn.container && s.occurrence.function === fn.name && s.occurrence.end > seq[0]!.vram)) continue;
          const parameters = Object.fromEntries([...norm.registers].map(([reg, slot]) => [slot, reg]));
          group.sites.push({ occurrence: { function: fn.name, container: fn.container, start: seq[0]!.vram, end: seq[seq.length - 1]!.vram + 4, parameters, feeds: feedsAt(insns, start, norm.registers) } });
        }
      }
    }
  }
  const effectMining = bounds.tier !== "tier-a" ? mineCompiledEffects(functions, bounds.minSupport, bounds.maxLength, bounds.maxPatterns) : { candidates: [], complete: true, patternCount: 0 };
  completeWithinBounds &&= effectMining.complete;
  const candidates: MacroCandidate[] = [...effectMining.candidates];
  for (const group of repeats.values()) {
    const first = group.sites[0]!;
    const slots = Object.keys(first.occurrence.parameters);
    const defined = new Set<number>(), external = new Set<number>();
    for (const insn of group.seq) {
      for (const reg of insn.reads) if (reg !== 0 && !defined.has(reg)) external.add(reg);
      insn.writes.forEach(reg => defined.add(reg));
    }
    const entrySlots = slots.filter(p => external.has(first.occurrence.parameters[p]!));
    const variantFeed = entrySlots.some(p => new Set(group.sites.map(s => s.occurrence.feeds[p])).size > 1);
    const unusualInstructions = [...new Set(group.seq.map(unusual).filter((s): s is string => s !== null))];
    const distinctFunctions = new Set(group.sites.map(s => `${s.occurrence.container}:${s.occurrence.function}`)).size;
    const registers = [...new Set(group.seq.flatMap(i => i.args.filter(a => a.kind === "gpr").map(a => a.value)))];
    const rigidRegisters = registers.filter(reg => SCRATCH.has(reg)); // normalization fixes these at every site
    const registerRigidity = rigidRegisters.length > 0;
    // The proof-form exception admits TWO different feeds of an unusual,
    // hard-scratch core, but never two ordinary store/return idioms.
    const twoFeedException = group.tier === "asm-origin" && distinctFunctions >= 2 && variantFeed && registerRigidity && unusualInstructions.length > 0;
    if (group.sites.length < bounds.minSupport && !twoFeedException) continue;
    const cop2 = group.seq.some(isCop2), pairs = independentPairs(group.seq);
    const verdict = group.tier === "compiled-idiom" ? "undetermined" : registerRigidity && (cop2 && pairs > 0 && (variantFeed || distinctFunctions >= bounds.minSupport) || variantFeed && unusualInstructions.length > 0) ? "macro-candidate" : cop2 || unusualInstructions.length ? "undetermined" : "compiler-explainable";
    candidates.push({ id: hash(`${group.tier}:${group.template.join(";")}`).slice(0, 20), tier: group.tier, representation: "instruction-window", template: group.template, parameters: slots, occurrences: group.sites.map(s => s.occurrence), signals: { cop2, registerRigidity, rigidRegisters, independentPairs: pairs, orderRigidity: "observed-in-occurrences", variantFeed, unusualInstructions }, verdict, claim: group.tier === "compiled-idiom" ? "shared-source-shape" : "asm-origin-hypothesis" });
  }
  // Suppress a repeated subpattern only if a longer pattern explains EXACTLY
  // the same sites. Extra occurrences are evidence and must not be discarded.
  candidates.sort((a, b) => Number(b.representation === "effect-window") - Number(a.representation === "effect-window") || b.template.length - a.template.length || a.id.localeCompare(b.id));
  const maximal: MacroCandidate[] = [];
  for (const candidate of candidates) {
    if (maximal.some(long => long.tier === candidate.tier && long.representation === candidate.representation && long.occurrences.length === candidate.occurrences.length && candidate.occurrences.every(s => long.occurrences.some(l => l.container === s.container && l.function === s.function && l.start <= s.start && l.end >= s.end)))) continue;
    maximal.push(candidate);
  }
  if (maximal.length > bounds.maxCandidates) completeWithinBounds = false;
  return { candidates: maximal.slice(0, bounds.maxCandidates), identicalFunctions: [...twins].filter(([, sites]) => sites.length >= 2).map(([sha256, sites]) => ({ sha256, size: sites[0]!.bytes.length, occurrences: sites.map(fn => ({ function: fn.name, container: fn.container, start: fn.vram })) })), bounds, completeWithinBounds, patternCoverage: { instructionPatternsRetained: repeats.size, effectPatternsRetained: effectMining.patternCount, candidateCountBeforeOutputCap: maximal.length, candidatesTruncated: Math.max(0, maximal.length - bounds.maxCandidates), policy: "Each map retains first-seen patterns up to maxPatterns, including singletons before support filtering. Existing groups continue accumulating sites; new groups are refused. A capped run is scan-order biased." }, limitations: ["Recurrence is not provenance. Tier B proposes shared source shapes only.", "Order rigidity is observed at matching sites, not proof that cc1 cannot emit the order.", "Tier A uses finite contiguous windows; interleaved/gapped unknown expansions may be missed. Tier B additionally mines a bounded call/constant-store effect spine.", "Rigidity and unusual-instruction signals are heuristics, not compiler impossibility proofs."] };
}
