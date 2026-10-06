# Techniques for solving parked functions

Record measured experiments and the source change that actually settled each
function. A parked label is not evidence that its preserved attempt still
mismatches. Scratch exactness and full finalization are separate outcomes.

## ovl_11_func_80108470 — restore an already-exact preserved attempt

**Outcome:** byte-exact clean C, 28/28 words; `psx_finalize_function` passed
exact diff, full configured build, scope and clean-source gates. Documentation
completed without a commit, as requested for the documentation role.

What was tried:
1. Inventoried parked sources and their approval notes. This function's note
   explicitly reported an earlier EXACT result despite its parked status.
2. Ran `psx_m2c` to refresh context. Its generated alternative compiled but
   mismatched; the original preserved attempt remained the candidate to recover.
   The experiment ledger showed that the generated draft repeated an already
   measured output with residual `[0,14,0,0]`.
3. Checked the parked source with `psx_c_source_guard`, then extracted its
   disabled attempt unchanged to `build/parked-recovery/ovl_11_func_80108470.c`.
4. Audited that candidate: triage reported no findings, callee truth found no
   direct callees, and `psx_residual_objective` confirmed EXACT with residual
   `[0,0,0,0]` and 28/28 words.
5. Replaced the live stub and disabled wrapper with that preserved clean C.
   The terminal finalization gate passed; no compiler flag, assembly or register
   exception was needed.

**Successful change:** enable the preserved implementation, not a new algorithm
or an allocation/scheduling workaround. It keeps the computed value in an s16
local and writes D_8012D050[2] only when that value is nonzero.

**Reusable check:** inspect the prior measured outcome before attempting another
rewrite. A parked function can already contain a policy-clean exact solution;
recompile it under current headers and flags, then require full finalization.

Evidence:
- `notes/human-needed-approvals/ovl_11_func_80108470.md` (historical park record
  and preserved source).
- `build/experimentLedger/ovl_11_func_80108470.jsonl` (earlier and fresh exact
  measurements, plus the mismatching generated draft).
- `src/overlays/ovl_11/ovl_11_func_80108470.c` (verified live implementation).
- Verified identity supplied by finalization:
  `c0a2134f1016e9c3951fca3612706ec5539c7df52dc9c97de77080b2e2ca7f43`.

Grouping documentation adds this member to the existing ovl_11 D_8012D0xx
cluster: shared +8/+A fields and the gapless preceding caller support the
membership; they do not establish a definitive translation-unit boundary.

## ovl_11_func_800D812C — place the store between two value births

**Outcome:** byte-exact clean C, 36/36 words, residual `[0,0,0,0]`; the
controller's `finalize` implementation passed exact diff, all linked images,
scope and clean-source checks (`build/parked-recovery/800D812C-finalize.json`).

What was tried:
1. Read the preserved best `[0,0,2,0]` attempt and the prior closures. The
   earlier scheduler impossibility assumed that the first store's RTL birth
   preceded the second multiplication; it did not cover a later store birth.
2. Refreshed m2c context; its new draft failed compilation and was not used.
   Triaged and audited the preserved compiling source instead.
3. Tested a void return and a separately named shared subtraction tail. Both
   compiled to the already-measured two-store-order residual, not a new result.
4. Ran the scheduler trace on the shared-tail variant. The first store had
   LUID 53, the second product's final shift had LUID 66, and the branch-specific
   constant had LUID 71. The latter two were unpromoted, multi-set pseudos.
5. Named the first product, computed the second product, **then stored the
   first product, then assigned the branch-specific constant**. Kept the
   subtraction and second store in the shared tail. This put the store's birth
   between the competing births and immediately produced EXACT.
6. Integrated using the existing shared `Vec3` type (s32 fields at +0/+8),
   confirmed the live source was still EXACT, and ran full finalization.

**Reusable technique:** a store's emitted position is not its source position.
For a backward-scheduler tie, move the store's RTL birth relative to the
unpromoted arithmetic operation, not merely relative to the final result.
An old UNSAT conditioned on a fixed LUID order does not close this alternative.

Evidence: `build/schedulerTrace/ovl_11_func_800D812C`,
`build/experimentLedger/ovl_11_func_800D812C.jsonl`, and the verified source.
No new same-TU evidence was established; no speculative grouping was added.

## ovl_11_func_800E3A3C — recover the indirect call's return contract

**Outcome:** byte-exact clean C, 22/22 words, residual `[0,0,0,0]`; full
finalization passed (`build/parked-recovery/800E3A3C-finalize.json`).

What was tried:
1. Read the preserved `[0,0,0,4]` source and old allocation/search closures.
   They all assumed a void callback and a void dispatcher. Direct-callee truth
   cannot validate an indirect callback's type; its report explicitly left
   this site uncovered.
2. Refreshed m2c context; its new draft failed compilation and was not used.
3. Inspected the original D_800B9920 table and its four handlers, rather than
   treating the source's void callback declaration as established. Handler
   800E4280 explicitly returns 1; 800E40CC and 800E4330 have explicit zero
   return paths. The dispatcher leaves the handler's v0 untouched at exit.
4. Changed the callback's result type to s32. The residual fell to allocation
   1 (20/22 words): only the final mask still occupied the wrong register.
5. Pipeline reversal located that mask's target register a0 versus candidate
   v0. Changed the dispatcher to return the captured callback result after
   clearing the flag. Keeping the result live prevented the mask from using
   v0 and immediately produced EXACT.
6. Published the table type in `include/globals_override.h`, removed the local
   extern declaration, integrated the source, reconfirmed EXACT, and finalized.

**Reusable technique:** a result retained in v0 can look like an allocation
mystery when a callback or wrapper is incorrectly declared void. Audit indirect
callee contracts against table members and the original return path before
solving allocation. The earlier UNSAT results were conditional on the wrong
void-return program, not proofs that this target needed an exception.

Evidence: original `1664.rodata.s`, the four handlers' original assemblies,
`build/experimentLedger/ovl_11_func_800E3A3C.jsonl`, and the finalization receipt.
Grouping notes record the shared selector and original dispatch-table links.

## ovl_11_func_800F9F58 — repair a direct callee's return declaration

**Outcome:** byte-exact clean C, 39/39 words; full finalization passed
(`build/parked-recovery/800F9F58-finalize.json`). The supporting refinement of
func_8001FABC remained 11/11 exact and separately passed full finalization.

What was tried:
1. Read the preserved allocation-1 source, the 58-measurement ledger and the
   earlier flag/source-search closures. Many purportedly different rewrites
   had produced identical words; none had changed the void declaration of
   func_8001FABC.
2. Refreshed context and audited the current declarations. Inspected the
   wrapper's original assembly and its matched callee func_800212A8: that
   callee returns the selected voice, and the wrapper leaves v0 untouched.
3. Changed only func_8001FABC's declaration in the scratch caller from void
   to s32. This immediately produced EXACT, removing the wrong register on
   the D_80126F80 address formation.
4. Baseline-verified func_8001FABC and the full build, then made its canonical
   definition return func_800212A8's result. It remained EXACT (11/11).
5. Integrated the caller with the matching s32 declaration and existing
   GfxObj layout, removing redundant globals and unused declarations/includes.
   The live source stayed EXACT; both functions passed full finalization.

**Evidence limit:** the wrapper's own words alone cannot distinguish an unused
scalar return from void. This reconstruction chooses the value-returning
interface consistent with the retained callee result and the caller's exact
code generation. `callee-truth` still labels it disputed because its target
scan sees no direct v0 write; the wrapper's jal supplies that value. This is
not an SDK-prototype override or a register/assembly exception.

**Reusable technique:** audit the return type of an apparently trivial wrapper
before trying dozens of address spellings. Unused scalar-return calls and void
calls can leave different hard-register state in this compiler even when the
callee's own bytes are identical.

Evidence: both experiment ledgers, the original func_8001FABC assembly,
`src/func_800212A8.c`, and both finalization receipts. Grouping notes now mark
800F9F58 matched and specify its confirmed state-field accesses.

## ovl_11_func_800F14D8 — unsigned clamp and initialization birth order

**Outcome:** 26/26 byte-exact words; full finalization passed all linked
images, source policy and scope checks (`build/parked-recovery/800F14D8-finalize.json`).

What was tried:
1. Audited the preserved population-2 source and leaf ABI; triage named the
   matched sibling 800F144C. Its source uses an unsigned window clamp.
2. Changed only the clamp to `(u32)arg1 >= 30U`: population became zero,
   but exact diff exposed two misplaced initialization words. The staged
   inverse alone reported zero residual, so the word oracle was essential.
3. Tried u16 parameters and a typed pointer: this introduced a new population
   and allocation residual because modifying the narrow parameter changes
   its web. Kept the masked full-width locals instead.
4. Moved `found = 0` before the clamp and `i = 0` after it. This
   immediately produced EXACT, including the branch delay-slot initializer.
5. Integrated the winner, remeasured, triaged and fully finalized. Updated the
   sibling grouping with the independently shared caller and predicate idiom.

**Reusable technique:** check signedness against a matched sibling, then
separate independent initialization births. A zero staged residual is not
byte identity; read exact words when same-shape operations are transposed.

Evidence: the function's experiment ledger, original assembly, matched
`src/overlays/ovl_11/ovl_11_func_800F144C.c`, and finalization receipt.

## ovl_15_func_80135AE0 — transfer the matched cluster's loop idiom

**Outcome:** 34/34 byte-exact words; full finalization passed all images and
policy/scope checks (`build/parked-recovery/80135AE0-finalize.json`).

What was tried:
1. Read the preserved schedule-1 source and the previous exhausted 5250-
   candidate closure. That closure assumed an explicit offset biv plus a
   post-loop offset shield; it did not cover the sibling's indexed algorithm.
2. Triage located the residual in a loop preheader and named the matched
   verifier 80135B68 as a cluster donor with different giv formation.
3. Tested declaration-born and statement-born base pointers. Both produced
   the previously measured population-6 program, not a solution.
4. Copied the verifier's actual loop construction: i from 5 to 255, inner j
   from 0 to 126, `D_80137830[i * 0x80 + j]`, and used post-loop j for
   the checksum store. Removed the separate offset counter and dead shield.
   This immediately produced EXACT without allocator/scheduler tuning.
5. Removed unused scratch declarations, integrated, remeasured and finalized.
   Both checksum halves now independently support the shared grouping idiom.

**Reusable technique:** a nearly exact hand-carved induction variable can
freeze the wrong loop-pass history. A matched sibling is evidence for the
source construction; transfer the whole bounded idiom rather than reordering
its emitted preheader or searching the frozen source's closure again.

Evidence: triage cluster-donor output, both original assemblies, matched
`src/overlays/ovl_15/ovl_15_func_80135B68.c`, the experiment ledger and receipt.

## ovl_11_func_800F27B0 — fresh pointer webs on the full-queue path

**Outcome:** 52/52 byte-exact words; full finalization passed exact diff,
all configured images, scope and source policy
(`build/parked-recovery/800F27B0-finalize.json`).

What was tried:
1. This parked entry contained no prior C or measurements. Refreshed m2c
   context; no usable draft was produced. Read the original assembly and
   audited the SDK memmove signature instead of inventing a declaration.
2. Wrote a signed-byte sentinel scan over 20 four-byte entries. The first
   natural count-up for loop already reproduced the target's peeled scan.
   Its full-queue tail retained the original base across memmove and had
   population 6, schedule 3 and allocation 7.
3. Rebased the full-queue path through D_8007121C, then subtracted 0x49E4.
   A typed tail-entry pointer let combine fold that subtraction into the
   last-entry address; replacing it with three independent base-relative
   stores reduced the residual to population 2, schedule 1, allocation 2.
4. Pipeline reversal identified the original base wrongly assigned s0 and
   the later alias's hi16 wrongly assigned v0. Both came from sharing one
   multi-set base variable between the scan and the full-queue path.
5. Gave the latter path a fresh tail pointer. This immediately produced
   EXACT. Published the witnessed four-byte local layout in game_types.h
   and the 0x50-byte queue alias in globals_override.h; live integration
   remained EXACT and passed full finalization.

**Reusable technique:** identical addresses need not be one C variable.
A fresh branch-local web can remove both a needless callee-saved assignment
and its displaced save, without pinning registers or changing flags.
Keep independent base-relative stores when a shared entry pointer would
allow combine to collapse the original rebase operation.

Grouping evidence: shares the +0x49E4 queue, byte-at-2 empty marker and
0x4C-byte shift with matched 800F2724; adjacent to that member and 800F2880.
The common data/call/link run supports cluster membership, not a TU boundary.
Evidence: original assembly, experiment ledger, verified source and receipt.

## ovl_11_func_800D0600 — finish the established entry-v0 exception

**Outcome:** 11/11 byte-exact words; full finalization passed all images,
policy and scope (`build/parked-recovery/800D0600-finalize.json`).
This is an explicitly classified register-capture exception, not clean C
for an ordinary ABI function.

What was tried:
1. The bulk recovery sweep found that the disabled historical attempt was
   already EXACT. Family transfer also found the byte-identical 800D1CD0
   donor; neither scratch result was treated as finalization.
2. Independently scanned the original: it reads incoming v0 at 800D0608
   and spills it to an unread stack slot. The documented caller 800D062C
   seeds v0 with sp+0x10; existing notes already establish this static-chain
   fingerprint and the same class in matched 800D1CD0/func_8001E9F8.
3. Restored the exact preserved implementation, retaining only its one
   file-scope register capture. Recorded the established exception in the
   source-policy allowlist. The scanner classifies the register declaration's
   asm syntax as both register-asm and embedded-asm, so both categories are
   necessary even though no inline instruction string was added.
4. Used the lowercase symbol key required by triage; a mixed-case key was
   not recognized. Source policy then passed, triage had no blocker, and
   authoritative full finalization passed.

**Reusable check:** separate a genuinely observed non-ABI entry register
from an ordinary allocation near-miss. An exception must rest on original
read-before-definition evidence and existing classification, not on score.
Record it explicitly rather than silently copying a grandfathered macro.

Grouping update marks the already-documented v0-channel sibling matched;
its cross-run data-free comparison identity does not prove a TU boundary.
Evidence: original entry-liveness scan, historical approval record,
static-chain research note, experiment ledger, live source and receipt.

## ovl_21_func_800B98CC — validate the parked scheduling-flag evidence

**Outcome:** clean C, 16/16 byte-exact words; full finalization passed all
images and policy/scope checks (`build/parked-recovery/800B98CC-finalize.json`).

What was tried:
1. The bulk preserved-source sweep rediscovered the historical exact
   implementation, but its -fno-schedule-insns override lacked an allowlist
   entry. Scratch exactness alone was not promoted.
2. Read the original's two tails: each computes the predicate in v0 and
   stores/returns it with no copy. The existing compiler-mechanism evidence
   identifies sched1's return-copy/store ordering as the baseline obstruction.
3. Re-ran the flag matrix on the actual C, not the assembly stub: baseline
   and -fno-schedule-insns2 produce 18 instructions and 6/16 masked matches;
   disabling sched1 produces the target's 16 instructions. The single
   -fno-schedule-insns production override was independently 16/16 byte-exact.
4. Checked the adjacent matched 800B9844 under -fno-schedule-insns alone: its
   entire 136-byte assembled text was unchanged. The combined sched1/sched2
   matrix differs there because of sched2; that is not contrary evidence for
   the sched1-only flag. The following neighbour is a stub, not a witness.
5. Retained the evidence-gated override, recorded its flag-override allowlist
   entry, corrected the old claim that a one-function source file proves an
   original TU boundary, and published the argument layout in game_types.h.
   Live source remained EXACT; triage and the full finalization gate passed.

**Reusable technique:** re-measure the candidate under the precise flag,
not only a combined flag column. Check an actual matched regional witness
without treating a stub's inherited assembly as compiled evidence. A manual
original-byte fingerprint can justify a flag even when the probe's two
encoded fingerprint detectors do not recognize it.

Grouping evidence: original caller 800B8B3C passes D_800C0448 record+0x10;
this establishes the callee's +0x12/+0x2C reads and +0x28 word write.
Evidence: original tails/call sites, existing flag mechanism comment, fresh
flag matrix, `build/parked-recovery/800B98CC-region-check.json`, ledger,
verified source and finalization receipt.

## ovl_17_func_800B9158 — preserve the CSE boundary's operand order

**Outcome:** clean C, 24/24 byte-exact words; all images and policy/scope
passed full finalization (`build/parked-recovery/800B9158-finalize.json`).

What was tried:
1. The preserved primary cached one entry pointer and omitted the target's
   second cursor reload. The historical w1 candidate independently indexed
   the two stores and was EXACT under the existing -fno-cse-skip-blocks flag.
2. Tried a typed queue view, a reused offset, integer addition, a named
   pointer and scaled-array/word indexing. These exposed the same one-word
   commutative operand mismatch; they were not allocation problems.
3. Temporarily removed the old flag and measured the candidates: baseline
   consistently canonicalized the first address to index-first, while the
   original uses base-first there and index-first at the second store.
   The actual-source flag matrix has one dominant CSE-skip column; the
   historical compiler evidence locates the equivalence propagation at
   cse_end_of_basic_block across the guarded cursor clear.
4. Measured four matched regional sources under the precise flag, not an
   assembly stub. 800B9F10, 800B9F44, 800B9CAC and 800BAEF0 have identical
   assembled text versus baseline (52/52/56/96 bytes). No contrary witness
   was found. Corrected the old one-source-file-equals-one-original-TU claim.
5. Integrated w1 without extra types or register directives, retained the
   evidence-gated override and added its flag-override audit entry. Live C
   stayed EXACT and passed the complete finalization gate.

**Reusable technique:** zero staged residual can hide a commutative operand
order. Compare exact words and inspect CSE's equivalence boundary before
searching allocation. A dominant flag column needs original-byte mechanism
evidence and actual matched regional checks; parked stubs cannot supply them.

Grouping evidence: the gapless 800B90F8 initializer touches the same +0x2D8
word, +0x2DC halfword, stride 8 and +0x5A8 cursor within D_800BD848.
Evidence: original words, experiment ledger, flag matrix, config mechanism
comment, `build/parked-recovery/800B9158-region-checks.jsonl`, and receipt.

## ovl_11_func_80103770 — transfer the matched table-access idiom

**Outcome:** clean C, 27/27 byte-exact words; full binary, source-policy and
scope gates passed (build/parked-recovery/80103770-finalize.json).

What was tried:
1. Restored and measured the historical pointer-walking candidate: allocation
   1 remained in the row-address preheader. Earlier offset grouping, pointer
   reuse and count-up pointer loops either worsened population or compiled
   identically; the bounded eight-schema closure exhausted 80 candidates.
2. Read triage's matched donor, 80104394, instead of searching allocation
   against that fixed address expression again. It uses a view containing
   the +0xE514 selector and +0xE522 six-by-seven-halfword rows.
3. Wrote the sum as a six-iteration count-up loop over
   v->rows[sel][i][0], retaining the target's unsigned selector after
   the signed selector comparison. The first complete donor-style variant
   was EXACT. Published the local view in game_types.h and remeasured the
   integrated source: still EXACT, then full finalization passed.

**Reusable technique:** an allocation-only floor can originate in an address
expression family. A source-space exhaustion conditioned on explicit pointer
arithmetic says nothing about a matched neighbour's indexed-member form.
Read the donor before attempting another solver on the frozen wrong form.

Grouping evidence: 80103770 and 80104394 now independently match the same
selector, row layout and indexed-access idiom; gapless predecessor status
remains corroborating evidence, not proof of an original TU boundary.
Evidence: donor source, original words, experiment ledger, shared view and
finalization receipt.

## ovl_11_func_800EF870 — indexed members recover the supposedly impossible copies

**Outcome:** clean C, 19/19 byte-exact words; complete finalization passed
(build/parked-recovery/800EF870-finalize.json), without an exception or flag.

What was tried:
1. Historical pointer-walking C had schedule 1/allocation 7. The ledger's
   many pointer-forwarding and field-view probes all failed to retain the
   two target base copies, and local-allocation/search proofs assumed that
   every store belonged to one precomputed address web.
2. Read matched 801047FC, which initializes the same five 0xC-stride records
   using independently indexed recs[i][k] member stores. Also inspected
   triage's DCC1C typed-entry donor, rather than repeating pointer copies.
3. Described the complete +0xE4D8 region as s16 recs[5][6] and independently
   indexed all five stores: recs[arg0][0/1/2/4/5]. The first compile was EXACT.
   Published the view in game_types.h, remeasured the live source, and ran
   full finalization; all passed.
4. Recorded the counterexample to the old broad impossibility claim. CSE's
   deletion of explicit pointer copies does not imply that the target's
   copies had that origin: the indexed-member source produces them naturally.

**Reusable technique:** a typed pointer to a padded record is not the same
experiment as a typed global view with an indexed member array. The latter
preserves independent address expressions through reload. Before believing
an allocation UNSAT, check that its web partition came from the right source
operation boundary.

Grouping evidence: the 801047FC initializer independently witnesses the
five-record bound, 0xC stride and +0/+8/+A fields. Shared storage supports a
family link, not an original-TU proof. Evidence: matched donor, original
words, experiment ledger/conditional closure, shared type and receipt.

## ovl_17_func_800B90F8 — recover the source induction variables, not their machine simulation

**Outcome:** ordinary clean C, 24/24 byte-exact words; all finalization gates
passed (build/parked-recovery/800B90F8-finalize.json). No override or exception.

What was tried:
1. The preserved draft manually carried a 0x10000-step accumulator, a derived
   integer counter, a walked byte pointer and an incremented value. Its best
   allocation 7 floor survived a large source-order/web-partition closure.
2. Reconstructed the actual array region and used a signed-halfword count-up
   index. An explicit value accumulator still left population 1/schedule 2/
   allocation 5. loopTrace confirmed that loop.c creates the 65536-step giv
   naturally from that narrow index; it need not be simulated in C.
3. Replaced the explicit value accumulator with the source expression
   i*0x1A+0x4D inside the first-six guard, and indexed each member directly
   from the global view. The required constant birth order emerged naturally;
   the remaining differences were the cursor's address and its live high part.
4. Changed the final raw global+0x5A8 store to the same view's cursor member.
   This preserved the common symbol high part and its late low-part formation,
   closing allocation as well as population: EXACT. Published the shared
   90-entry view, remeasured the integrated source and fully finalized.

**Reusable technique:** fixed-point-looking loop code can be strength-reduced
signed-short iteration. A machine-level simulation gets the right arithmetic
while freezing the wrong constant origins and allocation. Derive the source
expression and let the real loop pass create its givs; typed member access
also preserves the correct relocation origin for a post-loop store.

Grouping evidence: the adjacent matched 800B9158 appends to these exact
stride-8 fields and shares the +0x5A8 cursor. Evidence: original words,
loopTrace, staged ledger, shared layout, verified source and receipt.

## func_80019610 — restore the natural scan, then reuse the incoming y parameter

**Outcome:** clean C, 123/123 byte-exact words; full finalization passed
(build/parked-recovery/80019610-finalize.json). The necessary callee-return
correction preserves func_800197FC's existing 57/57 bytes as well.

What was tried:
1. The disabled best used a goto-heavy scan and a common sentinel-store tail.
   Fresh measurement was control-flow 2/population 117/schedule 6/allocation 17;
   block indexing had degraded, so an allocation analysis would be misleading.
2. Kept the 41-halfword whole-object assignment, but used a natural for-scan
   with separate marker cases: 0xFFFE is overwritten, while an already-0xFFFF
   terminator only marks done. This immediately reached population/allocation
   parity; just one stack-parameter load remained six positions late.
3. Moving the local y initializer earlier was byte-identical. The scheduler
   reported its load as UID63, later than the other incoming parameter loads.
   Updating arg4 itself rather than a separate local made the compiler birth
   that incoming halfword at parameter setup: EXACT.
4. Callee truth exposed a matched-but-wrong void declaration on 800197FC.
   Original caller words consume its returned cursor, and the wrapper's last
   call is matched scalar func_80011F5C(0). Returning that value corrects the
   interface without changing any of the callee's 57 words. Aligned the caller
   declaration with that actual signature and remeasured: still EXACT.
5. Published TextCopyBlock for the twin wrappers, integrated the clean source,
   reran triage without blockers and passed the complete finalization gate.

**Reusable technique:** a decompiler's goto/peeled-loop simulation can freeze
extra memory effects and distort every block comparison. Reconstruct the
natural operation boundaries first. For a prologue load whose position will
not move with statements, ask whether it belongs to an updated parameter or
an independently initialized local; assign_parms gives them different births.
A matched callee's void return is not authoritative when its original caller
consumes a independently witnessed scalar tail-call result.

Grouping evidence: the call-target-only twin 80019AD0 and gapless 800197FC
wrapper provide an existing module-family link. Evidence: original words,
scheduler UID63 report, staged ledger, matched 80011F5C definition, shared
aggregate type and receipt.

## func_80019AD0 — verified family transfer closes the second text wrapper

**Outcome:** clean C, 123/123 byte-exact words; complete finalization passed
(build/parked-recovery/80019AD0-finalize.json). Callee 800199F8 remains 54/54.

What was tried:
1. The disabled hand-peeled scan still measured population 76 after the bulk
   audit. Once 80019610 matched, queried familyTransfer with that donor.
   Original-word anti-unification found 74 already-agreeing holes and one
   required substitution: 800197FC to 800199F8. The first candidate was EXACT.
2. Corrected the corresponding matched wrapper's void result to its scalar
   final func_80011F5C(0) result. This independently witnessed return is
   consumed in the original caller; the callee's 54 words remain unchanged.
3. Investigated triage's contrary proven-void assertion instead of changing
   the matching program to satisfy it. The original wrapper contains six jal
   instructions, including the scalar allocator call at 0x80019AA0, after
   which the epilogue preserves v0. Its 'control never leaves' premise is
   concretely false. Recorded this narrow transitive-call-effect resolution
   in the closed-experiment ledger; it licenses no arbitrary return change.
4. Integrated the family candidate using the existing shared TextCopyBlock,
   remeasured the live source and passed full binary/policy/scope finalization.

**Reusable technique:** settle one representative, then requeue its original-
word family immediately. Byte verification, not visual similarity, decides a
transfer. Declaration scanners are diagnostic models: when a tail call defines
an observed result, the absence of a direct v0 write is not a proof of void;
check the original calls and the callee's independently matched return.

Grouping evidence: both exact callers and both matched width/render wrappers
now corroborate the existing gapless module family. Evidence: familyTransfer
substitutions/candidate, original jal sites, matched allocator definition,
staged ledger and receipt.

## ovl_21_func_800BA944 — natural short counter and indexed record access

**Outcome:** clean C, 45/45 byte-exact words; full finalization passed
(build/parked-recovery/800BA944-finalize.json).

What was tried:
1. The preserved best manually simulated selection position, buffer pointer
   and fixed-point step. Historical exhaustive searches froze those origins
   and left allocation 3. Read matched BA7F0 and B9798 in the existing group.
2. Used a signed-short count and ordinary three-record for-loop, accessing
   UnkStruct800C0448[i].unk14 directly and indexing buf[count]. The first
   natural probe was EXACT: the compiler creates the required induction
   variables without hand-simulating their optimized representation.
3. Audited the random helper against matched Rand and its original address
   80012A34. Renaming the call to Rand failed overlay relocation because the
   overlay imports its legacy func_80012A34 name. Kept that import, corrected
   the declaration to the independently witnessed u32(s32) interface and
   remeasured: still EXACT. No symbol configuration change was needed.
4. Integrated, reran triage and completed the full binary/policy/scope gate.

**Reusable technique:** optimized fixed-point induction instructions need not
come from fixed-point source variables. Restore the natural narrow counter
and member-array accesses before solving their allocation. A matched executable
callee can have a different imported name in an overlay; verify the address
and signature without changing a valid import for cosmetic naming.

Grouping evidence: existing B9798/BA7F0 record access and the paired BA868
selection helper; updated the existing cluster's matched status. Evidence:
original words, matched Rand definition/address, three measured candidates,
staged ledger and finalization receipt.
