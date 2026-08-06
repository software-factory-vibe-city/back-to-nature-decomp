# Plan: residual classification and ranking

**Status: proposed, and blocked on an unsolved soundness problem.** Do not
build this as specified. The ranking idea is right and the mechanism for
computing it is not yet sound; section "The problem" states exactly what has to
be settled first. Recorded now so the idea is not re-derived from scratch, and
so the next attempt starts from the objection rather than from the pitch.

Owner constraint that produced this status: *a tool whose output gets cited in
research notes must not be able to be wrong.* An advisory ranking that is
usually right is worse than no ranking, because a wrong "UNREACHABLE" ends a
search that should have continued, and a wrong "OPEN" restarts one that was
correctly closed.

## Purpose

Replace match count as the comparator between two candidate builds.

`diffFunc` scores, `explainDiff` classifies one diff, and nothing compares two.
So comparison falls back to "which scored higher", which is hill climbing, and
hill climbing cannot cross a valley. `func_80016C08` sat in that valley for
three sessions: baseline 353/357 with a residual later proved unreachable,
against `-mno-split-addresses` at 346/357 whose entire residual was a
permutation of five spill slots. Both numbers were in the research note on
2026-08-03; the lower one was the finished function.

Full account: `notes/retros/2026-08-06-func_80016C08-retro.md`, sections 3.3
and 4.

## What it would compute

For a candidate build, defect **groups** rather than mismatched instructions,
each with a mechanism class, the size of its outcome space, its known levers,
and a reachability verdict. Then rank lexicographically — semantic groups,
allocation groups, reachability, log(space), and **exact instruction count
last, as a tiebreaker only**.

On the motivating case that prints:

```
baseline              1 group | address-materialization | space unbounded
                              | levers none | UNREACHABLE (pre-anticipatable-high)
-mno-split-addresses  1 group | spill-slot-permutation {72,76,80,84,88}
                              | space <= 120 | levers [pseudo-numbering] | OPEN
```

and ranks the override first on reachability, without consulting the score.

## The problem

Three of the four computations are sound. One is not, and it is load-bearing.

| computation | status |
|---|---|
| alignment | **sound.** `residual-source-search/align.ts` already closes the four assembler/linker stage differences exactly and aligns the rest by LCS. |
| class | **sound.** A mechanical property of the differing operand fields; `explainDiff` already classifies at this granularity. |
| reachability | **sound where a lemma exists, silent otherwise.** A lemma is a proof read out of the vendored compiler source. The honest third verdict `UNKNOWN` is not "reachable". |
| **grouping** | **not sound.** This is the blocker. |

Grouping decides that N mismatched instructions share one cause and are
therefore one defect. That is a *hypothesis about causation* inferred from
*syntactic coincidence* — that the differing fields form a permutation, or that
the differing registers belong to one web. Neither implies a shared cause.

It fails in both directions, and both failures are silent:

- **Over-grouping.** Two unrelated defects whose operands happen to form a
  permutation are reported as one defect of finite size. The tool then says
  "space <= 120" about a problem that is not a permutation at all, and a
  session spends itself enumerating 120 candidates that cannot contain the
  answer.
- **Under-grouping.** One cause with heterogeneous effects — a reload decision
  that moves a slot *and* changes a register *and* enables a scheduler move —
  reads as three defects. The candidate is then ranked below a rival with one
  genuinely harder defect.

Neither is detectable from the diff. Both change the ranking, which is the only
output anyone would act on.

The ranking's own arithmetic inherits this. "Fewer groups is better" is only
meaningful if a group is a cause; over grouped input it is a count of
coincidences. So the defect does not stay contained in one column.

Two further soundness debts, smaller but real:

- **Space size is an upper bound presented as a size.** 5! = 120 assumes every
  permutation is attainable. Only the ones reload can actually produce are, and
  the tool has no way to know which. Reporting `<= 120` is honest; ranking on
  `log(120)` quietly treats the bound as the value.
- **`UNKNOWN` has no defined rank.** Placing it between `OPEN` and
  `UNREACHABLE` is a guess about an unmeasured thing. With two lemmas in the
  library, nearly every real residual is `UNKNOWN`, so the guess decides almost
  every comparison.

## What would have to be true

Directions, not a design. Each needs to be tried against real stuck functions
before anything is built.

1. **Derive grouping from the compiler, not from the diff.** Two mismatches
   share a cause if they trace to one decision in the dumps — one reload
   action, one allocation of one quantity, one scheduler move.
   `compilerTrace.ts` already parses all 16 stages, and `.greg` names the
   pseudo behind each slot. A grouping that cites a decision is a claim about
   the compiler; a grouping that cites a permutation is a claim about
   arithmetic. Only the first can be checked.
2. **Make grouping falsifiable by intervention.** If two mismatches share a
   cause, a perturbation that moves one moves the other. The variant harness
   can run that check. A group that survives an intervention test is evidence;
   one that has never been tested is a hypothesis and must print as one.
3. **Consider refusing to rank.** A tool that reports typed residuals with
   citations and declines to order them may be the whole answer. The retro's
   claim is that the *residual class* was the missing information, not that a
   scalar ordering was. A human reading "unbounded, no lever, proved
   unreachable" against "five slots, one known lever" does not need the tool to
   do the comparison — and cannot be misled by a wrong one.
   **This is the most likely correct answer.** Prefer it unless (1) and (2)
   both work out.
4. **Ship the lemma library first, separately.** Reachability is sound on its
   own and is the half that closed `func_80016C08`. It does not depend on
   grouping and should not wait for it. See below.

## What was built instead

`tools/vendor/gcc-2.95.2-psx/` — the exact patched source cc1 is built from,
hash-pinned — and `tools/agent/compilerSource.ts` to search it. That is the
substrate every lemma needs: `want_to_gcse_p`, `QTY_CMP_PRI`, `alter_reg`, and
`movsi_internal2` are now one command away and citable by file and line.

The lemma library itself is the next increment, and it is unblocked. Seed it
with the two this function proved:

| lemma | statement | condition | escape hatch |
|---|---|---|---|
| `pre-anticipatable-high` | an expression `want_to_gcse_p` accepts, computed on every iteration, is always hoisted under `-fgcse` | access is unconditional in the loop | the access is conditional |
| `reload-remat-dest` | reload never selects the load's destination register for a rematerialization | the value is a remat, not an allocated quantity | the value stays local to the loop |

Each lemma must carry the price of testing its escape hatch. §16's hatch cost a
whole other decompilation (`func_800165D8`, 206/360, prologue divergence) and
nothing forced that number to be written next to it; three sessions went into
the branch. A lemma that states its escape hatch without its price reproduces
the same failure.

## Constraints on any future attempt

- It must not become a match-percentage hill climber under a new name. If the
  ranking ever agrees with score ordering by construction, it has no content.
- It must not report a grouping it cannot attribute to a compiler decision.
- `UNKNOWN` must never be presented as, or ranked as, reachable. Silence is not
  a certificate.
- Every verdict must cite a file and line in the vendored compiler source, so a
  reader can check it the way §19.5 was checked.
