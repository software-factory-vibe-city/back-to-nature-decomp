# Static-first reconstruction: implementation review and recalibration

> **Followed up:** every counterexample in §4 and §5 is fixed and held by a
> regression fixture, the two unexplained findings in §5 have a proven cause,
> and the feedback mechanism of §6.5 is wired and demonstrated. See
> [the response](static-first-review-response.md), which also records what
> remains — items 6, 7 and 8, and a census that needs re-running because these
> fixes change what the engine produces.
>
> **Subsequent independent check:** [the second review](static-first-second-review.md)
> qualifies those closure claims and replaces the long-worker census comparison
> with parser-contained measurements. Some safety and integration gaps remain.

Review of the uncommitted implementation against
[the static-first plan](../../plans/static-first-matching-decompilation.md),
using commit `45a023a` as the baseline. The implementation patch, population,
runner, observations, candidates, and verification logs are preserved under
`build/static-first-review/`.

**Verdict: useful, measurable progress, but a partial implementation—not completion
of the plan.** The strongest delivered improvements are broader construction,
more compiling drafts, and replay of existing source donors. The central
CFG/SSA-to-C, executable repair, and learned-context feedback mechanisms are not
connected end to end. Source acceptance also needs correction.

No production C, headers, or implementation fixes were made during this review.
Integration experiments used a disposable copy. Live project progress is unchanged.

## 1. Controlled comparison

Both engines ran against the same frozen **1,852 remaining stubs / 570,308 target
bytes**, with effective production flags, at most **64 candidate attempts per
function**, and a **60-second worker timeout**. The baseline was isolated from
`git archive HEAD`; the new engine used the reviewed working tree.

These spans include excluded/dead code. Only **1,789 / 554,252 bytes** count toward
live progress. This cohort is the remaining backlog, not a representative sample
of every function in an untouched game.

| Outcome | Baseline engine | Implemented warm engine |
|---|---:|---:|
| Byte-exact candidates | 6 / 476 bytes | 47 / 3,400 bytes |
| Nonexact compiling drafts | 250 / 36,556 bytes | 556 / 92,380 bytes |
| Functions with comparable compiled output | 257 | 603 |
| `unsupported-target` outcomes | 1,587 | 1,181 |

The family-transfer sweep independently matched **12 targets / 780 bytes** across
all eight currently donor-backed families. These targets are disjoint from the
47 engine winners, giving **59 / 4,180 bytes** combined.

Accounting matters:

- **54 newly solved functions / 3,796 bytes**, but **one baseline winner / 92 bytes
  was lost**. Arithmetic improvement is **+53 candidates / +3,704 bytes**.
- Live-eligible combined winners: **54 / 3,844 bytes**, versus baseline
  **5 / 416 bytes**. Arithmetic improvement is **+49 / +3,428 bytes**.
- The saved `comparison.json` field `netNewVsOld` names the newly added set; it
  does **not** subtract the lost baseline winner.
- The one old comparable result without a preserved draft explains why its
  comparable count is not simply exact plus draft counts.

This is nearly ten times the old raw exact count, but from a very small baseline:
**3.19% of remaining stubs and 0.73% of their bytes**, before source/integration
rejections. The winners are strongly biased toward small functions.

The warm census had two actual candidate-budget stops and one review timeout,
`ovl_11_func_800F1078`. It is not an exhaustive impossibility proof.

### Cold-context and held-out checks

The current engine, with recovered game context withheld inside the configured
project, found **48 exact candidates / 3,484 bytes** on the same remaining-stub
cohort. Its exact set contains all 47 warm winners plus
`ovl_11_func_800F71DC` (84 bytes). It produced 556 nonexact drafts. This supports
real context-independent construction improvements; it is not just donor reuse.
It is not a new-project/bootstrap experiment.

On the existing **99-function held-out manifest**:

| Mode | Exact functions / bytes | Nonexact compiling drafts |
|---|---:|---:|
| Old warm | 26 / 496 | 19 |
| New warm | 26 / 496 | 25 |
| New cold | 26 / 496 | 25 |

Exact held-out coverage did not increase. Neither these selected fixtures nor
this remaining-backlog census establishes an 80% unattended yield.

### Original investigation probes and m2c

On the original 12 mechanism probes, the old engine produced **0 exact + 1 draft**;
the new engine produced **2 exact / 92 bytes + 6 drafts**. The matches are
`ovl_11_func_800BF3D0` and `func_80013450`.

A fresh raw-m2c comparison using the project's normal context produced **1 exact
+ 2 nonexact compiling drafts**; nine outputs did not compile. m2c already matched
`ovl_11_func_800BF3D0`. Thus the new engine supplies more compiling starting points
on this diagnostic set, and one additional exact result, but not every apparent
new engine capability beats m2c. This is not a benchmark of the full repaired-m2c
handoff or of agent time-to-match.

## 2. Byte matches are not yet accepted source

All **59 preserved candidates** were independently recompiled and passed the
relocated-byte oracle, C parser, and existing source-policy scanner.

A separate production-compiler diagnostic audit found what those gates missed:

- **15 exact candidates** contain valued returns in functions declared `void`.
  These violate a C89 constraint despite GCC's successful exit status.
- Two other exact candidates have pointer-conversion diagnostics:
  `func_800171CC` and `ovl_11_func_800C9E90`.
- **38 of the 556 nonexact drafts** also contain the invalid void-return pattern.
  The old preserved drafts had no such pattern.
- Overall, 109 of the 615 selected new outputs (603 engine outputs plus 12 donor
  outputs) emitted compiler diagnostics. Successful compilation is not a
  sufficient definition of a valid recovered seed.

For example, `ovl_11_func_8011F5BC` is declared `void` but emits
`return -0x7FED0000;`. The mixed-return constructor chooses a void signature while
still emitting valued leaf returns. See
`tools/agent/matching-reconstruction/control-structure.ts`, particularly the
signature decision around line 739 and return emission around line 1163.

Removing all diagnosed raw winners leaves **42 / 3,044 bytes**, including
**38 live-eligible / 2,760 bytes**. This is only a diagnostic filter, not proof of
faithful types or integration readiness.

### Integration experiment

For the 47 engine winners, regeneration and integration planning yielded:

- **37 `would-apply`**;
- **9 refused**, due to declarations/types or changed code after transformation;
- **1 inconsistent regeneration**, described below.

The existing engine finalizer does not accept family-transfer artifacts. The 12
verified family candidates were instead staged directly in the disposable copy.

After excluding compiler-diagnosed candidates from the stageable set:

- **33 functions / 2,364 bytes** were present in the disposable build;
- **30 functions / 2,140 bytes** count toward live progress;
- none of these 33 were baseline engine winners;
- all 13 overlay containers and the PS-X EXE matched;
- callee auditing reported no contradictions, though several callees remain
  unwitnessed or undeclared rather than positively corroborated.

With those sources staged, progress reports **800 / 2,559 functions (31.26%)** and
**93,060 / 645,172 bytes (14.42%)**, versus the live tree's **770 (30.09%)** and
**90,920 bytes (14.09%)**. That is **+1.17 percentage points of functions and
+0.33 points of bytes** in the disposable build—not delivered live progress.

There is another integration qualification: context export emits guessed opaque
layouts for private names such as `ReconA0View` and `ReconA3View`. Different
functions use these generic names for different layouts. The exporter also has
pre-existing overlay-type harvesting gaps. Passing a context syntax check with an
opaque guess does not publish the recovered layout. Unique/shared type
reconciliation and context acceptance remain necessary before promotion.

The incremental sandbox checks used existing objects for unchanged functions.
An attempted broader rebuild exposed an unrelated, pre-existing conflict in
`src/func_80023030.c`: `D_8005E340` disagrees with `include/globals_override.h`.
Compiling that unchanged live source reproduces it. The live incremental
`make check-all` passes; do not report that as a clean-from-source rebuild.

## 3. Plan coverage: what is executable

| Investment | Observed implementation |
|---|---|
| Result/seed integrity | Useful manifests, fresh partial products, and stronger checks; warning-invalid C and cold terminal-state accounting remain gaps. |
| ABI, returned pointers, addresses | Material new construction coverage; enum/type expressibility and forwarded-argument bounds remain incomplete. |
| Overlapping/unaligned memory, operations | New support is useful; trap stripping and aggregate-copy recognition have unsound cases. |
| Family reuse | Real donor AST instantiation and independently verified replay: 12/12 current donor-backed targets. |
| CFG/value/effect reconstruction | Machine CFG/SSA/regions are emitted as diagnostics. They do not drive the production C constructor. |
| Compiler recipes and near-miss repair | Retrieval and suggested moves exist; no executable recipe-construction/repair search closes the loop. |
| Fixed-point campaign | Queueing/dependencies exist, but successful artifacts are not published as new donor/type/signature inputs to subsequent attempts. |
| Prepared agent bundles | Valuable packaging, but draft faithfulness, context transfer, and actual agent-effort savings are not established. |
| Transactional integration | Useful staging/planning, but not a unified source/type/context/family acceptance path. |

The existing constructor remains the production route in
`tools/agent/matching-reconstruction/engine.ts`. Machine IR is invoked by
`tools/agent/campaign/bundle.ts` to describe a function. Implementing an analyzer
next to construction is not the planned compositional construction backbone.

Likewise, `tools/agent/nearMissRepair.ts` produces a report and suggested moves;
it does not apply them and recompile a bounded complete-function source domain.

## 4. Concrete correctness counterexamples

The review's `correctness-probes.ts` exercises these independently of match yield.
All returned normally; the existing 884 tests did not catch them.

### Call delay slots: SSA records the wrong argument

For `jal helper; addiu a0, zero, 7`, the symbolic executor records argument 7, but
`tools/agent/machine-ir/ssa.ts` records the entry `$a0` at the call. It processes
the call before the delay-slot effect and reports no opaque instruction. This
currently compromises diagnostics/handoff; wiring this SSA into construction
without fixing execution order would promote it into a construction bug.

### Division recognition removes an unrelated trap

`stripTrapGuards` in `tools/agent/matching-reconstruction/exec.ts` treats the
presence of a division as license to remove trap leaves outside the compiler's
specific divide-check packet. A fixture with an unrelated conditional trap plus
ordinary division becomes an unconditional `a1 / a2` leaf. Exception behavior is
lost. Recognize the actual packet/dataflow, not “a division exists somewhere.”

### Copy recognition follows register names, not values

`tools/agent/matching-reconstruction/copy-recipe.ts` recognizes an aggregate copy
when every loaded register is incremented before its store. Matching a store's
register number to a previous load does not prove the stored value is unchanged.
It needs reaching-definition/clobber and alias/order checks before it can license
a copy recipe.

### ABI lower bounds are clamped away

`inferSignatureRange` in
`tools/agent/matching-reconstruction/callee-signature.ts` returns **0..0** when
argument registers are forwarded untouched, including a probe for `CopyVec3`
whose independently resolved signature has arity 2. The clamp around lines
428–431 narrows the callee lower bound to a caller-setup heuristic. Untouched
registers are valid argument forwarding, not evidence of zero arguments.

The final byte oracle remains a strong protection for accepted machine output.
It does not make these intermediate facts sound or guarantee that a nonmatching
“faithful draft” is faithful.

## 5. Feedback and reproducibility

### The campaign does not currently learn into its next attempt

`tools/agent/campaign/campaign.ts` builds its donor index once from live sources.
Successful candidates remain under `build/`; requeued reconstruction calls receive
neither the recovered source nor a new signature/layout environment.

A dynamic test used the initially donorless family containing
`ovl_11_func_800E0220`, `ovl_11_func_800E1D48`, and `ovl_11_func_8010BF8C`. Two
selected siblings matched independently, but the later member acquired no donor.
Before/after donor lists stayed empty and the producer's resolved ABI signature
was unchanged. The run demonstrates independent successes, not a learned-context
unlock. More rounds of this implementation are not the proposed fixed point.

### A genuine baseline regression

`ovl_23_func_800BA30C` (92 bytes) matched in the old census. The new engine refuses
with “no parameter plan could express the relation's values.” Its preserved old
C still matches **23/23 words** under the current production compiler. The cause
was not established; this must become a regression fixture rather than be
written off as an unsupported target.

### One winner did not reproduce under a later context resolution

The warm census produced an exact 68-byte `ovl_27_func_800BA578` candidate using a
bounded six-argument declaration of `func_80014CBC`. Independent recompilation of
that preserved source still matches **17/17 words**.

A later reconstruction instead resolved the matched-definition parameter type
`ReadFlag` and refused because that type is not expressible by the constructor.
The originating order/cache/context difference was not proven. The observations
are enough to reject an unconditional reproducibility claim, and show that
stronger context can currently block an otherwise expressible call. Preserve
both records; do not silently replace the census measurement with the retry.

### Cold mode mislabels an exhausted filtered domain

In `engine.ts`, the total constructible count includes umbrella candidates, but
cold mode filters them out before compilation. The terminal comparison still
uses the unfiltered total. The 29 held-out new-warm `domain-exhausted` outcomes
become cold `budget-exhausted` outcomes despite the smaller allowed domains.
The cold census reports 625 budget outcomes; do not interpret that number as 625
functions stopped by the 64-candidate cap. Domain identity and terminal counts
must include context filtering.

## 6. Recalibrated expectations and next work

1. **Accept the measured representation and donor gains.** Static work was not
   exhausted. More functions now reach a compilable representation, including
   with recovered game context withheld.
2. **Do not accept “the plan is completed” or forecast 80% from this run.** Exact
   held-out coverage is unchanged, large-code coverage remains small, and the
   mechanisms intended to compound progress are disconnected.
3. **Distinguish three products in reporting:** byte-exact raw candidates,
   source/context/integration-accepted candidates, and actually promoted live C.
   This review delivered evidence and artifacts, not live integrations.
4. **Harden correctness before expanding search budgets:** C89 return/type
   acceptance, precise trap/copy recognition, architectural delay-slot execution,
   non-narrowable ABI floors, deterministic context resolution, and correct
   filtered-domain accounting. Add the concrete counterexamples as regressions.
5. **Wire actual feedback next:** publish a verified artifact overlay containing
   source donors and witnessed types/signatures; pass its revision to consumers;
   refresh affected indexes/caches; demonstrate a sibling or caller that fails
   before publication and succeeds because of it. No live source mutation is
   needed to implement this experiment.
6. **Implement one complete CFG-to-C slice**, not more diagnostic breadth: the
   handler family, then carried counted loops, sums, and nested loops. Preserve
   the existing successful fast paths.
7. **Execute one recipe-based repair end to end:** a source-reachable change,
   complete-function compilation, staged residual improvement, and final byte
   proof. Suggested recipe names alone are not a closer.
8. **Measure handoff usefulness separately:** faithful types/effects, materially
   different seeds, and bounded agent time/attempts against m2c plus existing
   repair. A compiling giant decision tree is not automatically a better seed.

The practical result is a worthwhile smaller matcher/drafter improvement, with
**30 genuinely new live functions demonstrated in a byte-matching sandbox**, but
with source/type publication work still outstanding. It is not yet the unattended
reconstruction service envisioned by the plan.

## 7. Evidence and rerunning

All diagnostic scripts are TypeScript and remain under the ignored review build
directory. Relevant artifacts:

- `population.json`, `eligibility.json`, `evaluate.ts`: frozen cohort and equal
  budget runner. Invocation shape:
  `npx tsx build/static-first-review/evaluate.ts run <root> <population> <out> 64 4 <warm-or-cold>`.
- `census-old/`, `census-new/`, `census-cold/`: observations, sources, and summaries.
- `held-old-warm/`, `held-new-warm/`, `held-new-cold/`: held-out comparisons.
- `families/report.json`, `comparison.json`: family replay and set accounting.
- `m2c-baseline.ts`, `m2c-baseline.json`: the 12 raw-m2c probes.
- `correctness-probes.ts`, `correctness-probes.json`, `feedback-probe.json`:
  behavioral counterexamples and the missing-feedback test.
- `verify-candidates.ts`, `verification.json`: independent recompilation and
  integration planning for every warm/family winner.
- `warnings.ts`, `warnings.json`, `warnings-old.json`: successful-compiler stderr,
  which the regular compile helper discards.
- `staged-diagnostic-clean-candidates.json`, `staged-diagnostic-clean-build.log`,
  `staged-diagnostic-clean-progress.txt`: the final 33-source sandbox and byte gate.
- `callee-audit.json`, `staged-context-export.log`: callee and context limitations.
- `preexisting-compile-failure.log`, `staged-clean-rebuild-failure.log`: the
  unrelated existing clean-rebuild defect.
- `tests.log`: **884 passed, 0 failed**. `live-build.log`: all containers match.

Generated/extracted binaries and experimental candidates were not committed.
