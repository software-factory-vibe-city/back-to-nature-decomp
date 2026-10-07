# Plan: same-value web-partition fingerprinting and diffing

**Status: completed 2026-10-07; historical gate 4/5, zero unsupported confident facts, negative control passing; one pin retirement verified end-to-end.** Third member of the static-domain-detection
set, written from the asm-exception survey of the same date. Companion plans:
`macro-identity-recognition.md`, `nested-function-detection.md`.

## Purpose

Roughly 80% of the project's register-pin exceptions close one mismatch: the
candidate's **same-value register webs** are partitioned differently than the
target's. The target keeps two or more registers carrying what the candidate
spells as one expression chain (or, inversely, rematerializes for free what
the candidate holds in a register), and GCC 2.95's copy-elimination machinery
— combine, CSE copy-substitution, allocator coalescing — fuses or deletes
webs the original's variable structure kept distinct. A pin is the admission
"I know the target's web structure but not the spelling that produces it."

This plan builds the tool that removes the guesswork: compute the target's
web partition **statically from the binary**, compute the candidate's from
the cc1 dumps, diff them, and emit the difference as *spelling directives* —
"this value needs a second named temp assigned between A and B", "merge these
two locals", "bind this constant to a local before the loop" — with each
directive citing the prior closure that proves the lever works. Gradients,
not gauges: the output tells the agent what to type, not how far away it is.

## Evidence

The pin catalog is one mismatch in six costumes:

1. **Views of one value** — raw load vs masked view vs loop-carried copy
   (`func_80017F30`: "preserve its two actual roles, not two differently
   spelled aliases"); shift temp vs sign-extended result (`func_8001D2D8`'s
   `sll v1 / sra v0`); value vs its low halfword (`ovl_11_func_800BF450`).
2. **Address high-half vs full pointer** — the HI16-web family
   (`800DDDBC`, `800F8B4C`, `8010476C`, `80112D10`, `8011F574`): `%hi` lives
   as its own web with per-consumer `%lo` re-adds; GCC fuses to one
   full-pointer web.
3. **Base vs derived pointer** — index, scaled index, resulting pointer as
   separate webs (`801129EC`, `800F2880`, `800F227C`).
4. **Constant bound to a register** — `1` in `$s0` across calls
   (`func_8001FEA4`); `999` born before the cursors (`800F3EF0`); `-1`
   sentinels; constant webs with their own birth positions.
5. **Kept copy across a boundary** — the rounding temp's copy before the
   branch (`func_80022794`); the tail selector reloaded into `$v0`
   (`800E1770`/`8010BC54`).
6. **The inverse** — `func_80012598`/`func_8001231C`: the target's sixteen
   base copies are one-instruction reload rematerializations costing nothing,
   while every copy C writes holds a register.

The systematic causes identified by the survey are also web facts, just
invisible ones: a nested-function static chain is an extra web live at entry
(`nested-function-detection.md`); a file-scope `register` declaration is a
TU-wide web declared in source we don't have (`notes/research/
func_8001E9F8.md`); `func_8001E340`'s reference-count pump is a web present
on both sides with the wrong **weight** (the counterfactual proved the index
needs ≥8 weighted references; the byte-identical machine code has exactly 7).
The genuine outliers are few: `func_800142D8` (delay-slot threading),
`func_8002437C` (symbol labels), and the inexpressible classes (GTE, `$ra`
capture).

Existing doctrine already gestures here — the allocation-swap-means-wrong-web
heuristic, the count-parity check, `notes/research/
func_80016280-web-parity-and-register-recurrence.md` — and the ledger's
clean closures are exactly web edits: the `800DBD78` donor diff merges two
locals into one; `800F227C` moved from `[0,0,2,13]` to `[0,0,2,0]` by giving
three additions fresh typed pointer outputs instead of a reused integer
accumulator. The survey upgrades the heuristic to the organizing principle
of the whole pin category.

## Goals

1. A target-side web extractor: per function, from bytes alone, the
   same-value web partition with per-web value identity, register residence,
   birth/copy/death structure, reference count, and live length.
2. A candidate-side extractor from the cc1 dumps the pipeline already
   produces.
3. A differ that aligns webs by value identity and classifies every mismatch.
4. A directive emitter mapping each mismatch class to the proven source
   levers, each citing its mechanism sheet and a prior closure.
5. Triage integration so an allocation-dominant residual names its web fact
   *before* the respell loop starts — and a retirement audit over the
   existing pins.

## Non-goals

- Solving register *assignment* given correct webs — `psx_solve_local_allocation`
  and the allocator counterfactual own that layer. This tool sits upstream:
  it fixes what the webs *are*, not which hard register each gets.
- Scheduling or population analysis (other sheets own those axes).
- Auto-editing source. Directives are suggestions for the agent; the oracle
  stays the authority.

## Design

### The core objects

**Target web partition.** A lightweight per-function dataflow over the
disassembly: track value identity through copies (`move`, `addu rX,rY,$zero`),
`%hi`/`%lo` formation and re-formation (same symbolic high = same value),
reloads from the same stack slot, rematerializations of the same
constant/symbol, call results, and dead writes. A web = one value identity
(constant / symbol-high / full address / load from slot / call result /
derived expression) with its set of (register, range) residences, its copy
edges, its read count, and its approximate live length. At joins where value
identity cannot be proven, the web is marked `undetermined` — the tool
reports only what it proves. Facts distinguish `same-value`, `copy-point`, and
`expression-roles` evidence. A checked copy contraction can prove equality at a
copy point without inventing a loop-invariant value. A base/derived-pointer
relation concerns different values: it requires aligned arithmetic operands and
result plus candidate multi-SET/self-input evidence, not just register reuse.

Value identity sources: main exe has splat symbols and relocations; overlays
decode `%hi`/`%lo` pairing heuristically within text-section bounds (the
misdecode trap in `tools/diagnostics/overlayFlagFingerprint.ts` applies).

**Candidate web partition.** The vendored cc1's `.lreg`/`.greg` dumps (via
`compilerTrace`) already print pseudo webs with `REG_N_SETS`/`REG_N_REFS`,
quantity suggestions, and final hard-register assignment — richer than
anything derivable from bytes. Parse, don't re-derive.

**The diff.** Align webs across sides by value identity (both sides can name
constants, symbols, slots, and call results), then classify every mismatch:

| Class | Meaning | Example lever (proven closure) |
|---|---|---|
| `fused` | candidate merged two target webs | introduce a named temp for the second view at the target's copy point (`80017F30` two-roles lesson) |
| `split` | candidate kept webs the target merged | merge the two locals into one variable (the `800DBD78` donor edit) |
| `weight` | same webs, refs/live differ enough to flip `allocno_compare` | add/remove a textual reference; print the required count (`8001E340`: ≥8) |
| `birth` | same webs, wrong birth order | move the binding statement; constants get their own local before the loop (`800F3EF0`) |
| `residence` | callee-saved vs scratch disagreement | lifetime across a call: name the local that must span it (`800F8B4C` high-in-`$s0`) |
| `entry-web` | target has a web live at entry with no in-function birth | route to the nested-function census / TU-context hypothesis, not to respelling |
| `free-copy` | target copies are reload remats; candidate copies hold registers | the `80012598` class — flag as heavyweight, do not suggest adding locals |

Every directive names the mechanism sheet to load and the ledger entry that
proved the lever, per the knowledge-retrieval design (push, with the citation
attached).

### Phase 1 — target-side extractor

`tools/diagnostics/webPartition.ts` (final location per
`notes/tools-directory-structure.md`). General-purpose inputs: bytes +
function table + optional symbols/relocations.

Tests (all against known targets):
- `func_80017F30`: raw-load and loop-carried values reported as two webs
  joined by the delay-slot copy.
- `func_8001D2D8`: the entry two-register sign-extension pair.
- `ovl_11_func_800DDDBC`: one `%hi` web with two `%lo` re-adds.
- `func_80012598`: the sixteen one-instruction remat copies, each flagged
  zero-cost.
- `func_8001E340`: the index web's read count equals the counterfactual's 7.

### Phase 2 — candidate-side extractor and the null diff

Parse `.lreg`/`.greg` (and `.rtl` for birth order) out of the existing
`compilerTrace` output into the same web schema.

Test — the strongest validation available: run the differ over a broad
sample of **matched** functions. Byte-exact matches must produce empty diffs
(modulo `undetermined` rows). Any non-empty diff on a matched function is a
bug in one extractor, found for free.

### Phase 3 — differ, directives, and historical replay

Build the aligner, classifier, and directive emitter.

Test — replay the survey's closures from their preserved pre-fix attempts
(approval files and `build/` experiment dirs hold them):
- `80017F30` → `fused` naming the raw/carried views;
- `800F8B4C` → `split`/`residence` consistent with the donor-merge and
  high-across-call facts;
- `8001E340` → `weight` with the required count;
- `800F3EF0` → `birth` on the `999` constant in the preserved cursor attempt;
  retain the approval's best attempt, where 999 is already early, as a negative
  control (the initial replay used the wrong positive fixture);
- `801129EC` → `fused` on product vs saved pointer.
Acceptance: the correct directive appears, named first, in at least four of
the five replays. A replay that produces a *wrong confident* directive is a
blocker; `undetermined` is acceptable.

### Phase 4 — integration and the pin-retirement audit

- Triage push: when the staged residual is allocation-dominant
  (`[0,0,0,k]` or allocation-majority), print the web diff and directives
  before any respell iteration. This is the step that converts the observed
  45–60-minute valleys into one targeted edit or a fast, evidenced park.
- `psx_residual_objective`: rank candidate edits by which named web fact
  they address.
- Park/exception gate (policy, filed for the owner, not enforced here): a
  pin request should attach the web diff showing either an `entry-web`/
  `free-copy` class or a `weight` tie with the counterfactual run — the two
  shapes the survey showed are genuinely tie-locked — so grants record which
  mismatch they close.
- Retirement audit: run the differ over the current configured ovl_11 pinned functions plus
  `80020E38`/`80021820` (the grandfathered 2.8.1-era pins with no fresh
  diagnosis). Where the diff names a spelling lever, attempt the clean
  respell; each success removes a pin and its allowlist entry, validated by
  `diffFunc` and `make check`.

## Phasing

| Phase | Deliverable | Gate |
|---|---|---|
| 1 | target web extractor | five known-target tests |
| 2 | candidate extractor | empty diff on matched-function sample |
| 3 | differ + directives | 4/5 historical replays, zero wrong-confident |
| 4 | triage push + retirement audit | at least one pin retired end-to-end |

## Delivery and measured limits (2026-10-07)

Implemented the pure original-word extractor in
`tools/diagnostics/webPartition.ts`, the candidate dump layer in
`tools/diagnostics/candidateWebPartition.ts`, the conservative aligner/directives
in `tools/diagnostics/webPartitionDiff.ts`, and the CLI/project adapter in
`tools/diagnostics/fingerprintWebPartition.ts`. `npm run web-partition` exposes
single-function, original-only, JSON and pin-audit modes. Triage pushes the
result on semantically aligned allocation-majority residuals; residualObjective
reports which named facts variants address, subordinate to the staged key.

The candidate's pre-reload pseudo quantities are **not** compared as if they
were final machine residences. Both final observed partitions use the same
extractor, with dump quantities/UIDs attached separately when identity and
assignment allow an unambiguous projection. This prevents phantom pseudos and
reload-generated copies from manufacturing defects on matched code, without
using byte equality as the differ's shortcut. An empty diff establishes only
observed partition agreement, not equality of unavailable original RTL.

Corrections to two proposed gates:

- `func_8001E340` has **two machine reads** of the index. Including definitions
  and natural-loop weighting gives the estimated **7**. This is not a recoverable
  original `REG_N_REFS`; a fresh hash-bound counterfactual is required for a
  confident threshold. No function-name-special-cased >=8 directive is emitted.
- `func_80012598` contains the copy topology the survey describes. The bytes
  cannot certify that those copies cost zero registers or were emitted by
  reload. The tool reports compatibility and directs investigation of
  single-set/REG_EQUIV evidence, not a proven zero-cost target classification.

The five original-target tests cover the raw/carried delay-slot copy, the
sign-extension pair, the high-half with two consumers, the base-copy census and
the index estimate. A 15-function independently byte-matched sample spanning
EXE/overlay, calls, loops and reload-heavy exceptions has empty observed diffs.
The shared natural-loop analysis had a self-loop bug: it included a preheader
in a one-block loop. That was fixed with a focused regression test; otherwise
this diagnostic's weighted estimate would incorrectly have been 10, not 7.

`npm run web-partition-replay` stages the preserved attempts through the shared
C AST guard and reports **4/5 named-first**, **zero unsupported confident facts**,
and **passing negative controls**. It validates the actual role/value named by the
first directive, not merely its class label; all observed facts are checked
against partition/RTL evidence. All five functions remain in the denominator.
`func_8001E340` remains unaccepted without a fresh private-weight witness; its
real machine birth inversions are reported without fabricating a >=8 threshold.
The replay writes `build/webPartition/historical-replay/report.json` (schema 2)
and exits 2 on a failed count, unsupported observed fact, or negative control.
This is the specified acceptance gate, not a claim that every pin or allocation
fight is diagnosed.

The retirement audit derives the current allowlist, rather than assuming its
historical size. It removes only local register bindings through the shared
pinned C AST guard, stages complete candidates under `build/`, and records
compile failures/mismatches explicitly. Symbol aliases, file-scope register
context, instructions and disabled source are not erased. Byte-exact pin-erased
candidates may still contain inherited instruction asm, so they are not silently
promoted as clean C. The grandfathered `func_80020E38` was separately measured
with ordinary C locals: **8/8 exact**, unchanged flags and owned global; its two
bindings and obsolete allowlist entry were removed. No other audit candidate
was integrated.

Single-function CLI output was subsequently made explicit about the diagnostic's
subject: it prints source register/asm constructs and the oracle verdict. A live
pinned source that already matches automatically gets a separate AST local-pin
removal probe; comparing the already-matching pinned program alone only produces
an empty diff and cannot answer whether its pins are still necessary. The
`--probe-pins` flag also permits a probe of an explicit candidate. For
`ovl_11_func_800BF450`, removing the one local binding is byte-exact, but the
instruction asm tail remains; the report explicitly refuses to label that
candidate fully clean C. No further source/allowlist change was integrated.
Unknown function names now receive configured-symbol suggestions rather than
an opaque lookup failure. This usability change does not close the historical
4/5 directive gate.

The BC54 pin-removal probe now prints its concrete **35/37** residual inline:
`0x8010BCC8` loads the selector into `v1` rather than `v0`, and `0x8010BCD4`
stores from `v1` rather than `v0`. The value, web count, birth/death, machine reads
and estimated weight agree. This is **scratch assignment**, explicitly outside
the spelling-fact/progress layer, not a fused/split web. A unique single-def
absolute memory load with matching width, signedness and assigned register
projects candidate pseudo 96 into that machine web; ambiguity in either direction
refuses attribution. `.lreg` reports one SET, two weighted refs, span three and
local assignment to `v1`. Reconstructed intervals expose the order UID 67 load →
UID 75 return-zero SET to `v0` → UID 72 store/death. Final scheduling moves the
zero SET later, so looking only at the final two differing words misses this
constraint. The report gives the nonoverlap experiment (UID 72 before UID 75 in
pre-allocation RTL), not a claim that merely moving the already-later C return
will accomplish it. No verified clean-C spelling or retirement is established.
A separate focused instrumented local-allocation run corroborates the current
state: stock replay **10/10**, quantity q9 containing pseudo 96 chooses hard 3
(`v1`), and hard 2 (`v0`) is absent from its available candidates. That observation
is conditioned on this pin-erased source/compiler state, not a proof that other
clean-C spellings cannot work.

The shared interval reconstructor does not close `REG_UNUSED` births or implicit
call clobbers; candidate extraction therefore excludes unused hard births and
scratch intervals crossing a subsequent call rather than manufacturing a
spurious overlap from the unused first call's result. These are reconstructed
candidate-side constraints, not original-source provenance or private allocator
proof. Reports retain the compiled object's actual path and same-address word
pairs; CLI paths are supplementary evidence, not the answer. Triage also exposes
these diagnostics as informational allocator evidence, never a confident spelling
directive. The focused memory-attribution, ambiguity, overlap/endpoint,
BC54 and BF450 probe regressions pass without changing live source or policy.
The subsequent completion pass closes the remaining directive gate:

- **80017F30 — fused raw/carried bindings:** `webPartitionProof.ts` contracts the
  exact target copy within one CFG block, substitutes its single-definition
  source's consumers, and checks every resulting word against the candidate.
  Intervening destination accesses, calls, opaque words and load hazards refuse
  the certificate. Every exit must overwrite the removed source without reading
  it first; this protects implicit ABI observers. The copy at instruction 10
  (delay slot) explains the complete 19/22 residual. Whole-loop identities remain
  undetermined; only equality at the copy point is asserted.
- **F8B4C — high-half residence:** the original observed saved/scratch and
  call-span fact remains first. A saved/scratch disagreement with no call span
  no longer manufactures a call-lifetime spelling directive.
- **F3EF0 — constant birth:** the approval's 26/35 attempt already places 999
  before its cursors, so it is preserved as a no-birth negative control. The
  independently preserved `build/parked-recovery/800F3EF0-cursors.c` genuinely
  puts 999 late. Its verbatim C is archived at
  `tools/diagnostics/test-fixtures/web-partition/800F3EF0-cursors.c`, SHA-256
  `154e6e9d2081bf934702455fdb7548df463a16405af2759a8be6b7e6dcec4eb2`.
  The positive replay names `const:999` first; the original control must not.
  The function denominator and 4/5 requirement are unchanged.
- **801129EC — fused expression roles:** target base `D_80076220` in v1,
  scaled index in v0 and saved result in s0 align with the candidate's operands
  and result. Candidate pseudo 81 has three SETs, base binding UID 34 and
  self-input pointer update UID 53 in the same block, reusing s0. This is
  multi-SET role fusion between different values, not numerical equality or
  coalescing of two separate single-SET pseudos. The directive names a byte-base,
  integer byte-offset and fresh typed record output, preserving signedness and
  byte-vs-element arithmetic. GCC's leading `*` raw assembler-name marker is
  resolved against the real symbol index; it previously hid this binding.

The focused diagnostic module now has **27 passing tests**, including these
certificates, refusal cases, the full historical gate, the negative birth
control, the independently matched 15-function null-diff sample and BC54/BF450.
The current 22-entry configured retirement cohort was audited without automatic
promotion. `func_80020E38`'s earlier clean retirement remains verified by source
policy and `make check`; other exact erased candidates stay explicitly
unintegrated, with inherited instruction/file-scope-register debt reported.
Final verification: **46/46 focused tests** across this diagnostic, the C source
guard and machine IR pass; the historical replay passes **4/5** with zero
unsupported confident facts and passing controls, and `make check` passes.
No full test suite was run. Repository-wide TypeScript checking still has
pre-existing errors; the new diagnostic modules and tests have no diagnostics.

## Risks and open questions

- Value identity at control-flow joins is the hard analytical corner; the
  schema's `undetermined` tier exists so the tool degrades honestly rather
  than guessing (verdicts over defaults, per project doctrine).
- Web alignment is ambiguous when several webs share one value (the remat
  cases); align by range overlap and copy topology, and report ambiguity as
  ambiguity.
- cc1 2.95 dump formats are stable (vendored compiler) but the parser should
  pin itself to golden dump fixtures so a toolchain rebuild can't silently
  skew it.
- Live-length and reference weights computed from bytes approximate the
  allocator's internal quantities; where a `weight` directive matters, the
  allocator counterfactual remains the confirming instrument — the differ
  points, the counterfactual proves.
- Directionality statistics from the survey (target-splits/candidate-fuses
  dominating, with `80012598` the known inverse) should be re-measured over
  the whole matched corpus once Phase 2 lands; if the inverse class is more
  common than the survey suggests, the directive table needs balancing the
  other way.
