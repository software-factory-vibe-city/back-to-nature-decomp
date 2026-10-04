# Which function shapes consumed the matching sessions?

First-pass analysis of the two supplied **2026-10-03–04** sessions. This is a
retrospective, not a new matching experiment. No live source or tooling was changed.

## Finding

**The logs support “certain loop forms produce a long tail,” not “loops are
uniformly difficult.”** The strongest observed cluster is loops with additional
branching, narrowed/shifted counters, or nested induction and address formation.
Small acyclic decision trees are the other important cluster. The longest single
attempt, however, has **no loop**.

More precisely, the difficult cases are often functions whose straightforward C
gets the behavior approximately right but does not reproduce the compiler's
**choice of control-flow construction, value lifetime, or induction expression**.
That can present as an allocation or scheduling residual rather than a CFG error.
There are also lengthy declaration/context problems that have nothing to do with
control flow.

## Scope and measurement

- **269 started attempts on 269 distinct functions:** 99 in S1, 170 in S2.
  S2 also ends with a target dispatch that received no assistant response; it is
  retained in the census but excluded from the statistics.
- All started targets are overlay functions, **14–34 original instruction words**.
  This is a selected small-function workload, not a representative sample of the
  game. Half of it is `ovl_11` (134 functions).
- There are **266 observed byte-exact results**, of which **261 have an explicit
  passing `psx_finalize_function` result**. Three are flag-policy blocked and two
  encounter scope-gate failures. Three attempts end without a byte match.
- Total measured **work-window time: 692.04 minutes (11.53 hours)**. This excludes
  the overnight gap, post-match documentation turns, and inter-target handoff.
  It includes model response time, tool execution, and finalization.

Here, **work time** runs from target assignment to the first passing finalize
result, or to the last work record if there is no passing result. It is *observed
investment*, not an estimate of eventual completion time. Unmatched attempts stay
in the effort statistics; excluding them would remove the three largest cases.

A separate **first-exact time** records the first explicit byte-exact candidate
verdict, which can precede integration or policy acceptance. Successful-only
first-exact medians are reported below, not substituted for the full effort table.
See [methods.md](methods.md) for exact extraction rules and limitations.

## 1. Broad structural comparison

Shapes come from the **original target's control-flow graph**, not the agent's
prose, the number of times it called a loop diagnostic, or today's C source.
Times are minutes; P90 is the nearest-rank 90th percentile.

| Target shape | Attempts | Median work | Mean work | P90 work | Work >10 min | Total work | Median assistant messages |
|---|---:|---:|---:|---:|---:|---:|---:|
| Straight-line, including calls | 80 | 1.23 | 1.88 | 3.26 | 2/80 | 150.28 | 14 |
| Acyclic, with conditional branches | 145 | 1.42 | 2.44 | 4.21 | 3/145 | 353.80 | 15 |
| Contains a loop | 44 | 1.82 | 4.27 | 12.72 | 5/44 | 187.95 | 22.5 |

Loops are **16.4% of attempts**, but account for **27.2% of work time**, **31.7%
of native residual-objective calls**, and **five of the ten >10-minute attempts**.
The >10-minute rate is 11.4% for loops versus 2.2% for non-loops. This is a
within-sample association, not a causal estimate.

The ordinary case is much less dramatic than the tail. Among attempts with an
observed exact result, median first-exact times are **0.95 minutes straight-line,
1.12 acyclic, and 1.40 looped**. Two expensive unresolved loop attempts are absent
from that successful-only comparison.

The ten longest attempts consume **205.78 minutes, 29.7% of all work**. The three
without a match consume **103.47 minutes, 15.0%**, by themselves.

### The two sessions are not interchangeable

| Session | Straight-line median / P90 | Acyclic median / P90 | Loop median / P90 |
|---|---:|---:|---:|
| S1 | 1.20 / 3.17 (n=46) | 1.49 / 4.37 (n=38) | 1.50 / 2.62 (n=15) |
| S2 | 1.34 / 3.41 (n=34) | 1.41 / 3.51 (n=107) | 2.29 / 18.17 (n=29) |

**None of S1's 15 loops exceeds five minutes.** The expensive loop cluster comes
from S2. S2 also works on generally larger targets and contains all three nested
loop cases. Pooling the sessions without this distinction overstates how broadly
the loop effect has been reproduced.

A coarse size check preserves the direction in the later workload: at **24–28
words**, loop median work is 1.83 minutes versus 1.21 for acyclic targets; at
**29–34 words**, it is 2.94 versus 1.69. These are small, nonrandom strata, not a
size-adjusted model.

## 2. Split “loops” into useful types

The following mutually exclusive subdivisions are mechanically annotated. “Extra
branches” means conditional branches beyond loop latches; these can be inside the
body or in entry/exit handling.

| Loop subtype | Attempts | Median work | Total work | >10 min | No exact result |
|---|---:|---:|---:|---:|---:|
| Single-level, latch-only conditional control | 21 | 1.47 | 43.82 | 0 | 0 |
| Single-level, additional conditional control | 20 | 2.00 | 93.26 | 3 | 1 |
| Nested loops | 3 | 16.65 | 50.87 | 2 | 1 |

The nested-loop sample is **only three functions**: `ovl_17_func_800BA630`
(4.48 minutes), `ovl_21_func_800B9844` (16.65), and `ovl_15_func_80135AE0`
(29.74, unmatched). It is a strong investigation lead, not a reliable population
estimate.

Simple loops are an important counterexample. `ovl_11_func_800C11C4` and
`ovl_11_func_800BFCA4`, both 24 words, finalize in **1.15 and 1.18 minutes**.
The existence of a back edge alone is a poor predictor of a debugging marathon.

## 3. The longest cases, with outcomes kept distinct

`R` counts native `psx_residual_objective` requests, **not compiled variants**.
A single request can test many candidates; shell-driven and exhaustive searches
are additional work. `—` means no explicit byte-exact result was observed.

| Function | Shape / salient issue | Work min | First exact min | R | Outcome | JSONL work span |
|---|---|---:|---:|---:|---|---|
| `ovl_11_func_800BF450` | Acyclic flag test; dead-looking definitions and return-tail construction | 49.70 | — | 25 | Unmatched | S1:L5904–6688 |
| `ovl_15_func_80135AE0` | Nested XOR reduction plus a following reduction; preheader placement | 29.74 | — | 48 | Unmatched | S2:L11342–11874 |
| `ovl_17_func_800B90F8` | Conditional record initializer; shifted counter and multiple induction values | 24.02 | — | 38 | Unmatched | S2:L866–1205 |
| `ovl_17_func_800BAEF0` | Three-way threshold classification feeding a conditional call | 22.74 | 22.40 | 54 | Finalize passed | S2:L41–542 |
| `ovl_21_func_800BA7F0` | Guarded record scan; shifted count and strided address construction | 18.17 | 17.86 | 43 | Finalize passed | S2:L7464–7801 |
| `ovl_21_func_800B9844` | Nested guarded scan; countdown and preheader address formation | 16.65 | 16.21 | 9 | Finalize passed | S2:L12038–12138 |
| `ovl_28_func_800B8A20` | Conditional call in record loop; invariant-hoisting/source-form interaction | 12.72 | 12.41 | 3 | Finalize passed | S2:L12148–12246 |
| `ovl_11_func_800BFE3C` | Straight-line calls and far-global store; callee return declaration | 11.50 | 10.81 | 16 | Finalize passed | S2:L2849–3119 |
| `ovl_11_func_8011F574` | Straight-line call and stores; scheduling/flag dispute | 10.38 | 8.92 | 15 | Exact under unaccepted flag | S1:L2221–2459 |
| `ovl_17_func_800B9158` | Guarded indexed writer; address operand order/CSE | 10.15 | 9.28 | 6 | Exact under unaccepted flag | S2:L1206–1479 |
| `ovl_21_func_800B98CC` | Branch-selected value, store and return; scheduling/flag dispute | 8.72 | 7.86 | 16 | Exact under unaccepted flag | S1:L704–939 |
| `ovl_11_func_800CF314` | Straight-line field copy; global storage origin and broad searches | 8.59 | 8.17 | 3 | Finalize passed | S1:L4985–5086 |
| `ovl_17_func_800BA698` | Affine record initializer; explicit induction vs derived expression | 8.27 | 7.89 | 11 | Finalize passed | S2:L4776–4983 |
| `ovl_31_func_800B8348` | SDK result classification; shared return/assignment tails | 7.84 | 7.47 | 15 | Finalize passed | S2:L6402–6552 |

### A. Narrowed/shifted counters and strided scans

`800B90F8`, `800BA7F0`, and `800B9844` combine loop control with a count represented
through shifts and a `0x10000` increment. Their candidates need more than choosing
`for` versus `while`: pointer strides, captured-before-increment values, guard
placement and the provenance of the counter all affect the resulting program.

For `800BA7F0`, switching to an explicit byte-strided pointer and changing its
initial address expression removes the preheader residual; the final explicit
shift/add expression reaches EXACT at **S2:L7799**, after repeated identical
outputs at L7775, L7779 and L7783. `800B9844`'s inner countdown rewrite clears the
CFG/population mismatch (**L12079–12082**); separate address construction inside
the guarded region then yields the exact variant (**L12129–12138**).

These are **construction-recovery problems**, not just loop-bound recovery. The
successful shifted-accumulator spellings are witnessed ways to get the target
code; they do not prove the original author wrote literal fixed-point arithmetic.

### B. Induction and invariant placement, especially across nested loops

`80135AE0` reaches a one-placement residual but does not match. The historical
source-space search exhausts **5,250 candidates** at **S2:L11802**; finalization
still reports **33/34 and MISMATCH at L11840**. Its nested reduction and subsequent
reduction interact through counter reuse, address formation and preheader order.
Calling this merely a hard loop body misses where the remaining work is.

Two solved cases show the same general sensitivity with smaller programs:

- `800BA698`: replacing an explicitly advanced value with a body-local
  `v = 0x4D + i * 0x1A` in the `for` form matches (**S2:L4975–4983**).
- `800B8A20`: materializing `base` before the loop and using `iter = base + i`
  matches after pointer/indexed forms and loop-trace work (**S2:L12241–12246**).

The hypothesis worth testing is **difficulty reproducing the optimizer's input
representation**, not an inability to recognize repetition.

### C. Small decision trees with sensitive joins and shared tails

`800BAEF0`, the longest *successfully finalized* attempt, has only 24 words and
no loop. Many candidates have the desired comparisons but different lifetimes or
branch layout. A complete `if / else if / else` assignment tree matches;
preassigning `mode` and selectively overwriting it does not. The decisive batch
has K1 identical to the old nonmatch and K2/K3 EXACT (**S2:L533–540**).

`800B8348` recovers the SDK calls and broad result mapping early, but needs the
particular separate negative/positive assignment tails and join arrangement.
The explicit-label candidate wins at **S2:L6546**, then finalizes at L6552.

The acyclic subdivisions themselves are not wildly different: one-branch median
work is **1.28 minutes (n=70)** versus **1.50 (n=75)** for multiple branches.
**Specific join/assignment forms**, rather than branch count alone, explain the
notable cases.

### D. Atypical residuals and context errors masquerading as hard code generation

These must remain separate from the loop taxonomy:

- `800BF450`: the session focuses on dead-looking constant definitions and
  duplicated return paths, eventually requests a register-policy exception, and
  parks without a match (**S1:L6687**). The observed 49.70-minute cost is real;
  the agent's assertion that all ordinary C is impossible is **not established
  by finite searches** and is not adopted here.
- `800BFE3C`: extensive allocation investigation, including a bounded UNSAT,
  precedes the change of one callee declaration from `s32` to `void`. The nearly
  original body then matches (**S2:L3104–3107**). The measured fix is a declaration
  change; it is not proof of the callee's unique original signature.
- `800B98CC`, `8011F574`, `800B9158`: conditional flag-based byte matches encounter
  policy barriers. They are not three failures to find any matching bytes, nor
  three accepted decompilations. Their flag-necessity claims need separate review.

## 4. What the timings do—and do not—attribute

1. **Tool/search cost is part of the tail.** Two whole-tree searches in
   `800CF314` take 128.45 and 128.97 seconds (**S1:L5009, L5044**): roughly half its
   entire 8.59-minute window, despite only three native residual requests.
   `800B8A20` has another 126.89-second search (**S2:L12186**).
2. **Model latency varies.** `800B9844` has nine residual requests but a
   16.65-minute window, including several 60–105-second assistant-response gaps.
   It is not evidence of more failed compiler experiments than `800BA7F0`'s 43
   requests. Counts and elapsed time should be read together.
3. **Finalization is not free.** The 261 successful native finalize calls have
   median call-to-result latency **15.58 seconds**, about **67.15 minutes total**.
   This fixed-ish overhead particularly affects the short cases.
4. **Context repair precedes many loop experiments.** The separate
   [draft-failure investigation](../static-decompilation-session-2026-10-04.md)
   documents invalid field views, pointer-stride scaling and signature conflicts.
   Those minutes cannot all be attributed to control flow just because the target
   contains a loop.
5. **Diagnostic labels are symptoms, not ground truth about the root cause.**
   The threshold tree closes through a control-flow rewrite; the straight-line
   allocation case closes through a callee declaration. Counting “allocation” or
   “schedule” tool calls would misclassify both.

## Working taxonomy for the next analysis

The evidence supports prioritizing these **types**, without yet prescribing a
harness redesign:

1. **Nested/guarded strided scans with narrowed or shifted counters.**
2. **Loop initializers/reductions whose induction and invariant setup must land
   in a particular preheader order.**
3. **Small multi-arm classifiers with shared tails or sensitive assignment joins.**
4. **A separate context/atypical-code-generation bucket:** call signatures,
   storage origin, flag-policy disputes and unexplained dead-looking definitions.

Keep ordinary counted loops as the control group. The next useful question is
which *specific transition* consumed the time in each hard subtype—valid draft,
correct CFG/population, correct loop representation, or final code-generation
residual—not whether another general-purpose loop diagnostic was available.

## Evidence files

- [function-attempts.csv](function-attempts.csv): complete 270-dispatch census,
  with 269 started attempts, timing, outcomes, shapes, counts and JSONL references.
- [methods.md](methods.md): extraction rules, structural annotation and caveats.
- [common-failure-patterns.md](common-failure-patterns.md): why the long attempts
  stall, including a timed breakdown of the 49.70-minute loop-free case.
- [provenance.json](provenance.json): input hashes, structural-reader hashes,
  aggregate statistics and outcome totals.

`S1:Lnnn` / `S2:Lnnn` always means a **one-based line in the original JSONL**, not
a line in an extracted transcript. The session paths are in methods/provenance.
