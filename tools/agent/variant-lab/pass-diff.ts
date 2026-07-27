import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAssignments } from "../compiler-trace/local-allocation.js";
import {
  describeSemanticInstruction,
  reconstructRtlMetadata,
  semanticInstructionSignature,
} from "../compiler-trace/rtl-notes.js";
import { FIRST_PSEUDO_REGISTER, parseRtlInstructions, parseRtlNotes } from "../compiler-trace/rtl-parser.js";
import { parseScheduler } from "../compiler-trace/scheduler-dag.js";
import { sha256, stableJson } from "./artifacts.js";
import {
  PASS_STAGES,
  type MetadataDifference,
  type NormalizedPassInstruction,
  type NormalizedPassNote,
  type PassComparison,
  type PassSnapshot,
  type PassStage,
  type StageDifference,
} from "./types.js";

function reference(reference: { register: number; mode: string; flags: string[]; name?: string }): string {
  return `${reference.mode}:${reference.register}${reference.flags.length ? `/${reference.flags.join("/")}` : ""}${reference.name ? `:${reference.name}` : ""}`;
}

function normalizeExpression(expression: string | undefined): string | undefined {
  return expression?.replace(/\s+/g, " ").replace(/\/[-a-z]+:/gi, ":").trim();
}

function formOrders(content: string): Map<number, number> {
  const result = new Map<number, number>();
  const pattern = /^\((?:insn|jump_insn|call_insn|note)\s+(\d+)\b/gm;
  let order = 0;
  for (const match of content.matchAll(pattern)) result.set(parseInt(match[1], 10), order++);
  return result;
}

function normalizedNotes(
  content: string,
  parsed: ReturnType<typeof parseRtlInstructions>,
  notes: ReturnType<typeof parseRtlNotes>,
): NormalizedPassNote[] {
  const orders = formOrders(content);
  const orderedInstructions = parsed
    .map((instruction) => ({ instruction, order: orders.get(instruction.uid) ?? Number.MAX_SAFE_INTEGER }))
    .sort((left, right) => left.order - right.order);
  return notes
    .filter((note): note is typeof note & { kind: NormalizedPassNote["kind"] } =>
      note.kind === "loop-begin" || note.kind === "loop-end" || note.kind === "loop-continue" ||
      note.kind === "basic-block" || note.kind === "deleted")
    .map((note) => {
      const previous = [...orderedInstructions].reverse().find((entry) => entry.order < note.order)?.instruction;
      const next = orderedInstructions.find((entry) => entry.order > note.order)?.instruction;
      const normalized: NormalizedPassNote = { kind: note.kind };
      if (note.block !== undefined) normalized.block = note.block;
      if (previous) normalized.previousInstruction = semanticInstructionSignature(previous);
      if (next) normalized.nextInstruction = semanticInstructionSignature(next);
      return normalized;
    });
}

export function snapshotPassContent(stage: PassStage, content: string): PassSnapshot {
  const parsed = parseRtlInstructions(content, stage);
  const notes = parseRtlNotes(content, stage);
  const metadata = reconstructRtlMetadata(content, stage, parsed, notes);
  const metadataByUid = new Map(metadata.instructions.map((item) => [item.uid, item]));
  const instructions: NormalizedPassInstruction[] = parsed.map((instruction) => {
    const instructionMetadata = metadataByUid.get(instruction.uid);
    const normalized: NormalizedPassInstruction = {
      uid: instruction.uid,
      kind: instruction.kind,
      operation: instruction.operation,
      expression: normalizeExpression(instruction.expression),
      semanticSignature: semanticInstructionSignature(instruction),
      sets: instruction.sets.map(reference),
      uses: instruction.uses.map(reference),
      deaths: instruction.deaths.map(reference),
      dependencies: instruction.dependencies
        .map((dependency) => `${dependency.predecessorUid}:${dependency.note || "true"}`)
        .sort(),
      memoryRead: instruction.memoryRead,
      memoryWrite: instruction.memoryWrite,
      control: instruction.control,
      loopDepth: instructionMetadata?.loopDepth || 0,
    };
    if (instructionMetadata?.block !== undefined) normalized.block = instructionMetadata.block;
    return normalized;
  });
  const assignments = [...parseAssignments(content)]
    .map(([pseudo, hardRegister]) => ({ pseudo, hardRegister }))
    .sort((left, right) => left.pseudo - right.pseudo);
  let schedulerDecisions: PassSnapshot["schedulerDecisions"] = [];
  if (stage === "sched" || stage === "sched2") {
    const scheduler = parseScheduler(stage, content, parsed, parsed.map((instruction) => instruction.uid));
    schedulerDecisions = scheduler.decisions.map((decision) => ({
      cycle: decision.cycle,
      selectedUid: decision.selectedUid,
      ranked: decision.ranked,
    }));
  }
  const normalized = {
    stage,
    instructions,
    notes: normalizedNotes(content, parsed, notes),
    loopRegions: metadata.loopRegions.map((region) => ({
      depth: region.depth,
      confidence: region.confidence,
      semanticInstructionSignatures: region.semanticInstructionSignatures,
      executableControlCount: region.executableControlUids.length,
    })),
    metadataCaveats: metadata.caveats,
    assignments,
    schedulerOrder: parsed.map((instruction) => instruction.uid),
    schedulerDecisions,
  };
  return {
    ...normalized,
    instructionCount: instructions.length,
    noteCount: normalized.notes.length,
    maximumLoopDepth: instructions.reduce((maximum, instruction) => Math.max(maximum, instruction.loopDepth), 0),
    hash: sha256(stableJson(normalized)),
  };
}

export function loadPassSnapshots(outputDirectory: string, stem: string): Map<PassStage, PassSnapshot> {
  const result = new Map<PassStage, PassSnapshot>();
  for (const stage of PASS_STAGES) {
    const path = join(outputDirectory, `${stem}.i.${stage}`);
    if (!existsSync(path)) throw new Error(`trace pass artifact missing: ${path}`);
    result.set(stage, snapshotPassContent(stage, readFileSync(path, "utf8")));
  }
  return result;
}

function pseudosIn(instruction: NormalizedPassInstruction | undefined): number[] {
  if (!instruction) return [];
  const result = new Set<number>();
  for (const item of [...instruction.sets, ...instruction.uses, ...instruction.deaths]) {
    const register = Number(item.match(/^[A-Z0-9]+:(\d+)/)?.[1]);
    if (register >= FIRST_PSEUDO_REGISTER) result.add(register);
  }
  return [...result].sort((left, right) => left - right);
}

function firstInstructionDifference(baseline: PassSnapshot, variant: PassSnapshot): number | undefined {
  const count = Math.max(baseline.instructions.length, variant.instructions.length);
  for (let index = 0; index < count; index++) {
    if (stableJson(baseline.instructions[index]) !== stableJson(variant.instructions[index])) return index;
  }
  return undefined;
}

function setCounts(snapshot: PassSnapshot): Map<number, number> {
  const result = new Map<number, number>();
  for (const instruction of snapshot.instructions) {
    for (const item of instruction.sets) {
      const pseudo = Number(item.match(/^[A-Z0-9]+:(\d+)/)?.[1]);
      if (pseudo >= FIRST_PSEUDO_REGISTER) result.set(pseudo, (result.get(pseudo) || 0) + 1);
    }
  }
  return result;
}

function changedSetCount(baseline: PassSnapshot, variant: PassSnapshot): { pseudo: number; summary: string } | undefined {
  const before = setCounts(baseline);
  const after = setCounts(variant);
  const changes = [...new Set([...before.keys(), ...after.keys()])]
    .map((pseudo) => ({ pseudo, before: before.get(pseudo) || 0, after: after.get(pseudo) || 0 }))
    .filter((change) => change.before !== change.after)
    .sort((left, right) => {
      const score = (change: { before: number; after: number }): number =>
        (change.after > change.before && change.after >= 2 ? 100 : 0) +
        (change.after > change.before ? 10 : 0) + change.after;
      return score(right) - score(left) || left.pseudo - right.pseudo;
    });
  const change = changes[0];
  return change
    ? { pseudo: change.pseudo, summary: `pseudo ${change.pseudo} set count changed ${change.before} -> ${change.after}` }
    : undefined;
}

function changedAssignment(baseline: PassSnapshot, variant: PassSnapshot): string | undefined {
  const before = new Map(baseline.assignments.map((assignment) => [assignment.pseudo, assignment.hardRegister]));
  const after = new Map(variant.assignments.map((assignment) => [assignment.pseudo, assignment.hardRegister]));
  for (const pseudo of [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b)) {
    if (before.get(pseudo) !== after.get(pseudo)) {
      return `pseudo ${pseudo} assignment changed ${before.get(pseudo) ?? "none"} -> ${after.get(pseudo) ?? "none"}`;
    }
  }
  return undefined;
}

function instructionsBySignature(snapshot: PassSnapshot): Map<string, NormalizedPassInstruction[]> {
  const result = new Map<string, NormalizedPassInstruction[]>();
  for (const instruction of snapshot.instructions) {
    const matches = result.get(instruction.semanticSignature) || [];
    matches.push(instruction);
    result.set(instruction.semanticSignature, matches);
  }
  return result;
}

function loopHasNoControl(snapshot: PassSnapshot, signature: string, depth: number): boolean {
  return snapshot.loopRegions.some((region) =>
    region.depth === depth &&
    region.executableControlCount === 0 &&
    region.semanticInstructionSignatures.includes(signature)
  );
}

function metadataDifferences(baseline: PassSnapshot, variant: PassSnapshot): MetadataDifference[] {
  const result: MetadataDifference[] = [];
  const before = instructionsBySignature(baseline);
  const after = instructionsBySignature(variant);
  for (const signature of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const left = before.get(signature) || [];
    const right = after.get(signature) || [];
    if (left.length === 0 || left.length !== right.length) continue;
    for (let index = 0; index < left.length; index++) {
      const baselineInstruction = left[index]!;
      const variantInstruction = right[index]!;
      if (baselineInstruction.loopDepth === variantInstruction.loopDepth) continue;
      const entered = variantInstruction.loopDepth > baselineInstruction.loopDepth;
      const description = describeSemanticInstruction(variantInstruction);
      const noControl = entered && loopHasNoControl(variant, signature, variantInstruction.loopDepth);
      result.push({
        kind: "loop-depth",
        instruction: description,
        baselineDepth: baselineInstruction.loopDepth,
        variantDepth: variantInstruction.loopDepth,
        noExecutableLoopControlAdded: noControl,
        summary: `${description} ${entered ? "entered" : "left"} loop depth ${variantInstruction.loopDepth}` +
          (noControl ? "; no executable loop-control instruction was added" : ""),
      });
    }
  }

  if (result.length === 0 && stableJson(baseline.loopRegions) !== stableJson(variant.loopRegions)) {
    result.push({
      kind: "loop-region",
      summary: `loop regions changed ${baseline.loopRegions.length} -> ${variant.loopRegions.length}`,
    });
  }
  if (stableJson(baseline.notes.filter((note) => note.kind === "basic-block")) !==
      stableJson(variant.notes.filter((note) => note.kind === "basic-block"))) {
    result.push({ kind: "basic-block", summary: "basic-block note partition changed" });
  }
  if (stableJson(baseline.notes.filter((note) => note.kind === "deleted")) !==
      stableJson(variant.notes.filter((note) => note.kind === "deleted"))) {
    result.push({ kind: "deleted-note", summary: "deleted-instruction note placement changed" });
  }
  if (result.length === 0 && stableJson(baseline.notes) !== stableJson(variant.notes)) {
    result.push({ kind: "note", summary: "RTL note placement changed" });
  }
  return result;
}

function stageDifference(stage: PassStage, baseline: PassSnapshot, variant: PassSnapshot): StageDifference {
  const index = firstInstructionDifference(baseline, variant);
  const left = index === undefined ? undefined : baseline.instructions[index];
  const right = index === undefined ? undefined : variant.instructions[index];
  const affectedPseudos = new Set<number>([...pseudosIn(left), ...pseudosIn(right)]);
  for (const assignment of [...baseline.assignments, ...variant.assignments]) {
    const leftAssignment = baseline.assignments.find((candidate) => candidate.pseudo === assignment.pseudo)?.hardRegister;
    const rightAssignment = variant.assignments.find((candidate) => candidate.pseudo === assignment.pseudo)?.hardRegister;
    if (leftAssignment !== rightAssignment) affectedPseudos.add(assignment.pseudo);
  }
  const setChange = changedSetCount(baseline, variant);
  if (setChange) affectedPseudos.add(setChange.pseudo);
  const assignmentChange = changedAssignment(baseline, variant);
  const metadataChanges = metadataDifferences(baseline, variant);
  const loopDepthChange = metadataChanges.find((change) => change.kind === "loop-depth");
  let summary = loopDepthChange
    ? `Metadata divergence: ${loopDepthChange.summary}`
    : setChange?.summary || assignmentChange ||
      (metadataChanges[0] ? `Metadata divergence: ${metadataChanges[0].summary}` : undefined);
  if (!summary && index !== undefined) {
    summary = `instruction ${index} changed from UID ${left?.uid ?? "missing"} to UID ${right?.uid ?? "missing"}`;
  }
  if (!summary && stableJson(baseline.schedulerDecisions) !== stableJson(variant.schedulerDecisions)) {
    summary = "scheduler ready-list selection changed";
  }
  if (!summary) summary = "normalized pass metadata changed";
  const difference: StageDifference = {
    stage,
    baselineHash: baseline.hash,
    variantHash: variant.hash,
    affectedUids: [...new Set([left?.uid, right?.uid].filter((uid): uid is number => uid !== undefined))],
    affectedPseudos: [...affectedPseudos].sort((a, b) => a - b),
    metadataChanges,
    summary,
  };
  if (index !== undefined) difference.firstInstructionIndex = index;
  if (left) difference.baselineUid = left.uid;
  if (right) difference.variantUid = right.uid;
  return difference;
}

export function comparePassSnapshots(
  baseline: Map<PassStage, PassSnapshot>,
  variant: Map<PassStage, PassSnapshot>,
): PassComparison {
  const divergentStages: StageDifference[] = [];
  let commonThrough: PassStage | undefined;
  for (const stage of PASS_STAGES) {
    const left = baseline.get(stage);
    const right = variant.get(stage);
    if (!left || !right) throw new Error(`cannot compare .${stage}: snapshot missing`);
    if (left.hash === right.hash) {
      if (divergentStages.length === 0) commonThrough = stage;
      continue;
    }
    divergentStages.push(stageDifference(stage, left, right));
  }
  const comparison: PassComparison = {
    equivalent: divergentStages.length === 0,
    divergentStages,
  };
  if (divergentStages[0]) comparison.firstDivergence = divergentStages[0];
  if (commonThrough) comparison.commonThrough = commonThrough;
  return comparison;
}
