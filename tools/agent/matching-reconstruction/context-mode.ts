/**
 * Warm and cold context — what the reconstruction is allowed to know.
 *
 * Almost every number this project reports about automatic reconstruction is a
 * *warm* number: it was produced in a tree that already contains hundreds of
 * matched functions, their generated headers, their view types, and their C
 * available as donors. That is the right measurement for "how much work is
 * left here", and the wrong one for "how much can be recovered from a binary",
 * because the second question is the one a new project asks and the first
 * answer silently assumes the work is already done.
 *
 * Cold mode withholds exactly the recovered *game* material and nothing else:
 *
 *   - **matched definitions** stop being a signature tier, so a callee's arity
 *     comes from its own machine code or an SDK declaration, never from C
 *     somebody already wrote;
 *   - **the umbrella header** stops being a compile context, so a candidate
 *     must carry its own declarations;
 *   - **family donors** stop existing, so no transfer can borrow a sibling's
 *     source.
 *
 * What stays is the configured project and its toolchain: the compiler, the
 * flags, the SDK headers, the container images, the symbol tables. The plan is
 * explicit that this is not project bootstrapping — the question is what the
 * *reconstruction* can do without previously recovered C, not whether a tree
 * can be set up from nothing.
 *
 * The mode is process-scoped rather than threaded through every call because
 * it is a property of the run, not of any one query, and a parameter that
 * fifteen call sites have to forward is a parameter fourteen of them will
 * eventually forget.
 */

export type ContextMode =
  /** The tree as it is: recovered C, its headers and its donors all available. */
  | "warm"
  /** Recovered game C withheld; toolchain, SDK and target artifacts kept. */
  | "cold";

let current: ContextMode = "warm";

export function contextMode(): ContextMode {
  return current;
}

export function setContextMode(mode: ContextMode): void {
  current = mode;
}

/**
 * Run `body` under one mode and restore the previous one afterwards.
 *
 * Restoring in a `finally` matters: an evaluation that leaves the process in
 * cold mode after a throw would make every later measurement in the same run a
 * cold one while reporting it as warm.
 */
export function withContextMode<T>(mode: ContextMode, body: () => T): T {
  const previous = current;
  current = mode;
  try {
    return body();
  } finally {
    current = previous;
  }
}

/** True when recovered game C may be read. */
export function warmContextAllowed(): boolean {
  return current === "warm";
}

/** One line naming what the current mode withholds, for a report. */
export function describeContextMode(): string {
  return current === "warm"
    ? "warm: recovered C, generated headers and family donors are all available"
    : "cold: recovered game C withheld — matched-definition signatures, the umbrella header and family donors are all unavailable; the toolchain, the SDK headers and the target artifacts remain";
}
