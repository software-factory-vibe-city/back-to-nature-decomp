/**
 * fingerprint.ts — the build a function was compiled by, per function.
 *
 * Per function, not per project. Two things make that necessary rather than
 * fussy. A container has its own small-data threshold (`-G0` for every overlay,
 * `-G8` for the executable), which changes how many instructions an address
 * takes. And a translation unit may carry a per-file flag override, which is a
 * fact about the original build rather than a workaround — those functions are
 * the only in-project evidence about what a different flag column does to
 * codegen, so excluding them would discard the most interesting rows in the
 * set.
 *
 * The fingerprint is what lets a retrieval hit *degrade its claim* instead of
 * being dropped. A hit from a `-fno-schedule-insns` function tells a
 * baseline-flags target nothing about its schedule residual and everything
 * about its population one, and the tool can say exactly that because it knows
 * which flags own which axis.
 */

import { configuredCc1FlagsForContainer, configuredGccVersion, containerKindForSymbol, loadFlagOverrides } from "../decompToolchain.js";

/** The four residual axes, in the order the staged objective compares them. */
export type Axis = "controlFlow" | "population" | "schedule" | "allocation";

/**
 * Which residual axis a flag owns.
 *
 * Derived from what the flag actually turns on or off in GCC 2.95's
 * `rest_of_compilation`, not from where it appears in a manual. A flag that
 * owns an axis makes any cross-flag claim about that axis worthless, and leaves
 * claims about the other axes intact.
 */
export const FLAG_AXES: Array<{ pattern: RegExp; axes: Axis[]; why: string }> = [
  { pattern: /^-f(no-)?schedule-insns2?$/, axes: ["schedule"], why: "turns the instruction scheduler on or off" },
  { pattern: /^-f(no-)?gcse$/, axes: ["population"], why: "global CSE removes or keeps whole computations" },
  { pattern: /^-f(no-)?cse-skip-blocks$/, axes: ["population"], why: "changes which redundancies CSE finds across blocks" },
  { pattern: /^-f(no-)?rerun-cse-after-loop$/, axes: ["population"], why: "a second CSE pass removes computations loop opts exposed" },
  { pattern: /^-G\d+$/, axes: ["population"], why: "the small-data threshold decides whether an address is one instruction or two" },
  { pattern: /^-f(no-)?unsigned-char$/, axes: ["population"], why: "changes whether a byte load needs a sign extension" },
  { pattern: /^-f(no-)?omit-frame-pointer$/, axes: ["population", "allocation"], why: "frees or reserves a callee-saved register" },
  { pattern: /^-f(no-)?strength-reduce$/, axes: ["population", "allocation"], why: "creates or omits derived induction variables" },
  { pattern: /^-m(no-)?split-addresses$/, axes: ["population", "schedule"], why: "changes whether %hi/%lo are separable instructions" },
  { pattern: /^-O[0-3s]$/, axes: ["controlFlow", "population", "schedule", "allocation"], why: "the optimisation level decides which passes run at all" },
  { pattern: /^-f(no-)?regmove$/, axes: ["allocation"], why: "regmove rewrites copies before allocation" },
  { pattern: /^-f(no-)?peephole$/, axes: ["population"], why: "peephole fuses or leaves instruction pairs" },
];

export interface ToolchainFingerprint {
  /** Compiler version string, e.g. `2.95.2`. */
  gcc: string;
  /** Container kind, which fixes the small-data threshold. */
  container: "exe" | "overlay";
  /** cc1 flags, sorted, including any per-file override. */
  flags: string[];
  /** Per-file override flags only — empty for a baseline translation unit. */
  overrides: string[];
  /** Stable identity, for grouping and for the corpus record. */
  id: string;
}

export function fingerprintOf(functionName: string): ToolchainFingerprint {
  const container = containerKindForSymbol(functionName);
  const base = configuredCc1FlagsForContainer(container);
  const overrides = loadFlagOverrides().get(functionName) ?? [];
  const flags = [...base, ...overrides].sort();
  const gcc = configuredGccVersion();
  return {
    gcc,
    container,
    flags,
    overrides,
    id: `gcc${gcc}/${container}${overrides.length > 0 ? `+${[...overrides].sort().join(" ")}` : ""}`,
  };
}

/**
 * How far apart two builds are, and what a hit across that distance may claim.
 *
 * The point is never to drop a hit for being from a different build. It is to
 * say which half of it is still evidence — the source idiom and the mechanism
 * almost always are, the instruction alignment often is not.
 */
export type Distance = "identical" | "flags" | "compiler-minor" | "compiler-major";

export interface Compatibility {
  distance: Distance;
  /** Axes a hit at this distance still proves something about. */
  provenAxes: Axis[];
  /** Axes it cannot speak to, with the flag that owns each. */
  unprovenAxes: Array<{ axis: Axis; because: string }>;
  /** One sentence a tool can print verbatim. */
  claim: string;
}

const ALL_AXES: Axis[] = ["controlFlow", "population", "schedule", "allocation"];

export function compatibility(query: ToolchainFingerprint, hit: ToolchainFingerprint): Compatibility {
  if (query.id === hit.id) {
    return {
      distance: "identical",
      provenAxes: ALL_AXES,
      unprovenAxes: [],
      claim: "same compiler, same flags, same assembler — the shape alignment is proof.",
    };
  }

  if (query.gcc === hit.gcc) {
    const differing = symmetricDifference(query.flags, hit.flags);
    const unproven = new Map<Axis, string>();
    for (const flag of differing) {
      const owner = FLAG_AXES.find((entry) => entry.pattern.test(flag));
      if (!owner) {
        /* An unrecognised flag could own anything. Saying so is the honest
           answer; assuming it owns nothing would quietly upgrade the claim. */
        for (const axis of ALL_AXES) unproven.set(axis, `${flag} (unclassified — assumed to affect every axis)`);
        continue;
      }
      for (const axis of owner.axes) unproven.set(axis, `${flag} ${owner.why}`);
    }
    const proven = ALL_AXES.filter((axis) => !unproven.has(axis));
    return {
      distance: "flags",
      provenAxes: proven,
      unprovenAxes: [...unproven].map(([axis, because]) => ({ axis, because })),
      claim:
        `same compiler, different flags (${differing.join(" ")}). ` +
        (proven.length > 0
          ? `Proof for ${proven.join(", ")}; a hypothesis for ${[...unproven.keys()].join(", ")}.`
          : "Every axis is owned by a differing flag, so the source idiom is a hypothesis and the alignment proves nothing."),
    };
  }

  const major = (version: string) => version.split(".").slice(0, 2).join(".");
  if (major(query.gcc) === major(hit.gcc)) {
    return {
      distance: "compiler-minor",
      provenAxes: [],
      unprovenAxes: ALL_AXES.map((axis) => ({ axis, because: `gcc ${hit.gcc} is not gcc ${query.gcc}` })),
      claim: `different GCC patch level (${hit.gcc} vs ${query.gcc}) — the source idiom is a hypothesis, the alignment is not proof.`,
    };
  }
  return {
    distance: "compiler-major",
    provenAxes: [],
    unprovenAxes: ALL_AXES.map((axis) => ({ axis, because: `gcc ${hit.gcc} is a different compiler from gcc ${query.gcc}` })),
    claim: `different GCC (${hit.gcc} vs ${query.gcc}) — take the source idiom and the mechanism; never claim the assembly aligns.`,
  };
}

function symmetricDifference(left: string[], right: string[]): string[] {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return [...new Set([...left.filter((f) => !rightSet.has(f)), ...right.filter((f) => !leftSet.has(f))])].sort();
}
