import type {
  PseudoProvenance,
  PseudoStagePresence,
  PseudoTransition,
  RtlInstruction,
} from "./types.js";
import { FIRST_PSEUDO_REGISTER } from "./rtl-parser.js";

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function expressionSummary(expression: string): string {
  return expression
    .replace(/\(reg(?:\/[a-z]+)*:[A-Z0-9]+\s+(\d+)(?:\s+[^()\s]+)?\)/gi, "pseudo $1")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function stagePresence(stage: string, instructions: RtlInstruction[]): Map<number, PseudoStagePresence> {
  const result = new Map<number, PseudoStagePresence>();
  const ensure = (pseudo: number): PseudoStagePresence => {
    let presence = result.get(pseudo);
    if (!presence) {
      presence = { stage, setUids: [], useUids: [], deathUids: [], blocks: [], expressions: [] };
      result.set(pseudo, presence);
    }
    return presence;
  };
  for (const instruction of instructions) {
    for (const reference of instruction.sets) {
      if (reference.register < FIRST_PSEUDO_REGISTER) continue;
      const presence = ensure(reference.register);
      presence.setUids.push(instruction.uid);
      if (instruction.expression) presence.expressions.push(expressionSummary(instruction.expression));
      if (instruction.block !== undefined) presence.blocks.push(instruction.block);
    }
    for (const reference of instruction.uses) {
      if (reference.register < FIRST_PSEUDO_REGISTER) continue;
      const presence = ensure(reference.register);
      presence.useUids.push(instruction.uid);
      if (instruction.block !== undefined) presence.blocks.push(instruction.block);
    }
    for (const reference of instruction.deaths) {
      if (reference.register < FIRST_PSEUDO_REGISTER) continue;
      const presence = ensure(reference.register);
      presence.deathUids.push(instruction.uid);
      if (instruction.block !== undefined) presence.blocks.push(instruction.block);
    }
  }
  for (const presence of result.values()) {
    presence.setUids = uniqueSorted(presence.setUids);
    presence.useUids = uniqueSorted(presence.useUids);
    presence.deathUids = uniqueSorted(presence.deathUids);
    presence.blocks = uniqueSorted(presence.blocks);
    presence.expressions = [...new Set(presence.expressions)];
  }
  return result;
}

function copySourceFor(
  pseudo: number,
  instructions: RtlInstruction[],
  next: Map<number, PseudoStagePresence>,
): number[] {
  const candidates = new Set<number>();
  for (const instruction of instructions) {
    if (!instruction.sets.some((reference) => reference.register === pseudo)) continue;
    if (instruction.operation !== "reg") continue;
    for (const use of instruction.uses) {
      if (use.register >= FIRST_PSEUDO_REGISTER && next.has(use.register)) candidates.add(use.register);
    }
  }
  return [...candidates].sort((a, b) => a - b);
}

function buildTransitions(
  stageOrder: string[],
  instructionsByStage: Map<string, RtlInstruction[]>,
  presenceByStage: Map<string, Map<number, PseudoStagePresence>>,
): Map<number, PseudoTransition[]> {
  const result = new Map<number, PseudoTransition[]>();
  const add = (pseudo: number, transition: PseudoTransition): void => {
    const list = result.get(pseudo) || [];
    list.push(transition);
    result.set(pseudo, list);
  };

  for (let index = 0; index + 1 < stageOrder.length; index++) {
    const fromStage = stageOrder[index]!;
    const toStage = stageOrder[index + 1]!;
    const before = presenceByStage.get(fromStage) || new Map();
    const after = presenceByStage.get(toStage) || new Map();
    const beforeInstructions = instructionsByStage.get(fromStage) || [];

    for (const [pseudo, oldPresence] of before) {
      const nextPresence = after.get(pseudo);
      if (nextPresence) {
        if (oldPresence.setUids.length !== nextPresence.setUids.length) {
          add(pseudo, {
            fromStage,
            toStage,
            kind: "set-count-changed",
            relatedPseudos: [pseudo],
            confidence: "exact",
            evidence: `SET UIDs changed from [${oldPresence.setUids.join(",")}] to [${nextPresence.setUids.join(",")}].`,
          });
        }
        continue;
      }

      const copySources = copySourceFor(pseudo, beforeInstructions, after);
      const expressionMatches: number[] = [];
      const oldExpressions = new Set(oldPresence.expressions);
      if (oldExpressions.size > 0) {
        for (const [candidate, candidatePresence] of after) {
          if (candidatePresence.expressions.some((expression) => oldExpressions.has(expression))) {
            expressionMatches.push(candidate);
          }
        }
      }
      const related = uniqueSorted([...copySources, ...expressionMatches]);
      let kind: PseudoTransition["kind"] = "deleted";
      let confidence: PseudoTransition["confidence"] = "exact";
      let evidence = `Pseudo ${pseudo} is absent from .${toStage}; no replacement is asserted.`;
      if (copySources.length === 1) {
        kind = "substituted";
        confidence = "inferred";
        evidence = `A copy into pseudo ${pseudo} used surviving pseudo ${copySources[0]}; this is an inferred substitution.`;
      } else if (related.length === 1) {
        kind = "substituted";
        confidence = "inferred";
        evidence = `The SET expression matches surviving pseudo ${related[0]}; the mapping is inferred.`;
      } else if (related.length > 1) {
        kind = "ambiguous";
        confidence = "inferred";
        evidence = `Several surviving pseudos are plausible replacements: ${related.join(", ")}.`;
      }
      add(pseudo, { fromStage, toStage, kind, relatedPseudos: related, confidence, evidence });
    }

    for (const pseudo of after.keys()) {
      if (before.has(pseudo)) continue;
      add(pseudo, {
        fromStage,
        toStage,
        kind: "appeared",
        relatedPseudos: [],
        confidence: "exact",
        evidence: `Pseudo ${pseudo} first appears in .${toStage}.`,
      });
    }

    const byReplacement = new Map<number, PseudoTransition[]>();
    for (const pseudo of before.keys()) {
      const transition = result.get(pseudo)?.find((candidate) =>
        candidate.fromStage === fromStage && candidate.toStage === toStage &&
        candidate.kind === "substituted" && candidate.relatedPseudos.length === 1
      );
      const replacement = transition?.relatedPseudos[0];
      if (!transition || replacement === undefined) continue;
      const list = byReplacement.get(replacement) || [];
      list.push(transition);
      byReplacement.set(replacement, list);
    }
    for (const [replacement, merged] of byReplacement) {
      if (merged.length < 2) continue;
      for (const transition of merged) {
        transition.kind = "merged";
        transition.evidence = `Several disappearing pseudos map to surviving pseudo ${replacement}; this merge is inferred from copies/SET expressions.`;
      }
    }
  }
  return result;
}

export function buildPseudoProvenance(
  stageOrder: string[],
  instructionsByStage: Map<string, RtlInstruction[]>,
): Map<number, PseudoProvenance> {
  const presenceByStage = new Map<string, Map<number, PseudoStagePresence>>();
  const pseudos = new Set<number>();
  for (const stage of stageOrder) {
    const presence = stagePresence(stage, instructionsByStage.get(stage) || []);
    presenceByStage.set(stage, presence);
    for (const pseudo of presence.keys()) pseudos.add(pseudo);
  }
  const transitions = buildTransitions(stageOrder, instructionsByStage, presenceByStage);
  const result = new Map<number, PseudoProvenance>();

  for (const pseudo of pseudos) {
    const stages: PseudoStagePresence[] = [];
    const modes = new Set<string>();
    let userVariable = false;
    for (const stage of stageOrder) {
      const presence = presenceByStage.get(stage)?.get(pseudo);
      if (presence) stages.push(presence);
      for (const instruction of instructionsByStage.get(stage) || []) {
        for (const reference of [...instruction.sets, ...instruction.uses]) {
          if (reference.register !== pseudo) continue;
          modes.add(reference.mode);
          userVariable ||= reference.flags.includes("v");
        }
      }
    }
    if (stages.length === 0) continue;
    const firstExpression = stages.flatMap((stage) => stage.expressions)[0];
    const summary: PseudoProvenance = {
      pseudo,
      modes: [...modes].sort(),
      userVariable,
      pointer: false,
      attributes: [],
      firstStage: stages[0]!.stage,
      lastStage: stages[stages.length - 1]!.stage,
      stages,
      transitions: transitions.get(pseudo) || [],
      lifetimes: [],
      preferences: [],
      conflicts: [],
    };
    if (firstExpression) {
      summary.sourceExpression = firstExpression;
      summary.sourceExpressionConfidence = "inferred";
    }
    result.set(pseudo, summary);
  }
  return result;
}
