import { PASS_STAGES, type HypothesisClassification, type PassComparison, type VariantHypothesis, type VariantStatus } from "./types.js";

function normalizedPass(value: string): string {
  return value.trim().toLowerCase().replace(/^\./, "");
}

export function classifyHypothesis(options: {
  hypothesis: VariantHypothesis;
  status: VariantStatus;
  passComparison?: PassComparison;
  tracePasses: boolean;
  cc1Only: boolean;
  baseline: boolean;
}): HypothesisClassification {
  if (options.baseline) {
    return { verdict: "inconclusive", reason: "reference baseline; no hypothesis is judged against itself", promotionEligible: false };
  }
  if (options.status === "compile-error") {
    return { verdict: "inconclusive", reason: "compilation failed before the predicted mechanism could be observed", promotionEligible: false };
  }

  const expected = normalizedPass(options.hypothesis.expectedPass);
  let verdict: HypothesisClassification["verdict"] = "inconclusive";
  let reason: string;
  if (!options.tracePasses) {
    if (expected === "assembly") {
      verdict = options.status === "exact" ? "confirmed" : "partially-confirmed";
      reason = options.status === "exact"
        ? "the predicted final-assembly effect occurred"
        : "final assembly changed, but the expected effect requires human inspection";
    } else {
      reason = "pass tracing was disabled, so the predicted compiler mechanism was not measured";
    }
  } else if (!options.passComparison) {
    reason = "the baseline pass trace was unavailable";
  } else if (options.passComparison.equivalent) {
    verdict = "rejected";
    reason = "the variant is equivalent to the baseline through .dbr; the source edit had no compiler effect";
  } else if (!(PASS_STAGES as readonly string[]).includes(expected)) {
    verdict = "inconclusive";
    reason = `expectedPass ${options.hypothesis.expectedPass} is not a traced pass; inspect the preserved artifacts manually`;
  } else {
    const divergent = options.passComparison.divergentStages.map((difference) => difference.stage);
    const first = options.passComparison.firstDivergence!.stage;
    if (first === expected) {
      verdict = "confirmed";
      reason = `the first meaningful divergence is .${first}, matching the predicted pass`;
    } else if (divergent.includes(expected as any)) {
      verdict = "partially-confirmed";
      reason = `.${expected} changed as predicted, but an earlier divergence already appeared in .${first}`;
    } else {
      verdict = "rejected";
      reason = `the first divergence is .${first}, and .${expected} is equivalent to the baseline`;
    }
  }

  return {
    verdict,
    reason,
    promotionEligible: !options.cc1Only && options.status === "exact" &&
      (verdict === "confirmed" || verdict === "partially-confirmed"),
  };
}

export const VERDICT_RANK: Record<HypothesisClassification["verdict"], number> = {
  confirmed: 0,
  "partially-confirmed": 1,
  rejected: 2,
  inconclusive: 3,
};
