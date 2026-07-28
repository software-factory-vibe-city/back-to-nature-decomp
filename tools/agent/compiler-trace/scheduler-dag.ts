import type {
  DependencyEdge,
  DependencyKind,
  LifetimeChange,
  ReadyEntry,
  RtlInstruction,
  SchedulerDecision,
  SchedulerStage,
} from "./types.js";
import { registerAccess } from "./rtl-parser.js";
import { explainSchedulerSelections, reconstructLuid } from "./scheduler-order.js";

function intersects(left: Set<number>, right: Set<number>): number[] {
  return [...left].filter((value) => right.has(value));
}

function parseDisplayedPriority(raw: string): number {
  /* Ready-list priorities are printed with %x by GCC's legacy sched.c. */
  return parseInt(raw, 16);
}

function parseReadyEntries(text: string): ReadyEntry[] {
  const result: ReadyEntry[] = [];
  const pattern = /(\d+)\s+\(([0-9a-f]+)\)/gi;
  for (const match of text.matchAll(pattern)) {
    result.push({
      uid: parseInt(match[1], 10),
      displayedPriority: parseDisplayedPriority(match[2]),
      rawPriority: match[2].toLowerCase(),
      rank: result.length,
    });
  }
  return result;
}

function parseUidList(text: string): number[] {
  return [...text.matchAll(/\b\d+\b/g)].map((match) => parseInt(match[0], 10));
}

function dependencyKind(current: RtlInstruction, predecessor: RtlInstruction, note?: string): DependencyKind {
  if (note === "REG_DEP_ANTI") return "anti";
  if (note === "REG_DEP_OUTPUT") return "output";
  const currentAccess = registerAccess(current);
  const predecessorAccess = registerAccess(predecessor);
  if (intersects(predecessorAccess.sets, currentAccess.uses).length > 0) return "true";
  if (intersects(predecessorAccess.uses, currentAccess.sets).length > 0) return "anti";
  if (intersects(predecessorAccess.sets, currentAccess.sets).length > 0) return "output";
  if (current.control || predecessor.control) return "control";
  if ((current.memoryRead || current.memoryWrite) && (predecessor.memoryRead || predecessor.memoryWrite)) {
    return "memory/alias";
  }
  return "unknown";
}

function dependencyCost(kind: DependencyKind, predecessor: RtlInstruction): { cost: number; adjusted: number } {
  if (kind === "anti" || kind === "output") return { cost: 1, adjusted: 0 };
  if (kind === "true" && predecessor.memoryRead) return { cost: 2, adjusted: 2 };
  return { cost: 1, adjusted: 1 };
}

function parseDependencies(instructions: RtlInstruction[]): DependencyEdge[] {
  const byUid = new Map(instructions.map((instruction) => [instruction.uid, instruction]));
  const result: DependencyEdge[] = [];
  const seen = new Set<string>();
  for (const current of instructions) {
    for (const dependency of current.dependencies) {
      const predecessor = byUid.get(dependency.predecessorUid);
      if (!predecessor) continue;
      const kind = dependencyKind(current, predecessor, dependency.note);
      const key = `${predecessor.uid}:${current.uid}:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const costs = dependencyCost(kind, predecessor);
      result.push({
        fromUid: predecessor.uid,
        toUid: current.uid,
        kind,
        cost: costs.cost,
        targetAdjustedCost: costs.adjusted,
        confidence: dependency.note || kind === "true" ? "exact" : "inferred",
        evidence: dependency.note
          ? `GCC emitted ${dependency.note} on the dependency link.`
          : kind === "memory/alias"
            ? "No register flow explains the untyped link and both instructions access memory."
            : "Dependency kind reconstructed from RTL register and memory access sets.",
      });
    }
  }
  return result;
}

function decisionReason(decision: SchedulerDecision): void {
  const selected = decision.selectedUid;
  if (selected === undefined) return;
  if (decision.events.some((event) => event.includes("greater potential hazard"))) {
    decision.reason = "functional-unit-hazard";
    decision.reasonConfidence = "exact";
    return;
  }
  if (decision.events.some((event) => event.includes("launching"))) {
    decision.reason = "launch";
    decision.reasonConfidence = "exact";
    return;
  }
  if (decision.events.some((event) => event.includes("blocking"))) {
    decision.reason = "blocked";
    decision.reasonConfidence = "exact";
    return;
  }
  if (decision.ready.length === 1) {
    decision.reason = "sole";
    decision.reasonConfidence = "exact";
    return;
  }
  if (decision.birthPriorityAdjusted) {
    decision.reason = "birth-priority";
    decision.reasonConfidence = "reconstructed";
    return;
  }
  const selectedEntry = decision.ready.find((entry) => entry.uid === selected);
  const others = decision.ready.filter((entry) => entry.uid !== selected);
  if (selectedEntry && others.every((entry) => selectedEntry.displayedPriority > entry.displayedPriority)) {
    decision.reason = "priority";
    decision.reasonConfidence = "exact";
    return;
  }
  decision.reason = "luid-or-list-order";
  decision.reasonConfidence = "inferred";
}

function parseDecisions(content: string): SchedulerDecision[] {
  const result: SchedulerDecision[] = [];
  let block = -1;
  let current: SchedulerDecision | undefined;
  const pendingEvents = new Map<string, string[]>();
  const eventKey = (eventBlock: number, cycle: number): string => `${eventBlock}:${cycle}`;

  const finish = (): void => {
    if (!current) return;
    current.selectedUid = current.ranked[0];
    if (current.selectedUid !== undefined) {
      current.selectedRank = current.ready.findIndex((entry) => entry.uid === current!.selectedUid);
      const selected = current.ready.find((entry) => entry.uid === current!.selectedUid);
      if (selected) current.birthPriorityAdjusted = /^7f[0-9a-f]+$/i.test(selected.rawPriority);
    }
    decisionReason(current);
    result.push(current);
    current = undefined;
  };

  for (const rawLine of content.split("\n")) {
    const line = rawLine.replace(/^;;\s?/, "");
    const blockMatch = line.match(/-- basic block number (\d+) /);
    if (blockMatch) block = parseInt(blockMatch[1], 10);

    const launch = line.match(/^(launching .+ at T-(\d+))$/);
    if (launch) {
      const cycle = parseInt(launch[2], 10);
      const key = eventKey(block, cycle);
      const events = pendingEvents.get(key) || [];
      events.push(launch[1]);
      pendingEvents.set(key, events);
      continue;
    }

    const ready = line.match(/^ready list at T-(\d+):\s*(.*)$/);
    if (ready) {
      finish();
      const cycle = parseInt(ready[1], 10);
      const pieces = ready[2].split(/,\s*now\s*/);
      const entries = parseReadyEntries(pieces[0] || "");
      const ranked = pieces[1] ? parseUidList(pieces[1]) : entries.map((entry) => entry.uid);
      current = {
        block,
        cycle,
        ready: entries,
        comparatorRanked: [...ranked],
        ranked,
        birthPriorityAdjusted: false,
        reason: "unknown",
        reasonConfidence: "inferred",
        events: pendingEvents.get(eventKey(block, cycle)) || [],
      };
      continue;
    }

    if (current && /^(blocking insn|insn \d+ has a greater potential hazard)/.test(line)) {
      current.events.push(line);
      const now = line.match(/,\s*now\s+(.*)$/);
      if (now) current.ranked = parseUidList(now[1]);
    }
  }
  finish();
  return result;
}

function parsePriorities(content: string): Record<string, { priority: number; refCount: number }> {
  const result: Record<string, { priority: number; refCount: number }> = {};
  for (const match of content.matchAll(
    /^;; insn\[\s*(\d+)\]: priority =\s*(-?\d+), ref_count =\s*(\d+)/gm,
  )) {
    result[match[1]] = { priority: parseInt(match[2], 10), refCount: parseInt(match[3], 10) };
  }
  return result;
}

function parseLifetimeChanges(content: string): LifetimeChange[] {
  const result: LifetimeChange[] = [];
  for (const match of content.matchAll(
    /^;; register (\d+) life (shortened|extended) from (\d+) to (\d+)$/gm,
  )) {
    result.push({
      register: parseInt(match[1], 10),
      direction: match[2] as LifetimeChange["direction"],
      from: parseInt(match[3], 10),
      to: parseInt(match[4], 10),
    });
  }
  return result;
}

export function parseScheduler(
  stage: "sched" | "sched2",
  content: string,
  instructions: RtlInstruction[],
  source: number[] | RtlInstruction[],
): SchedulerStage {
  const decisions = parseDecisions(content);
  const priorities = parsePriorities(content);
  const sourceInstructions: RtlInstruction[] = source.length > 0 && typeof source[0] === "number"
    ? (source as number[]).map((uid, order) => ({
        uid, kind: "insn", stage: `${stage}-input`, order, chainOrder: order,
        text: "", sets: [], uses: [], deaths: [], memoryRead: false,
        memoryWrite: false, control: false, dependencies: [],
      }))
    : source as RtlInstruction[];
  const luidByUid = reconstructLuid(sourceInstructions);
  const dependencies = parseDependencies(instructions);
  for (const decision of decisions) {
    if (decision.selectedUid === undefined) continue;
    const base = priorities[String(decision.selectedUid)];
    if (base) decision.basePriority = base.priority;
  }
  if (/^;; ready list at T-/m.test(content) && decisions.length === 0) {
    throw new Error(`Scheduler parse error in .${stage}: ready-list lines were present but none could be parsed`);
  }
  const selectionExplanations = explainSchedulerSelections(stage, decisions, dependencies, luidByUid);
  return {
    stage,
    instructionPriorities: priorities,
    decisions,
    selectionExplanations,
    luidByUid,
    dependencies,
    sourceOrder: sourceInstructions.map((instruction) => instruction.uid),
    forwardOrder: instructions.map((instruction) => instruction.uid),
    backwardSelectionOrder: decisions.flatMap((decision) =>
      decision.selectedUid === undefined ? [] : [decision.selectedUid]
    ),
    lifetimeChanges: parseLifetimeChanges(content),
    caveats: [
      "Ready-list selection uses GCC 2.95.2 legacy sched.c order: priority, relation to the last scheduled instruction, then block-local LUID; scheduling is backward.",
      "Dependency costs use the documented R3000 load latency and MIPS anti/output cost adjustment when the dump does not print per-edge costs.",
      "LUID relations are reconstructed from the pre-scheduler RTL chain including note gaps and validated against each dumped comparator order.",
    ],
  };
}
