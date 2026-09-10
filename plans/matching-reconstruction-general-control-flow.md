# Matching reconstruction — general control-flow constructor (branchy read-only functions)

**Status: proposed. This is the project's largest single lever, not another
narrow axis. The census (build/matchingReconstruction/census.json, sweep of
2026-09-10) shows 907 undecompiled functions — 46% of everything unmatched —
blocked on one missing capability: a constructor that can express general
nested control flow. Everything prior (model completion D1–D7, call signatures,
inferred signatures) widened what a *single relation* can say; this plan widens
what *shapes of control flow* the engine can emit as byte-exact C. Read
`plans/matching-reconstruction-model-completion.md` (ground rules + protocol),
then `tools/agent/matching-reconstruction/effect-construct.ts`
(`constructGuardedCandidates`, the constructor this generalizes) before
starting.**

## The problem, grounded

The engine already recovers the decision DAG for these functions — bounded
symbolic execution produces a hash-consed graph of `test` / `dispatch` / `leaf`
nodes (`types.ts` `DagNode`). What fails is the *constructor*: turning that DAG
back into the original C. `constructGuardedCandidates` is deliberately narrow —
it caps the structure at `tests + dispatches ≤ 32, leaves ≤ 16, targets ≤ 64`
and handles a shallow decision tree with early returns. The 907 functions blow
past it in three verbatim ways (from the census `detail`):

1. **`no parameter plan could express the guarded structure`** — the branch
   leaves carry return expressions richer than the current per-function
   `deriveParamPlans` grammar can type.
2. **`structure too large for the guarded class (N tests, …)`** — genuine
   nested decision logic beyond the bounds (and, in the pathological tail, a
   symbolic-bound loop that unrolled itself into hundreds of tests — those are
   *not* decision trees and must be sent elsewhere, not force-fit).
3. **`some paths return a value and some leave it unset`** — the function
   returns a value on some paths and falls through on others; the constructor
   has no way to spell "this path leaves `$v0` as-is."

These 907 are **read-only and call-free** (that is the census bucket): no
stores, no calls. So every leaf is either `return <expr>;` or a fall-through,
and there are **no cross-path side-effect ordering constraints** — the single
biggest simplification available. This is the cleanest possible first target
for a general control-flow constructor: pure predicate / selection functions
that return a computed value from nested comparisons of parameters and loaded
fields. Build the general constructor here, where leaves are pure, before ever
taking on branches that store or call.

## Why this is the lever

`679 / 2559` decompiled today (27%). Harvesting current matches plus the
inferred/void-callee levers reaches ~33%. This constructor, at a plausible
yield, converts most of the 907 — pushing the project past ~55% in one
capability. The follow-on work (loops, computed addressing, calls-in-branches)
stacks on top of it. Nothing else left is close to this size.

## Ground rules

Follow the ground rules and per-deliverable protocol in
`plans/matching-reconstruction-model-completion.md` verbatim. Load-bearing here:

- **The byte oracle (`compareFunction`) is the only judge.** Structured C is a
  hypothesis; every candidate compiles and passes the oracle. Different valid
  structurings of the same DAG are enumerated as candidates — the oracle picks
  the one whose bytes match. Never mark a match from anything else.
- **Unsupported beats guessing.** A DAG shape the structuring algorithm cannot
  provably render (irreducible control flow, a genuine join it cannot express)
  is an honest `unsupported-target` with a specific reason — not a
  best-effort guess. Enumerating known-equivalent *source forms* of a shape you
  *can* render is not guessing; emitting one unverified structure for a shape
  you cannot is.
- **Determinism.** Candidate enumeration order is fixed; same DAG → same winner.
- **Keep the gates green** after each deliverable: the reconstruction unit suite
  and `benchmarkReconstruction.ts --set development` (exit 0). Never regress an
  existing exact-candidate.
- **Do not weaken the existing constructors.** The new general constructor runs
  *alongside* `constructGuardedCandidates`; a function the guarded constructor
  already matches must keep matching (byte-identically). Prefer adding the
  general path and letting the engine try both, over rewriting the guarded one.

## Known traps

- **A shared successor is a join, and a join is not a tree.** When two branches
  reach the same DAG node, naive tree emission would duplicate its subtree.
  For pure read-only leaves that duplication is *semantically* fine (no side
  effects) but may not be *byte*-identical — the compiler may have emitted a
  shared tail. Enumerate both: tail-duplicate, and (where the join is a clean
  post-dominator) a single shared block reached by both arms. Let the oracle
  decide which the original used.
- **"Large" is two different things.** A wide-but-shallow decision tree is in
  class; hundreds of `test` nodes in a *chain* is almost always a symbolic-bound
  loop that unrolled. Detect the latter (long spine of tests with affine-varying
  live state — the D7 machinery already recognizes this) and refuse it *to the
  loop track*, do not raise the tree bound to swallow it.
- **Mixed return/void is real, not an error.** A path that leaves `$v0` unset is
  the original returning "whatever is there." Model it: the function's return
  type stays `s32`, and the fall-through path emits no `return` (control reaches
  the closing brace). Do not force every path to return, and do not refuse the
  function for it — that refusal (trap #3 above) is exactly what this removes.
- **Condition polarity and early-return vs else are byte-visible.**
  `if (c) return a; return b;` and `if (!c) return b; return a;` and
  `return c ? a : b;` can each be what the target compiler emitted for the same
  DAG. These are source-form axes to enumerate, not free choices — the oracle
  disambiguates. (The *set* of forms is general C; which one matches is a
  per-toolchain fact the oracle decides, so nothing here is specific to one
  compiler or game.)
- **Do not invent a new expression translator.** Leaf return values already go
  through the same `translate` / `deriveParamPlans` / storage-map machinery as
  the effects constructor. The gap is that it is applied once per function;
  here it must apply *per leaf*. Extend, do not fork.

## Deliverables

Do them in order; do not start one until the previous one's acceptance passes.

### T0 — Sub-census of the 907 (the build spec)

Before building, measure exactly what shapes the constructor must cover. Write
a one-off analysis over the 907 (decode each, build the DAG via the existing
executor, tally):

1. **test count, dispatch count, leaf count** distributions.
2. how many are **shallow trees** (every leaf reached by one path) vs **have
   joins** (a node with in-degree > 1).
3. how many hit **mixed return/void** (some leaf sets `$v0`, some does not).
4. how many of the "large" ones are **unrolled loops** (long test spine with
   affine live-state deltas — reuse D7's `detectAffine`) vs **genuine wide
   trees**.
5. **leaf expression complexity** — max operator depth, whether leaves are bare
   params/consts or computed expressions.

**Accept:** a written breakdown (counts per axis) and a probe set of **6–8
functions** spanning the shapes: a shallow tree, a tree with a join, a
mixed-return/void one, a wide tree, and a couple of medium ones. Record each
probe's DAG stats. This breakdown is the acceptance yardstick for T4/T5 — state
up front which shapes are in scope for v1 and which are deferred.

### T1 — DAG → structured C (the core, shape only)

**Files:** a new `control-structure.ts` beside `effect-construct.ts`.

Turn a reducible `test`/`dispatch`/`leaf` DAG into a structured statement tree
(`CStmt[]` from `construct.ts`), leaves as `return <placeholder>` for now
(expressions come in T2). The DAG from bounded symex over a read-only,
call-free function is reducible; structure it directly:

1. A `test` node → `if (pred) { <onTrue> } else { <onFalse> }`, recursively.
2. A `dispatch` node → `switch`, recursively (reuse the existing dispatch/jump
   -table handling as the model).
3. A `leaf` → a return placeholder (or fall-through for the unset-`$v0` case).
4. **Joins:** detect in-degree > 1. Emit two structurings per join — one
   tail-duplicating the shared subtree, one hoisting it to a shared block after
   the branch (only when the join post-dominates the branch). Cap the number of
   joins handled per function; over the cap → `unsupported-target` with the
   count, not a silent truncation.
5. **Irreducible / unstructurable** control (a join that is not a clean
   post-dominator, a back-edge that is not a recognized loop) → honest
   `unsupported-target`.

**Accept:** unit tests in `control-structure.test.ts` that build DAGs by hand
(shallow tree, tree with a post-dominating join, a switch) and assert the
emitted `CStmt` tree shape(s). No compilation yet.

### T2 — Per-leaf expressions and mixed return/void

**Files:** `control-structure.ts`, reusing `effect-construct.ts` translation.

1. Each leaf's `value` (a `SymExpr`) becomes its return expression through the
   **existing** `translate` + storage-map + `deriveParamPlans` path — but keyed
   per leaf, not once per function. Collect the union of all leaves' atoms for
   one storage map / parameter plan across the function (parameters are shared),
   then render each leaf's expression against it.
2. **Mixed return/void:** a leaf whose `value` canonicalizes to `@v0` (entry
   `$v0`, i.e. unset) emits **no** return statement — control falls through.
   The function signature stays `s32`. Verify this is what "some paths return a
   value and some leave it unset" means on the probe set from T0.
3. Feed the result into the same candidate-emission path the effects/guarded
   constructors use (standalone + umbrella contexts, tentative defs, extern
   decls). No calls here, so no callee declarations.

**Accept:** every T0 probe now **constructs** a compiling, correctly-typed
candidate (state `domain-exhausted` or `exact-candidate`, never "no parameter
plan" / "structure too large"). At least the shallow-tree and mixed-return
probes reach **`exact-candidate`** (oracle `match`). Dev gate green.

### T3 — Size bounds and the unrolled-loop split

1. Replace the `constructGuardedCandidates` hard bounds for the general path
   with a **cost bound** on emitted statements (not a raw test count), so wide
   shallow trees are in class while unbounded unrolling is not.
2. Route a detected unrolled-loop spine (T0 criterion 4) to the loop track /
   honest refusal — never render it as a giant `if` chain.

**Accept:** the census "structure too large" cases split cleanly into
constructed (genuine wide trees) and honestly-refused (unrolled loops); no
function is force-fit. Dev gate green.

### T4 — Source-form axes

Add the byte-visible source-form choices as enumerated axes (like the existing
`exitStyle` / `pairStyle` axes), bounded and deterministic:

- **early-return vs else-branch:** `if (c) return a; return b;` vs
  `if (c) return a; else return b;` vs (single-expression leaves)
  `return c ? a : b;`
- **condition polarity:** `c` vs `!c` with arms swapped; `x == 0` vs `!x`.
- **join rendering:** tail-duplicated vs shared block (from T1).

**Accept:** the probe functions that were `domain-exhausted` after T2 now reach
`exact-candidate` where a source form matches. Report the per-function candidate
count (enumeration cost) — median and tail. Bound the product; `budget-exhausted`
honestly if a function's axes blow past the cap.

### T5 — Integrate, measure, freeze

1. Wire the general constructor into `engine.ts` alongside the existing ones,
   and update `censusCategory` so its outcomes are no longer bucketed as
   "read-only, call-free, but not a fixed-stride scan."
2. Update the supported-classes sentence in the `psx_reconstruct_function`
   entry of the Pi tool registration (`diagnostics.ts` under
   `.pi/extensions/psx-decomp/tools/`) and in
   `notes/tools-directory-structure.md`.
3. Run `--census`; report how many of the 907 became `exact-candidate` vs
   `domain-exhausted` vs still refused, with the transition matrix against the
   pre-change census (the method used in this review: per-function
   baseline→new). Publish the number honestly.
4. Add 2–3 newly byte-exact functions (spanning shapes) to `DEVELOPMENT_SET`,
   `--freeze-manifest`, re-run the gate.
5. Finish with `npm test` and `make check-all`.

**Accept:** a measurable, oracle-verified reduction of the 907 bucket; dev gate
green; `make check-all` byte-identical; no exact-candidate regression.

## Non-goals (do not attempt in v1)

- **Branches that store or call.** v1 is read-only, call-free only. Once the
  structuring core is proven on pure leaves, a later plan adds store/call
  effects inside arms (with the cross-path ordering discipline the effects
  constructor already has). Keep them out now — they reintroduce exactly the
  ordering complexity this bucket lets us avoid.
- **Loops.** Affine loops are D7; symbolic-bound/sentinel loops are their own
  plan. T3 only *classifies* an unrolled spine as not-a-tree; it does not
  construct it.
- **Computed addressing** (the separate 157-function bucket) — untouched.
- **Turning every one of the 907 into a byte-exact match.** Modelling the
  control flow (a bounded, oracle-checked set of structurings, correctly typed)
  is the job. A `domain-exhausted` outcome — right structure, no source form
  matching yet — is a success and a handoff to axis refinement.

## Reuse map

| Existing component | Role here |
|---|---|
| `exec.ts` executor + `DagArena` | Produces the `test`/`dispatch`/`leaf` DAG already; unchanged. |
| `types.ts` `DagNode` | The input the structuring algorithm consumes. |
| `effect-construct.ts` `constructGuardedCandidates` | The narrow predecessor; the general constructor generalizes its DAG walk and runs alongside it. |
| `effect-construct.ts` `translate` / `deriveParamPlans` / storage map | Per-leaf expression typing (T2) — extend to per-leaf, do not fork. |
| `construct.ts` `CStmt` / `CExpr` / `renderStmts` | The structured-C AST and renderer the constructor emits. |
| D7 `detectAffine` (`exec.ts`) | Distinguish an unrolled-loop spine from a genuine wide tree (T0/T3). |
| `benchmarkReconstruction.ts` `censusCategory` | Re-bucket the constructed outcomes (T5). |
