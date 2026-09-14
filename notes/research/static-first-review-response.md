# Response to the static-first implementation review

> **Independently re-reviewed:** [the second review](static-first-second-review.md)
> confirms the original fixture fixes and donor-feedback demonstration, but
> qualifies the closure claims below. It reproduces parser exhaustion, unsafe
> historical-source integration, overlay restoration loss, and neighboring
> semantic failures, and supplies a corrected controlled census.

What changed after
[the implementation review](static-first-implementation-review.md), which
called for correctness hardening *before* any expansion of search budgets, and
for the feedback mechanism to be wired rather than described.

Nothing in `src/`, `include/`, `configs/`, `lib/` or the `Makefile` was
modified. No candidate was promoted. The work is in `tools/` and its tests.

## 1. Every counterexample in §4 and §5 is fixed, and each one is a fixture now

**A `void` signature over a valued return.** The general control-flow
constructor took the `void` return type whenever *any* leaf left `$v0` unset,
while its valued leaves still emitted `return expr;` — 200 diagnostics across 53
functions, including 15 byte-exact candidates. A value-less leaf falls off the
end instead, which is what its path does; the signature takes the valued type.
On MIPS the return type is only `$v0` liveness and costs no instruction either
way, so declaring the value is free in machine terms and valid in source terms.

**A zero exit status was being read as acceptance.** The compile helper
returned stdout and discarded stderr, so GCC 2.95's "diagnose the constraint
violation, then compile it anyway" reached the byte oracle unseen. `compileSource`
now carries a `diagnostics` field; `classifyDiagnostics` separates a constraint
violation from a remark; and the engine, the family transfer and the artifact
overlay all refuse a candidate the front end diagnosed. Pointer/integer
conversions are no longer possible to emit at all: an argument crossing the
boundary carries the cast the callee's declared type requires, in the same
expressible form the prototype uses.

**"A division exists somewhere" is no longer a licence to remove a trap.**
`stripTrapGuards` tested the *function*; it now tests the *guard*, against the
operands of divisions the execution actually performed. The review's fixture —
an unrelated conditional trap beside an ordinary division, which used to become
an unconditional `a1 / a2` — is refused with the `trap-packet` category, and the
real divide-check packet still strips.

**Copy recognition follows values, not register names.** A store whose register
number matches an earlier load proved only that the name was reused;
`lw t0; addiu t0, t0, 1; sw t0` shared the register and moved nothing. The
recogniser now takes the reaching definition and requires the window between
load and store to redefine nothing — with `definedRegister` exhaustive over the
decoder's opcode set, so an undecoded word answers `"unknown"` rather than
"writes nothing". The 628-byte copy family still recovers with its full
geometry.

**An ABI floor is no longer clamped away.** A caller forwarding `$a0`/`$a1`
untouched writes no instruction, so the call site looks silent — and silence was
being read as evidence of absence, narrowing `CopyVec3` to `0..0` against its
own machine code's `2`. The caller's setup is an upper hint; it can never lower
the floor the callee's own code proved.

**A call's delay slot executes before the call.** `jal` is not a block
terminator, so it sat mid-block with its slot after it in program order and the
machine IR recorded the entry `$a0` as the argument of `jal f; addiu a0, zero, 7`.
The slot is applied first.

**Cold mode counted a domain it was not allowed to compile.** The terminal
comparison used the unfiltered constructible total while cold mode filtered
umbrella candidates out before compiling, turning "nothing here matches" into a
spurious candidate-budget stop. The domain is now what the run was allowed.

## 2. Two findings the review could not explain have a cause

**`ovl_23_func_800BA30C`, the lost baseline winner.** The reviewed tree
reconstructs it exactly in a clean single-process run, so the census refusal was
not a property of the code under review. The cause is `assembleTarget`: it built
`<callee>.target.s` and `<callee>.target.o` under names shared by every process
using the same scratch directory, and a census runs several workers. Six
concurrent processes witnessing `SquareRoot0` forty times each in the reviewed
tree return `{min:1}`, `{min:0}` and — 13 to 22 times out of 40 — nothing at
all. The artifacts are now built under private names and renamed into place; the
same probe returns one answer 240 times out of 240.

That also covers §5's other non-reproducibility (`ovl_27_func_800BA578`, whose
signature resolved one way in the census and another on a retry): a signature
that depends on what else is running makes every measurement taken under it
unreproducible.

**Stronger context blocking an expressible call.** Chasing the same symptom on
`func_8001FE7C` — refused warm, byte-exact cold — found a separate defect with
the same shape. The executor marks every caller-saved register a call clobbers
with a `call-result` atom, and the constructors read *any* such atom as the
call's result being consumed. So the second call's `$a0` slot, full of the first
call's clobber, reported the first call's return value as used: the candidate
declared a temporary nothing reads, and a callee correctly declared `void` then
invalidated the whole hypothesis. Only `$v0` is a result. With that fixed, the
recovered source is the C somebody actually wrote —

```c
void func_8001FE7C(void) {
    func_80020A40();
    func_800218C4();
}
```

— rather than the same thing with a dead `s32 callRet1;` in it, and the function
reconstructs warm as well as cold. Two other functions the review lists as
refused (`ovl_11_func_800C0688`, `ovl_11_func_800C6E0C`) now reconstruct or
produce clean compiling drafts as a consequence.

## 3. The campaign learns from its own successes

The review's §5 finding was structural, not a bug: the donor index and the
signature resolver ask `src/`, a campaign may not write `src/`, so a function
recovered byte-exactly five seconds ago was still a stub to every consumer.

`tools/agent/campaign/artifact-overlay.ts` is the missing tier — a store of
recovered C that is not `src/`, that consumers consult where they consult
`src/`, and that carries a **content-hash revision** every dependent cache is
keyed on: the family index, the evidence graph, and the callee-signature cache.
Nothing enters unverified: publication compiles under the production flag
column, requires the relocated-byte oracle to return `match`, requires no
constraint violation, and rejects any source containing assembly. Each entry
records the context it was recovered under, and a cold reader sees only
cold-derived entries — otherwise the overlay would be a hole through which warm
material re-enters a cold measurement.

`runCampaign` publishes on every exact result *before* requeueing its
dependents, and rebuilds its indexes when the revision moves.

`tools/diagnostics/feedbackLoop.ts` is the demonstration the review asked for,
with a control, in cold context:

```
feedback experiment (cold context): ovl_21_func_800BA670 → ovl_11_func_800F4114

  ✓ 1. the dependent fails
      ovl_11_func_800F4114: domain-exhausted, 0 donor(s) available
  ✓ 2. the producer is recovered and verified
      ovl_21_func_800BA670: exact-candidate (10/10 words)
  ✓ 3. publication moves the revision
      empty → 25d41dcab515a4be; the donor index and the signature cache are keyed on it
  ✓ 4. the dependent succeeds
      ovl_11_func_800F4114: exact-candidate (family transfer)
  ✓ control: the constructor alone still cannot
      ovl_11_func_800F4114 reconstructed on its own: domain-exhausted — unchanged from step 1
```

Cold is the point rather than a detail: warm, step 4 could be explained by
material that was on disk all along. The experiment restores the overlay it
found.

## 4. Two integration blockers from §2 are closed

**Family-transfer artifacts now integrate.** A transfer writes no reconstruction
result, so a function recovered entirely by substitution had no route into the
tree and had to be staged by hand. `planIntegration` falls back to the overlay,
whose entry bar is the same bar integration enforces.

**Invented view names can no longer collide.** `ReconA0View` was referenced by
three different functions' signatures with three different layouts, and the
exported m2c context published one opaque guess for all of them. Every invented
view name is stamped with its owner (`Recon800C6E0CA0View`), so the collision is
impossible rather than detectable. Separately, the integrator was dropping the
candidate's scalar typedefs through a vacuous `every` over a list of names
nothing could read — which would have taken an invented view typedef with them.
It reads the typedef's own name now.

## 5. What is still outstanding

The review's items 6, 7 and 8 are untouched, and its recalibration in §6.2
stands unchanged:

- **No CFG-to-C slice.** The machine IR is still a diagnostic. It does not drive
  the production constructor.
- **No executable recipe-based repair.** `nearMissRepair.ts` still reports moves
  rather than applying them and recompiling a bounded source domain.
- **Handoff usefulness is not measured.** Whether a prepared bundle saves an
  agent time against m2c-plus-repair is not established.
- **No fresh census.** Every correctness fix above changes what the engine
  produces — several functions moved from refusal to exact — so the review's
  comparison table is now a measurement of a different engine. The numbers in it
  should not be carried forward; the census needs re-running, and with the
  determinism fix it can be run concurrently without corrupting its own
  evidence.
- **No live integration.** Byte-exact candidates remain under `build/`.
  Promotion is still a separately authorized step.
