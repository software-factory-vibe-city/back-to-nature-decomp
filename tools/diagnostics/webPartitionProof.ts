/** Bounded copy-contraction certificate. A loop's loaded value need not be a
 * compile-time invariant: a move still proves equality at its copy point.
 * Contract only a single-def, dying source within ONE straight-line CFG block;
 * reject intervening destination accesses, calls, opaque words and load hazards.
 * Promotion requires every rewritten word to equal the other stream, not a
 * similarity score. No C inspection, compiler-private state or source edits. */
import { buildCfg } from "../agent/machine-ir/cfg.js";
import { decodeWord, definedRegister, isLoad, isStore, isBranch, REGISTER_NAMES, type DecodedInsn } from "../agent/matching-reconstruction/decode.js";
import type { CopyEdge, Web, WebPartition } from "./webPartition.js";
import type { CandidatePartition, PseudoSetBinding, PseudoWeb } from "./candidateWebPartition.js";

export interface RoleFusion {
  base: Web; output: Web; candidateBase: Web; candidateOutput: Web;
  pseudo: PseudoWeb; binding: PseudoSetBinding; update: PseudoSetBinding;
  targetAt: number; candidateAt: number;
}
/** Base -> derived saved-pointer is a relation between DIFFERENT values.
 * It is a source-web fusion only with an observed multi-SET/self-input pseudo;
 * hard-register coalescing of two single-SET pseudos is not such a fact. */
export function certifyRoleFusions(target: WebPartition, candidate: CandidatePartition): RoleFusion[] {
  const result: RoleFusion[] = [];
  const unique = (p: WebPartition, key: string) => p.webs.filter(w => w.status === "proven" && w.identity?.key === key);
  for (const ct of candidate.transitions) {
    if (ct.operation !== "add" || ct.inputs.length !== 2) continue;
    const co = candidate.webs.find(w => w.id === ct.output)!;
    if (!co.identity || co.residences.length !== 1 || !co.residences[0]!.acrossCalls.length || unique(candidate, co.identity.key).length !== 1) continue;
    const tos = unique(target, co.identity.key);
    if (tos.length !== 1 || tos[0]!.residences.length !== 1) continue;
    const output = tos[0]!, targetRelations = target.transitions.filter(t => t.output === output.id && t.operation === ct.operation && t.inputs.length === ct.inputs.length);
    if (targetRelations.length !== 1) continue;
    const tt = targetRelations[0]!, ci = ct.inputs.map(id => candidate.webs.find(w => w.id === id)!), ti = tt.inputs.map(id => target.webs.find(w => w.id === id)!);
    if (!ci.every(w => w.identity && w.status === "proven") || !ti.every(w => w.identity && w.status === "proven")) continue;
    if (JSON.stringify(ci.map(w => w.identity!.key).sort()) !== JSON.stringify(ti.map(w => w.identity!.key).sort())) continue;
    for (const candidateBase of ci) {
      if (candidateBase.identity!.kind !== "address" || candidateBase.residences.length !== 1) continue;
      const bases = ti.filter(w => w.identity!.key === candidateBase.identity!.key);
      if (bases.length !== 1 || unique(candidate, candidateBase.identity!.key).length !== 1 || unique(target, candidateBase.identity!.key).length !== 1) continue;
      const base = bases[0]!;
      if (base.residences[0]!.register === output.residences[0]!.register || candidateBase.residences[0]!.register !== co.residences[0]!.register) continue;
      const pseudos = candidate.pseudoWebs.filter(p => (p.sets ?? 0) > 1 && p.hardRegister === co.residences[0]!.register && p.setBindings.some(s => s.identity?.key === candidateBase.identity!.key));
      if (pseudos.length !== 1) continue;
      const pseudo = pseudos[0]!, bindings = pseudo.setBindings.filter(s => s.identity?.key === candidateBase.identity!.key), updates = pseudo.setBindings.filter(s => s.selfInput && s.operation === "plus");
      if (bindings.length !== 1 || updates.length !== 1 || bindings[0]!.order >= updates[0]!.order || bindings[0]!.block === null || bindings[0]!.block !== updates[0]!.block) continue;
      const sameRegisterAdds = candidate.pseudoWebs.filter(p => p.hardRegister === co.residences[0]!.register).flatMap(p => p.setBindings.filter(s => s.operation === "plus"));
      if (sameRegisterAdds.length !== 1 || sameRegisterAdds[0]!.uid !== updates[0]!.uid) continue;
      result.push({ base, output, candidateBase, candidateOutput: co, pseudo, binding: bindings[0]!, update: updates[0]!, targetAt: tt.at, candidateAt: ct.at });
    }
  }
  return result;
}
export interface CopyContraction { edge: CopyEdge; from: Web; to: Web; candidate: Web }
export function readFields(i: DecodedInsn): Array<"rs" | "rt"> {
  if (isLoad(i.op)) return ["rs"];
  if (isStore(i.op) || ["beq", "bne"].includes(i.op)) return ["rs", "rt"];
  if (["sll", "srl", "sra"].includes(i.op)) return ["rt"];
  if (["lui", "nop", "j", "jal", "break", "mfhi", "mflo"].includes(i.op)) return [];
  if (isBranch(i.op) || ["jr", "jalr", "addiu", "addi", "andi", "ori", "xori", "slti", "sltiu"].includes(i.op)) return ["rs"];
  return ["rs", "rt"];
}
function replaceField(word: number, field: "rs" | "rt" | "rd", register: number): number {
  const shift = field === "rs" ? 21 : field === "rt" ? 16 : 11;
  return ((word & ~(31 << shift)) | (register << shift)) >>> 0;
}
export function certifyCopyContractions(larger: WebPartition, smaller: WebPartition): CopyContraction[] {
  if (larger.machine.words.length !== smaller.machine.words.length || larger.machine.vram !== smaller.machine.vram) return [];
  const insns = larger.machine.words.map((w, i) => decodeWord(w, larger.machine.vram + i * 4));
  const cfg = buildCfg(insns), result: CopyContraction[] = [];
  for (const edge of larger.copies) {
    if (edge.rematerialized || edge.from === edge.to) continue;
    const from = larger.webs.find(w => w.id === edge.from)!, to = larger.webs.find(w => w.id === edge.to)!;
    if (from.residences.length !== 1 || to.residences.length !== 1 || from.entry || to.entry) continue;
    const fr = from.residences[0]!, tr = to.residences[0]!;
    if (fr.definitions.length !== 1 || tr.definitions.length !== 1 || tr.definitions[0] !== edge.at || from.death !== edge.at) continue;
    const birth = fr.definitions[0]!, source = REGISTER_NAMES.indexOf(fr.register as typeof REGISTER_NAMES[number]), dest = REGISTER_NAMES.indexOf(tr.register as typeof REGISTER_NAMES[number]);
    if (source <= 0 || dest <= 0 || source === dest || birth >= edge.at || cfg.blockOf[birth] !== cfg.blockOf[edge.at]) continue;
    if (["sp", "gp", "fp", "ra", "at", "k0", "k1"].includes(tr.register)) continue;
    if (insns.slice(birth, edge.at + 1).some(i => i.op === "unknown" || ["jal", "jalr", "lwl", "lwr", "swl", "swr"].includes(i.op))) continue;
    if (insns.slice(birth + 1, edge.at).some(i => definedRegister(i) === dest || readFields(i).some(f => i[f] === dest))) continue;
    const first = insns[birth]!;
    if (definedRegister(first) !== source) continue;
    const destinationField = isLoad(first.op) || ["lui", "addiu", "addi", "andi", "ori", "xori", "slti", "sltiu"].includes(first.op) ? "rt" : "rd";
    const words = [...larger.machine.words];
    words[birth] = replaceField(words[birth]!, destinationField, dest);
    for (const at of new Set(fr.reads)) {
      if (at === edge.at) continue;
      if (at <= birth || at > edge.at) { words.length = 0; break; }
      for (const field of readFields(insns[at]!)) if (insns[at]![field] === source) words[at] = replaceField(words[at]!, field, dest);
    }
    if (!words.length) continue;
    words[edge.at] = 0; // Same-width nop retains CFG and branch displacement.
    const changed = words.map((w, i) => decodeWord(w, larger.machine.vram + i * 4));
    if (changed.some((i, at) => at > 0 && isLoad(changed[at - 1]!.op) && readFields(i).some(f => i[f] === changed[at - 1]!.rt && i[f] !== 0))) continue;
    if (!words.every((w, i) => w === smaller.machine.words[i])) continue;
    // The web census omits implicit ABI observers. Preserve the old source
    // register too: every exit must first overwrite it without reading it.
    // Calls/opaque words before that kill are refused, not guessed harmless.
    const pending = [{ block: cfg.blockOf[edge.at]!, start: cfg.blocks[cfg.blockOf[edge.at]!]!.instructions.indexOf(edge.at) + 1 }], visited = new Set<string>();
    let safe = true;
    while (pending.length && safe) {
      const { block, start } = pending.pop()!, key = `${block}:${start}`;
      if (visited.has(key)) continue; visited.add(key);
      const b = cfg.blocks[block]!;
      let killed = false;
      for (const at of b.instructions.slice(start)) {
        const i = changed[at]!;
        if (i.op === "unknown" || ["jal", "jalr"].includes(i.op) || readFields(i).some(f => i[f] === source)) { safe = false; break; }
        if (definedRegister(i) === source) { killed = true; break; }
      }
      if (!safe || killed) continue;
      if (!b.successors.length) { safe = false; break; }
      for (const successor of b.successors) pending.push({ block: successor, start: 0 });
    }
    if (!safe) continue;
    const matches = smaller.webs.filter(w => w.residences.length === 1 && w.residences[0]!.register === tr.register && w.residences[0]!.definitions.includes(birth) && [...fr.reads.filter(at => at !== edge.at), ...tr.reads].every(at => w.residences[0]!.reads.includes(at)));
    if (matches.length !== 1) continue;
    result.push({ edge, from, to, candidate: matches[0]! });
  }
  return result;
}
