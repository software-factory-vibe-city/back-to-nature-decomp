# First pass, part 1: honest refusals, call results as values, best-effort output

**Status: proposed. Every number in this plan is measured, not guessed. It
comes from the 2026-09-10 full census plus an element-level probe that re-ran
the control-flow constructor's emit loop for all 507 functions in its largest
refusal bucket with the error-swallowing removed. This plan is part 1 of 2;
`matching-reconstruction-structural-gaps-and-closers.md` is part 2 and depends
on this one.**

## Goal

The project goal these two plans serve: a first-pass census that byte-exact
decompiles as much of the binary as possible with **no agent interaction**,
and, for every function it cannot match, hands the agent starting C that is
better than m2c output. The oracle (`tools/lib/functionOracle.ts`
`compareFunction`) remains the only judge of a match, at every step.

## What the probe found

Census state today: of 1,957 unmatched functions, 84 match automatically,
231 build a compiling candidate that misses by a few words, and 1,641 are
refused outright. The refused functions hold **93% of the remaining byte mass**
(537 KB of 577 KB) — the engine currently only matches tiny functions (average
46 bytes matched vs. 328 bytes refused).

The largest single refusal message — "no parameter plan could express the
control-flow structure", 507 functions — turned out to be produced by **three
stacked error-swallowing sites**, and the message is wrong:

- `tools/agent/matching-reconstruction/control-structure.ts:660` —
  `catch { continue; }` around each candidate attempt.
- `control-structure.ts:1132` — `catch { return null; }` inside `emitDagBody`,
  which converts every real error into a silent "no body".
- `control-structure.ts:977` — `catch { return []; }` inside `assignStmts`,
  which silently **drops store statements from a candidate** instead of
  failing it. That is a correctness hazard, not just a diagnostic one: it can
  send a candidate to the compiler that is missing stores.

Probing each predicate, call argument, store, and return value individually
shows what actually fails, per function (count / mass):

| First failing element | Functions | Mass |
|---|---|---|
| `CR(n,reg)` — **a call's return value** — in a predicate | 256 | 57 KB |
| `CR(n,reg)` as a later call's argument | 105 | 28 KB |
| `CR(n,reg)` as the return value | 31 | 4 KB |
| `CR(n,reg)` as a stored value | 4 | 1 KB |
| No accessor for an absolute (global) address | ~70 | ~14 KB |
| `mulHi` division-by-constant not recognized | ~26 | ~7 KB |
| Stack-local (`@sp`) accessors, misc | ~15 | ~3 KB |

**396 of the 507 fail on one missing feature: using the return value of a
call.** That is `v = f(); if (v) ...` — the most common idiom in compiled C.
The same root cause appears one level earlier in the executor: 95 more
census refusals (40 KB) are loads/stores through a call result or loop bounds
that start at one ("has a computed address (CR(n,v0))"). Total blocked on call
results: **~491 functions, ~131 KB** — 30% of all refused functions.

The engine already knows how to consume a call result: the straight-line
constructor assigns it to a named temporary
(`tools/agent/matching-reconstruction/effect-construct.ts:1252`–`1270`,
`assign` to the `consumed` name). The capability was never carried into the
control-flow emitter or the executor's address model. That is the gap this
plan closes.

## Deliverables

Do them in order. Each has a measurable acceptance test.

### T0 — Element-precise refusals; stop swallowing errors (1 day)

1. Remove the three swallow sites. `assignStmts` must fail the candidate
   (throw) rather than drop statements. `emitDagBody` and the candidate loop
   must record the error message per failed axis combination.
2. The constructor's zero-candidate refusal must report the dominant recorded
   error (element kind + message), not "no parameter plan".
3. Apply the same treatment to the straight-line and guarded constructors —
   their zero-candidate messages (`effect-construct.ts:1319` and `:2017`) hide
   causes the same way. The 195 "relation's values" refusals (22 KB) get real
   causes in the same run.
4. Census reporting: bucket refusals by failing element (the table above must
   be reproducible from `benchmarkReconstruction.ts --census` output alone),
   and report the 137 coprocessor/handwritten functions (77 KB) as a separate
   "not plain C" class so coverage percentages are honest.

**Done when:** a fresh census reproduces the probe's numbers from its own
output, with no "no parameter plan could express" catch-all remaining, and no
candidate can silently lose a store. Dev gate stays green.

### T1 — Call results as values in the emitter (2–3 days)

In the control-flow emitter (and the guarded constructor if it shares the
path), when a leaf's later expressions reference `CR(n,reg)`
(`SymExpr` kind `"call-result"`):

- Emit the call as an assignment to a declared temporary
  (`temp = callee(...);`) instead of a bare expression statement, and register
  the temporary in the `temps` map keyed by the call-result expression, so
  `translate` resolves `CR(n)` to the temporary's name.
- Declarations are C89: temporaries declared at the top of the function body.
  Type the temporary from the callee's resolved return type
  (`resolveCallSignatures`, `effect-construct.ts:98`); a callee currently
  declared `void` whose result is consumed is a **signature-inference
  signal** (the callee's declaration is wrong or the callee is undecompiled),
  not an emission bug — route it through the existing inferred-signature
  machinery rather than forcing `s32`.
- The existing common-prefix effect factoring in `emitDagBody` already orders
  shared effects before a branch; calls referenced by a predicate ride that
  mechanism (call emitted in the shared prefix, predicate tests the
  temporary).

**Done when:** functions of the shape `v = f(); if (v) ...` produce compiling
candidates; the census's call-result-in-predicate/argument/return buckets
shrink to near zero as *refusals* (they become attempts — matched or
domain-exhausted as the oracle decides); no currently-matching function
regresses. Dev gate green; add 2–3 newly matching call-result functions to it.

### T2 — Call results as pointer bases in the executor (2–3 days)

The executor refuses any load/store whose address is based on a call result
("load at X has a computed address (CR(n,v0))" — 95 functions, 40 KB). Treat
`CR(n)` as an opaque pointer base, exactly like an argument register:

- Loads/stores at `CR(n) + offset` become atoms whose base is the call-result
  expression, grouped like `@a0` groups are today.
- The storage map builds a struct view over the group
  (the same machinery as argument-register views), and the C side declares
  `View *temp = callee(...);` with field accesses through it.
- Loop bounds starting at a call result remain refused for now — loops are
  part 2. The refusal must say so precisely.

**Done when:** dereference-a-returned-pointer functions produce compiling
candidates and the "computed address (CR…)" refusal class is empty except for
loop cases; no regression; dev gate green.

### T3 — Best-effort output for every function that builds a DAG (2 days)

This is the second project goal. The engine already persists every candidate
it tried under `build/matchingReconstruction/<function>/candidates/` and then
tells nobody. Make the best-effort result a first-class output:

1. For every domain-exhausted function, record in `result.json` the **best
   candidate** (ranked by the staged residual / diff distance, not raw byte
   score), with its diff summary attached.
2. Add a **fallback expression planner**: when no typed parameter plan exists,
   emit accesses in cast form (`*(s16 *)((u8 *)arg0 + 0x1C)`) so the function
   still produces candidates instead of refusing. Fallback candidates go
   through the oracle like any other — if one matches, it matches; measure,
   do not assume.
3. Add a small tool (e.g. `tools/agent/bestCandidate.ts`, new file) that <!-- doc-ref-ignore -->
   prints, for a
   function name: the best candidate C, its diff against the target, and the
   provenance note ("engine best-effort, N words off, cause bucket X"). Wire
   it into the decompile handoff so an agent starting a function sees the
   engine's best-effort C **before** m2c output (`tools/agent/m2cFunc.ts`
   remains available; the skill decides which to lead with).

**Done when:** every function that builds a DAG yields either a match or a
compiling best-effort C file with an attached diff; `bestCandidate.ts` serves
it; the psx-decompile-function skill's draft step references it. No effect on
matched output; dev gate green.

### T4 — Measure and freeze (half a day)

Re-run the full census. Report, against the 2026-09-10 baseline
(84 / 231 / 1,641): matches gained, refusals converted to attempts, best-effort
coverage (what fraction of unmatched functions now have a compiling
best-effort candidate). Compare function-by-function. Publish the real
numbers, good or bad. Finish with `npm test` and `make check-all`.

## Honest scope

- This plan does **not** promise a match count. The measured attempt-to-match
  rate today is 84 / 315 (27%) on small, call-free functions; whether it holds
  for call-bearing functions is exactly what T4 measures. What is certain from
  the probe: T1+T2 move ~491 functions from "refused, agent gets m2c" to
  "attempted, best-effort C guaranteed, match possible".
- Loops, unrolled loops, union/overlap accesses, the pointer-and-value typing
  rule, and the near-miss closers are **part 2**
  (`matching-reconstruction-structural-gaps-and-closers.md`).
- Nothing here is game-specific: call-result consumption, cast-form accessors,
  and refusal reporting are properties of the compiler and ABI, not of this
  binary.

## Files

- `tools/agent/matching-reconstruction/control-structure.ts` — T0, T1.
- `tools/agent/matching-reconstruction/effect-construct.ts` — T0, T1, T3
  (fallback planner).
- `tools/agent/matching-reconstruction/exec.ts` — T2.
- `tools/agent/matching-reconstruction/engine.ts` — T0 (refusal detail), T3
  (best-candidate recording).
- `tools/diagnostics/benchmarkReconstruction.ts` — T0 (cause buckets), T4.
- `tools/agent/bestCandidate.ts` — new file, T3. <!-- doc-ref-ignore -->
- `.pi/skills/psx-decompile-function/SKILL.md` — T3 (handoff reference).
