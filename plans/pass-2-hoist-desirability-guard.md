# Plan: a mechanical guard for pass-2 hoist residuals

**Status: proposed 2026-10-09.** This follows the match of
`ovl_11_func_800F9BE4`, recorded in
`notes/retros/2026-10-09-ovl_11_func_800F9BE4-retro.md`.

## The theme

A loop-preheader residual can come down to one loop-invariant constant that
the target emits in loop pass 2 and the candidate emits in pass 1. The
decision is `move_movables`' desirability test, `loop.c:1837`:

    threshold × savings × lifetime  >=  insn_count      (×2 if moved_once)

Both sides are properties of the **pass-1 loop body**, before anything is
hoisted:

- `insn_count` counts the loop's instructions at that point;
- `threshold` starts at 58, or 29 in a loop with a call, and loses 3 for every
  movable moved ahead of this one in loop order.

Invariant work in the pass-1 body raises `insn_count` and, once hoisted,
lowers `threshold`. It then merges into the preheader and leaves no trace in
the final loop. So the source can control a pass-2 hoist through code that
never appears in the target's loop.

The previous session got the requirement right but had no tool for the
remaining steps:

1. **Deriving the requirement.** `psx_target_loop_emission` stated no goal for
   this function. The prologue saves that sched2 places at the end of the
   preheader pinned every earlier group to `source`. The candidate's
   preheader was never matched to its loop trace. The requirement was derived
   by hand.
2. **The distance to a flip.** `psx_loop_trace` printed each comparison
   ("threshold 52, needs product >= 1, has 1 -> moves"). It did not say how
   far the source was from flipping it, or which source quantities move each
   side.
3. **The source move.** Nothing listed the in-loop sites whose spelling
   changes the pass-1 body without changing the final program. In this case
   the move was reaching a global directly versus through a local copy of its
   address.
4. **The closure.** The session recorded "not source-reachable", conditional
   on the target's identical loop body. That condition holds only *after*
   hoisting, so the row closed a direction that was open.

## Design principle

When the target requires a decision to flip, the tool should say three
things, in the source's terms:

- the inequality the flip needs;
- how far the current source is from satisfying it;
- the finite set of source sites that move each side.

It should then measure those sites rather than predict them. A loop-pass
quantity used as a premise is a property of the source the pass ran on, and
the record must say so.

## Phase 1: derive the requirement from the target

Make `tools/agent/loop-emission/derive.ts` produce a goal for this function's
preheader.

- **1a. Drop the prologue and epilogue.**
  - Treat these as outside the emission sequence, with a caveat:
    - the frame adjustment (`addiu sp,sp,-N`);
    - callee-save stores (`sw ra/sN,k(sp)`) in a preheader block;
    - their epilogue counterparts.
  - Take the frame facts from the reader the `frame-map` triage detector
    already uses, not from register-name heuristics.
  - The prologue expander emits them and sched2 places them; loop.c never
    does.
  - Today `roleOf` classes them `effectful`, admits only `Source`, and the
    non-decreasing sequence then forces every earlier group to `Source`.
- **1b. Order only the leaves.**
  - The old `sched.c` walks the block backward and sorts ready instructions by
    LUID. A chain is pulled next to its consumer when it becomes ready
    (`adjust_priority` / `birthing_insn_p`).
  - Only leaves therefore carry emission-order evidence. A leaf is a group
    with no consumer in the block.
  - A non-leaf group is constrained only to be no later in class than its
    consumer.
  - Without this rule, a source-statement base address pulled up next to a
    giv init reads as a pass-2 movable.
- **1c. Match the candidate's preheader to its loop trace.**
  - On this function, `compare.ts` reports "no loop in the trace could be
    joined to it".
  - It also reports "3 hoist(s) in this program carry no resolvable symbol".
    The two constants (`li t0,8`, `li a3,17`) carry no symbol at all.
  - Match constants by value, and giv inits by step, multiplier and add value.
  - Confirm that this is the cause before fixing it.
- **1d. Conditional goals.**
  - When the candidate assigns the target's induction-init leaves to giv-init
    classes, state the goal given that assignment. For example: "GIVEN `a0`
    and `a1` are pass-1 giv inits, as in your program, `li a3,17` must be a
    pass-2 movable".
  - List the other reading (the induction values are source variables) with
    any ledger measurements that refuted it.
- **Tests** (fixtures from `build/9be4_claude/`):
  - On the prior best (`prior_best.c`):
    - goal `17: pass-2 movable` is NOT MET;
    - goal `8: pass-1 movable` is MET;
    - the triage `loop-preheader-order` finding carries a `REQUIRED of the
      original` line.
  - On the committed source both goals are MET.
  - Existing `loop-emission.test.ts` cases still pass, and a preheader with no
    prologue stores is unchanged.

## Phase 2: desirability slack, the gradient

In `tools/agent/loop-trace/threshold.ts` (`movableMargins`), for each Phase 1
goal that requires a flip:

- **Print the target inequality** for the movable that must flip and for
  every movable whose decision must hold, in source-side terms:
  - `T0 − 3·m_before(i)`, where `m_before` counts the moved groups ahead of
    movable `i` in loop order;
  - `savings_i`, `lifetime_i` and the `moved_once` doubling;
  - pass-1 `insn_count`.
- **Print the slack.** For the prior best:
  - insn 95 (17) needs `N > 52·1·1` and has `N = 34`, so it is short by 19;
  - insn 53 (8) must keep `55 ≥ N`, a headroom of 21.
- **Name the window.** The window is the stretch, in loop order, between the
  last movable that must still move and the movable that must decline. Map it
  back to source lines using the trace's line map, `loop-trace/lines.ts`.
- **Name both knobs, with their measured unit effects:**
  - a moved invariant group placed in the window costs the threshold 3 and
    adds its instructions to `N`;
  - an instruction added anywhere in the pass-1 body adds 1 to `N`.
  - Matching movables merge and absorb savings, so the arithmetic is a target
    for Phase 3, not a prediction of it.
- **Teach the doctrine.** Add the general imperative to
  `prompts/reference/loop.md` §5, with no function names: "a movable the
  target emits in pass 2 and yours in pass 1 is a desirability flip. Both
  sides of the test belong to the pass-1 body, so change the invariant work
  inside the window".
- **Tests:**
  - On a fixture loop dump of the prior best, the slack lines read 52 against
    34 and 55 against 34.
  - On the committed source, 43 < 44 and 52 ≥ 44.
  - On the all-global variant, insn 56 (the 8) declines at 46 < 48, which is
    the wrong flip. The tool must report it as violating a must-hold goal.

## Phase 3: hoist-knob sweep, the source move

Add `tools/agent/hoistKnobSweep.ts <fn> [--source path] [--max 64]` and a Pi <!-- doc-ref-ignore: proposed -->
tool `psx_hoist_knob_sweep`, registered from `diagnostics.ts` under
`.pi/extensions/psx-decomp/tools/` beside `psx_loop_trace`.

- **Sites.**
  - Use tree-sitter, with no regex.
  - Enumerate expressions inside the loop that reach an invariant base:
    - access through a local that is a pure copy of a global's address,
      assigned once before the loop and never reassigned
      (`base->f`, `base[i]`);
    - direct access through the global (`((T *)G)->f`, `G.f`, `G[i]`).
  - Each site has two semantics-preserving spellings: through the local, or
    through the global.
- **Domain.**
  - Use the sites inside the Phase 2 window, plus those ahead of it, since
    they move the must-hold movables.
  - Take their full product when it is at most `--max`. Otherwise sample, and
    print the coverage as a sampled fraction. A sampled run is never reported
    as exhaustive.
- **Measure.**
  - Compile each variant with `-dL` and read the goal movables' decisions
    from the loop trace.
  - Score it with `residualObjective.ts --dir`.
  - Sort by goals met first, then by residual, not by word count.
- **Report.** For each variant, print:
  - its decision vector, e.g. `8:p1 17:p2`;
  - `N` and the thresholds;
  - its residual key.
- **Triage routing.** When Phase 1 yields a flip goal, the
  `loop-preheader-order` finding names `psx_hoist_knob_sweep` and the window
  as the next step.
- **Acceptance.**
  - On `prior_best.c`, with the old view typedef inlined and the slot view
    applied, the sweep enumerates the 16 per-read choices.
  - It returns exactly two EXACT variants, with all goals met. Their shapes
    are `m05` and `m10` (`build/9be4_claude/v2/`).
  - The all-global variant is listed with goal 8 NOT MET.

## Phase 4: guard against closures with a false premise

In `tools/agent/closedDirections.ts` and its renderer:

- **Classify.** A closure whose tool is `psx_loop_trace`, or whose result
  cites `insn_count`, the threshold, moved movables, `savings` or `lifetime`,
  is classed as a **source-side premise**.
- **Record and render.**
  - Store the source hash it was measured on.
  - In the ledger's CLOSED DIRECTIONS block, print it as `OPEN PREMISE` with
    the line: "these counts belong to source <hash>'s pass-1 body. A source
    whose pass-1 body differs can still reach the same final loop. Attack the
    counts, not the inequality."
- **Retire the row.** When Phase 3 has run over that source's window with no
  goal-meeting variant, the row may be recorded as closed, conditional on the
  window and the site set that were searched.
- **This is a label, not a veto.** The tool records and renders what it can
  prove. It does not refuse a closure.
- **Acceptance.**
  - Replaying the 16:03:18 `psx_loop_trace` row of
    `build/experimentLedger/closed/ovl_11_func_800F9BE4.jsonl` through the
    classifier tags it `OPEN PREMISE`, naming `insn_count 34` and two moved
    groups.
  - A `psx_residual_objective` closure is unaffected.

## Related defect: `loop-nesting` evidence

`detectLoopNesting` (`tools/agent/triage.ts:1526`):

- **The defect.** It finds a nested pair correctly. Its evidence then slices
  the instructions between the first two headers in address order, not
  between the outer and inner header of the pair that nests. With two loops
  in sequence before a nested one, it lists the first loop's body as
  "invariant in inner loop".
- **The fix.** Slice between the nested pair's headers.
- **Test.** Use this function's target:
  - outer `0xA4`, inner `0xE8`;
  - no instruction below `0xA4` listed.

## Sequencing

- Phase 1 comes first, because Phases 2 and 3 key on its goals.
- Phase 2 and the `loop-nesting` fix are independent of each other.
- Phase 3 needs Phase 2's window.
- Phase 4 needs only Phase 3's result format.

## Overall acceptance

Starting from `build/9be4_claude/prior_best.c` alone:

1. Triage reports the `loop-preheader-order` goal `17: pass-2 movable` NOT
   MET, with the slack and the window.
2. `psx_hoist_knob_sweep` returns an EXACT variant.
3. The previous session's loop-trace closure renders as `OPEN PREMISE`.

`npm test` and `make check-all` pass.

## Out of scope

- The other routes to a pass-2 emission: the nested-loop cascade
  (`prompts/reference/loop.md` §3.1) and invariance that exists only in
  pass 2. Phase 1 lists them as alternative routes, but this plan builds the
  sweep only for the decline-at-pass-1 route.
- Knobs other than the access route, such as extra non-hoisted statements in
  the loop to raise `N`. These change the final program, which the target
  forbids.
- Any change to cc1.
