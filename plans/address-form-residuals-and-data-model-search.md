# Plan: address-form residuals and data-model search

**Status: proposed 2026-10-08.** This follows the hand match of
`ovl_15_func_80134770`, recorded in
`notes/research/ovl_15_func_80134770-struct-member-store-escapes-cse.md`.

## The theme

One session spent 19 ledger attempts and 37 variant files on a single
population difference. Thirteen different sources compiled to identical words.
The two address forms were:

- **Target:** `sb zero,0(s2)`, where `s2` holds the full address of
  `D_80140F14`.
- **Candidate:** `sb zero,%lo(D_80140F14)(s0)`.

No spelling of the statement could reach the target. The lever was the
declared type: the buffer is `Title[64]` at +4 of a memory-card header at
`D_80140F10`, and only a member access on that global gets the store past
CSE. Once the population matched, the remaining schedule residual came from
statement order and base-before-index address loading. A grid sweep found
both, but this repository's searcher could not run on the function.

The general failure has four parts:

1. **The tools see the difference but not its meaning.**
   - Pipeline reversal located it exactly.
   - Triage reduced it to "constant 0x0 target 4 yours 3" and pushed an
     unrelated `memset` callee-truth signal.
   - Nothing translated an addressing-mode difference into the source
     mechanism that produces it.
2. **No tool proposes data-model hypotheses.**
   - The evidence was mechanical: a 4-byte data label directly below the
     referenced symbol, and another function writing into it.
   - Nothing reads the data-label neighbourhood of a symbol the residual
     names.
3. **The plateau went unread.**
   - `residualObjective.ts:374` prints "same experiment, different spelling"
     on every repeat.
   - Nothing aggregates those repeats into a stop signal.
4. **The searcher can't take the schedule half.**
   - Its eligibility gate rejects the project's normal overlay declarations.
   - Its order model serializes stores to distinct fields of a struct local.
   - It can't split a global array's base into its own statement.

## Design principle

A residual that survives every rewrite of the statement it sits on is a
fact about the declarations, not the statement. The tools should say which
declaration, and back it with a measured source variant: a gradient, not a
gauge.

## Phase 1: the address-form classifier

Add a module `tools/agent/addressForm.ts` and a triage detector named <!-- doc-ref-ignore: proposed -->
`address-form`.

- **Input.** The aligned target-only/candidate-only access pairs that
  pipeline reversal already produces for a population site:
  - the target is read from the splat asm, which is symbolic;
  - the candidate is read from the cc1 `.s`.
- **Per-access provenance.** For each access, record what the base register
  holds.
  - Track `lui %hi(S)` and `addiu %lo(S)` through the extended basic block.
  - A register is invalidated by redefinition, by a call for caller-saved
    registers, and at every code label in either syntax (`.Lxxxx:` and
    `_8001D884:`).
- **Classes.** Classify each pair and attach the mechanism and the source
  move:

  | class | target | candidate | mechanism | source move |
  |---|---|---|---|---|
  | interior | `k(R)`, `R = &S`, no label between | `%lo(S+k)(H)` | the address reached combine as `base+offset` of an enclosing object, after CSE | Phase 2 hypotheses for `S` |
  | boundary | as above, with a label between | `%lo(S+k)(H)` | CSE forgot the equivalence at a label | name the label; the candidate's control flow differs there |
  | direct | `%lo(S+k)(H)` | `k(R)`, `R` a pointer copy of `&S` | the original accessed the global directly | replace the alias access with a direct global access |
  | rebased | `k(R)` | `k'(R')`, with `&S − &S' = k' − k` | different base object | Phase 2 hypotheses for both symbols |
  | gp | `%gp_rel(S)` | `%lo(S)` | translation-unit ownership | cite `notes/adr-0001-symbol-addressing-at-the-assembler-boundary.md` |

- **Exclusions.** These have to be proven, not guessed:
  - `lwl`/`lwr`/`swl`/`swr` runs and aligned load-run/store-run block moves,
    using the `backend-packet` detector's reading;
  - operands of PSY-Q GTE macros, using the macro registry;
  - pairs that differ only in relocation.
- **Output.** A `[signal] address-form` finding citing the instruction pair,
  the class, and the move.
- **Tests:**
  - this function's stuck source is classified `interior` on `D_80140F14`;
  - a loop-body access with a label between is `boundary`;
  - the `lwr` block moves in the ovl_10/ovl_11 census entries give no
    finding;
  - `gte_ReadRotMatrix` (`func_8001BB88`) gives no finding;
  - pointer-to-struct code whose forms agree gives no finding.

## Phase 2: enclosing-aggregate hypotheses

Add `tools/agent/aggregateHypotheses.ts <fn> [--source path]`, which Phase 1 <!-- doc-ref-ignore: proposed -->
calls for `interior` and `rebased` findings.

- **Data-label index.**
  - Parse every `dlabel`/`enddlabel` pair in `build/<container>/asm/data/*.s`
    and the link map to get address and extent.
  - Cross-reference each label against the nonmatching asm and the matched
    sources.
- **Candidate enclosures.** For a symbol `S`, consider each label `P` that
  precedes `S` within the segment, with `k = S − P`. Rank them by:
  1. adjacency (`P` ends exactly at `S`);
  2. whether `P` is referenced by another function;
  3. smallest `k`.
- **Rewrite.** Use the tree-sitter front end; no regex.
  - Declare `P` as a struct with the access at member offset `k`.
  - Replace uses of `S`, and of local pointers that are pure copies of `S`,
    with `P.member`. The access must be on the global itself, because a
    pointer to `P` compiles to `k(Rp)`.
  - Use the declaration placement Phase 5 decides.
- **Measure.** Score every hypothesis with `residualObjective.ts --dir` and
  report the residual change for each. A hypothesis that does not clear the
  located population difference is reported as refuted, not hidden.
- **Prep hook (cheap).** When an m2c draft accesses `S` at offset 0 through
  a pointer copy and the index finds an adjacent referenced label `P`, record
  "`S` may be `P`+k" as a discovery unknown in the packet.
- **Acceptance.** On the stuck ledger source
  `build/experimentLedger/sources/ovl_15_func_80134770/` (output
  `756accf7…`), the top hypothesis is `D_80140F10`, k = 4. Its variant
  reaches population 0, matching the words of `build/exp34770/w3.c`, without
  any `q - 1` construct.

## Phase 3: spelling-plateau escalation

- **Trigger.** Add a triage detector `spelling-plateau`, read from
  `build/experimentLedger/<fn>.jsonl`. It fires when at least 3 distinct
  `sourceHash` values share one non-exact `outputHash`.
- **Message.** "N sources produced identical words since <time>. The
  statements edited between them are not the lever; the residual's located
  site is X."
- **Routing.** It forwards to Phase 1's finding for that site. With no
  Phase 1 finding, it points at the type and declaration model generally.
- **Steering.** Wire it into the stuck protocol in
  `prompts/reference/stuck.md` and the autoloop checkpoint steer. The rule
  stays a general imperative there, with no function names.
- **Acceptance.** Replaying this function's ledger as of 04:03:14 fires on
  `756accf7` (13 sources).

## Phase 4: make the residual searcher reach the schedule half

Three independent defects kept `searchResidualSourceSpace.ts` from this
function's schedule residual:

- **4a. Eligibility gate.**
  - `GENERATED_GLOBAL` (`tools/agent/variant-lab/manifest.ts:127`) rejects
    any local `extern … D_XXXXXXXX`.
  - Restrict it to symbols a generated header actually declares, starting
    with `include/globals.h`.
  - Share one predicate with `sourcePolicy.ts`, which accepts this source
    today.
  - Test: the committed source passes. A source restating a `globals.h`
    declaration still fails.
- **4b. Field commutation for struct locals.**
  - `memoryEffectsConflict` (`topological-orders.ts:74`, the `?:` guard at
    `:81`) refuses object identity to a base with no value web.
  - A non-pointer struct local whose address is never taken has a certain
    identity anyway. Give it an object key in `semantic-graph.ts` so that
    distinct named fields commute.
  - Test: with the declarations in a side header and the natural field order
    (`build/34770_claude/srch/e_ysdw_1.c`), the domain grows from 7 to at
    least 24 orders and contains the exact one. Pointer bases with unknown
    webs still conflict.
- **4c. Base-before-index.**
  - The target needs `entries = D_801376E0; … &entries[arg0]`.
  - The existing `base-pointer-form` rule lifts shared addresses, but it
    reads symbol types only from the include path and needs two uses.
  - First measure whether 4a plus 4b let it emit this split.
  - If not, add the narrowest materialization: a global array base born as
    its own pointer statement before an index expression. Bound it like the
    other materialization sites.
- **Acceptance.** Starting from the population-correct but naturally ordered
  source, the searcher's exhaustive run contains an EXACT coordinate.

## Phase 5: declaration placement (owner decision)

- **The rule.** `configs/project-profile.md` says a data symbol's aggregate
  type goes in `include/globals_override.h`, never in a `.c` file.
- **The practice.** Overlay data has no generated header, and 50 of 62
  matched ovl_15 sources declare their overlay data locally. That includes
  this function's two `D_801376E0` siblings, which carry their own local
  `D_801376E0Entry`.
- **The decision.** Either:
  - amend the profile for overlay data; or
  - migrate shared overlay aggregates, starting with `D_801376E0` and
    `D_80140F10`, into the override header, deduplicating their typedefs.

This is filed, not adjudicated. Phases 2 and 4a follow whichever is decided.

## Sequencing

- Phase 1 comes first, then Phase 2.
- Phase 3 and Phases 4a and 4b are independent of Phase 1 and of each
  other.
- Phase 4c follows the 4a/4b measurement.
- Phase 5 is decided before Phase 2's rewrite emits declarations.

## Overall acceptance

Replay from the stuck source alone:

1. Triage reports `address-form: interior` on `D_80140F14` and fires
   `spelling-plateau`.
2. `aggregateHypotheses.ts` proposes `D_80140F10.Title` and measures it at
   population 0.
3. The searcher, on that variant, finds an exact coordinate.

`npm test` and `make check-all` pass.

## Out of scope

- Naming members beyond what the evidence supports.
- Inferring aggregate layouts from access patterns across many functions.
  This is a natural Phase 2 extension, but it is a separate plan.
- Any change to cc1 or maspsx.
