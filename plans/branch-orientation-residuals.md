# Plan: branch-orientation residuals and control-shape search

**Status: implemented, with evidence-backed acceptance corrections below.**
Originally proposed 2026-10-09. This follows the match of
`ovl_11_func_8011E090`, recorded in
`notes/retros/2026-10-09-ovl_11_func_8011E090-retro.md`.

## Implementation record

- Added production dump-pair `jumpTrace.ts`, the located `branch-orientation`
  triage detector, and AST-only `controlShapeSweep.ts`; both CLIs have Pi tools.
- Added search cost repricing, pre-pilot reach caveats (also carried by triage),
  and historical better-baseline warnings. Doctrine and tool documentation are
  updated; no live function sources, compiler flags or cc1 code changed.
- Regression evidence is tracked as text under
  `test-fixtures/branch-orientation/`, including preserved dumps, cost/grammar
  snapshots and a provenance manifest. Unit tests check structural witnesses,
  negative controls, read count/order, policy-safe forms and advisory reach.
  Integration tests compile the real tails through the production byte oracle.
- Verification passed: `npm test` (1,299 tests), `make check-all` (PS-X EXE
  and all 13 overlays byte-identical), fixture hashes and `git diff --check`.

Three premises needed correction after replaying the preserved evidence:

1. Parked's `||` tail has a jump-over-jump inversion (`jump.c:1733`), **not**
   a witnessed :596 SET hoist. Its report stays `undetermined`, with the actual
   inversion evidence. The nested `t1` tail does witness :596. Triage binds it
   through a survived UID's unique final hard-register comparison; it does not
   assign another hoist in the function to this block.
2. Correcting only parked's address statements already produces EXACT under
   the current production toolchain. A separate address-corrected **nested**
   fixture supplies a genuine tail residual. Its sweep reaches EXACT with the
   required outer duplicate `else { return 0; }`; OR-inverted is also EXACT.
3. The historical return path is outside every order region, but a real
   `web:ptr#0` rename axis touches its expression return. The reach warning
   retains that axis rather than falsely declaring it absent. A folded-away
   literal result uses the conservative union of all source returns, explicitly
   not an exact line binding. Renaming is not coverage of return-arm creation.

The historical 60,672-candidate projection now uses the observed 330.7 ms
pilot cost and quotes 14.5 minutes, within 25% of the recorded 17.6 minutes.
The original design below is updated only where these measured premises
changed its acceptance conditions. See the fixture README for exact provenance.

## The theme

The residual reported one block as a population difference. In fact both
programs held the same comparison, and one conditional branch had the
opposite sense:

```asm
/* target */                    /* candidate */
bnez  v0,exit                   beqz  v1,exit
 move v0,zero                    li   v0,1
li    v0,1                      move  v0,zero
exit:                           exit:
```

The first jump pass can decide this. On the nested tail, `jump.c:596` rewrites
`if (c) { x = a; goto l; } x = b;` into `x = a; if (!c) goto l; x = b;`, and
the store-flag rewrite (`jump.c:870`) can then fold the result into `sltiu`.

The parked OR tail instead inverts a jump-over-jump, without hoisting a SET.
The source lever is the label layout after the `goto`. An extra arm that
returns the same value blocks the first rewrite. Every tidier spelling of the
logic normalises to the same inverted or folded output.

The session that parked the function had nothing that:

1. **Named the pass.** The residual said "population". Nothing compared the
   expand dump with the jump-pass dump, where the rewrite is plainly visible.
2. **Offered the source move.** Nothing enumerated the equivalent control
   shapes of a return-valued tail, so the one that works had to be found by
   hand.
3. **Said the searcher couldn't reach it.** The residual source searcher varies
   statement order, value-web partitions and materialisation. It ran twice for
   about 47 minutes over a grammar that cannot add an arm. Its 2.2-minute
   projection took 17.6 minutes, because it priced candidates at the 51 ms
   median compile instead of the 330.7 ms its own pilot measured.

## Design principle

A rewrite that leaves the instruction multiset almost unchanged and flips a
branch is a compiler decision with a known source lever. The tools should:

- name the decision;
- show the dump evidence for it;
- generate the source shapes that block or allow it;
- measure those shapes.

That is a gradient, not a gauge.

## Phase 1: jump-pass attribution

Add `tools/agent/jumpTrace.ts <fn> [--source path] [--json]`. <!-- doc-ref-ignore: proposed -->

- **Compile.** Compile with `-da` and read the `.rtl` (expand) and `.jump`
  (first jump pass) dumps. Use the jump dumps after CSE as well when they are
  emitted.
- **Classify.** For each conditional jump present in both dumps, classify what
  happened to it:
  - **assignment hoist (`jump.c:596`):** a `set` of register R appears before
    the jump that was not there at expand, the jump's sense is inverted, and
    its label is now the `goto`'s label;
  - **else hoist (`jump.c:453`):** the `x = b` set moves ahead of the whole
    chain of jumps to one label;
  - **store-flag fold (`jump.c:870`/`:1021`):** the jump and its guarded
    `set` are replaced by a store-flag set (`(set R (eq/ne/lt ...))`);
  - **unchanged.**
- **Report what blocks each rewrite, in source terms:**
  - `:596` needs the jump's target label directly after the `goto` of the
    guarded arm, with no label between the jump and that `goto`.
  - The store-flag fold needs the guarded set right after the jump, and a
    known prior value found by `reg_set_last`, which stops at a label.
- **Attribution only.** jump.c logs nothing, so this matches the two dumps
  against each other. A jump whose before/after pair fits no class is
  reported as `undetermined`, never as a guess.
- **Tests** (fixtures copied from `build/e090_claude/` into a tracked
  `test-fixtures` directory):
  - the nested-if tail (`t1`) reports an assignment hoist on the flag test;
  - the separate-returns tail (`t5`) reports a store-flag fold on the flag
    test. The `:596` hoist that precedes the fold inside the same jump pass
    is not visible between two dumps, and the report says so;
  - the committed source reports both tail jumps unchanged.

## Phase 2: the `branch-orientation` triage detector

Add a triage detector named `branch-orientation`.

- **Input.** The aligned target/candidate blocks that pipeline reversal
  already produces.
- **When it fires.** Within a located block:
  - the same comparison operands appear, but the branch sense is opposite
    (`beq`/`bne`, `beqz`/`bnez`, `bltz`/`bgez`); and
  - the constants written to one register are swapped between delay slot and
    fallthrough, or the candidate has a store-flag (`sltiu`/`sltu`/`xori`)
    where the target branches, or the reverse.
- **Output.**
  - Name the block and the rewrite, from Phase 1 when a source is given.
  - Name the source moves:
    - add or remove an arm that returns the same value (sets the same
      register);
    - switch between a single result variable and direct returns;
    - nest or flatten the guarding `if`s.
  - Point at the Phase 3 sweep.
- **Must not fire** on register-only differences or on blocks whose
  comparisons differ.
- **Tests:**
  - the parked `ovl_11_func_8011E090` source fires on its return block;
  - the committed source gives no finding;
  - `ovl_11_func_801136D0`, whose target itself folds to `sltiu`, gives no
    finding;
  - the `ovl_11_func_800D7EF8` target, the inverted form, compared against a
    non-inverted candidate fires in the opposite direction.

## Phase 3: control-shape sweep

Add `tools/agent/controlShapeSweep.ts <fn> --source path [--max N]` and a Pi <!-- doc-ref-ignore: proposed -->
tool, registered from `diagnostics.ts` under `.pi/extensions/psx-decomp/tools/`.

- **Site.** Use tree-sitter, with no regex. Find the maximal suffix of the
  function body that is a decision tail: `if` statements whose arms end in
  `return <constant>` (or assign one result variable), with no other side
  effects in the arms. Reads in the conditions are allowed; no form evaluates
  a condition twice.
- **Forms.** Equivalent spellings of the same decision table:
  - early returns per test;
  - nested `if`s;
  - one `if` joined with `&&` or `||`;
  - each nested `if` given an `else` arm with a duplicate return, at each
    level;
  - a single result variable with one `return`;
  - a `switch` on the first tested value when it compares against
    constants;
  - each form with the condition sense inverted.
- **Measure.**
  - Compile every form.
  - Attach its Phase 1 classification.
  - Score it with `residualObjective.ts --dir`.
  - Rank by located-block residual, then the full key.
- **Acceptance.**
  - Start from the parked attempt, with only the grid-address block
    corrected (a fixture).
  - The sweep returns an EXACT variant: the `else { return 0; }` form.
  - The plain nested and `&&` forms are listed as `:596` hoists, and the
    early-return form as a store-flag fold. The OR form remains `undetermined`
    with observed jump-over-jump inversion evidence, not an invented hoist.
  - The address-only corrected parked fixture is already EXACT. The separate
    address-corrected nested fixture verifies a genuine repair, not just a
    spelling of an already-matching input.

## Phase 4: guardrails for the residual source searcher

Changes to `tools/agent/residual-source-search/`:

- **4a. Honest projection.**
  - `cost-report.ts` prices candidates from `perCandidateMs`, the median
    single compile.
  - When the pilot's `observedPerCandidateMs` is higher, project from the
    pilot and print both.
  - Test: the `ovl_11_func_8011E090` run `28ba8c82fa398cad` (60,672
    candidates, 23 jobs, pilot 330.7 ms) projects within 25% of its observed
    17.6 minutes.
- **4b. Reach check.**
  - Before an exhaustive run, map the residual's located blocks onto the
    domain's axes.
  - Report as a caveat, not a refusal, when:
    - a located block falls outside every region the grammar can vary; or
    - the located difference is a Phase 2 branch-orientation finding.
  - Triage's `search-domain` finding carries the same line.
  - Test: the 14:31 run's domain reports that the return block is outside every
    order region, retaining the remaining web axis and naming the missing
    return-arm construction. An unbound literal-result path uses an explicit
    conservative union of all source returns; other unknown bindings remain
    undetermined.
- **4c. Stale baseline.**
  - When the source handed to a long run measures worse than the ledger's best
    key for the function, print the better source and its key first.
  - The 14:31 run searched a source at population 43. A population-5 source
    appeared 18 minutes later.

## Phase 5: doctrine

Add a general imperative to `prompts/reference/population.md`, with no
function names:

> A population difference consisting of one branch with the opposite sense,
> and the result constants swapped between delay slot and fallthrough, is a
> jump-pass rewrite, not different semantics. Compare the expand and jump
> dumps. Change the arms around the `goto` (an extra arm returning the same
> value, nesting, or a result variable), not the condition's spelling.

Also add a general imperative to the materialisation guidance in the same
sheet:

> When the target computes an address's index chain before its base split,
> write the scaled offset and the table pointer as their own statements, in
> the target's order.

## Sequencing

- Phase 1 comes first.
- Phase 2 uses Phase 1's attribution.
- Phase 3 uses both.
- Phase 4 is independent of the others.
- Phase 5 follows Phase 2.

## Overall acceptance

Starting from the parked `ovl_11_func_8011E090` attempt alone:

1. Triage reports `branch-orientation` on parked's return block with the
   observed inversion and undetermined hoist attribution. The nested fixture
   names the witnessed `jump.c:596` hoist.
2. With the address block corrected, the control-shape sweep reaches EXACT,
   including the required duplicate-else form. The nested fixture confirms an
   actual residual is repaired; the parked OR fixture is already exact.
3. The searcher's projection and reach check would have flagged both long
   runs before they started.

`npm test` and `make check-all` pass.

## Related, filed for the owner

`ovl_11_func_801103E8` declares the handler argument as
`Recon800D0408A1View`, which is 12 bytes. The callee copies 16 bytes from it,
and the caller's slot has room for 16, which suggests a `VECTOR`. This is a
declaration disagreement, not part of the guard.

## Out of scope

- Any change to cc1 to log jump.c decisions.
- Control-flow rewrites that change the CFG rather than branch orientation.
  Those stay with the existing control-flow residual handling.
