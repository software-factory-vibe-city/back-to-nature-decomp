# func_800153BC: solving a four-instruction scheduling/allocation mismatch

**Date:** 2026-07-27  
**Status:** **SOLVED** — `src/func_800153BC.c` matches **68/68 instructions
(100%)** in clean C89. No register pins, barriers, flag overrides, or assembly
stubs are used.

This case is useful because the final fix was only a movement of one independent
field assignment. That source movement changed pseudo birth order, local
allocation, hard-register hazards, and finally `sched2` output. The target
order was not reproduced by writing statements in target assembly order.

## 1. Function summary

`func_800153BC` initializes a PSY-Q-style `POLY_G4` primitive:

- tag length and primitive code;
- the conditional semitransparent code variant;
- four RGB triples;
- four vertex coordinate pairs;
- the ordering-table link words; and
- the return pointer to the next 0x24-byte primitive slot.

The reconstructed struct is 0x24 bytes. Its byte fields are the tag and four
RGB/code groups, and its halfword fields are the four coordinate pairs. The
word access at offset zero intentionally overlaps the four tag bytes when the
ordering-table link is built.

## 2. The previous frontier

The previous clean-C attempt already had the correct semantics, instruction
selection, and register roles almost everywhere:

```text
target:   68 instructions
compiled: 68 instructions
index:    64/68 exact
opcodes:  68/68 exact
opcode LCS: 68
classification: scheduling
```

Only four positions differed:

```text
Position  Target                    Previous candidate
--------  ------------------------  ------------------------
44        sb  v1,21(t0)             sb  v0,28(t0)
45        sra v1,t4,8               sra v0,t4,8
46        sb  v1,29(t0)             sb  v1,21(t0)
54        sb  v0,28(t0)             sb  v0,29(t0)
```

These are:

- `field_15 = arg8 >> 8`;
- `field_1C = arg9 >> 16`; and
- `field_1D = arg9 >> 8`.

The candidate contained every required operation. The remaining problem was
where those operations landed after allocation and post-allocation scheduling.

## 3. The exact clean-C fix

The old source birthed the `field_1C` expression before the raw color-byte
stores:

```c
arg0->field_14 = (s8)(arg8 >> 0x10);
arg0->field_15 = (s8)(arg8 >> 8);
arg0->field_1C = (s8)(arg9 >> 0x10);
arg0->field_8 = arg2;
/* raw coordinate/color stores */
arg0->field_16 = (s8)arg8;
arg0->field_1D = (s8)(arg9 >> 8);
```

The matching source moves only `field_1C` beside the later `arg9` stores:

```c
arg0->field_14 = (s8)(arg8 >> 0x10);
arg0->field_15 = (s8)(arg8 >> 8);
arg0->field_8 = arg2;
/* raw coordinate/color stores */
arg0->field_16 = (s8)arg8;
arg0->field_1C = (s8)(arg9 >> 0x10);
arg0->field_1D = (s8)(arg9 >> 8);
```

The stores are to disjoint fields, so this preserves semantics. It changes the
compiler mechanism that matters: **statement and expression birth order**.

The mechanism-backed variant was tested with `psx_fuzz_variants` in full mode
with pass tracing. It scored 68/68 and was reported as a promotion candidate.
After promotion, `psx_diff_function` independently confirmed 68/68.

## 4. Why the source move works

### 4.1 It changes RTL birth order

In the previous candidate, the `arg9 >> 16` pair was born as the earlier
UID 148/150 shift/store chain. In the matching candidate it is born later as
the UID 163/165 chain, near `arg9 >> 8` (UID 168/170).

This is not a cosmetic source reorder. The variant trace found the first
meaningful change in RTL and propagated it through allocation and `sched2`.

### 4.2 It changes local allocation

The previous candidate assigned both late `arg9` extraction results to `$v0`:

- `arg9 >> 16` -> `$v0`;
- `arg9 >> 8` -> `$v0`.

In the matching trace:

- pseudo 119 (`arg9 >> 16`, UID 163/165) is assigned `$v0`;
- pseudo 120 (`arg9 >> 8`, UID 168/170) is assigned `$v1`.

Both remain fresh, single-set, single-death local quantities. No reused global
web is required. Their changed birth order and neighboring/fake lifetime
conflict are enough to split them across `$v0` and `$v1`.

### 4.3 The allocation creates the target sched2 hazards

After allocation, `sched2` sees hard-register dependencies that did not exist
in the pseudo-register DAG. In the matched trace, allocation introduces a
hard `$v1` WAR edge from UID 145 to UID 168:

- UID 145 stores `field_15` from `$v1`;
- UID 168 writes `$v1` with `arg9 >> 8`.

That edge forces the target sequence:

```text
sb   v1,21(t0)
sra  v1,t4,8
sb   v1,29(t0)
```

Meanwhile, the later-born `arg9 >> 16` store is selected much earlier by the
backward scheduler, which places it later in forward output. Its `$v0` value
survives until the target's delayed `sb v0,28(t0)` position.

The important chain is therefore:

```text
source statement placement
  -> RTL birth order
  -> local quantity conflicts / register assignment
  -> hard-register WAR edges
  -> sched2 order
  -> exact assembly
```

## 5. Why the earlier reasoning stalled

The old note correctly identified a scheduling/allocation feedback problem,
but made the search space too narrow in two ways.

First, it treated the target's repeated `$v1` use as evidence that a shared C
variable might be necessary. That was only an allocator recurrence hint. The
winning source uses fresh compiler pseudos; the allocator independently gives
the relevant late value `$v1`.

Second, it focused on forcing the final store order directly. GCC's scheduler
works backward. Moving `field_1C` later in source causes its shift to appear
early and its store late in final assembly. The useful source order therefore
looks counterintuitive if one compares only against forward target assembly.

The scheduler does model memory dependencies where alias analysis requires
them. The narrower fact relevant here is that these disjoint struct-field
stores are not mutually ordered strongly enough to determine the desired
sequence; allocation-created hard-register hazards finish the job.

## 6. Strategies that generalized from the solution

### Strategy A: trust a 100% opcode LCS

When all opcodes are present and the mismatch is a short permutation, preserve
semantics and instruction selection. Do not restart the decompilation or alter
types without evidence.

### Strategy B: trace both scheduler stages and allocation

A final scheduling mismatch can originate before `sched2`. Compare:

1. RTL/combine birth order;
2. `sched` pseudo order;
3. local/global assignment; and
4. `sched2` hard-register order.

Treat `allocation-blocked` edges as possible causes, not incidental noise.

### Strategy C: move the producer/store pair as one source unit

For an expression such as:

```c
obj->byte = (s8)(value >> 16);
```

moving the whole assignment changes both the shift pseudo's birth and the
store's scheduler node. This can alter allocation without introducing a named
multi-death temporary.

### Strategy D: remember that scheduling is backward

A statement moved later in C can have its producer floated earlier while its
store remains later. Test source birth sites rather than manually copying the
forward target order.

### Strategy E: prefer fresh local quantities before shared variables

The target's reuse of a hard register does not prove source-variable reuse.
A shared C variable can become a multi-set/multi-death web and fall into global
allocation, causing widespread register changes. Keep fresh expression results
unless a trace demonstrates that a shared web is required.

### Strategy F: test one mechanism with complete variants

The successful variant declared:

- mechanism: `statement-birth-order`;
- expected pass: `sched2`;
- expected effect: alter the late color pseudos and hard-register hazards;
- invariants: identical field values, branch behavior, and link semantics.

Pass tracing showed a real mechanism change rather than a syntax-only no-op.
This was more informative than trying many unlabelled statement permutations.

## 7. Failed and diagnostic strategies

| Strategy | Result | Lesson |
|---|---:|---|
| Direct expressions in the old order | 64/68 | Best baseline; semantics and opcode selection were already right. |
| Broad grouping of all `>>16` then all `>>8` stores | worse | Changes too many births at once. |
| Reused `hi`/`lo` variables | much worse | Multi-death webs trigger global allocation and cascade register changes. |
| `s8` extraction temporaries | worse | Changes shift instruction selection/signedness behavior. |
| Moving all extraction before vertex stores | much worse | Perturbs the entire scheduler ready list. |
| Scheduling barriers | unsuitable | Either changed generated instructions/allocation or over-constrained the block. |
| Reusing `temp_v1` for the first tag-link result | 35/68 | The predicted multi-set web was created, but it changed global allocation broadly; mechanism partially confirmed, target hypothesis rejected. |
| Moving only `field_1C` later | **68/68** | Minimal birth-order change produced the required local allocation and sched2 hazards. |

A failed mechanism-confirmed experiment is still useful. The `temp_v1` reuse
variant proved that target hard-register recurrence must not be promoted from a
hint to a source-level conclusion without checking allocation collateral.

## 8. Recommended workflow for similar cases

1. Run the structural classifier before editing.
2. If opcode LCS is complete, map each displaced instruction to one source
   expression.
3. Run the compiler trace over the mismatch window.
4. Identify the producing pseudo, consuming store, assignment pass, and hard
   register in both candidate and target.
5. Change one birth site or one web boundary at a time.
6. Use complete C89 variants with explicit mechanism metadata and pass tracing.
7. Rank mechanism verdict before match percentage.
8. Promote only a full-mode exact variant.
9. Re-run the exact function oracle, export context, and run the final project
   verification gates.

## 9. Verification record

- `psx_explain_diff` on the previous source: `scheduling`, 64/68 exact,
  68/68 opcode LCS.
- `psx_compiler_trace`: exposed the baseline `$v0` allocation and sched2 WAR
  constraints.
- `psx_fuzz_variants`: the `statement-birth-order` variant reached 68/68 in
  full mode and showed its first causal divergence in RTL.
- `psx_diff_function` after promotion: **68/68 (100%)**.
- `psx_export_context`: exported the function signature and struct context to
  `include/functions.h`.
- Full binary verification: `build/slus_011.bin` matches the original payload.

## References

- `src/func_800153BC.c` — matching clean-C source.
- `build/compilerTrace/func_800153BC/report.json` — matched compiler trace.
- `build/fuzz/func_800153BC/05822de28c76e1cb/` — successful variant run.
- `notes/research/func_800154CC-polyf4-diamond-crossjump.md` — sibling POLY_F4
  allocator/scheduler case.
- `notes/research/func_8001B4E4-scheduler-allocator-resolution.md` — reusable
  backward-scheduler and local-allocation mechanics.
- `prompts/c-style-guide.md` — project matching doctrine.
