# Plan: the cascade class, donor evidence, and stall-shape signals

Written 2026-08-23, from the session that closed `ovl_10_func_800BA394`
(EXACT 479/479 after six parked sessions). The mechanism that solved it is
recorded in the function's closed-directions log and the retro
(`notes/retros/2026-08-23-ovl_10_func_800BA394-retro.md`). This plan is about
the harness: every fact the solution needed was derivable a day earlier from
artifacts the project already had, and nothing pushed any of it at the agent.
Six deliverables, each mapped to the specific miss it prevents.

---

## 1. What the harness let happen

The function sat for six sessions at two words, under a correct impossibility
proof with an unstated premise. The record shows four distinct harness gaps,
none of them about missing instruments — the loop trace and the emission model
existed and worked. The gaps are about what the instruments *say* and what the
triage layer *pushes*.

### G1 — the sibling's attempt was never read as evidence

`ovl_10_func_800B95F0` (same cluster, same preheader shape) had a preserved
attempt whose trace demonstrated, measured:

- the two-stage cascade: `Insn 1021 moved to 1058` — an insn *created by
  pass-1-inner* (UID ≥ `max_uid_for_loop`) re-hoisted by pass-2-outer into the
  outer preheader, landing after the pass-1 giv inits;
- a payload address pair living per-iteration in the inner loop as a
  standalone `%hi`/`%lo` pair, because its index is a two-register sum
  (`D_800BB90C[off + i]`) and the `%lo` cannot fold into the load;
- mult-1 givs with a compound add (`off + base`) reducing at benefit 8 into a
  step-1 walking pointer, while single-reg-add mult-1 givs decline at net 0.

The two functions' attempts were complementary halves — the sibling's payload
was already right and its `off` wrong; ours the mirror image. One trace run on
the sibling's attempt was the whole answer. The park notes said "whatever
closes one closes the other," and both sessions' agents read the sibling only
as a *beneficiary* of a future fix, never as a *donor* of measured mechanism.
Nothing in triage looks sideways at cluster members' artifacts.

### G2 — the emission model's reading enumeration is missing a class origin

`psx_target_loop_emission` types each preheader group against
`{source, p1-movable, p1-giv-init, p2-movable, p2-giv-init}`
(`tools/agent/loop-emission/types.ts`). The order model is right. What is
wrong is the *reachability* analysis behind readings: it assumes a
`Pass2Movable` must have existed in the outer loop through pass 1 and declined
there. Under that assumption the payload needed desirability product exactly
2, the forced pair floors at 4, and the closed-directions log concluded — in
so many words — "the target's payload pair is NOT a move_movables emission,"
which parked the function on a false dichotomy.

The missing origin: **an insn hoisted out of a nested loop by pass-1-inner is
skipped by pass-1-outer** (`scan_loop`'s movable recording skips loop-created
insns / regs ≥ `max_reg_before_loop`, and `loop_reg_used_before_p` cannot see
their luids) **and is a fresh movable for pass-2-outer**. That is a reachable
route to `Pass2Movable` with *no* product constraint at pass-1-outer, and it
is the route both targets in the cluster actually take.

### G3 — a phony loop silently voids a whole hypothesis family

Two variants this session failed with body-population explosions whose real
cause was `Loop from 1228 to 1314 is phony.` — gcse's PRE insertions landed
between `NOTE_INSN_LOOP_BEG` and the loop's entry jump, so `scan_start` was a
plain insn and `loop.c:740` discarded the loop unscanned. A phony inner loop
converts every per-iteration placement experiment into the already-refuted
outer-level regime, and converts every giv hypothesis inside it into a no-op.
The trace prints one quiet line (`loop-trace/render.ts:62`); nothing connects
it to consequences, and nothing names the trigger (the `&&`-form loop tail
lays the loop out with an entry jump; the break-form tail keeps a fallthrough
entry and the insertions land harmlessly before the note).

### G4 — impossibility records don't carry their premises, and the ledger
### can't say "you are in a valley"

Session 2's proof was conditional on an unmeasured threshold (fixed by
session 3's trace). Sessions 4–6's exhaustion was conditional on row-level
origination of the payload (fixed by this session). Both rows entered the
closed-directions log as unconditional CLOSED facts, and later sessions
correctly refused to re-run them. Separately: the ledger's best key sat at 2
words with every measured neighbour 10–90 words worse — the signature of a
multi-coordinate valley that one-axis sweeping cannot cross (the solution
needed index arity, no source walker, no source index, doubled giv spelling,
and tail form *simultaneously*) — and the `STALLED` line
(`.pi/extensions/psx-decomp/autoloop/prompts.ts:90`) counts measurements
without ever describing this shape or routing away from sweeps.

---

## 2. Deliverables

Ordered so the small, immediately-protective pieces land first. D1 and D2
depend on the loop-trace and loop-emission trees, which are still uncommitted
working-tree implementations of `plans/loop-pass-observer.md`; that work must
be committed first.

### D1 — phony-loop consequences (small; `loop-trace`, `triage`)

1. `loop-trace/parse.ts` already sets `phony`. Extend the record with the
   *cause* when it is determinable from the dump the tool already reads:
   whether real insns sit between the `NOTE_INSN_LOOP_BEG` and the first
   label/jump (gcse insertion), or the entry jump's target is out of range.
2. `loop-trace/render.ts`: promote the line to a warning that states the
   consequence — the pass never scanned this loop; movable/giv reasoning
   inside it is void — and the known antidote when the cause is the entry-jump
   layout (fallthrough entry; in source terms, a break-form tail instead of a
   `&&` compound tail).
3. New triage detector `phony-loop` in `tools/agent/triage.ts`: when the
   residual's next block belongs to (or is the preheader of) a loop nest whose
   candidate trace marks an enclosed loop phony, emit a **blocker**-level
   finding. Reuse the cached trace under `build/loopTrace/<fn>` when inputs
   are unchanged; otherwise run the trace (it is one compile).
4. Test: a fixture pair — the `&&`-tail and break-tail spellings of the same
   grid loop — asserting phony flips and the detector fires only on the first.
   `loop-trace/test-fixtures/` already holds a real `.loop` fixture to extend.

### D2 — the cascade, as a first-class origin (medium; `loop-emission`,
### `loop-trace`)

1. `loop-trace`: report cascades explicitly. The parser already has per-pass
   loop records with moved-to UIDs; add a synthesis step that joins pass-1
   inner-loop moves against pass-2 outer-loop movables whose insn UID is
   pass-1-created, and prints:
   `cascade: <expr> — pass-1 loop A..B hoisted it to the outer body; pass-2
   loop C..D re-hoisted it to the preheader (after pass-1 giv inits)`.
2. `loop-emission/derive.ts`: when enumerating which source shapes can
   produce a `Pass2Movable` group, add the inner-origin route with its own
   eligibility: the value is computed per-iteration inside a nested loop,
   its movable is desirable at the *inner* bar, and pass-1-outer never
   re-evaluates loop-created insns. Readings that today come back "no reading
   holds together" or demand an impossible product must instead surface this
   route with its source-side requirements (per-iteration occurrence;
   two-register-sum index if the value is an address, so the `%lo` cannot fold
   into a load; non-phony inner loop — cross-reference D1).
3. `loop-emission/precedents.ts`: register the two solved/parked cluster
   shapes as precedents for the route so `compare.ts` can cite a measured
   instance instead of a hypothesis.
4. Tests over the existing fixtures: the reading enumeration for the
   `ovl_10_func_800BA394` target preheader must now include exactly one
   consistent reading, and it must be the cascade one.

### D3 — cluster-donor triage detector (medium; `triage`, reads
### `notes/file-groupings.md`, ledger, loop-trace)

New detector `cluster-donor`, push not search
(`project_knowledge_retrieval_design`):

1. Resolve the target's suspected group from `notes/file-groupings.md`.
2. For each sibling with a matched source or a preserved parked attempt,
   obtain its loop trace (cached or one compile) and extract the mechanism
   set it demonstrably reaches: pass-2 movables and their landing class,
   cascades (per D2), reduced givs with their mult/add shape and benefit,
   giv combinations.
3. Diff that set against (a) the target's requirement — the emission-class
   reading of the residual's block, when the reversal attributes the residual
   to the loop pass — and (b) the mechanism set across the *target's own*
   measured candidates (from the ledger's distinct programs, bounded: trace
   only the best row per distinct key, and only when a cached trace exists or
   the row's source file is still present).
4. Emit a finding when a sibling demonstrates a mechanism the requirement
   names and no candidate of the target has ever reached: name the sibling,
   the mechanism, and the sibling source lines that produce it.
5. Budget honestly: cap at the group's members, skip silently when no group
   is recorded, and report "undetermined" rather than guessing when a
   sibling's attempt no longer compiles
   (`feedback_tools_correct_over_convenient`).

Acceptance is live: `ovl_10_func_800B95F0` is still parked at `[0,0,1,0]`
with its `off` as a source variable where its target derives it. Triage on it
must surface `ovl_10_func_800BA394`'s now-matched source as the donor for the
derived-offset giv-init mechanism.

### D4 — reference-sheet imperatives (small; `prompts/reference/loop.md`,
### `prompts/reference/population.md`)

General imperatives only, mechanism not anecdote
(`feedback_doctrine_no_anecdotes`); the named case stays in the retro.

Into `loop.md`:
- Type every preheader insn by emission class before choosing a reading; an
  insn positioned after a giv init cannot be a source statement, so a
  "obviously source" init sitting there proves the variable is
  compiler-created.
- The final body's induction variables are not evidence of source variables:
  a walking pointer or a counter can be a strength-reduce product. Apply the
  position test above before writing either into the source.
- Giv benefits sum when identical givs combine; an expression that declines
  as one occurrence (mult-1, single-reg add: benefit 4 − add_cost 4 = 0) may
  reduce as two. Spelling the same expression in two consumers is a lever,
  not a redundancy.
- Emissions of an inner loop's pass-1 scan are invisible to the outer pass-1
  scan and fresh for the outer pass-2 scan; a pass-2 movable needs no
  pass-1-decline story if it originates in a nested loop.
- A phony loop (`is phony` in the dump) is never scanned; check for it before
  reasoning about any per-iteration placement, and prefer fallthrough-entry
  loop tails when gcse insertions are implicated.

Into `population.md`:
- On MIPS, index arity decides address-materialisation form: a one-register
  index folds the `%lo` into the load (single `high` movable); a
  two-register-sum index forces a standalone `%hi`/`%lo` pair. The choice of
  index spelling is therefore a population *and* placement lever.

### D5 — premises on closed-direction rows (small; `closedDirections.ts`)

1. Schema v2: optional `conditionalOn?: string` on `ClosedRow`; CLI flag
   `--conditional-on`; render as a `conditional on:` line directly under the
   verdict. Old rows remain valid (versioned, as the experiment ledger already
   does for its own v1 rows).
2. Behavioural nudge, not a gate: recording a `closed` verdict whose question
   is a reachability/search-space claim without `--conditional-on` prints a
   one-line reminder that an impossibility is conditioned on its inputs.
3. One sentence in the skill's stall section
   (`.pi/skills/psx-decompile-function/SKILL.md`): record the premise with
   the closure; a later session should attack the premise, not the proof.
   While editing, add the donor imperative to stall step 2: a cluster
   sibling's *attempt trace* is author-side evidence of which mechanisms are
   reachable, and reading it costs one compile.

### D6 — valley signal in the ledger (small; `experimentLedger.ts`,
### `autoloop/prompts.ts`)

When rendering the ledger summary (and the autoloop's `STALLED` line), detect
the valley shape: best key within N words of exact (N ≤ 4) while every other
distinct measured key is worse by a large margin (no second key within, say,
3× the best's total). Print one advisory line: the best is isolated; single-
coordinate respellings are unlikely to cross; take the next experiment from
the requirement side (`psx_target_loop_emission` reading, or a D3 donor
finding) rather than from another sweep. This is a rendering change only — no
new state.

---

## 3. Definition of done

- `make test` green including the new fixtures; no hand-edited generated
  files; all tooling TypeScript under `npx tsx`.
- D1: the `&&`-tail fixture yields a phony record *with cause*, the render
  warns with the consequence, and triage raises a blocker for a residual
  inside it; the break-tail fixture yields none of the three.
- D2: `psx_target_loop_emission` on `ovl_10_func_800BA394`'s target bytes
  reports the cascade reading as consistent, citing the registered precedent;
  the loop trace on the matched source prints the cascade line.
- D3: `psx_triage ovl_10_func_800B95F0` surfaces the cluster-donor finding
  naming `ovl_10_func_800BA394` and the derived-offset mechanism.
- D4/D5: sheets and skill updated; a `closed` row recorded with
  `--conditional-on` renders the premise; the ledger header shows it.
- D6: replaying the pre-solve ledger for `ovl_10_func_800BA394` (it is on
  disk, `build/experimentLedger/ovl_10_func_800BA394.jsonl`) renders the
  valley advisory.
- The real acceptance test, run once the above land: a fresh session pointed
  at `ovl_10_func_800B95F0` with only the standard skill should be pushed to
  the donor + cascade reading by triage alone, without rediscovering any of
  it. Its solve (or failure to) is the measure of whether the distillation
  worked.

## 4. What this does not do

- No auto-application of donor recipes: the detector names evidence; the
  agent still authors and measures the source.
- No changes to the desirability model beyond the new origin route — the
  threshold/decay/moved_once arithmetic validated this session stands as is.
- No `-freduce-all-givs` or other flag work; the cluster matched under
  baseline flags and the flag-probe evidence bar is unchanged.
- No Layer-2 knowledge index; D3 stays within the established push-detector
  design.
