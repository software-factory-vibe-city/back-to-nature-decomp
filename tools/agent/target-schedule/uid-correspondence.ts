import type { PseudoProvenance, RtlInstruction } from "../compiler-trace/types.js";
import { alignFinalRtlToMachine, type EmissionAlignmentResult } from "./emission-alignment.js";
import type {
  InstructionCorrespondence,
  MachineInstructionRef,
  RegisterRoleMap,
} from "./types.js";

/** Map final RTL UIDs through proven zero-width forms without forcing unknowns. */
export function attachFinalUids(
  candidate: MachineInstructionRef[],
  finalInstructions: RtlInstruction[],
): EmissionAlignmentResult {
  return alignFinalRtlToMachine(candidate, finalInstructions);
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
