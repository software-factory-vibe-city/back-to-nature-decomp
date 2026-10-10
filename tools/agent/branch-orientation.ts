/** Located machine witnesses, independent of hard-register spelling. */
import type { MirInsn, MirProgram } from "./pipeline-reversal/types.js";
import type { ReversalArtifacts } from "./pipeline-reversal/reverse.js";
import type { JumpChange, JumpTraceReport } from "./jumpTrace.js";
import { hardRegisterName } from "./compiler-trace/rtl-parser.js";

export const CONTROL_SHAPE_MOVES = [
  "Add or remove an arm returning the same value (or setting the same result register).",
  "Switch between one result variable with a final return and direct returns.",
  "Nest or flatten the guarding ifs; use psx_control_shape_sweep to measure the equivalent tails.",
];
export interface BranchOrientation {
  block: number;
  vram?: number;
  kind: "opposite-sense" | "branch-to-flag" | "flag-to-branch";
  target: string;
  candidate: string;
  evidence: string[];
  candidateComparison?: string;
  attribution?: JumpChange;
}
const sense: Record<string, string> = { beq: "eq", beqz: "eq", bne: "ne", bnez: "ne", bltz: "lt", bgez: "ge" };
const inverse: Record<string, string> = { eq: "ne", ne: "eq", lt: "ge", ge: "lt" };
const reg = (value: string) => value.replace(/^\$/, "");
function number(value: string): string { const n = Number(value); return Number.isFinite(n) ? String(n) : value; }
function constSet(insn: MirInsn | undefined): { register: string; value: string } | undefined {
  if (!insn) return undefined;
  const op = insn.operands.map(reg);
  if (insn.mnemonic === "li") return { register: op[0]!, value: number(op[1]!) };
  if (insn.mnemonic === "move" && op[1] === "zero") return { register: op[0]!, value: "0" };
  if (["addiu", "ori"].includes(insn.mnemonic) && op[1] === "zero") return { register: op[0]!, value: number(op[2]!) };
  return undefined;
}
/** Pure producer tree. Joins/calls/unknown instructions never compare equal. */
function valueKey(p: MirProgram, register: string, before: number, visited = new Set<string>(), ownerBlock?: number): string | undefined {
  register = reg(register);
  if (register === "zero") return "0";
  const token = `${register}:${before}:${ownerBlock ?? "current"}`;
  if (visited.has(token)) return undefined;
  const seen = new Set(visited); seen.add(token);
  if (seen.size > 256) return undefined;
  const blockIndex = ownerBlock ?? p.insns.find(i => i.index === before)?.block;
  if (blockIndex === undefined) return undefined;
  const block = p.blocks.find(b => b.index === blockIndex);
  const members = p.insns.filter(i => i.block === blockIndex && i.index < before).reverse();
  for (const insn of members) {
    if (insn.isCall) return undefined;
    if (!insn.defs.map(reg).includes(register)) continue;
    const c = constSet(insn); if (c) return c.value;
    const op = insn.operands.map(reg);
    const use = (r: string) => valueKey(p, r, insn.index, seen, blockIndex);
    if (insn.mnemonic === "move") return use(op[1]!);
    if (insn.mnemonic === "mfhi") return use("hi");
    if (insn.mnemonic === "mflo") return use("lo");
    if (["mult", "multu", "div", "divu"].includes(insn.mnemonic)) {
      const a = use(op[0]!), b = use(op[1]!); if (a === undefined || b === undefined) return undefined;
      return `${insn.mnemonic}.${register}(${a},${b})`;
    }
    if (insn.mnemonic === "lui") return insn.symbolAddress !== undefined ? `high:${insn.symbolAddress}` : `high:${number(op[1]!)}`;
    if (insn.isLoad) {
      const match = op[1]?.match(/^(-?(?:0x[\da-f]+|\d+))\((\w+)\)$/i);
      if (!match) return undefined;
      const base = use(match[2]!); if (base === undefined) return undefined;
      return `${insn.mnemonic}(${base},${number(match[1]!)})`;
    }
    if (["andi", "ori", "xori", "addiu", "sll", "sra", "srl", "slti", "sltiu"].includes(insn.mnemonic)) {
      const a = use(op[1]!); if (a === undefined) return undefined;
      if (insn.mnemonic === "addiu" && insn.symbolAddress !== undefined) return `address:${insn.symbolAddress}`;
      return `${insn.mnemonic}(${a},${number(op[2]!)})`;
    }
    if (["addu", "subu", "and", "or", "xor", "sltu", "slt"].includes(insn.mnemonic)) {
      const a = use(op[1]!), b = use(op[2]!); if (a === undefined || b === undefined) return undefined;
      const args = [a, b]; if (["addu", "and", "xor"].includes(insn.mnemonic)) args.sort();
      return `${insn.mnemonic}(${args.join(",")})`;
    }
    return undefined;
  }
  /* Only a unique incoming edge licenses carrying a producer across blocks. */
  if (block?.predecessors.length === 1 && block.predecessors[0]! < block.index) {
    const prior = p.insns.filter(i => i.block === block.predecessors[0]).at(-1);
    if (prior) return valueKey(p, register, prior.index + 1, seen, prior.block);
  }
  if (block?.index === 0 && ["a0", "a1", "a2", "a3", "sp", "gp"].includes(register)) return `incoming:${register}`;
  return undefined;
}
function testKey(p: MirProgram, insn: MirInsn): string | undefined {
  const s = sense[insn.mnemonic]; if (!s) return undefined;
  const a = valueKey(p, insn.operands[0]!, insn.index);
  const b = ["beq", "bne"].includes(insn.mnemonic) ? valueKey(p, insn.operands[1]!, insn.index) : "0";
  if (a === undefined || b === undefined) return undefined;
  const operands = [a, b]; if (s === "eq" || s === "ne") operands.sort();
  return operands.join("|");
}
function flagInfo(p: MirProgram, insn: MirInsn): { key: string; sense: string } | undefined {
  const op = insn.operands;
  if (insn.mnemonic === "sltiu" && number(op[2]!) === "1") {
    const a = valueKey(p, op[1]!, insn.index); return a === undefined ? undefined : { key: [a, "0"].sort().join("|"), sense: "eq" };
  }
  if (insn.mnemonic === "sltu" && reg(op[1]!) === "zero") {
    const a = valueKey(p, op[2]!, insn.index); return a === undefined ? undefined : { key: [a, "0"].sort().join("|"), sense: "ne" };
  }
  if (insn.mnemonic === "xori" && number(op[2]!) === "1") {
    const prior = p.insns.slice(0, insn.index).reverse().find(i => i.defs.includes(reg(op[1]!)));
    if (prior && prior.block === insn.block) {
      const info = flagInfo(p, prior); if (info) return { key: info.key, sense: inverse[info.sense]! };
    }
  }
  return undefined;
}
function constantPath(p: MirProgram, branch: MirInsn): boolean {
  const target = branch.branchTargetIndex;
  return target !== undefined && target > branch.index + 2 && p.insns.filter(i => i.index > branch.index + 2 && i.index < target).every(i => i.isNop);
}
function booleanResult(p: MirProgram, branch: MirInsn): { register: string; sense: string } | undefined {
  if (!constantPath(p, branch)) return undefined;
  const slot = constSet(p.insns.find(i => i.delaySlotOf === branch.index));
  const fall = constSet(p.insns.find(i => i.index === branch.index + 2));
  if (!slot || !fall || slot.register !== fall.register || new Set([slot.value, fall.value]).size !== 2 || ![slot.value, fall.value].every(v => v === "0" || v === "1")) return undefined;
  return { register: slot.register, sense: slot.value === "1" ? sense[branch.mnemonic]! : inverse[sense[branch.mnemonic]!]! };
}
function flagReaches(p: MirProgram, flag: MirInsn, result: string): boolean {
  const held = new Set(flag.defs); if (!held.size) return false;
  for (const insn of p.insns.filter(i => i.block === flag.block && i.index > flag.index)) {
    if (insn.isCall) return false;
    const copied = insn.mnemonic === "move" && held.has(reg(insn.operands[1]!));
    for (const r of insn.defs) held.delete(r);
    if (copied) held.add(reg(insn.operands[0]!));
  }
  return held.has(result);
}
function swapped(left: MirProgram, a: MirInsn, right: MirProgram, b: MirInsn): boolean {
  if (!constantPath(left, a) || !constantPath(right, b)) return false;
  const as = constSet(left.insns.find(i => i.delaySlotOf === a.index)), bs = constSet(right.insns.find(i => i.delaySlotOf === b.index));
  const af = constSet(left.insns.find(i => i.index === a.index + 2)), bf = constSet(right.insns.find(i => i.index === b.index + 2));
  return !!(as && bs && af && bf && as.register === af.register && bs.register === bf.register && as.value !== af.value && as.value === bf.value && af.value === bs.value);
}
function machineComparison(insn: MirInsn): string | undefined {
  const register = Array.from({ length: 32 }, (_, i) => hardRegisterName(i)).indexOf(reg(insn.operands[1] ?? ""));
  if (insn.mnemonic === "sltiu" && insn.operands[2] === "0x1" && register >= 0) return `flag-eq:r${register}`;
  const tested = Array.from({ length: 32 }, (_, i) => hardRegisterName(i)).indexOf(reg(insn.operands[0] ?? ""));
  const zero = ["beqz", "bnez", "bltz", "bgez"].includes(insn.mnemonic) || ["beq", "bne"].includes(insn.mnemonic) && reg(insn.operands[1]!) === "zero";
  return zero && tested >= 0 ? `${sense[insn.mnemonic]}:r${tested}:0` : undefined;
}
export function branchOrientations(target: MirProgram, candidate: MirProgram, blocks?: ReadonlySet<number>): BranchOrientation[] {
  const findings: BranchOrientation[] = [];
  for (const block of target.blocks) {
    if (blocks && !blocks.has(block.index)) continue;
    const left = target.insns.filter(i => i.block === block.index), right = candidate.insns.filter(i => i.block === block.index);
    for (const a of left) {
      const key = testKey(target, a);
      if (key !== undefined) {
        const b = right.find(i => sense[i.mnemonic] === inverse[sense[a.mnemonic]!] && testKey(candidate, i) === key && swapped(target, a, candidate, i));
        const result = booleanResult(target, a);
        const folded = result ? right.find(i => { const flag = flagInfo(candidate, i); return flag?.key === key && flag.sense === result.sense && flagReaches(candidate, i, result.register) && ["eq", "ne"].includes(sense[a.mnemonic]!); }) : undefined;
        if (b || folded) findings.push({ block: block.index, ...(a.vram === undefined ? {} : { vram: a.vram }), kind: b ? "opposite-sense" : "branch-to-flag",
          target: a.text, candidate: (b ?? folded)!.text, ...(machineComparison((b ?? folded)!) ? { candidateComparison: machineComparison((b ?? folded)!)! } : {}), evidence: ["The same producer/operand trees feed this comparison (unknown or joined producers are excluded).",
            b ? "Opposite branch sense; result constants exchange delay-slot and fallthrough positions." : "A Boolean store-flag replaces the branch over constant result assignments."] });
      } else {
        const flag = flagInfo(target, a); if (flag === undefined) continue;
        const b = right.find(i => { const result = booleanResult(candidate, i); return testKey(candidate, i) === flag.key && result?.sense === flag.sense && flagReaches(target, a, result.register) && ["eq", "ne"].includes(sense[i.mnemonic]!); });
        if (b) findings.push({ block: block.index, ...(a.vram === undefined ? {} : { vram: a.vram }), kind: "flag-to-branch", target: a.text, candidate: b.text, ...(machineComparison(b) ? { candidateComparison: machineComparison(b)! } : {}),
          evidence: ["The same compared operand tree feeds a target Boolean store-flag and a candidate branch."] });
      }
    }
  }
  return findings;
}
export function orientationFrom(artifacts: ReversalArtifacts): BranchOrientation[] {
  if (artifacts.report.exact) return [];
  return branchOrientations(artifacts.target.machine, artifacts.candidate.machine,
    new Set(artifacts.report.objective.blocks.filter(b => !b.blind && b.total > 0).map(b => b.block)));
}
/** Only attach a unique dump witness for the tested producer, not another
 * hoist elsewhere in the function. A missing/ambiguous binding stays explicit. */
export function attachJumpAttribution(findings: BranchOrientation[], trace: JumpTraceReport): void {
  const changes = trace.passes.find(p => p.before === "rtl" && p.after === "jump")?.changes ?? [];
  for (const finding of findings) {
    const wanted = finding.kind === "opposite-sense" ? "assignment-hoist" : "store-flag-fold";
    const bound = changes.filter(c => c.machineComparison !== undefined && c.machineComparison === finding.candidateComparison);
    let candidates = bound.filter(c => c.classification === wanted && c.resultRegister === 2);
    if (!candidates.length && finding.kind === "opposite-sense") candidates = bound.filter(c => c.classification === "undetermined" && c.evidence.some(e => e.startsWith("Observed jump-over-jump")));
    if (candidates.length === 1) finding.attribution = candidates[0]!;
    else finding.evidence.push("Jump-dump attribution undetermined: no unique survived-UID/hard-comparison rewrite witness.");
  }
}
