export interface FiniteValue<T> {
  value: T;
  cost: number;
  label: string;
}

export interface FiniteVariable<T> {
  id: string;
  values: FiniteValue<T>[];
}

export type PartialConstraintVerdict =
  | { status: "open" }
  | { status: "reject"; reason: string };

export interface FiniteSolveOptions<T> {
  variables: FiniteVariable<T>[];
  maxAssignments: number;
  evaluatePartial?: (assignment: ReadonlyMap<string, T>) => PartialConstraintVerdict;
  evaluateComplete: (assignment: ReadonlyMap<string, T>) => boolean;
}

export interface FiniteSolveResult<T> {
  status: "sat" | "unsat" | "inconclusive";
  assignment?: Map<string, T>;
  exploredAssignments: number;
  rejectedPartialAssignments: number;
  exhaustive: boolean;
  rejectionReasons: Record<string, number>;
}

function maximumCost<T>(variables: FiniteVariable<T>[]): number {
  return variables.reduce((sum, variable) => sum + Math.max(...variable.values.map((item) => item.cost)), 0);
}

/**
 * Deterministic finite-domain satisfiability search. Values carry a non-negative
 * intervention cost; assignments are visited in increasing total cost and then
 * variable/value declaration order. The solver is domain-generic and has no
 * scheduler knowledge.
 */
export function solveFiniteDomain<T>(options: FiniteSolveOptions<T>): FiniteSolveResult<T> {
  if (!Number.isInteger(options.maxAssignments) || options.maxAssignments < 1) {
    throw new Error("maxAssignments must be a positive integer");
  }
  for (const variable of options.variables) {
    if (!variable.id || variable.values.length === 0) throw new Error(`finite variable ${variable.id || "<unnamed>"} has no values`);
    if (variable.values.some((item) => !Number.isInteger(item.cost) || item.cost < 0)) {
      throw new Error(`finite variable ${variable.id} has a negative or non-integral cost`);
    }
  }

  let exploredAssignments = 0;
  let rejectedPartialAssignments = 0;
  let truncated = false;
  let witness: Map<string, T> | undefined;
  const rejectionReasons: Record<string, number> = {};
  const assignment = new Map<string, T>();
  const maxCost = maximumCost(options.variables);

  const visit = (index: number, remainingCost: number): boolean => {
    if (exploredAssignments >= options.maxAssignments) {
      truncated = true;
      return false;
    }
    if (index === options.variables.length) {
      if (remainingCost !== 0) return false;
      exploredAssignments++;
      if (options.evaluateComplete(assignment)) {
        witness = new Map(assignment);
        return true;
      }
      return false;
    }

    const variable = options.variables[index]!;
    for (const candidate of variable.values) {
      if (candidate.cost > remainingCost) continue;
      assignment.set(variable.id, candidate.value);
      const verdict = options.evaluatePartial?.(assignment) || { status: "open" as const };
      if (verdict.status === "reject") {
        rejectedPartialAssignments++;
        rejectionReasons[verdict.reason] = (rejectionReasons[verdict.reason] || 0) + 1;
      } else if (visit(index + 1, remainingCost - candidate.cost)) {
        return true;
      }
      assignment.delete(variable.id);
      if (truncated) return false;
    }
    return false;
  };

  for (let cost = 0; cost <= maxCost && !witness && !truncated; cost++) visit(0, cost);
  return {
    status: witness ? "sat" : truncated ? "inconclusive" : "unsat",
    ...(witness ? { assignment: witness } : {}),
    exploredAssignments,
    rejectedPartialAssignments,
    exhaustive: !truncated,
    rejectionReasons,
  };
}
