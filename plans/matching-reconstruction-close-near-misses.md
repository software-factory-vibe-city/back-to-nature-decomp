# Close the near-misses: connect the reconstruction engine to the pipeline tools

**Status: proposed. This plan is built on measurement, not a guess. Every number
below comes from a full census of the current code (2026-09-10) plus a
per-function distance analysis of the 231 functions the engine gets closest on.
The two previous plans (general control-flow, sequential guards) produced zero
byte matches because they chased structural coverage of a bucket that turned out
to be mislabeled. This plan targets the opposite: the functions the engine
already understands and nearly reproduces.**

## What the data actually says

Full census of the 1,957 unmatched functions, current code:

- **84 match** (the engine reproduces them byte-for-byte on its own).
- **231 are near-misses** — the engine builds a real candidate, it compiles, but
  the bytes do not quite match. *These are the prize.* The engine already
  recovered what the function does; it is only failing to reproduce the exact
  machine code.
- **1,641 are refused** — the engine cannot build a candidate at all (structural
  gaps: branches mixed with calls and stores, computed addressing, loops). That
  is separate, larger work. This plan does **not** touch it.

Breaking down the 231 near-misses:

- **202 produce a candidate that compiles**; **29 fail to compile** (the
  candidate calls a helper with the wrong number of arguments — a fixable
  declaration bug, see T1).
- Of the 202 that compile, ranked by how many machine words differ from the
  target: **60 are within 4 words**, 63 are 5–12 off, 79 are further.

The 60 closest are almost all the *same kind* of failure — **right
instructions, wrong last-mile codegen**, not wrong logic. Three real examples:

- `ovl_11_func_800E54F8`: identical instructions to the target, except one
  (`addiu a3,a1,-351`) is emitted one slot later. Pure **instruction
  scheduling** — GCC ordered the instructions differently than our source made
  it order them.
- `ovl_15_func_801300E4`: the function is `*p = -1; return -1;`. The target
  computes `-1` once and reuses the register for both the store and the return;
  our candidate emits `li -1` twice. **Register/value reuse.**
- `func_8001F35C`: three field additions; right instructions, different order
  and a different delay-slot fill. **Scheduling + delay slot.**

## The one-sentence problem

The engine's weakness is not understanding functions — it is reproducing GCC's
exact instruction *order*, *register choices*, and *delay-slot fills*. It emits
one source form, compiles it, and if GCC schedules or allocates differently than
that source implies, it misses by one or two instructions and throws the whole
thing away.

## The leverage nobody is using

The repository already contains mature tooling that models exactly these
last-mile decisions, and the reconstruction engine imports **none** of it:

- `tools/agent/pipeline-reversal/` — reverses GCC's register allocation,
  instruction scheduling, and delay-slot resolution from the target bytes, back
  toward the pre-scheduling instruction sequence.
- `tools/agent/scheduler-constraint/` — derives and solves the constraints
  GCC's scheduler was operating under.
- `tools/agent/target-schedule/` — models the scheduler and allocator, including
  an `intervention-search` that looks for source changes that steer GCC's
  output.
- `tools/agent/allocator-counterfactual/` — models GCC's register-allocation
  order.

The diff tool's own advice, printed on every count-mismatch, is literally "run
psx_reverse_pipeline." The engine never does. That is the gap this plan closes.

## The thesis

Stop generating one source form and hoping GCC schedules it the way the original
was scheduled. Instead: when a candidate is close, use the pipeline tools to
(a) confirm the difference is only scheduling/allocation — meaning the *source is
already correct* — and (b) find the source form that makes GCC reproduce the
target's exact order and register choices. Both capabilities already exist; they
just need to be wired into the engine's evaluation loop.

## Deliverables

Do them in order. Each has a measurable acceptance test.

### T0 — Stand up the near-miss report (half a day)

Turn the one-off analysis behind this plan into a repeatable report: for every
domain-exhausted function, record its best candidate's matched-words,
differing-words, and target-vs-candidate instruction-count delta, and bucket it
by cause: **compile-error (arity)**, **scheduling** (same instruction multiset,
different order), **allocation/reuse** (off by a redundant or missing
register-materialization), **wrong-form** (a genuinely different instruction),
**far**. Save it as JSON next to the census.

**Done when:** the report reproduces the 231 / 202 / 60 figures and assigns each
near-miss a cause bucket. This is the scoreboard for T1–T4 — every later step is
judged by how many functions move out of its bucket into "matched."

### T1 — Fix the arity compile errors (1 day)

29 near-misses never compile because the candidate calls a helper with the wrong
number of arguments — e.g. `func_800171CC` emits `func_80017300(arg0, 0, 0, 0)`
and GCC rejects it with "too few arguments," because the helper's real prototype
in the generated header declares a different arity. The candidate's call is not
being reconciled with the callee's declared signature.

Find why (the call's argument count is taken from the recovered model, not from
the callee's known prototype when one exists) and make the candidate respect the
declared arity of a decompiled callee.

**Done when:** the 29 compile-error near-misses all compile; some become matches;
none regress. Dev gate green.

### T2 — Wire pipeline-reversal into the evaluation loop for scheduling misses (3–4 days)

When a candidate compiles but does not match, and its instruction *multiset* is
equal to the target's (same instructions, different order — the `800E54F8`
case), run `pipeline-reversal` on both. If they agree once scheduling and
delay-slot placement are reversed, the source is proven correct and only the
schedule differs. Feed that into `target-schedule`/`scheduler-constraint`'s
`intervention-search` to find the source-level change (statement order,
temporary use) that makes GCC emit the target's order, and re-run the oracle.

Keep it bounded and honest: a fixed search budget per function; if no source
form reproduces the schedule, leave the function as domain-exhausted with a
note, do not loop forever. The byte oracle remains the only judge — the pipeline
tools propose, the oracle confirms.

**Done when:** a measurable number of the scheduling-bucket near-misses become
matches (start with `ovl_11_func_800E54F8` and `func_8001F35C`), and the report
shows the scheduling bucket shrinking. No regression.

### T3 — Register/value reuse source form (2 days)

For the allocation/reuse bucket (the `li -1` twice case), add a source-form axis
that reuses a value across a store and a return (or two uses) instead of
re-materializing it, and let the oracle pick. Use `allocator-counterfactual` to
confirm when a one-instruction delta is a register-allocation artifact rather
than a real difference, so the engine knows this axis is worth trying.

**Done when:** `ovl_15_func_801300E4` and similar reuse near-misses match; the
allocation bucket in the report shrinks. No regression.

### T4 — Measure and freeze (half a day)

Re-run the census. Report, against the pre-plan census, how many of the 231
near-misses became matches, bucketed by which deliverable closed them. Add 3–4
newly-matching functions (one per cause bucket) to the development gate and
re-freeze. Finish with `npm test` and `make check-all`.

**Done when:** the matched count rises by a real, oracle-verified amount; dev
gate green; `make check-all` byte-identical.

## Honest scope and expectations

- **This targets the 231 near-misses**, a bounded, verified population where the
  engine is already 1–12 instructions from a match. The 60 closest are the
  primary target; the 63 mid ones are secondary.
- **The realistic yield is not known until the tools are connected.** Scheduling
  is genuinely hard, and some near-misses will not have a source form that
  reproduces GCC's exact order. The bet is de-risked only in that the hard
  modeling (reversing and constraining the scheduler and allocator) is *already
  built* — this plan connects it, it does not invent it. Do not promise a
  number; publish the measured one.
- **It does not address the 1,641 refused functions.** Those need the structural
  constructor work (branches with calls and stores) and are a separate plan.
  Attempting them here would repeat the last two plans' mistake of chasing the
  wrong population.

## Why this is different from the last two plans

The general-control-flow and sequential-guard plans chased structural coverage
of a bucket the census *labeled* "read-only, call-free" that was, on inspection,
93% call-bearing and full of unrolled loops — so they produced zero matches. This
plan starts from the functions the engine measurably almost solves, and spends
its effort on the last mile using tools the project already owns. It is the
difference between guessing where the leverage is and measuring it.

## Reuse map

| Existing component | Role here |
|---|---|
| `tools/agent/pipeline-reversal/` | Reverse the target's scheduling/allocation/delay-slot to prove a candidate's source is right modulo codegen (T2). |
| `tools/agent/scheduler-constraint/`, `tools/agent/target-schedule/` (`intervention-search`) | Find the source form that makes GCC reproduce the target's instruction order (T2). |
| `tools/agent/allocator-counterfactual/` | Confirm a one-instruction delta is an allocation artifact (T3). |
| `tools/lib/functionOracle.ts` `compareFunction` | Still the only judge — every proposed form is confirmed by a byte match. |
| `tools/agent/diffFunc.ts` | Already computes the per-candidate distance the T0 report needs. |
| `tools/diagnostics/benchmarkReconstruction.ts` | Census + the T0/T4 measurement. |
