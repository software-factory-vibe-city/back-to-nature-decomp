import type {
  AllocationStage,
  ConflictSummary,
  LifetimeRange,
  PseudoProvenance,
  QuantitySummary,
  RtlInstruction,
} from "./types.js";
import { FIRST_PSEUDO_REGISTER, hardRegisterName } from "./rtl-parser.js";

interface HeaderSummary {
  uses: number;
  span: number;
  block?: number;
  sets: number;
  attributes: string[];
}

export interface AllocationRecord {
  pseudo: number;
  header?: HeaderSummary;
  assignedHardReg?: number;
  allocationStage?: AllocationStage;
  preferences: number[];
  conflicts: ConflictSummary[];
  lifetimes: LifetimeRange[];
  quantity?: QuantitySummary;
}

export interface AllocationAnalysis {
  records: Map<number, AllocationRecord>;
  caveats: string[];
}

function parseHeaders(content: string): Map<number, HeaderSummary> {
  const result = new Map<number, HeaderSummary>();
  for (const line of content.split("\n")) {
    const match = line.match(
      /^Register (\d+) used (\d+) times? across (\d+) insns?(?: in block (\d+))?; set (\d+) times?;\s*(.*)$/,
    );
    if (!match) continue;
    const header: HeaderSummary = {
      uses: parseInt(match[2], 10),
      span: parseInt(match[3], 10),
      sets: parseInt(match[5], 10),
      attributes: match[6].split(";").map((item) => item.trim().replace(/\.$/, "")).filter(Boolean),
    };
    if (match[4]) header.block = parseInt(match[4], 10);
    result.set(parseInt(match[1], 10), header);
  }
  return result;
}

export function parseAssignments(content: string): Map<number, number> {
  const result = new Map<number, number>();
  for (const match of content.matchAll(/;; Register (\d+) in (\d+)\./g)) {
    result.set(parseInt(match[1], 10), parseInt(match[2], 10));
  }
  const dispositionIndex = content.indexOf(";; Register dispositions:");
  if (dispositionIndex >= 0) {
    const disposition = content.slice(dispositionIndex).split("\n\n", 1)[0];
    for (const match of disposition.matchAll(/\b(\d+) in (\d+)\b/g)) {
      result.set(parseInt(match[1], 10), parseInt(match[2], 10));
    }
  }
  return result;
}

function parseNumberLists(content: string, label: "conflicts" | "preferences"): Map<number, number[]> {
  const result = new Map<number, number[]>();
  const pattern = new RegExp(`^;; (\\d+) ${label}:\\s*(.*)$`);
  for (const line of content.split("\n")) {
    const match = line.match(pattern);
    if (!match) continue;
    const pseudo = parseInt(match[1], 10);
    const values = [...match[2].matchAll(/\d+/g)].map((value) => parseInt(value[0], 10));
    result.set(pseudo, values.filter((value) => value !== pseudo));
  }
  return result;
}

function parseLiveAtStart(content: string): Map<number, Set<number>> {
  const result = new Map<number, Set<number>>();
  for (const match of content.matchAll(
    /^;; Start of basic block (\d+), registers live:\s*(.*)$/gm,
  )) {
    result.set(
      parseInt(match[1], 10),
      new Set([...match[2].matchAll(/\b\d+\b/g)].map((value) => parseInt(value[0], 10))),
    );
  }
  return result;
}

function computeLifetimes(content: string, instructions: RtlInstruction[]): Map<number, LifetimeRange[]> {
  const result = new Map<number, LifetimeRange[]>();
  const liveAtStart = parseLiveAtStart(content);
  const blocks = new Map<number, RtlInstruction[]>();
  for (const instruction of instructions) {
    if (instruction.block === undefined) continue;
    const list = blocks.get(instruction.block) || [];
    list.push(instruction);
    blocks.set(instruction.block, list);
  }

  for (const [block, blockInstructions] of blocks) {
    const active = new Map<number, { birthUid?: number; birthIndex: number; liveIn: boolean }>();
    const firstIndex = blockInstructions[0]?.order ?? 0;
    const lastIndex = blockInstructions[blockInstructions.length - 1]?.order ?? firstIndex;
    for (const register of liveAtStart.get(block) || []) {
      if (register >= FIRST_PSEUDO_REGISTER) {
        active.set(register, { birthIndex: firstIndex, liveIn: true });
      }
    }

    const close = (pseudo: number, deathUid: number | undefined, deathIndex: number, liveOut: boolean): void => {
      const birth = active.get(pseudo);
      if (!birth) return;
      const ranges = result.get(pseudo) || [];
      const range: LifetimeRange = {
        block,
        birthIndex: birth.birthIndex,
        deathIndex,
        fakeBirthIndex: Math.max(firstIndex, birth.birthIndex - 1),
        fakeDeathIndex: Math.min(lastIndex, deathIndex + 1),
        liveIn: birth.liveIn,
        liveOut,
        confidence: "reconstructed",
      };
      if (birth.birthUid !== undefined) range.birthUid = birth.birthUid;
      if (deathUid !== undefined) range.deathUid = deathUid;
      ranges.push(range);
      result.set(pseudo, ranges);
      active.delete(pseudo);
    };

    for (const instruction of blockInstructions) {
      for (const set of instruction.sets) {
        if (set.register < FIRST_PSEUDO_REGISTER) continue;
        if (active.has(set.register)) close(set.register, instruction.uid, instruction.order, false);
        active.set(set.register, {
          birthUid: instruction.uid,
          birthIndex: instruction.order,
          liveIn: false,
        });
      }
      for (const death of instruction.deaths) {
        if (death.register >= FIRST_PSEUDO_REGISTER) {
          close(death.register, instruction.uid, instruction.order, false);
        }
      }
    }
    for (const pseudo of [...active.keys()]) close(pseudo, undefined, lastIndex, true);
  }
  return result;
}

function overlaps(left: LifetimeRange, right: LifetimeRange, fake: boolean): boolean {
  if (left.block !== right.block) return false;
  const leftStart = fake ? left.fakeBirthIndex : left.birthIndex;
  const leftEnd = fake ? left.fakeDeathIndex : left.deathIndex;
  const rightStart = fake ? right.fakeBirthIndex : right.birthIndex;
  const rightEnd = fake ? right.fakeDeathIndex : right.deathIndex;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function addFakeLifetimeConflicts(records: Map<number, AllocationRecord>): void {
  const locals = [...records.values()].filter((record) =>
    record.allocationStage === "local" && record.lifetimes.length > 0
  );
  for (let leftIndex = 0; leftIndex < locals.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < locals.length; rightIndex++) {
      const left = locals[leftIndex];
      const right = locals[rightIndex];
      if (!left || !right) continue;
      const actual = left.lifetimes.some((a) => right.lifetimes.some((b) => overlaps(a, b, false)));
      const fake = left.lifetimes.some((a) => right.lifetimes.some((b) => overlaps(a, b, true)));
      if (actual || !fake) continue;
      left.conflicts.push({ register: right.pseudo, kind: "fake-lifetime-only", confidence: "reconstructed" });
      right.conflicts.push({ register: left.pseudo, kind: "fake-lifetime-only", confidence: "reconstructed" });
    }
  }
}

export function analyzeAllocation(
  localContent: string,
  globalContent: string,
  localInstructions: RtlInstruction[],
): AllocationAnalysis {
  if (!/^\d+ registers\.$/m.test(localContent)) {
    throw new Error("Allocation parse error in .lreg: missing register-count header");
  }
  const headers = parseHeaders(localContent);
  const localAssignments = parseAssignments(localContent);
  const globalAssignments = parseAssignments(globalContent);
  const conflictMap = parseNumberLists(globalContent, "conflicts");
  const preferenceMap = parseNumberLists(globalContent, "preferences");
  const lifetimes = computeLifetimes(localContent, localInstructions);
  const pseudos = new Set<number>([
    ...headers.keys(), ...localAssignments.keys(), ...globalAssignments.keys(),
    ...conflictMap.keys(), ...lifetimes.keys(),
  ]);
  const records = new Map<number, AllocationRecord>();

  for (const pseudo of pseudos) {
    if (pseudo < FIRST_PSEUDO_REGISTER) continue;
    const hard = globalAssignments.get(pseudo) ?? localAssignments.get(pseudo);
    const conflicts: ConflictSummary[] = [];
    for (const register of conflictMap.get(pseudo) || []) {
      const conflict: ConflictSummary = {
        register,
        kind: register >= FIRST_PSEUDO_REGISTER ? "pseudo" : "hard-register",
        confidence: "exact",
      };
      if (register < FIRST_PSEUDO_REGISTER) conflict.registerName = hardRegisterName(register);
      conflicts.push(conflict);
    }
    const ranges = lifetimes.get(pseudo) || [];
    const record: AllocationRecord = {
      pseudo,
      preferences: preferenceMap.get(pseudo) || [],
      conflicts,
      lifetimes: ranges,
    };
    const header = headers.get(pseudo);
    if (header) record.header = header;
    if (hard !== undefined) {
      record.assignedHardReg = hard;
      record.allocationStage = localAssignments.has(pseudo) ? "local" : "global/reload";
    }
    if (record.allocationStage === "local") {
      const quantity: QuantitySummary = {
        id: `pseudo-${pseudo}`,
        members: [pseudo],
        confidence: "reconstructed",
        evidence: "The stock dump reports a local assignment but not GCC's internal qty number; no merge note was exposed.",
      };
      if (ranges.length > 0) {
        quantity.birthIndex = Math.min(...ranges.map((range) => range.birthIndex));
        quantity.deathIndex = Math.max(...ranges.map((range) => range.deathIndex));
      }
      record.quantity = quantity;
    }
    records.set(pseudo, record);
  }
  addFakeLifetimeConflicts(records);

  return {
    records,
    caveats: [
      "Lifetime endpoints are reconstructed from scheduled instruction order, SETs, REG_DEAD notes, and live-at-start sets; GCC's private doubled qty indices are not printed by -da.",
      "Local quantity IDs are therefore reconstructed pseudo IDs unless a future dump exposes an explicit quantity merge.",
      "fake-lifetime-only conflicts are reconstructed by extending each local range one scheduled instruction on both sides.",
    ],
  };
}

export function applyAllocation(
  pseudos: Map<number, PseudoProvenance>,
  allocation: AllocationAnalysis,
): void {
  for (const [pseudo, record] of allocation.records) {
    const summary = pseudos.get(pseudo);
    if (!summary) continue;
    const header = record.header;
    if (header) {
      summary.uses = header.uses;
      summary.span = header.span;
      summary.sets = header.sets;
      summary.attributes = header.attributes;
      summary.userVariable ||= header.attributes.includes("user var");
      summary.pointer ||= header.attributes.includes("pointer");
      if (header.block !== undefined) summary.block = header.block;
    }
    if (record.assignedHardReg !== undefined) {
      summary.assignedHardReg = record.assignedHardReg;
      summary.assignedRegister = hardRegisterName(record.assignedHardReg);
    }
    if (record.allocationStage) summary.allocationStage = record.allocationStage;
    if (record.assignedHardReg !== undefined) {
      for (const transition of summary.transitions) {
        if (transition.fromStage === "lreg" && transition.toStage === "greg" && transition.kind === "deleted") {
          transition.kind = "hard-register-renumbered";
          transition.confidence = "exact";
          transition.evidence = `Global/reload renumbering replaced pseudo ${pseudo} with $${hardRegisterName(record.assignedHardReg)} (${record.assignedHardReg}).`;
        }
      }
    }
    summary.preferences = record.preferences;
    summary.conflicts = record.conflicts;
    summary.lifetimes = record.lifetimes;
    if (record.quantity) summary.quantity = record.quantity;
  }
}
