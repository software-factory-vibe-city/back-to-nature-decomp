import type {
  CompilerTraceReport,
  LifetimeRange,
  PseudoProvenance,
  RtlInstruction,
  TraceConfidence,
} from "../compiler-trace/types.js";
import { FIRST_PSEUDO_REGISTER, hardRegisterName } from "../compiler-trace/rtl-parser.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import {
  ALLOCATOR_COUNTERFACTUAL_SCHEMA_VERSION,
  type AllocatedPseudoBlocker,
  type AllocatorCounterfactualAnalysis,
  type AllocnoPriority,
  type ExplicitHardBlocker,
  type HardRegisterLifetime,
  type PriorityIntervention,
  type PseudoCounterfactual,
  type RegisterRoleCounterfactual,
} from "./types.js";

const HARD_REGISTER_NUMBERS = new Map(Array.from({ length: FIRST_PSEUDO_REGISTER }, (_unused, register) => [hardRegisterName(register), register]));

export interface AllocatorCounterfactualInputs {
  functionName: string;
  trace: CompilerTraceReport;
  targetSchedule: TargetScheduleAnalysis;
  targetScheduleArtifact: string;
  outputDirectory: string;
  lregContent: string;
  lregInstructions: RtlInstruction[];
}

export function gcc295AllocnoPriority(references: number, liveLength: number, size = 1): number {
  if (references <= 0 || liveLength <= 0 || size <= 0) return -1;
  const floorLog2 = Math.floor(Math.log2(references));
  return Math.trunc((floorLog2 * references / liveLength) * 10000 * size);
}

function pseudoSize(pseudo: PseudoProvenance): number {
  return pseudo.modes.some((mode) => /^(?:DI|DF|DC|TI)$/.test(mode)) ? 2 : 1;
}

export function deriveAllocnoPriorities(trace: CompilerTraceReport): { allocnos: AllocnoPriority[]; verified: boolean } {
  const byPseudo = new Map(trace.pseudos.map((pseudo) => [pseudo.pseudo, pseudo]));
  const allocnos = trace.allocationOrder.map((entry) => {
    const pseudo = byPseudo.get(entry.pseudo);
    const references = pseudo?.uses || 0;
    const liveLength = pseudo?.span || 0;
    const size = pseudo ? pseudoSize(pseudo) : 1;
    const item: AllocnoPriority = {
      pseudo: entry.pseudo,
      rank: entry.rank,
      references,
      liveLength,
      size,
      priority: gcc295AllocnoPriority(references, liveLength, size),
      formulaVerified: references > 0 && liveLength > 0,
    };
    if (entry.assignedRegister) item.assignedRegister = entry.assignedRegister;
    return item;
  });
  const verified = allocnos.every((item, index) => {
    const previous = allocnos[index - 1];
    if (!previous || !item.formulaVerified) return item.formulaVerified;
    if (previous.priority !== item.priority) return previous.priority > item.priority;
    /* GCC breaks equal priorities by allocno. Pseudo order is equivalent unless allocnos share. */
    return previous.pseudo < item.pseudo;
  });
  for (const item of allocnos) item.formulaVerified = verified;
  return { allocnos, verified };
}

function liveAtBlockStart(content: string): Map<number, number[]> {
  const result = new Map<number, number[]>();
  for (const match of content.matchAll(/^;; Start of basic block (\d+), registers live:\s*(.*)$/gm)) {
    result.set(
      parseInt(match[1]!, 10),
      [...match[2]!.matchAll(/(?:^|\s)(\d+)(?=\s|\[|$)/g)].map((value) => parseInt(value[1]!, 10)),
    );
  }
  return result;
}

export function reconstructHardRegisterLifetimes(
  content: string,
  instructions: RtlInstruction[],
): HardRegisterLifetime[] {
  const starts = liveAtBlockStart(content);
  const blocks = new Map<number, RtlInstruction[]>();
  for (const instruction of instructions) {
    if (instruction.block === undefined) continue;
    const values = blocks.get(instruction.block) || [];
    values.push(instruction);
    blocks.set(instruction.block, values);
  }
  const result: HardRegisterLifetime[] = [];
  for (const [block, values] of blocks) {
    if (values.length === 0) continue;
    const first = values[0]!.order;
    const last = values[values.length - 1]!.order;
    const active = new Map<number, { birthIndex: number; birthUid?: number; liveIn: boolean }>();
    for (const register of starts.get(block) || []) {
      if (register < FIRST_PSEUDO_REGISTER) active.set(register, { birthIndex: first, liveIn: true });
    }
    const close = (register: number, deathIndex: number, deathUid: number | undefined, liveOut: boolean): void => {
      const birth = active.get(register);
      if (!birth) return;
      const range: HardRegisterLifetime = {
        register,
        registerName: hardRegisterName(register),
        block,
        birthIndex: birth.birthIndex,
        deathIndex,
        liveIn: birth.liveIn,
        liveOut,
      };
      if (birth.birthUid !== undefined) range.birthUid = birth.birthUid;
      if (deathUid !== undefined) range.deathUid = deathUid;
      result.push(range);
      active.delete(register);
    };
    for (const instruction of values) {
      for (const death of instruction.deaths) {
        if (death.register < FIRST_PSEUDO_REGISTER) close(death.register, instruction.order, instruction.uid, false);
      }
      for (const set of instruction.sets) {
        if (set.register >= FIRST_PSEUDO_REGISTER) continue;
        close(set.register, instruction.order, instruction.uid, false);
        active.set(set.register, { birthIndex: instruction.order, birthUid: instruction.uid, liveIn: false });
      }
    }
    for (const register of [...active.keys()]) close(register, last, undefined, true);
  }
  return result.sort((left, right) => left.block - right.block || left.birthIndex - right.birthIndex || left.register - right.register);
}

function overlaps(left: { block: number; birthIndex: number; deathIndex: number }, right: { block: number; birthIndex: number; deathIndex: number }): boolean {
  return left.block === right.block && left.birthIndex <= right.deathIndex && right.birthIndex <= left.deathIndex;
}

function operandRegisters(operand: string): string[] {
  return [...operand.matchAll(/(?:^|[^a-z0-9_])(zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|fp|ra)(?=$|[^a-z0-9_])/gi)]
    .map((match) => match[1]!.toLowerCase());
}

function operandIsDestination(mnemonic: string, operand: number): boolean {
  if (operand !== 0) return false;
  return !/^(?:sb|sh|sw|b|j)/.test(mnemonic.toLowerCase());
}

function referencesForRole(
  role: TargetScheduleAnalysis["registerRoles"][number],
  targetSchedule: TargetScheduleAnalysis,
  instructionsByUid: Map<number, RtlInstruction>,
  pseudosByNumber: Map<number, PseudoProvenance>,
): { pseudos: number[]; uids: number[]; evidence: string[] } {
  const result = new Set<number>();
  const uids = new Set<number>();
  const evidence: string[] = [];
  for (const correspondence of targetSchedule.correspondence) {
    if (correspondence.candidateIndex === undefined) continue;
    if (!role.targetIndexes.includes(correspondence.targetIndex) || !role.candidateIndexes.includes(correspondence.candidateIndex)) continue;
    const target = targetSchedule.target[correspondence.targetIndex];
    const candidate = targetSchedule.candidate[correspondence.candidateIndex];
    if (!target || !candidate || candidate.uid === undefined || target.mnemonic !== candidate.mnemonic) continue;
    const instruction = instructionsByUid.get(candidate.uid);
    if (!instruction) continue;
    for (let operand = 0; operand < Math.min(target.operands.length, candidate.operands.length); operand++) {
      const targetRegisters = operandRegisters(target.operands[operand]!);
      const candidateRegisters = operandRegisters(candidate.operands[operand]!);
      const occurrences = Math.min(targetRegisters.length, candidateRegisters.length);
      for (let occurrence = 0; occurrence < occurrences; occurrence++) {
        if (targetRegisters[occurrence] !== role.targetRegister || candidateRegisters[occurrence] !== role.candidateRegister) continue;
        uids.add(candidate.uid);
        const references = operandIsDestination(candidate.mnemonic, operand) ? instruction.sets : instruction.uses;
        for (const reference of references) {
          if (reference.register < FIRST_PSEUDO_REGISTER) continue;
          if (pseudosByNumber.get(reference.register)?.assignedRegister === role.candidateRegister) result.add(reference.register);
        }
        evidence.push(`Target/candidate operand ${operand} at indexes ${correspondence.targetIndex}/${correspondence.candidateIndex} maps through UID ${candidate.uid} as a ${operandIsDestination(candidate.mnemonic, operand) ? "SET" : "use"}.`);
      }
    }
  }
  return {
    pseudos: [...result].sort((left, right) => left - right),
    uids: [...uids].sort((left, right) => left - right),
    evidence,
  };
}

function explicitHardBlockers(
  pseudo: PseudoProvenance,
  desiredRegister: string,
  hardRanges: HardRegisterLifetime[],
): ExplicitHardBlocker[] {
  const desired = HARD_REGISTER_NUMBERS.get(desiredRegister);
  if (desired === undefined) return [];
  const result: ExplicitHardBlocker[] = [];
  for (const roleRange of pseudo.lifetimes) {
    for (const hardRange of hardRanges) {
      if (hardRange.register !== desired || !overlaps(roleRange, hardRange)) continue;
      const blocker: ExplicitHardBlocker = {
        kind: "explicit-hard-register",
        register: desiredRegister,
        block: roleRange.block,
        birthIndex: hardRange.birthIndex,
        deathIndex: hardRange.deathIndex,
        roleBirthIndex: roleRange.birthIndex,
        roleDeathIndex: roleRange.deathIndex,
        evidence: [
          `Explicit $${desiredRegister} is live at scheduled indices ${hardRange.birthIndex}..${hardRange.deathIndex} while pseudo ${pseudo.pseudo} is live at ${roleRange.birthIndex}..${roleRange.deathIndex}.`,
        ],
      };
      if (hardRange.birthUid !== undefined) blocker.birthUid = hardRange.birthUid;
      if (hardRange.deathUid !== undefined) blocker.deathUid = hardRange.deathUid;
      if (hardRange.deathUid !== undefined && roleRange.birthUid !== undefined && hardRange.deathIndex >= roleRange.birthIndex) {
        blocker.requiredRelation = { beforeUid: hardRange.deathUid, afterUid: roleRange.birthUid };
        blocker.evidence.push(`The hard-register death at UID ${hardRange.deathUid} must precede pseudo birth UID ${roleRange.birthUid}.`);
      }
      result.push(blocker);
    }
  }
  return result;
}

function allocatedPseudoBlockers(
  pseudo: PseudoProvenance,
  desiredRegister: string,
  pseudos: PseudoProvenance[],
): AllocatedPseudoBlocker[] {
  const conflictNumbers = new Set(pseudo.conflicts.filter((conflict) => conflict.kind === "pseudo").map((conflict) => conflict.register));
  const result: AllocatedPseudoBlocker[] = [];
  for (const blocker of pseudos) {
    if (blocker.pseudo === pseudo.pseudo || blocker.assignedRegister !== desiredRegister) continue;
    if (!conflictNumbers.has(blocker.pseudo)) continue;
    for (const roleRange of pseudo.lifetimes) {
      const blockerRange = blocker.lifetimes.find((range) => overlaps(roleRange, range));
      if (!blockerRange) continue;
      const item: AllocatedPseudoBlocker = {
        kind: "allocated-pseudo",
        pseudo: blocker.pseudo,
        assignedRegister: desiredRegister,
        block: roleRange.block,
        birthIndex: blockerRange.birthIndex,
        deathIndex: blockerRange.deathIndex,
        evidence: [
          `Conflicting pseudo ${blocker.pseudo} occupies $${desiredRegister} over scheduled indices ${blockerRange.birthIndex}..${blockerRange.deathIndex}.`,
        ],
      };
      if (blocker.allocationStage) item.allocationStage = blocker.allocationStage;
      result.push(item);
      break;
    }
  }
  return result.sort((left, right) => left.birthIndex - right.birthIndex || left.pseudo - right.pseudo);
}

function minimumReferences(current: number, liveLength: number, size: number, requiredPriority: number): number | undefined {
  for (let references = Math.max(1, current); references <= Math.max(4096, current + 1024); references++) {
    if (gcc295AllocnoPriority(references, liveLength, size) >= requiredPriority) return references;
  }
  return undefined;
}

function maximumLiveLength(references: number, current: number, size: number, requiredPriority: number): number | undefined {
  for (let liveLength = current; liveLength >= 1; liveLength--) {
    if (gcc295AllocnoPriority(references, liveLength, size) >= requiredPriority) return liveLength;
  }
  return undefined;
}

function priorityInterventions(
  pseudo: PseudoProvenance,
  desiredRegister: string,
  allocnos: AllocnoPriority[],
  pseudosByNumber: Map<number, PseudoProvenance>,
): PriorityIntervention[] {
  const own = allocnos.find((item) => item.pseudo === pseudo.pseudo);
  if (!own) return [];
  const conflicts = new Set(pseudo.conflicts.filter((item) => item.kind === "pseudo").map((item) => item.register));
  return allocnos.filter((blocker) =>
    blocker.rank < own.rank && blocker.assignedRegister === desiredRegister && conflicts.has(blocker.pseudo)
  ).map((blocker) => {
    const requiredPriority = blocker.priority + (pseudo.pseudo < blocker.pseudo ? 0 : 1);
    const item: PriorityIntervention = {
      blockerPseudo: blocker.pseudo,
      blockerRank: blocker.rank,
      blockerPriority: blocker.priority,
      requiredPriority,
      confidence: "reconstructed" as TraceConfidence,
      evidence: [
        `Pseudo ${blocker.pseudo} is allocated earlier at rank ${blocker.rank}, occupies $${desiredRegister}, and conflicts with pseudo ${pseudo.pseudo}.`,
        "The threshold uses GCC 2.95.2 global.c's exact allocno priority formula; register preference and pruning can still affect the chosen hard register.",
      ],
    };
    const size = pseudoSize(pseudo);
    if (pseudo.uses && pseudo.span) {
      const references = minimumReferences(pseudo.uses, pseudo.span, size, requiredPriority);
      const liveLength = maximumLiveLength(pseudo.uses, pseudo.span, size, requiredPriority);
      if (references !== undefined) item.minimumReferences = references;
      if (liveLength !== undefined) item.maximumLiveLength = liveLength;
    }
    const blockerPseudo = pseudosByNumber.get(blocker.pseudo);
    if (blockerPseudo?.preferences.includes(HARD_REGISTER_NUMBERS.get(desiredRegister) ?? -1)) {
      item.evidence.push(`Blocker pseudo ${blocker.pseudo} also has an explicit preference for $${desiredRegister}.`);
    }
    return item;
  });
}

function findingVerdict(
  pseudo: PseudoProvenance,
  desiredRegister: string,
  explicit: ExplicitHardBlocker[],
  allocated: AllocatedPseudoBlocker[],
  priorities: PriorityIntervention[],
): PseudoCounterfactual["verdict"] {
  if (pseudo.assignedRegister === desiredRegister) return "already-satisfied";
  if (explicit.length > 0) return "requires-hard-lifetime-change";
  if (pseudo.allocationStage === "local") return "requires-local-allocation-change";
  if (allocated.some((blocker) => blocker.allocationStage === "local")) return "requires-local-allocation-change";
  if (priorities.length > 0) return "requires-global-order-change";
  return "assignment-choice-unexplained";
}

function analyzePseudo(
  pseudo: PseudoProvenance,
  desiredRegister: string,
  hardRanges: HardRegisterLifetime[],
  allPseudos: PseudoProvenance[],
  allocnos: AllocnoPriority[],
  pseudosByNumber: Map<number, PseudoProvenance>,
): PseudoCounterfactual {
  const desiredNumber = HARD_REGISTER_NUMBERS.get(desiredRegister);
  const directHardConflict = desiredNumber !== undefined && pseudo.conflicts.some((conflict) =>
    conflict.kind === "hard-register" && conflict.register === desiredNumber
  );
  const explicit = directHardConflict ? explicitHardBlockers(pseudo, desiredRegister, hardRanges) : [];
  const allocated = allocatedPseudoBlockers(pseudo, desiredRegister, allPseudos);
  const priorities = priorityInterventions(pseudo, desiredRegister, allocnos, pseudosByNumber);
  const ownAllocno = allocnos.find((item) => item.pseudo === pseudo.pseudo);
  const finding: PseudoCounterfactual = {
    pseudo: pseudo.pseudo,
    desiredRegister,
    directHardConflict,
    explicitHardBlockers: explicit,
    allocatedPseudoBlockers: allocated,
    priorityInterventions: priorities,
    verdict: findingVerdict(pseudo, desiredRegister, explicit, allocated, priorities),
    sourceMechanisms: [],
    evidence: [],
  };
  if (pseudo.assignedRegister) finding.observedRegister = pseudo.assignedRegister;
  if (pseudo.allocationStage) finding.allocationStage = pseudo.allocationStage;
  if (pseudo.sets !== undefined) finding.sets = pseudo.sets;
  if (pseudo.uses !== undefined) finding.references = pseudo.uses;
  if (pseudo.span !== undefined) finding.liveLength = pseudo.span;
  if (ownAllocno) {
    finding.rank = ownAllocno.rank;
    finding.priority = ownAllocno.priority;
  }
  if (directHardConflict) finding.evidence.push(`The .greg conflict set explicitly forbids $${desiredRegister} for pseudo ${pseudo.pseudo} in the candidate.`);
  if (explicit.length > 0) finding.sourceMechanisms.push("statement-birth-order", "fresh-vs-reused-web", "single-vs-multi-set");
  if (allocated.length > 0) finding.sourceMechanisms.push("result-vs-input-reuse", "lifetime-endpoint", "fresh-vs-reused-web");
  if (priorities.length > 0) finding.sourceMechanisms.push("allocno-priority", "statement-birth-order", "single-vs-multi-set");
  if (finding.verdict === "already-satisfied") finding.evidence.push(`Pseudo ${pseudo.pseudo} already occupies target register $${desiredRegister}.`);
  finding.sourceMechanisms = [...new Set(finding.sourceMechanisms)];
  return finding;
}

function roleConfidence(candidateUids: number[], pseudos: number[]): TraceConfidence {
  if (candidateUids.length > 0 && pseudos.length === 1) return "reconstructed";
  return "inferred";
}

export function analyzeAllocatorCounterfactual(inputs: AllocatorCounterfactualInputs): AllocatorCounterfactualAnalysis {
  const priority = deriveAllocnoPriorities(inputs.trace);
  const hardRanges = reconstructHardRegisterLifetimes(inputs.lregContent, inputs.lregInstructions);
  const pseudosByNumber = new Map(inputs.trace.pseudos.map((pseudo) => [pseudo.pseudo, pseudo]));
  const instructionsByUid = new Map(inputs.lregInstructions.map((instruction) => [instruction.uid, instruction]));
  const roles: RegisterRoleCounterfactual[] = [];

  for (const role of inputs.targetSchedule.registerRoles) {
    if (role.targetRegister === role.candidateRegister) continue;
    const refined = referencesForRole(role, inputs.targetSchedule, instructionsByUid, pseudosByNumber);
    const candidateUids = refined.uids;
    let pseudos = refined.pseudos;
    const evidence: string[] = [...refined.evidence];
    if (pseudos.length > 0) {
      evidence.push(`Operand-specific candidate UIDs ${candidateUids.join(", ")} refine $${role.candidateRegister} to lreg pseudo web(s) ${pseudos.join(", ")}.`);
    } else {
      pseudos = role.pseudos;
      evidence.push("No operand-specific UID/pseudo refinement was available; retained the target-schedule role's assignment-wide pseudo set.");
    }
    const findings = pseudos.map((pseudoNumber) => pseudosByNumber.get(pseudoNumber))
      .filter((pseudo): pseudo is PseudoProvenance => Boolean(pseudo))
      .map((pseudo) => analyzePseudo(pseudo, role.targetRegister, hardRanges, inputs.trace.pseudos, priority.allocnos, pseudosByNumber));
    roles.push({
      targetRegister: role.targetRegister,
      candidateRegister: role.candidateRegister,
      targetIndexes: role.targetIndexes,
      candidateIndexes: role.candidateIndexes,
      candidateUids,
      pseudos,
      confidence: roleConfidence(candidateUids, pseudos),
      findings,
      evidence,
    });
  }

  const requirements: string[] = [];
  for (const role of roles) {
    for (const finding of role.findings) {
      const earliestHardRelations = new Map<number, ExplicitHardBlocker>();
      for (const blocker of finding.explicitHardBlockers) {
        if (!blocker.requiredRelation) continue;
        const previous = earliestHardRelations.get(blocker.requiredRelation.beforeUid);
        if (!previous || blocker.roleBirthIndex < previous.roleBirthIndex) {
          earliestHardRelations.set(blocker.requiredRelation.beforeUid, blocker);
        }
      }
      for (const blocker of earliestHardRelations.values()) {
        requirements.push(
          `UID ${blocker.requiredRelation!.beforeUid} must kill incoming $${finding.desiredRegister} before pseudo ${finding.pseudo} is born at UID ${blocker.requiredRelation!.afterUid}.`,
        );
      }
      for (const blocker of finding.allocatedPseudoBlockers) requirements.push(
        `Pseudo ${blocker.pseudo} must stop occupying/conflicting on $${finding.desiredRegister} before pseudo ${finding.pseudo} can take that target register.`,
      );
      for (const intervention of finding.priorityInterventions) requirements.push(
        `Pseudo ${finding.pseudo} must outrank conflicting pseudo ${intervention.blockerPseudo} (priority >= ${intervention.requiredPriority}) if allocation order is the chosen mechanism.`,
      );
    }
  }

  return {
    schemaVersion: ALLOCATOR_COUNTERFACTUAL_SCHEMA_VERSION,
    function: inputs.functionName,
    source: inputs.trace.source,
    traceArtifact: inputs.trace.reportArtifact,
    targetScheduleArtifact: inputs.targetScheduleArtifact,
    outputDirectory: inputs.outputDirectory,
    allocnoPriorityFormula: "trunc((floor(log2(n_refs)) * n_refs / live_length) * 10000 * size)",
    allocnoOrderVerified: priority.verified,
    allocnos: priority.allocnos,
    hardRegisterLifetimes: hardRanges,
    roles,
    requirements: [...new Set(requirements)],
    caveats: [
      "The allocno priority formula and observed order come from GCC 2.95.2 global.c and the exact .greg header.",
      "Hard-register lifetime requirements are reconstructed from .lreg live-at-start sets, SETs, and REG_DEAD notes.",
      "Local allocation is not replayed: fake one-insn lifetime extension, quantity tying, class selection, and allocation-created conflicts are reported as constraints rather than guessed assignments.",
      "A target register role may span multiple coalesced pseudos; UID-local lreg references are retained rather than forcing one pseudo identity.",
      "Counterfactuals are diagnostic compiler-state requirements. Clean C and exact object comparison remain the acceptance gates.",
    ],
  };
}
