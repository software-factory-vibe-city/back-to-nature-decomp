# Implementation Record — Matching Reconstruction Model Completion

Date: 2025-07-17
Session: Full D1-D7 implementation in one sitting.

## Files changed across all deliverables

### New files
- `tools/agent/matching-reconstruction/idioms.ts` — constant-divisor recognition (D2)
- `tools/agent/matching-reconstruction/idioms.test.ts` — 11 tests (D2)

### Modified files
| File | D1 | D2 | D3 | D4 | D5 | D6 | D7 |
|---|---|---|---|---|---|---|---|
| `types.ts` | ✓ | | ✓ | ✓ | | ✓ | ✓ |
| `decode.ts` | ✓ | | | | | | |
| `exec.ts` | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ |
| `effect-construct.ts` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `construct.ts` | | | | ✓ | | ✓ | |
| `fixture-asm.ts` | ✓ | | | | | | |
| `engine.ts` | | | | ✓ | | | |
| `decode.test.ts` | ✓ | | | | | | |
| `exec.test.ts` | ✓ | | ✓ | ✓ | | ✓ | |
| `benchmarkReconstruction.ts` | ✓ | | | | | | |
| `diagnostics.ts` | ✓ | | | | | | |
| `notes/tools-directory-structure.md` | ✓ | | | | | | |

## Test progression

- Start of session: 53 tests → 8 exact candidates
- End of session: 68 tests → 8 exact candidates (3 expected unresolved preserved)
- Total new tests: 15 across all deliverables
- All unit tests green, development gate green throughout

## Key insights and traps (log for future implementers)

### General traps
1. **Discriminated unions require a `kind` discriminant on every member.** When introducing `Effect = StoreEffect | CallEffect`, StoreEffect needed `kind: "store"` added — otherwise TypeScript can't narrow by `effect.kind`.
2. **`tsc` and `tsx` have different target capabilities.** `tsc --noEmit` rejects BigInt literals targeting ES2020+ on pre-ES2020 settings, but `tsx` runtime handles them fine. Accept this discrepancy.
3. **`canon()` reads `expr` not `normalized` after normalization.** When we added normalization logic to `canon` (add/sub simplification), the switch cases still referenced the original `expr` — need to use `normalized` consistently.

### D3 traps
4. **Indexed groups need separate treatment in `buildStorageMap`.** The existing group iteration assumed every cell in a group shared the same base expression. Indexed groups add a `[expr*scale]` suffix to the group key, so they must be split into indexed vs plain before the main group processing loop.
5. **Atom keys for `collectAtoms` must include the index canon.** Without the index in the dedup key, two loads at the same offset with different indexes would collapse incorrectly.

### D4 traps
6. **`eq` comparator canon normalization swaps operands.** `canonPredicate` sorts `eq` operands by canonical string, so `eq(#0, sltU(...))` becomes `eq(sltU(...), #0)`. The dispatch merge detection (`findSltU`) handles both orderings now.
7. **The DAG retains the bounds test above a dispatch node.** The merge into a C `switch` with `default` happens at C emission time in `emitNode`, not in the executor. The executor faithfully represents the machine's test+dispatch structure.

### D5 traps
8. **`binary()` simplification affects canonical identity.** Adding `add(X,#0)→X` to `binary()` means `binary("add", state.regs[sp], constExpr(0))` now returns the sp atom directly. This breaks frame-balance detection if `canon()` normalization wasn't already doing this — the canon change (normalization at canon level) needs to match.
9. **Sp-stores must be filtered in every effect-processing loop.** The guarded constructor had its own copy of the store-cell-collection, effect-key, common-prefix, and body-emission loops — all need sp-filtering.

### D6 traps
10. **`jalr` reads `rs` explicitly.** Unlike `jal` which is always a direct call, `jalr` has `rs` as a source register (the callee address) — liveness and clobber/uses must reflect this.
11. **Call invalidation of memory groups.** A call invalidates every non-`@sp` memory group (the callee may write anything). `@sp` is preserved *unless* an argument passes a local address (stack arg), in which case `@sp` is also invalidated.
12. **`stateKey` must include call effects in the effect log key.** Without that, two paths with different call sequences would erroneously merge.

## D7 detailed implementation

### Files changed in D7
- `types.ts` — Added `"iv"` SymExpr variant, `loop` DagNode (kind, induction, guard, exit, body), `LOOP_BACK` sentinel
- `exec.ts` — 128+ new lines:
  - `canon` for `iv` → `IV(register,delta)`
  - `arena.continueRef()` — sentinel continue marker leaf
  - `arena.loop(induction, guard, exit, body)` — loop DAG node factory
  - `replaceSentinel(ref, sentinelRef, replacementRef)` — walks DAG replacing sentinels
  - `classDescendants(ref)` — classifies DAG arm into hasBack/hasLeaf categories
  - `detectAffine(pc, prev, current, liveWords)` — finds constant register deltas
  - `buildLoopNode(pc, state, deltas)` — main entry point, calls fallback
  - `buildLoopNodeFallback(...)` — explores one iteration with IV, classifies body vs exit
  - `firstStateAtPc` tracking per-pc for detectAffine
  - Control-PC guard: skip detectAffine at branch/jump instructions
  - Back-edge detection: `j` and branch handlers check backward targets within loop context
  - `splitAddress`/`splitIndexedAddress` accept `iv` as valid pointer base
- `effect-construct.ts` — 
  - `baseDepth` handles `iv` (depth 0 like entry)
  - `argumentUses` skips `iv` (not a value use, it's a pointer base)
  - `buildStorageMap` handles IV bases via `effectiveBase` (maps IV → entry register)
  - `walk()` in `constructGuardedCandidates` traverses loop guard, exit, and body sub-DAGs
  - `emitNode` handles `loop` nodes: emits `while` with inverted guard, reformats body with continues, appends return from exit leaf
  - `emitBodyRecursive` traverses body DAG, emitting `continue` for markers, `return` for exit leaves
- `construct.ts` — Added `"!"` to unaryop, `"continue"` and `"while"` to CStmt, rendering support

### Key realizations
1. **The sentinel guard is at a different address than the loop head.** `func_80017F30`'s head (where `detectAffine` fires) is at 0x80017F48, while the sentinel guard (beq t0, 0xFFFF) is at 0x80017F38. The initial `j` entry skips the guard entirely. This means the sentinel condition does NOT appear in the body DAG from head exploration.

2. **IV substitution creates separate atom groups.** The group key `IV(a0,2)` is distinct from `@a0`. `buildStorageMap` handles both via `effectiveBase` mapping, but the accessor generation treats them as separate groups with the same underlying register.

3. **`classDescendants` handles complex LOOP_BACK distribution.** When both arms of a test contain LOOP_BACK (one directly, one mixed with exits), the function identifies which arm has ONLY back-edges (pure body) and which has real exit leaves.

4. **IV is not a value use.** Counting `IV(a0,2)` as a "value use" of a0 in `argumentUses` conflicts with a0 being a pointer param. Fixed by skipping IV in argumentUses.

### Remaining work for func_80017F30
The function produces a decision tree with sentinel checks and loop nodes nested inside. For full reconstruction:
- The loop guard (sentinel check) needs to be SYNTHESIZED as the while condition
- The `findGuard` approach needs the state at the guard, not from the head
- Alternative: detect the sentinel pattern from load-at-offset-0 compared against 0xFFFF

### D7 rework (second session — corrections to the above)

The first-session D7 above did not typecheck (12 errors across the loop node
shape, the emitter, and the effect union in the tests) and its loop DAG carried
a peeled first iteration, which no plain-loop source reproduces. The
`guard`/`exit`/`body`/`classDescendants`/`findGuard`/`replaceSentinel` design
was replaced with a simpler, sound one:

- **Restart-on-detection.** Affine detection fires at the *second* arrival at
  a head, by which point iteration one is already unrolled into the DAG. On
  detection the executor throws `RestartWithLoop(head, deltas)` and
  `executeFunction` re-runs the whole exploration with that head recorded, so
  the loop is summarized at its *first* arrival — no peeled iteration, ever.
- **Loop-head normalization.** The detected pc is usually mid-tail; the real
  body start is the unique cycle entry (the SCC node with an out-of-cycle
  predecessor), computed from `buildSuccessors`/predecessors. This is what put
  the sentinel test inside the summarized body instead of before it.
- **Back-edge = return to the head.** Inside a loop context, reaching the head
  again ends the iteration (→ `LOOP_BACK`); every other backward branch (the
  rotated tail with its exit check) is followed, keeping the exit test in the
  body. The `< pc` heuristic was wrong for rotated loops and is gone.
- **The `loop` DAG node is just `{ induction, body }`.** Advances live in the
  induction list, realized by the constructor as the `for (;; step)` clause
  (or, on the `trailing` axis, as statements after an in-body exit test) so
  every continue path applies them exactly once. Body purity is enforced: a
  store or call inside a symbolic-bound loop is refused, not approximated.
- **Constructor axes for loops:** result-variable-and-break exits, a
  wide/narrow variable pair for a re-masked load (the sentinel tests the wide
  copy — evidenced by `maskWitnesses`), join-factoring for shared tails, and
  step-vs-trailing advance placement.

**Result:** `func_80017F30` moved from a hard `unsupported-target` ("not a
fixed-stride scan") to a clean, correct loop candidate at **15/22 words**
(`domain-exhausted`). The remaining residual is a compiler loop-rotation
choice — cc1 rotated the natural `while(1){ v=*a; …; if(v==0xFFFF) break;
a++; }` so the sentinel tests the *previous* iteration's saved raw value at
the top. That is a scheduling/rotation difference the byte oracle judges, not
a source-expressivity gap this grammar closes; it stays `unresolved` in the
development set, honestly. All 68 unit tests pass and the whole engine
typechecks.

### Remaining D7 work (genuinely open)
1. **Loop-rotation source forms** (`do/while`, carried-previous-value) for the
   `func_80017F30` class — the last mile on that function.
2. **Counted-scan `for (i = 0; i < N; i++)`** for explicit-counter inductions.
3. **Accumulator loops** (a body register whose delta is a loop-varying load).
4. **Body stores** — currently refused; needs per-iteration effect summaries.