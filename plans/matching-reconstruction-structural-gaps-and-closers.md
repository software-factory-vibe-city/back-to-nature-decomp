# First pass, part 2: repair m2c's output, close the structural gaps, convert near-misses

**Status: proposed. Part 2 of 2. Part 1
(`matching-reconstruction-call-results-and-best-effort.md`) is landed and
committed: call results as values, the best-effort pipeline, and the perf and
measurement fixes found while evaluating it. All numbers below are from the
first complete census after part 1 (2026-09-10).**

## The architecture this plan serves

The handoff to the agent is **layered**, not a contest between m2c and this
engine:

1. **The engine byte-matches the function.** Ship it — no m2c, no agent. This
   is the 93 functions the engine matches today, and it grows as the
   structural constructors below land.
2. **The engine cannot match it.** The agent gets **m2c's draft, repaired by
   the engine's analysis** — its resolved call signatures, the struct/field
   types it recovered, and the byte oracle. m2c keeps its readable structure
   and names; the engine's analysis makes it compile and moves it toward the
   target. This is the supplement model — m2c first, then our tooling.
3. **m2c produces nothing usable even after repair.** The engine's from-scratch
   best-effort candidate is the fallback seed.

Part 1 built the pieces this depends on — signature resolution, recovered
types, the best-effort candidate, and a now-honest m2c baseline — but wired
them only into path 3 (from-scratch output). **The central new work in part 2
is path 2: the m2c-repair layer.** The structural constructors (former plan)
remain, because each one grows path 1 (more automatic matches) *and* deepens
the analysis that path 2 repairs m2c with.

## Where we are (first complete census after part 1)

| State | Functions | Mass |
|---|---|---|
| Automatic byte-match (path 1) | 93 | 4 KB |
| Best-effort draft compiles, no match (path 2/3 candidates) | 355 | 54 KB |
| Refused — no engine draft at all (m2c-only today) | 1,508 | 503 KB |
| Context-unresolved | 1 | <1 KB |

Goal-2 measurement, now that the m2c baseline is fixed: across the 329
functions with a best-effort draft, the engine's from-scratch draft is closer
to the target than raw m2c in 284 (86%), and **raw m2c fails to compile in 276
of 329 (84%)** — genuine defects (`?` unknown-type markers that do not parse,
`void*->field` derefs, undeclared globals). Those three defect classes are
exactly what path 2's repair layer fixes.

## Deliverable A — The m2c-repair layer (the supplement; primary goal-2 work)

The agent-assisted path already seeds the agent with m2c's output
(`getPrompt.ts` reads `src/*.c`). Today that seed is raw m2c, which does not
compile 84% of the time on the hard functions. Build a pass that takes m2c's
draft and repairs it with what the engine already knows:

- **Undeclared globals** — the engine's storage map identifies the absolute
  addresses m2c left undeclared; emit the `extern` declarations.
- **`?` unknown types and `void*` derefs** — replace with the engine's
  recovered struct/field views and resolved return types
  (`resolveSignature`, now cached).
- **Wrong or missing call signatures** — reconcile m2c's call sites with the
  engine's resolved/inferred signatures (arity, return type).

Then compile the repaired draft and byte-compare it with the oracle. The
repaired draft, not raw m2c, becomes the agent's seed whenever it compiles and
is not worse than the from-scratch best-effort.

**The right metric is repaired-m2c vs raw-m2c, not best-effort vs m2c.** The
bake-off number above measured which *seed* is better; this layer measures
whether the engine *improves* m2c's own draft. Report: how many of the 276
raw-m2c non-compiles now compile after repair, and how many move closer to the
target.

**Done when:** a `repairM2c` tool exists, the decompile skill seeds the agent
with the repaired draft (falling back to from-scratch best-effort, then raw
m2c); the repaired-vs-raw metric is in the census; a measurable majority of
the 276 non-compiles now compile. No regression.

## The structural gaps (grow path 1, and feed path 2's repair inputs)

Refused population after part 1 (1,508 functions / 503 KB), by cause:

| Gap | Functions | Mass |
|---|---|---|
| Register typed as pointer but also "used as a value" | 257 | 59 KB |
| Loops with stores/calls in the body; symbolic bounds; non-parameter induction | 213 | 88 KB |
| Computed-address / missing accessor (globals, stack locals, indexed) | 271 | 78 KB |
| Unrolled loops / structures over the size bound | 130 | 75 KB |
| Overlapping or mixed-width accesses to one cell | 76 | 45 KB |
| Call-result residual (part 1 cases not fully handled) | 165 | 32 KB |
| Division-by-constant (`mulHi` magic numbers) | 34 | 16 KB |
| Coprocessor/GTE + handwritten asm (not plain C, reported separately) | ~130 | ~90 KB |
| Straight-line "relation's values" residual (effect constructor) | 198 | (in above) |

### B — Pointer-and-value typing rule (1–2 days)

`deriveParamPlans` refuses any function whose argument register is both a
pointer base and a "value" (`effect-construct.ts:768`) — 257 functions, 59 KB.
A probed sample (`func_8001F100`) shows the "value use" is the raw register
**passed as a call argument**: the function only dereferences `a0`, then passes
`a0` to a callee — a pointer use, not arithmetic.

- In `argumentUses`, classify a raw use that appears **only as a call
  argument** as pointer-compatible.
- For genuinely mixed uses (arithmetic on the register), fall back to part 1's
  cast-form planner instead of refusing.

**Done when:** the pointer-and-value refusal class is empty; converts compile;
no regression.

### C — Missing accessors and the divisor idiom (1–2 days)

- **Absolute globals** and **stack locals** (part of the 271 computed-address /
  missing-accessor bucket): build accessors for cells the storage map skips
  (stores-only cells, predicate-only cells, real `@sp` locals).
- **Division by a constant** (34 fn): recognize the `mulHi` magic-number
  sequence as `x / K` / `x % K`; the constant is derivable from the emitted
  multiplier and shifts. Emit it and let the oracle judge.

These also directly enrich path 2's repair: the same recovered accessors and
divisor rewrites are what fix m2c's `void*` and its opaque shift/multiply
sequences.

**Done when:** those refusal causes empty; converts attempted; no regression.

### D — Loops with effects in the body (the one real design job, 1–2 weeks)

The largest structural class (213 loop functions / 88 KB, plus the 130
unrolled/over-size). Today only pure fixed-stride scans fit. Treat a loop body
the way part 1 treats straight-line code — a leaf-effect sequence (stores,
calls, call results) plus an induction step — and emit `for`/`while` with the
body built by the same statement machinery. Three steps, census checkpoint
after each:

1. Counted loops (`for (i = 0; i < K; i++)`) with stores/calls in the body.
2. Symbolic bounds (bound loaded from memory or a parameter).
3. Inductions starting at non-parameter values (derived pointers, call
   results — uses part 1's call-result base support).

Unrolled-loop **re-rolling** (the 130 over-size spines) belongs here: detect
the repeated body, propose the rolled loop, let the oracle decide.

**Done when:** each step's checkpoint shows its class moving refused →
attempted, matches confirmed by the oracle only; dev gate grows by at least one
matched loop function per step.

### E — Overlapping and mixed-width accesses (3–4 days)

76 functions (45 KB) refuse because two accesses to one cell disagree on width
or overlap. Period source expresses this with unions and byte-wise access.
Extend the view builder to emit a union or byte-array member as a candidate
axis — not a default — and let the oracle pick.

**Done when:** the overlap refusal class shrinks measurably; a few converts
match; no regression.

## Deliverable F — Run the near-miss closers over the enlarged pool

Execute the already-written closer plan,
`matching-reconstruction-close-near-misses.md` (pipeline-reversal +
scheduler-intervention wiring), **after** B–E, not before. Every convert from
parts 1–2 that misses only by a schedule or an allocation lands in exactly the
near-miss pool that plan closes. Running the closers last multiplies their
yield instead of spending them on today's small pool.

**Done when:** that plan's acceptance tests pass, measured against the post-E
census.

## Deliverable G — Final measurement (half a day)

Full census against the post-part-1 baseline (93 matched / 355 best-effort /
1,508 refused). Report, on **both** goals:

- **Path 1 (automatic):** total matched, function-by-function movement.
- **Path 2 (supplement):** how many refused/best-effort functions now get a
  repaired-m2c seed that compiles and beats raw m2c, and by how much.
- Remaining refusals by cause; the not-plain-C class reported separately.

`npm test` and `make check-all` green.

## Honest scope

- No promised match counts. Each deliverable's yield is measured at its census
  checkpoint.
- The coprocessor/GTE and handwritten-asm class (~130 functions, ~90 KB) stays
  out of scope for automated C reconstruction *and* for repair — m2c cannot
  produce plain C for it either. Reported in its own census class.
- The repair layer does not discard the from-scratch engine: where the engine
  matches, path 1 wins outright; the repair layer only governs the seed for
  functions the engine cannot match.
- Nothing here is game-specific: signature-driven repair, unions, loop
  re-rolling, divisor idioms, and pointer-argument typing are compiler/ABI
  facts, portable to any PSX binary.

## Files

- `tools/agent/repairM2c.ts` — new, Deliverable A (m2c-repair layer). <!-- doc-ref-ignore -->
- `.pi/skills/psx-decompile-function/SKILL.md` — A (seed = repaired m2c, then
  best-effort, then raw m2c).
- `tools/agent/matching-reconstruction/effect-construct.ts` — B, C.
- `tools/agent/matching-reconstruction/control-structure.ts` — D (loop
  emission), E (union axis).
- `tools/agent/matching-reconstruction/exec.ts` — D (loop-body execution,
  induction generality), E (overlap tolerance).
- `tools/diagnostics/benchmarkReconstruction.ts` — checkpoints, G, and the
  repaired-vs-raw m2c metric.
- `plans/matching-reconstruction-close-near-misses.md` — F (existing plan,
  executed as written).
