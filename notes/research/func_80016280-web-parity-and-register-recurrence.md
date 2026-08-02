# func_80016280 — Web Parity and Register Recurrence

**Status:** exact active C/asm hybrid; 214/214 instructions, linked-binary
byte-identical. The complete sprite/CLUT/OT/DR_MODE loop remains compiled C;
39 instructions in the coupled entry/guard region are extended asm.
**Updated:** 2026-08-02 (was 30.4% on 2026-01-25; clean C reached 94.4%
on 2026-08-01)
**Compiler:** GCC 2.95.2-psx, baseline flags (probe-verified; `-fno-schedule-insns`
alone scores 78/214 LCS — the target requires sched1 ON)

## Final disposition — narrowly scoped active hybrid

The accepted source in `src/func_80016280.c` is a genuine hybrid, not an
`INCLUDE_ASM` stub and not a disabled clean-C function. GCC still compiles the
stack frame, callee-save stores, constant births, the complete primitive loop
(target offsets 0xC8--0x330), and the restore/return epilogue. The loop remains
ordinary active C containing the recovered `setSprt`, semitransparency,
shade-texture, position/size/UV/CLUT, both `addPrim` expansions, `setDrawTPage`,
and pointer/counter recurrences.

Extended asm is confined to the coupled entry/guard state:

- two small non-volatile output blocks emit the target's `$s1/$t1` argument
  copies and `$v0/$t3` stack-argument/source setup; because they are separate
  RTL nodes, GCC can interleave its own `$s1` and `$s0` saves exactly as the
  target does;
- one volatile guard block computes the header and group addresses, performs
  the 0xFFFE guard, loads `$s6/$s5` and `$s4/$s3`, installs the mode pointer in
  `$s0`, and produces entry pointer `$t0` plus counter `$t6`;
- fixed-register locals describe the ABI state crossing from that block into
  active C. A zero-instruction output asm exposes those values to GCC without
  adding copies or disabling the loop.

This region had to be handled as one coherent compiler-state handoff rather
than by replacing only the visibly different machine instructions. In the best
clean C, sched1 delayed the incoming `$a0/$a1` parameter copies past the guard
births. Local allocation therefore could not legally put the header base and
offset in the target hard registers. After the guard, count, group offset, and
entry base also required a coupled `$a0/$a2/$a1` visitation/occupancy state.
The two effects feed back into prologue scheduling through hard-register
lifetimes. Empty barriers or isolated register forces either failed to change
that state or rotated the already exact loop.

The exception was chosen only after the mechanism evidence below: complete
semantic and web parity, exact instruction count/opcode structure, hundreds of
thousands of finite clean-C candidates, targeted parameter/copy/web shapes,
scheduler-state searches, and allocator-oracle counterfactuals. Equivalent
source forms normalized back to the 202/214 fixpoint; effective forms changed
the solved suffix. This does **not** reclassify the original function as
handwritten assembly—the read-before-definition scan remains clean. It records
a project-owner-approved reconstruction exception for an ordinary function
whose remaining compiler state was not recovered in clean C.

The final inline `bltz` is emitted as target word `0x05C0009F`. In this exact
end-of-asm boundary, spelling the mnemonic made maspsx insert a spurious `nop`
before the intended `addu $t0,$t0,$v0` delay slot, yielding 215 instructions.
The word is the target branch from offset 0xB4 to the shared epilogue at 0x334;
encoding it directly preserves the delay slot. Its layout coupling is covered
by both the exact function oracle and linked-binary verification.

`.pi/autodecomp.json` allowlists only `register-asm` and `embedded-asm` for this
symbol. It does not allow an `INCLUDE_ASM` stub or a per-file compiler flag.

## What the function is

A sprite renderer in pure PSY-Q libgpu idiom. Per entry it emits a free-size
`SPRT` (code 0x64, len 4) followed by a `DR_MODE` (`setDrawTPage(p,1,1,tpage)`,
0xE1000600), both linked into the OT via `addPrim`-style 24-bit `P_TAG.addr`
bitfield writes through `arg0`. Confirmed macro shapes: `setSprt`,
`setSemiTrans` (short-circuit `||` condition), `setShadeTex(p,0)`, `getClut`,
and a getTPage-equivalent expression whose x-mask is **0x3C0** (NOT the 0x3ff
of the vendored 4.7/silent-hill headers — written inline in our source).

Call-graph evidence shows two callers (`func_80015E3C`, `func_80015EE8`) and no
callees. Assembly adjacency and shared rendering behavior support one
`func_80015E3C`--`func_800165D8` sprite-renderer source family; this evidence is
recorded in `notes/file-groupings.md`. The mandatory read-before-definition
scan reports `0 finding(s)`, so this function does not have the project's
register-variable/handwritten-assembly fingerprint.

## Semantic corrections vs the January source (each was a real misread)

- header pointer = `field_2C + field_28[arg4].field_02 + arg5*10` (the old
  source never read `field_2C`, and read offset 0 instead of 2);
- sprite Y comes from entry offset 0x6, not 0xA;
- `setcode(p,0x64)` byte store before the `0x64808080` RGB word store;
- `hx/hy` are `lh` (s16) header fields hoisted into locals before the loop;
- clut-x needs `(s16)` casts on both operands; `v` must be computed in an
  `s32` variable with explicit `& 0xFF` (a `u8` variable lets the C frontend
  shorten the adds to `lbu`);
- walking `ent--` pointer + separate `for (i = n-1; i >= 0; i--)` counter
  (tree-level fold of `(n-1)*12` → `12n-12` is the fingerprint);
- an 8-byte aggregate local (`RECT rect;`) that is never used — it exists only
  as frame space (frame -40, saves at sp+8..32) and shifts every sp offset;
- the whole header is computed through ONE reused `u32 work` variable with
  compound assignments, plus `tmp`, `base`, a reused `off`, and the promoted
  fresh `entryBase` input web:

```c
    work = (u32)arg3->field_28;
    work += arg4 * 4;
    base = (u32)arg3->field_2C;
    off = ((Group *)work)->field_02;
    base += off;
    work = arg5;
    hdr = (Header *)(base + work * 10);
    work = hdr->field_00;
    if (work < 0xFFFE) {
        tmp = work;
        work = (u32)arg3->field_20;   /* redefinition BETWEEN copy and shift */
        tmp <<= 2;
        work += tmp;
        entryBase = (u32)arg3->field_24;
        off = entryBase + ((Group *)work)->field_02;
        ent = (Entry *)off + (((Group *)work)->field_00 - 1);
        hx = hdr->field_02;
        hy = hdr->field_04;
```

The `tmp = work; work = <newbase>; tmp <<= 2;` sequence is the ONLY spelling
that produces the target's `move v0,v1; sll v0,v0,2`: the interposed
redefinition of `work` blocks both gcse copy-prop (availability killed) and
combine (substitution crosses the set). Every single-assignment spelling
collapses to one `sll`. The register-recurrence hints in the old trace were
exactly this: the `$v1` web IS `work`.

`u *= 2 / u *= 4` in-place scaling (one variable, then/else) reproduces the
target's asymmetric sign-extension: the fallthrough branch copy-propagates the
single-set masked temp (sext dropped), the jump-target branch keeps the
multi-set web (sext kept).

The clut block requires three named values and one deliberately reused addend:

```c
clutY = uv1->field_02;
clutAdd = arg3->field_12;
clutY += clutAdd;
clutX = (s16)uv1->field_00;
clutAdd = arg3->field_10;
clutX += clutAdd;
(*arg1)->clut = getClut(clutX, clutY);
```

The multi-set `clutAdd` web forces the first `$a0` load to die in the y add
before the second `$a0` load is born. It also leaves `clutY` in `$v1` and
`clutX` in `$v0`, reproducing target instructions 137–148 exactly. Fused
expressions, named x/y without the shared addend, operand swaps, and reuse of
`work`/`tmp`/`base`/`off` do not reproduce this recurrence.

## Historical clean-C residual (12 LCS instructions) and why it was hard

The current compiler output has the same 214-instruction count, matching opcode
multiset, and 167 matched webs. `explainDiff` classifies it as
`scheduling-and-operands`: 192/214 instructions and 207/214 opcodes match by
index, while opcode LCS is 212. The first mismatch is target index 1
`sw s1,12(sp)` versus compiled `move t3,a3`.

The remaining mismatches have two coupled parts:

- prologue scheduling: target emits `move s1,a0`, `move t1,a1`, and stack-arg
  `lbu v0,56(sp)` before `move t3,a3` and the rest of the callee-save stores;
  compiled emits `move t3,a3` first and delays the stack-arg load;
- guard/entry coloring: target's first header base/offset arithmetic uses
  `$a0/$a1` where compiled uses `$a3/$t0`; after the guard, target loads count
  into `$a0` and group offset into `$a2`, while compiled uses `$v1/$a0`.

The promoted `entryBase` split already makes `lw a1,36(t3)` exact. The delay
slot `move s0,a2`, `work`=`$v1`, `hdr`=`$a3`, `ent`=`$t0`, `arg1`=`$t1`, the
complete sprite/DR_MODE loop, the CLUT recurrence, both `addPrim` expansions,
the epilogue, and all instructions from target offset 0xBC onward are exact.

Mechanism chain (verified against extracted gcc-2.95.2 sources — global.c
find_reg pass-0 used-so-far preference, local-alloc.c numeric scan +
suggestion rounds, sched.c adjust_priority birth boost + rank_for_schedule +
schedule_select hazard groups):

1. sched.c's birth boost saturates every single-set live-dest insn to
   max priority; selection inside the uniform group is hazard-then-LUID;
2. the backward pass eats the a0/a1/a2 entry copies as load-delay filler at
   cycles 6-8 (positions 14-16 of BB0) — verified in .sched and by the trace's
   exact 22/22 selection replay;
3. hard a0/a1 therefore stay live across the whole guard chain during
   local/global conflict analysis (verified: `.lreg` gives `Register 105 in
   7` — base skipped a0/a1/a2);
4. the target's base=a0/off=a1 requires those hard regs dead before the
   guard-chain births, i.e. the copies at BB0-top in ITS sched1 — which the
   boost forbids for any single-set parm web.

Escape routes tried and closed:
- multi-set parm webs: every spelling either folds at tree level, is deleted
  by flow (which zeroes and recounts REG_N_SETS, flow.c:2586), or emits real
  instructions;
- local pointer aliases (`mp = arg2;` inside the if): gcse cprop coalesces
  (cross-block availability); with shadow-kill sets the kills survive as real
  instructions (156/137 regressions);
- K&R definition: byte-identical output (no effect);
- per-file `-fno-schedule-insns` (SetGfxClip precedent): 78/214 — the target
  needs sched1;
- statement-order sweeps: 100+ variants across BB0/BB1 orders, off/n/tmp web
  reshapes, hx/hy positions — ALL land exactly 192/214 with identical
  coloring (the fixpoint is insensitive to this whole neighborhood);
- searchSchedulerState --block 0 (500k, 2M, and 5M assignment bounds, up to
  3 phantoms):
  INCONCLUSIVE, and the block-0 target correspondence is ambiguous
  (prologue moves/saves interchangeable), so no usable witness. The refreshed
  500k search after the clut fix serialized an impossible target backward order
  (`UID 81` before its unscheduled successor `UID 83`), confirming that this
  correspondence cannot guide a source edit. An earlier analysis retained only
  2/205 machine/UID anchors because concurrent trace generation had duplicated
  every function dump. A clean sequential trace now retains 197/205 unique
  final UIDs; the prologue target-order projection is still ambiguous, but the
  candidate-side lifetime evidence below is exact.
- direct, chained, and one-at-a-time local aliases for arg0/arg1/arg2: final
  code is byte-identical to the baseline; address-taken/struct wrappers leave
  real stack operations;
- value-preserving source-level parameter swaps/cycles do make parameter
  pseudos multi-set at RTL/sched1, but rotate the entire loop allocation
  (120–144 indexed matches), so they confirm the mechanism without preserving
  the solved t-file;
- preserving the original pointer in a local alias and reusing its parameter
  variable for an existing guard value also survives through sched1 and makes
  the selected parameter multi-set. However, the preserved alias loses the
  parameter allocno's assignment behavior (e.g. OT becomes `$t3` instead of
  `$s1`), rotating the otherwise exact loop; targeted and combined arg0/arg1/
  arg2 forms score only 125–156 indexed matches. `const` aliases do not change
  that allocation;
- top-level `register`, array-parameter syntax, top-level `const`, natural
  pointer typing for `base`, and signedness changes for `off`/`tmp`: no useful
  final-code change; narrow `u16 tmp` changes instruction structure;
- the automatic residual grammar exhaustively compiled all 60,192 schema-4
  candidates (web partitions, statement orders, declaration births, known
  macro forms, and activated administrative forms) with no exact object;
- allocator-guided campaigns also closed: all 24 four-pointer value
  permutations, reversible and guard-tied parameter identities, loop-carried
  and midpoint alias transfers, interleaved permutation/inverse cycles,
  declaration initializers, lexical scopes, zero-width label/goto CFG forms,
  early-return/goto guards, K&R declaration-order permutations, integer-address
  parameter types, return-type forms, equivalent loop syntaxes, addPrim
  component forms, aggregate frame shapes, volatile guard provenance, and
  explicit arg4 webs. Machine-equivalent forms return to 191/214 indexed;
  effective forms rotate or expand the solved loop allocation;
- requirement-guided synthesis evaluated another 125 prologue alternatives
  against the refreshed 197/205 UID correspondence without an exact result;
- the instrumented-GCC oracle verifies that its unmodified diagnostic path is
  instruction-identical to the production compiler and exactly replays all
  observed local `find_free_reg` choices (69/69 before the entry-base split,
  70/70 now). Pseudos 126 and 127 in the pre-split source can legally
  take `$a2` and `$a0`; forcing that pair improves indexed equality from
  191/214 to 196/214 without solving the entry allocation. Pseudo 105 cannot
  legally take `$a0` under the baseline block-0 lifetime state;
- leave-one-out local minimization shows the exact stock-choice occupancy
  requirements for the 126/127 pair: `$v1` must be unavailable to pseudo 127,
  while `$v1` and `$a1` must be unavailable to pseudo 126. Pseudo 127 then
  naturally takes `$a0`, which itself makes `$a0` unavailable to overlapping
  pseudo 126; no separate 126/`$a0` exclusion is required;
- injecting the inferred UID relations as literal scheduler DAG edges is too
  strong: schedule-only falls to 171/214 indexed and combined forced allocation
  reaches only 176/214. The original source must change scheduler
  birth/readiness/priority or web dependencies, not merely add those ordering
  edges;
- corrected exact local-state solving (after removing an early-result cap
  before solution ranking) shows that the pre-split allocation could be
  produced by two short abstract quantities, but that witness was not a claim
  about original source. After promoting the real entry-base split, no bounded
  phantom-only solution preserves all existing assignments: `$v1` must first
  be occupied so count can take `$a0`, and the two-reference entry-base
  quantity must then outrank the shorter two-reference offset quantity so it
  keeps `$a1` and leaves `$a2` for offset. This is now a priority/web-shape
  requirement, not merely an occupancy requirement;
- a targeted source realization confirms the entry-base input/result split:
  separating `arg3->field_24` from the resulting entry pointer creates one
  block-1 quantity with two references, assigns it `$a1`, improves indexed
  equality to 192/214, and improves the real LCS-aligned result to **202/214**.
  This clean-C change is promoted. A fresh `groupWork` web creates the expected
  other quantity, but its observed lifetime is only 0..14 with five references,
  so it takes `$v0` and rotates the suffix (13/214);
- after that promotion, all 229,680 coordinates in the refreshed schema-4
  residual grammar were compiled with no exact object. Targeted count/offset/
  entry-base role reuse, arithmetic-web splits, duplicate-load CSE webs,
  coalescible copy chains, and parameter-role reuse also fail: equivalent forms
  return to 192/214 indexed, while effective multi-set forms rotate the solved
  loop. Exact forced block-1 allocation now requires 128->$a0, 127->$a2, and
  118->$a1 simultaneously and reaches 198/214 indexed; forcing only the two
  mismatched roles displaces the newly correct entry-base `$a1` quantity.

### Post-promotion experiment ledger

These are complete-source mechanism tests, not isolated expression snippets.
All source is preserved under `build/hypotheses/`; full compiler-pass artifacts
and comparisons are under the listed `build/fuzz/` run.

| Mechanism | Variants and result (indexed /214) | Conclusion |
|---|---:|---|
| Entry-base coalescible copy chains | `copy`, `copy_step`, `copy2`, `result_copy`: 192 (`866b44f40f45becd`) | Extra front-end pseudos disappear or coalesce before local allocation; block-1 quantities remain unchanged. |
| Reuse all first three parameters for count/base/offset | typed and integer: 125 (`92dd1c0dbc25bd4d`) | Confirms multi-set scheduling mechanism, but preserved pointer aliases take different global colors and rotate the solved loop. |
| Reuse only arg0/arg1, preserving arg2 | four source/load-order forms: 138 (`986ba2a1cc92cabf`) | Still rotates global aliases; changing source load order has no effect on the class. |
| Entry-base compound/result reuse | `result_first`: 192; inplace forms: 138 (`e1b1e7cbc1c261af`) | Machine-equivalent result copy vanishes; an allocator-visible multi-set web becomes too long and changes global allocation. |
| Repeated/split entry arithmetic | repeated forms: 192; split pointer arithmetic: 8 (`31edde823d76c9a5`) | CSE removes useful duplicate references; forcing a distinct decomposition destroys the solved suffix. |
| Duplicate count/offset loads | count, offset, both: 192 (`5a8a22783ff0c27d`) | CSE collapses duplicate memory values before local allocation; no occupancy web remains. |
| Preserve a group copy by redefining `work` | best 146; other orders 6--7 (`54c7cd978ee0040a`) | The copy becomes real, but redefining the global `work` web rotates global allocation and is not the target mechanism. |
| Fresh entry-sum chain | best 141 (`064c84408c5c4f5a`) | Tying input to a short result changes allocation, but not in a suffix-preserving way. |
| Reverse base/offset source-load order | 191 indexed, 201 LCS | Scheduler restores the undesired quantity order; source statement order is not the missing priority mechanism. |
| Explicit `off = entryBase; off += groupOff` | 192 indexed, 202 LCS | Normalizes to the promoted source; no lifetime/reference change survives. |

The refreshed residual search at
`build/residualSourceSearch/func_80016280/9c1cd5b52c809634/` evaluated all
229,680 schema-4 candidates over 37 web partitions and two order regions. It
reported `exhausted-no-exact`; this is finite exhaustion of that recorded
schema, not a proof over all C. The earlier pre-promotion search exhausted
60,192 candidates. Requirement-guided prologue synthesis generated 125 more
alternatives, covering 38/128 analyzed requirements, with no exact object.

The allocator counterfactual analyzer now makes the remaining candidate-side
requirements precise:

- target base `$a0` is local pseudo 105; candidate `.lreg` keeps incoming
  `$a0` live until parameter-copy UID 4, overlapping pseudo-105 births UID 55
  and UID 61. The minimal relation is **UID 4 before UID 55**;
- target first addend `$a1` is global pseudo 106; incoming `$a1` remains live
  until parameter-copy UID 6, overlapping birth UID 58. The minimal relation
  is **UID 6 before UID 58**;
- after the promoted split, block-1 count is pseudo 128 (currently `$v1`,
  target `$a0`), group offset is pseudo 127 (currently `$a0`, target `$a2`),
  and entry base is pseudo 118 (currently and target `$a1`);
- GCC 2.95.2's exact global priority formula reproduces all 23 `.greg` allocnos
  in order. Therefore the primary fix is not a global-priority tweak: it is the
  two incoming-hard-register death relations plus a different block-1 local
  visitation/occupancy state.

The current exact block-1 local-allocation replay is:

| Visit | Quantity / members | Fake life | Refs | Stock color |
|---:|---|---:|---:|---:|
| 1 | q4 / 132--135 | 16..28 | 8 | `$v0` |
| 2 | q0 / 104 | 0..10 | 4 | `$v0` |
| 3 | q3 / 128 (count) | 12..30 | 4 | `$v1` |
| 4 | q2 / 127 (group offset) | 10..18 | 2 | `$a0` |
| 5 | q1 / 118 (entry base) | 8..18 | 2 | `$a1` |

The target-compatible order/state must occupy `$v1` before q3 so count chooses
`$a0`, and must visit q1 before q2 so entry base retains `$a1` and offset then
chooses `$a2`. Occupancy alone is insufficient: adding only a `$v1` quantity
makes q2 consume `$a1` before q1. This is why the post-promotion bounded
phantom-only solver is UNSAT while direct forcing of all three roles is legal.

Secondary facts point the same direction: target's count load
`lh a0,0(v1)` does not tie to the dying `work` register (compiled self-clobbers
`lh v1,0(v1)`), implying the source pointer web outlived that load; target's
offset in `$a2` implies `$a0` was already occupied by count while `$v1` was
also busy.

## Diagnostic tooling and reproducible artifacts

All allocator forcing, candidate exclusion, scheduler-edge injection, and
phantom quantities are diagnostic oracles. None is production source.

- `build/compilerTrace/func_80016280/`: typed pass report plus `.rtl` through
  `.dbr` dumps and candidate assembly;
- `build/targetSchedule/func_80016280/analysis.json`: 197/205 unique final UID
  links after fixing trace-directory isolation; prologue correspondence remains
  ambiguous and must not be treated as an exact target scheduler order;
- `build/allocatorCounterfactual/func_80016280/analysis.json`: candidate-side
  hard-register lifetimes, target role links, all 23 verified global allocno
  priorities, and the exact priority formula;
- `build/compilerOracle/`: isolated instrumented GCC. Its untouched baseline is
  instruction-identical to production; it never replaces the configured
  compiler or edits the vendored GCC source;
- `build/compilerOracle/runs/func_80016280/`: baseline, local-only,
  schedule-only, combined, and leave-one-out reports. The preserved
  `5d877d6694360cf9` report is the pre-promotion 191/214 oracle baseline;
- `build/hypotheses/func_80016280-force-block1-oracle.ts`: post-promotion
  diagnostic forcing of 128->$a0, 127->$a2, 118->$a1, producing 198/214
  indexed equality;
- `build/schedulerConstraint/func_80016280/`: bounded scheduler-state searches.
  Candidate replay is exact, but searches are INCONCLUSIVE and one projected
  target order violates the reconstructed candidate dependency, so no solver
  source claim follows;
- `build/sourceShapeSynthesis/func_80016280/` and
  `build/sourceShapeSearch/func_80016280/`: bounded requirement-guided source
  models, recipes, candidates, and search summaries;
- `build/residualSourceSearch/func_80016280/9c1cd5b52c809634/`: complete
  post-promotion 229,680-coordinate search, deduplicated assembly classes, and
  checkpoint;
- `build/hypotheses/func_80016280-*`: complete hand-authored mechanism
  hypotheses. These are intentionally retained outside `src/`;
- `build/fuzz/func_80016280/`: deterministic full compiler runs, pass hashes,
  comparisons, and mechanism verdicts for those hypotheses.

Primary commands:

```sh
npx tsx tools/agent/diffFunc.ts func_80016280
npx tsx tools/agent/compilerTrace.ts func_80016280
npx tsx tools/agent/analyzeTargetSchedule.ts func_80016280
npx tsx tools/agent/analyzeAllocatorCounterfactual.ts func_80016280
npx tsx tools/agent/instrumentCompilerOracle.ts func_80016280
npx tsx tools/agent/analyzeLocalAllocationOracle.ts func_80016280
npx tsx tools/agent/minimizeLocalAllocation.ts func_80016280
npx tsx tools/agent/solveLocalAllocationState.ts func_80016280
npx tsx tools/agent/inspectLocalAllocationVariant.ts func_80016280 <variant.c> --block 1
```

Score terminology matters for the historical clean-C results: normal
`diffFunc` reported a masked LCS-aligned score of 202/214, while compiler-oracle
and fuzz reports used strict same-index instruction equality (192/214).
Residual-search's 69/214 `instruction-count` field is its own raw normalized
comparison and must not be confused with either production metric. The active
hybrid is 214/214 and byte-verified.

## Rejected mechanisms: do not retry without new pass evidence

- statement permutations or declaration-only aliases that normalize before
  `.sched`/`.lreg`;
- parameter multi-set/reuse shapes that change the solved global pointer
  allocation;
- literal scheduler edges `4<55`, `4<61`, `6<58`;
- forcing only count/offset while allowing entry base to lose `$a1`;
- fresh `groupWork` with the observed five references and life 0..14;
- duplicate loads, simple copy chains, repeated sums, and cancellation terms
  that CSE removes before local allocation;
- address-taking, aggregate wrappers, volatile values, or CFG tricks that add
  real stack/control instructions;
- `-fno-schedule-insns`, other per-file flag changes, or diagnostic empty-asm
  barriers. They substantially regress and do not model the target mechanism.

## Validation snapshot

As of 2026-08-02:

- `diffFunc.ts func_80016280`: **214/214 masked LCS-aligned (100%)**;
- linked function verdict: **VERIFIED, byte-identical with relocations**;
- full `make check`: **original executable payload matched**;
- active source contains no `INCLUDE_ASM` and no disabled clean-C body;
- the historical clean-C classifier result was `scheduling-and-operands`,
  192/214 same-index, 207/214 same-index opcodes, 212 opcode LCS, web parity
  OK (167 webs);
- `scanReadBeforeDef.ts func_80016280`: one function scanned, zero findings;
- package tests: 113/113 passing;
- focused TypeScript checks and `git diff --check`: passing.

## If replacing the exception with clean C in a future session

1. Gate every source variant first on the historical block-1 requirement: a
   `$v1`-occupying quantity before q3 plus q1/118 visited before q2/127. Reject
   immediately if any post-0xBC instruction or solved loop register changes.
2. Search natural source shapes in which an essential copy from a longer-lived
   pointer web survives CSE/combine into local allocation, but is coalesced
   away later; it must not redefine the global `work` web or alter pointer
   allocno priorities.
3. Independently require block-0 `UID 4 < UID 55` and `UID 6 < UID 58`, but do
   not inject those relations as literal DAG edges. The source must change
   birth eligibility, dependency, or lifetime while preserving pseudos
   81/82/83 and the exact loop allocation.
4. Use the confirmed same-TU renderer family (`func_80015E3C` through
   `func_800165D8`) only as source-style evidence. `func_800165D8` increments a
   direct primitive pointer and therefore naturally has a multi-set parameter;
   that explanation does not transfer to this function's unchanged
   pointer-to-pointer parameters without a corresponding source mechanism.
