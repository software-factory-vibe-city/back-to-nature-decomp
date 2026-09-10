# First pass, part 2: typing gaps, loops with effects, and the last-mile closers

**Status: proposed. Part 2 of 2 — do
`matching-reconstruction-call-results-and-best-effort.md` (part 1) first.
Part 1's element-precise refusal reporting is the scoreboard for everything
here, and its call-result support is a prerequisite for the loop work (most
loops that store also call). All numbers are from the 2026-09-10 census and
its probes.**

## Goal

Same as part 1: maximize the number of functions the engine byte-exact
matches with no agent interaction, and guarantee compiling best-effort C for
the rest. Part 1 removed the single biggest blocker (call results) and made
refusals name their real cause. Part 2 clears the remaining measured gaps, in
order of mass, then runs the existing near-miss closer plan over the enlarged
pool. The oracle stays the only judge.

## The remaining gaps, measured

After part 1's targets are removed, the refused population decomposes into:

| Gap | Functions | Mass |
|---|---|---|
| Register typed as pointer but also "used as a value" | 257 | 59 KB |
| Loops with stores or calls in the body; symbolic bounds | ~200 | 80 KB |
| Unrolled loops / structures over the size bound | 72 | 39 KB |
| Overlapping or mixed-width accesses to one cell | 57 | 39 KB |
| Missing accessors (absolute globals, stack locals) | ~80 | ~20 KB |
| Division-by-constant (`mulHi` magic numbers) | ~34 | 8 KB |
| Coprocessor/GTE + handwritten asm (reported separately, not plain C) | 137 | 77 KB |

## Deliverables

### T1 — Fix the pointer-and-value typing rule (1–2 days)

`deriveParamPlans` refuses any function whose argument register is both a
pointer base and a "value" (`effect-construct.ts:768`) — 257 functions, 59 KB.
Probing a sample (`func_8001F100`) shows the "value use" is the raw register
**passed as a call argument**: the function only ever dereferences `a0`, then
passes `a0` to a callee. Passing a pointer to a callee is a pointer use, not
arithmetic.

- In `argumentUses`, classify a raw use that appears **only as a call
  argument** as pointer-compatible (the callee parameter takes the pointer).
- For genuinely mixed uses (arithmetic on the register), fall back to part
  1's cast-form planner instead of refusing: type it one way and cast at the
  conflicting sites, as period code did.

**Done when:** the pointer-and-value refusal class is empty; sampled converts
compile; the census shows the 257 moving to attempted; no regression.

### T2 — Missing accessors and the divisor idiom (1–2 days)

Two small, mechanical gaps from part 1's probe table:

- **Absolute globals** (~70 fn): a predicate/argument/store references an
  absolute address the storage map built no accessor for (probe message
  "no accessor for #N+…"). Find why those cells are skipped (stores-only
  cells, or cells reached only from predicates) and build the accessor.
- **Stack locals** (~10 fn): `@sp`-based cells that are real locals (arrays,
  structs, address-taken temporaries), not frame saves. Give them declared
  local variables and accessors.
- **Division by a constant** (~34 fn): recognize the `mulHi` magic-number
  sequence as `x / K` / `x % K` (the probe's message names the need:
  "needs constant-divisor recognition"). GCC's constant is derivable from the
  emitted multiplier and shifts; emit the division and let the oracle judge.

**Done when:** all three probe buckets are empty as refusal causes; converts
attempted; no regression.

### T3 — Loops with effects in the body (the one real design job, 1–2 weeks)

The largest remaining structural class (~200 functions, 80 KB): loops that
store or call in the body, loops with symbolic bounds, and loop inductions
that do not start at a parameter value. Today only pure fixed-stride scans
fit. This needs a loop body treated the way part 1 treats straight-line code —
the body is a leaf-effect sequence (stores, calls, call results) plus an
induction step, and the constructor emits `for`/`while` forms with the body
emitted by the same statement machinery.

Scope it honestly, in three steps with a census checkpoint after each:

1. Counted loops (`for (i = 0; i < K; i++)`) with stores/calls in the body.
2. Symbolic bounds (bound loaded from memory or a parameter).
3. Inductions starting at non-parameter values (derived pointers,
   call results — depends on part 1's T2).

Unrolled-loop **re-rolling** (72 functions over the size bound whose spine is
a repeated body) belongs here too: detect the repetition, propose the rolled
loop, let the oracle decide — the compiler either unrolls it back identically
or the candidate fails honestly.

**Done when:** each step's census checkpoint shows its class moving from
refused to attempted, with matches confirmed by the oracle only; dev gate
grows by at least one matched loop function per step.

### T4 — Overlapping and mixed-width accesses (3–4 days)

57 functions (39 KB) refuse because two accesses to the same cell disagree on
width or overlap ("partially overlaps an earlier access", "two access widths
at offset…"). Period source does this with unions, byte-wise access to
halves/words, and struct copies. Extend the view builder to emit a union or
byte-array member when widths conflict, as a candidate axis — not a default —
and let the oracle pick.

**Done when:** the overlap refusal class shrinks measurably and at least a
few converts match; no regression.

### T5 — Run the near-miss closers over the enlarged pool

Execute the already-written closer plan,
`matching-reconstruction-close-near-misses.md` (pipeline-reversal +
scheduler-intervention wiring), **after** T1–T4, not before. Rationale: every
convert from parts 1–2 that misses by a schedule or an allocation lands in
exactly the near-miss pool that plan closes; today that pool is 231 functions,
and running the closers last multiplies their yield instead of spending them
on the smallest version of the pool.

**Done when:** that plan's own acceptance tests pass, measured against the
post-T4 census.

### T6 — Final measurement (half a day)

Full census against the 2026-09-10 baseline (84 matched / 231 near /
1,641 refused). Report: total matched, total attempted-with-best-effort,
remaining refusals by cause, and the not-plain-C class (coprocessor /
handwritten, reported separately). Function-by-function category movement.
`npm test` and `make check-all` green.

## Honest scope

- No promised match counts. Each deliverable's yield is measured at its
  census checkpoint; the attempt-to-match rate for each new class is an
  output of this plan, not an input.
- The coprocessor/GTE and handwritten-asm class (137 functions, 77 KB) stays
  out of scope for automated C reconstruction. If GTE-macro support is ever
  wanted, it is its own plan; these functions are reported in their own
  census class either way.
- Nothing here is game-specific: unions, loop re-rolling, divisor idioms, and
  pointer-argument typing are compiler/ABI facts, portable to any PSX binary.

## Files

- `tools/agent/matching-reconstruction/effect-construct.ts` — T1, T2.
- `tools/agent/matching-reconstruction/control-structure.ts` — T3 (loop
  emission), T4 (union axis).
- `tools/agent/matching-reconstruction/exec.ts` — T3 (loop-body execution,
  induction generality), T4 (overlap tolerance).
- `tools/diagnostics/benchmarkReconstruction.ts` — checkpoints, T6.
- `plans/matching-reconstruction-close-near-misses.md` — T5 (existing plan,
  executed as written).
