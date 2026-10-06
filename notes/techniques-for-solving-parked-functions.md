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
