/**
 * Anti-unification of two family members: the template both share, and the
 * substitution that turns one into the other.
 *
 * Two functions with the same shape agree on every token; they can only
 * disagree at holes. This module reads those disagreements and turns them into
 * a *constrained* substitution — constrained because one donor value must map
 * to one target value everywhere it occurs, which is the difference between a
 * transfer and a coincidence.
 *
 * Where the constraint cannot be met, the answer is a refusal with the
 * conflicting values named. A transfer that silently picked one of two
 * readings would produce a candidate that compiles, fails the oracle, and
 * tells nobody why.
 */

import type { FamilySignature, Hole, HoleKind } from "./signature.js";

/** One donor value and what the target has in its place, everywhere it occurs. */
export interface Substitution {
  kind: HoleKind;
  donorValue: number;
  targetValue: number;
  /** Symbol names, when the hole names an address. */
  donorSymbol?: string;
  targetSymbol?: string;
  /** Hole positions this substitution covers, in instruction order. */
  occurrences: Array<{ index: number; donorVram: number; targetVram: number }>;
}

export type AntiUnification =
  | {
      fitted: true;
      /** Substitutions, most-occurring first — the order a reader wants. */
      substitutions: Substitution[];
      /** Holes whose values already agree; recorded so nothing looks omitted. */
      identical: number;
    }
  | { fitted: false; reason: string };

/**
 * Compare two same-shape signatures and derive the substitution.
 *
 * The shape check is not redundant with the hole comparison: two signatures
 * with different shapes may still have equal hole counts, and pairing their
 * holes positionally would produce a substitution that means nothing.
 */
export function antiUnify(donor: FamilySignature, target: FamilySignature): AntiUnification {
  if (donor.shape !== target.shape) {
    return { fitted: false, reason: `different shapes: donor ${donor.shape}, target ${target.shape}` };
  }
  if (donor.holes.length !== target.holes.length) {
    return {
      fitted: false,
      reason: `same shape but ${donor.holes.length} donor holes against ${target.holes.length} target holes — the signature is inconsistent`,
    };
  }

  const groups = new Map<string, Substitution>();
  let identical = 0;

  for (let index = 0; index < donor.holes.length; index++) {
    const donorHole = donor.holes[index]!;
    const targetHole = target.holes[index]!;
    if (donorHole.kind !== targetHole.kind) {
      return {
        fitted: false,
        reason: `hole ${index} is ${donorHole.kind} in the donor and ${targetHole.kind} in the target`,
      };
    }
    if (sameValue(donorHole, targetHole)) {
      identical++;
      continue;
    }
    /* A high half some low half completes is redundant: substituting the low
     * half's symbol name moves both instructions. Recording it separately
     * would produce a substitution with no site in the donor's C and a
     * spurious "unplaceable" on every family that names two symbols. */
    if (donorHole.kind === "symbol-hi" && donorHole.paired) {
      identical++;
      continue;
    }
    const key = `${donorHole.kind}|${donorHole.value}|${donorHole.symbol ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      if (existing.targetValue !== targetHole.value || existing.targetSymbol !== targetHole.symbol) {
        return {
          fitted: false,
          reason:
            `the donor's ${donorHole.kind} ${formatValue(donorHole)} maps to both ${formatValue(targetHole)} ` +
            `and ${formatTarget(existing)} — one donor value cannot become two different things`,
        };
      }
      existing.occurrences.push({ index, donorVram: donorHole.vram, targetVram: targetHole.vram });
      continue;
    }
    groups.set(key, {
      kind: donorHole.kind,
      donorValue: donorHole.value,
      targetValue: targetHole.value,
      ...(donorHole.symbol ? { donorSymbol: donorHole.symbol } : {}),
      ...(targetHole.symbol ? { targetSymbol: targetHole.symbol } : {}),
      occurrences: [{ index, donorVram: donorHole.vram, targetVram: targetHole.vram }],
    });
  }

  return {
    fitted: true,
    identical,
    substitutions: [...groups.values()].sort(
      (left, right) => right.occurrences.length - left.occurrences.length || left.donorValue - right.donorValue,
    ),
  };
}

/**
 * Whether two holes hold the same thing.
 *
 * An address hole is compared by *symbol plus offset* when both resolve,
 * because two containers place the same symbol at different addresses and a
 * raw-address comparison would report a substitution for a reference that is
 * in fact identical.
 */
function sameValue(donor: Hole, target: Hole): boolean {
  if (donor.symbol !== undefined && target.symbol !== undefined) {
    return donor.symbol === target.symbol && (donor.symbolOffset ?? 0) === (target.symbolOffset ?? 0);
  }
  return donor.value === target.value;
}

function formatValue(hole: Hole): string {
  if (hole.symbol) return `${hole.symbol}${hole.symbolOffset ? `+0x${hole.symbolOffset.toString(16)}` : ""}`;
  return hole.value < 0 ? String(hole.value) : `0x${(hole.value >>> 0).toString(16)}`;
}

function formatTarget(substitution: Substitution): string {
  if (substitution.targetSymbol) return substitution.targetSymbol;
  return substitution.targetValue < 0 ? String(substitution.targetValue) : `0x${(substitution.targetValue >>> 0).toString(16)}`;
}

/** One line per substitution, for a report a reader can check by hand. */
export function describeSubstitutions(substitutions: Substitution[]): string[] {
  return substitutions.map((substitution) => {
    const from = substitution.donorSymbol ?? hex(substitution.donorValue);
    const to = substitution.targetSymbol ?? hex(substitution.targetValue);
    const where = substitution.occurrences
      .map((occurrence) => `0x${occurrence.donorVram.toString(16)}`)
      .join(", ");
    return `${substitution.kind}: ${from} → ${to} (${substitution.occurrences.length}× at ${where})`;
  });
}

function hex(value: number): string {
  return value < 0 ? String(value) : `0x${(value >>> 0).toString(16)}`;
}
