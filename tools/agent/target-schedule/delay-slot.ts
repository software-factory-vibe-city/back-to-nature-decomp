import type { InstructionCorrespondence, MachineInstructionRef, DelaySlotAnalysis, TargetScheduleRequirement } from "./types.js";

const BRANCHES = new Set(["b", "beq", "beqz", "bne", "bnez", "bgez", "bgtz", "blez", "bltz", "j", "jr"]);
const LOADS = new Set(["lb", "lbu", "lh", "lhu", "lw", "lwl", "lwr"]);
const STORES = new Set(["sb", "sh", "sw", "swl", "swr"]);
const DESTINATION_FIRST = new Set([
  "add", "addu", "addiu", "sub", "subu", "and", "andi", "or", "ori", "xor", "xori", "nor",
  "slt", "sltu", "slti", "sltiu", "sll", "sllv", "srl", "srlv", "sra", "srav", "lui", "li", "move",
  ...LOADS,
]);

function regs(text: string): Set<string> {
  return new Set([...text.matchAll(/(?:^|[^a-z0-9_])(zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra)(?=$|[^a-z0-9_])/gi)]
    .map((match) => match[1]!.toLowerCase()));
}

function access(instruction: MachineInstructionRef): { sets: Set<string>; uses: Set<string>; memory: boolean; control: boolean } {
  const all = regs(instruction.operands.join(","));
  const sets = new Set<string>();
  const uses = new Set(all);
  if (DESTINATION_FIRST.has(instruction.mnemonic) && instruction.operands[0]) {
    const destination = [...regs(instruction.operands[0])][0];
    if (destination) {
      sets.add(destination);
      uses.delete(destination);
    }
  }
  return {
    sets,
    uses,
    memory: LOADS.has(instruction.mnemonic) || STORES.has(instruction.mnemonic),
    control: BRANCHES.has(instruction.mnemonic) || instruction.mnemonic === "jal" || instruction.mnemonic === "jalr",
  };
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  return [...left].some((item) => right.has(item));
}

function candidateEligibility(candidate: MachineInstructionRef[], index: number, branchIndex: number): string | undefined {
  const item = access(candidate[index]!);
  if (item.control) return "control-transfer instructions are not own-block delay candidates";
  if (LOADS.has(candidate[index]!.mnemonic)) return "load candidate conservatively rejected because target delay attributes/load-use resources are unavailable";
  const crossed = candidate.slice(index + 1, branchIndex);
  for (const lower of crossed) {
    const other = access(lower);
    if (intersects(item.sets, other.uses)) return `sets a register needed below it by candidate index ${lower.index}`;
    if (intersects(item.uses, other.sets)) return `uses a register set below it by candidate index ${lower.index}`;
    if (intersects(item.sets, other.sets)) return `has an output hazard with candidate index ${lower.index}`;
    if (item.memory && other.memory) return `memory-resource ordering is blocked by candidate index ${lower.index}`;
  }
  return undefined;
}

export function analyzeDelaySlots(
  target: MachineInstructionRef[],
  candidate: MachineInstructionRef[],
  correspondence: InstructionCorrespondence[],
): { analyses: DelaySlotAnalysis[]; requirements: TargetScheduleRequirement[] } {
  const analyses: DelaySlotAnalysis[] = [];
  const requirements: TargetScheduleRequirement[] = [];
  const byTarget = new Map(correspondence.map((item) => [item.targetIndex, item]));

  for (const branch of target.filter((instruction) => BRANCHES.has(instruction.mnemonic))) {
    const branchLink = byTarget.get(branch.index);
    const candidateBranchIndex = branchLink?.candidateIndex;
    if (candidateBranchIndex === undefined || !BRANCHES.has(candidate[candidateBranchIndex]?.mnemonic || "")) continue;
    const targetDelay = target[branch.index + 1];
    const candidateDelay = candidate[candidateBranchIndex + 1];
    if (!targetDelay || !candidateDelay || targetDelay.canonical === candidateDelay.canonical) continue;
    const desiredLink = byTarget.get(targetDelay.index);
    const desiredCandidateIndex = desiredLink?.candidateIndex;
    const blockStart = (() => {
      for (let index = candidateBranchIndex - 1; index >= 0; index--) {
        if (BRANCHES.has(candidate[index]!.mnemonic)) return index + 2;
      }
      return 0;
    })();
    const eligibleUids: number[] = [];
    const rejected: Array<{ uid: number; reason: string }> = [];
    const scanUids: number[] = [];
    for (let index = candidateBranchIndex - 1; index >= blockStart; index--) {
      const uid = candidate[index]!.uid;
      if (uid === undefined) continue;
      scanUids.push(uid);
      const reason = candidateEligibility(candidate, index, candidateBranchIndex);
      if (reason) rejected.push({ uid, reason });
      else eligibleUids.push(uid);
    }
    const evidence = [
      `Candidate branch delay instruction is ${candidateDelay.canonical}${candidateDelay.uid !== undefined ? ` (UID ${candidateDelay.uid})` : ""}.`,
      `Target branch delay instruction is ${targetDelay.canonical}.`,
    ];
    if (desiredCandidateIndex !== undefined) {
      evidence.push(`The desired target instruction corresponds to candidate index ${desiredCandidateIndex}${candidate[desiredCandidateIndex]?.uid !== undefined ? ` / UID ${candidate[desiredCandidateIndex]!.uid}` : ""}.`);
    }
    const analysis: DelaySlotAnalysis = {
      branchTargetIndex: branch.index,
      branchCandidateIndex: candidateBranchIndex,
      ownBlockScanUids: scanUids,
      eligibleUids,
      rejected,
      confidence: desiredCandidateIndex === undefined ? "inferred" : "reconstructed",
      evidence,
    };
    if (candidate[candidateBranchIndex]!.uid !== undefined) analysis.branchUid = candidate[candidateBranchIndex]!.uid;
    analysis.candidateDelayIndex = candidateBranchIndex + 1;
    if (candidateDelay.uid !== undefined) analysis.candidateDelayUid = candidateDelay.uid;
    analysis.desiredTargetIndex = targetDelay.index;
    if (desiredCandidateIndex !== undefined) {
      analysis.desiredCandidateIndex = desiredCandidateIndex;
      const desiredUid = candidate[desiredCandidateIndex]?.uid;
      if (desiredUid !== undefined) analysis.desiredCandidateUid = desiredUid;
    }
    if (candidateDelay.uid !== undefined) analysis.firstEligibleUid = candidateDelay.uid;
    analysis.requirement = desiredCandidateIndex === undefined
      ? "No unambiguous candidate counterpart for the target delay instruction; report is observational only."
      : `place candidate UID ${candidate[desiredCandidateIndex]?.uid ?? "unknown"} first in reorg's eligible backward scan, or make UID ${candidateDelay.uid ?? "unknown"} ineligible`;
    analyses.push(analysis);

    if (desiredCandidateIndex !== undefined) {
      const uids = [candidateDelay.uid, candidate[desiredCandidateIndex]?.uid].filter((uid): uid is number => uid !== undefined);
      const intervention = {
        id: `dbr-order-${branch.index}`,
        stage: "dbr" as const,
        kind: "delay-candidate-order" as const,
        uids,
        pseudos: [],
        expectedEffect: analysis.requirement,
        sourceMechanisms: ["statement-birth-order", "alias-dependency", "constant-birth-site"] as const,
        confidence: analysis.confidence,
        evidence,
      };
      requirements.push({
        id: `delay-slot-${branch.index}`,
        stage: "dbr",
        description: `branch target index ${branch.index} must use ${targetDelay.canonical} instead of ${candidateDelay.canonical} in its delay slot`,
        targetIndexes: [branch.index, targetDelay.index],
        targetCanonical: [branch.canonical, targetDelay.canonical],
        candidateIndexes: [candidateBranchIndex, candidateBranchIndex + 1, desiredCandidateIndex],
        candidateUids: uids,
        pseudos: [],
        hardConstraint: true,
        interventions: [{ ...intervention, sourceMechanisms: [...intervention.sourceMechanisms] }],
        confidence: analysis.confidence,
        evidence,
      });
    }
  }
  return { analyses, requirements };
}
