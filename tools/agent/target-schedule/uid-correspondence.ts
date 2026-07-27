import type { PseudoProvenance, RtlInstruction } from "../compiler-trace/types.js";
import type {
  InstructionCorrespondence,
  MachineInstructionRef,
  RegisterRoleMap,
} from "./types.js";

/**
 * GCC's final .mach dump is in emitted instruction order. We only use the
 * positional relationship when the normalized cc1 stream and executable RTL
 * counts agree; otherwise no UID is forced onto a machine instruction.
 */
export function attachFinalUids(
  candidate: MachineInstructionRef[],
  finalInstructions: RtlInstruction[],
): { exactCount: boolean; caveats: string[] } {
  if (candidate.length !== finalInstructions.length) {
    return {
      exactCount: false,
      caveats: [
        `Final .mach instruction count (${finalInstructions.length}) differs from normalized cc1 assembly (${candidate.length}); positional UID mapping was disabled.`,
      ],
    };
  }
  for (let index = 0; index < candidate.length; index++) {
    const finalInstruction = finalInstructions[index]!;
    candidate[index]!.uid = finalInstruction.uid;
    if (finalInstruction.block !== undefined) candidate[index]!.block = finalInstruction.block;
  }
  return {
    exactCount: true,
    caveats: ["Candidate machine UID links are reconstructed from equal-count final .mach emission order."],
  };
}

export function attachCorrespondenceUids(
  correspondence: InstructionCorrespondence[],
  candidate: MachineInstructionRef[],
): void {
  for (const item of correspondence) {
    if (item.candidateIndex === undefined) continue;
    const uid = candidate[item.candidateIndex]?.uid;
    if (uid === undefined) continue;
    item.candidateUid = uid;
    item.evidence.push("Candidate UID follows the final .mach-to-assembly emission-order link.");
  }
}

export function attachRolePseudos(
  roles: RegisterRoleMap[],
  pseudos: PseudoProvenance[],
): void {
  for (const role of roles) {
    const matching = pseudos
      .filter((pseudo) => pseudo.assignedRegister === role.candidateRegister)
      .map((pseudo) => pseudo.pseudo)
      .sort((a, b) => a - b);
    role.pseudos = matching;
    if (matching.length === 1) {
      role.evidence.push(`Pseudo ${matching[0]} is the unique traced pseudo assigned to $${role.candidateRegister}.`);
    } else if (matching.length > 1) {
      role.confidence = "inferred";
      role.evidence.push(`Multiple traced pseudos (${matching.join(", ")}) use $${role.candidateRegister}; role-to-pseudo identity is ambiguous.`);
    }
  }
}
