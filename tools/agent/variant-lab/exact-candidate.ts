import type { ExactCandidateBasis, NormalizedInstruction, VariantStatus } from "./types.js";

/**
 * Byte-exactness as an oracle result, orthogonal to the mechanism verdict.
 *
 * A variant can be byte-exact and still be classified `inconclusive` — that is
 * what happens whenever pass tracing is disabled, because the classifier has no
 * evidence about the mechanism the hypothesis predicted. Both statements are
 * true at once, and the run has to say so: the verdict answers "did the stated
 * mechanism fire", this answers "does the code come out the same".
 *
 * Exactness is never inferred from the score alone. In full mode the object
 * comparison already carries relocation type and symbol, so an exact category
 * is relocation-aware. In cc1-only mode the normalized text does not, and two
 * calls to different symbols disassemble identically before linking — so a
 * target instruction whose relocation never reached the compared text is an
 * unresolved symbol, and an unresolved symbol is not a match.
 */
export interface ExactCandidateAssessment {
  exactCandidate: boolean;
  exactCandidateBasis: ExactCandidateBasis;
  reason: string;
}

const NOT_EXACT: ExactCandidateAssessment = {
  exactCandidate: false,
  exactCandidateBasis: null,
  reason: "not an exact result",
};

/** Target instructions whose relocation never reached the compared text. */
export function unresolvedRelocations(
  target: NormalizedInstruction[],
  compiled: NormalizedInstruction[],
): number[] {
  const unresolved: number[] = [];
  target.forEach((instruction, index) => {
    if (!instruction.relocation) return;
    const other = compiled[index];
    if (!instruction.canonical.includes(instruction.relocation) ||
        other === undefined ||
        !other.canonical.includes(instruction.relocation)) {
      unresolved.push(index);
    }
  });
  return unresolved;
}

export function assessExactCandidate(input: {
  status: VariantStatus;
  exact?: number;
  total?: number;
  mode: "full" | "cc1-only";
  target: NormalizedInstruction[];
  compiled: NormalizedInstruction[];
}): ExactCandidateAssessment {
  if (input.status !== "exact") return NOT_EXACT;
  if (input.total === undefined || input.total === 0 || input.exact !== input.total) return NOT_EXACT;

  if (input.mode === "full") {
    return {
      exactCandidate: true,
      exactCandidateBasis: "full-object",
      reason: `${input.exact}/${input.total} instructions identical in the configured object comparison, relocations included`,
    };
  }

  const unresolved = unresolvedRelocations(input.target, input.compiled);
  if (unresolved.length > 0) {
    return {
      exactCandidate: false,
      exactCandidateBasis: null,
      reason:
        `normalized score is ${input.exact}/${input.total}, but ${unresolved.length} target instruction(s) ` +
        `carry a relocation the comparison never resolved (index ${unresolved.join(", ")}); ` +
        "an unresolved symbol is not a match",
    };
  }
  return {
    exactCandidate: true,
    exactCandidateBasis: "cc1-only",
    reason: `${input.exact}/${input.total} normalized cc1 instructions identical; full-mode confirmation still required`,
  };
}
