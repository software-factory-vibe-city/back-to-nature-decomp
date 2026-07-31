# C Style Guide for PSX Matching Decompilation

This is the project's mandatory matching field manual. Read it completely
before editing a function. It distills failures that repeatedly caused agents
to waste turns or accept false solutions. Concrete compiler flags, small-data
threshold, assembler, SDK, and target facts are in `configs/project-profile.md`.

Apply the compiler and assembler confidence statements from the generated
project profile. When the active project establishes that an ordinary function
came from a reproducible C compiler invocation, failure to find its source
shape is not permission to bypass the clean-source gate. Stop with a classified
diff rather than using inline assembly, hard-register pinning, a new assembly
stub, or a flag override.

## 1. Decode semantics before searching source shapes

Do not fuzz syntax around a misread computation. If many different source
shapes diverge at the same early instruction, stop and recompute the target's
arithmetic, constants, signedness, and address.

### Sign extension fused with element scaling

Around an array access, this pattern usually combines a cast with element
scaling:

```text
sll r,x,16
...
sra r,r,16-k
```

It means `sext16(x) * 2^k`, not `sext16(x) >> k`. For example,
`(x << 16) >>a 15` is `(s16)x * 2`. The source index may simply be `(s16)x`;
combine can fuse the cast's right shift with the array element's left shift.

A fused instruction occupies the latest merged instruction's position. If the
target has `sll 16` early and the fused `sra` later, split the cast into an
earlier statement and let the consuming array access create the scaling shift:

```c
idx = (s16)arg0;
base = (char *)&D_LARGE_TABLE;
value = D_INDEX_TABLE[idx];
```

### Strength-reduced multiplication

Evaluate every `sll`/`addu`/`subu` step to a fixed point. Do not stop halfway.
For example:

```text
8v - v = 7v
7v << 2 = 28v
28v + v = 29v
29v << 2 = 116v
116v + v = 117v
117v << 2 = 468v
```

The source multiplication is `v * 468`, not `v * 28`. Once the constant is
correct, write the natural multiplication first and let GCC's multiply
synthesizer reproduce the chain.

### Unsigned comparisons with large constants

MIPS `sltiu` sign-extends its immediate. Unsigned thresholds at or above
`0x8000` therefore commonly compile as:

```text
ori  r,zero,C-1
sltu r,r,x
```

Read this as a source comparison against `C`, not `C-1`. The branch direction
determines whether the source is `< C` or `>= C`.

### Load widths and arithmetic signedness

Infer storage types from the target:

| Target instruction | Likely C type |
|---|---|
| `lw` / `sw` | `s32`, `u32`, or pointer |
| `lh` / `sh` | `s16` |
| `lhu` | `u16` |
| `lb` / `sb` | `s8` |
| `lbu` | `u8` |
| `slt` | signed comparison |
| `sltu` | unsigned comparison or Boolean idiom |
| `div` / `mult` | signed operands |
| `divu` / `multu` | unsigned operands |

Preserve cast placement. A cast on a loaded value, an index, and the final
comparison can produce different instructions even when modern C semantics
look equivalent.

## 2. Start from natural C, not target-shaped statements

The original programmers generally wrote straightforward C. First reconstruct
the complete operation a programmer would express, then use compiler evidence
to alter its web shape deliberately.

```c
/* Natural forms to try first. */
result = table[index];
obj->flags |= 0x10;
delta = *p++ - *q++;
if (count > 0) {
    /* ... */
}
```

Avoid instruction-by-instruction transcriptions and unnecessary cast chains:

```c
/* Usually the wrong starting shape. */
rhs = *q;
q++;
delta = *p;
delta -= rhs;
p++;
```

A named temporary is not free in pre-SSA GCC. Reusing `rhs` for independent
loads creates one multi-death pseudo, often forcing it through global
allocation. The fused expression lets GCC create fresh, single-set,
short-lived operand pseudos while retaining only the semantically recurring
`delta` web.

### Signature of an assembly-shaped temporary web

Try a fused natural expression early when:

1. opcode selection is already correct or nearly correct;
2. the diff is a stable pointer-versus-loaded-value register-role swap;
3. the target moves an argument out of `$a0`–`$a3` and immediately reuses the
   incoming register for a load, while the candidate omits that move;
4. the trace shows a reused operand pseudo with several deaths and a
   `global/reload` assignment; and
5. statement reordering changes priorities but never gives the operand the
   target register.

Keep named locals only for values genuinely carried across statements. Fuse
one natural operation at a time:

```c
delta = *p++ - *q++;
sum += *p++;
delta = *p - *q;       /* final non-walking component */
```

Do not reject a candidate because it creates more RTL pseudos. Fresh local
pseudos often allocate more simply than one reused global pseudo.

### Deliberately vary web shape

These forms are distinct compiler experiments:

- reused named operand: one longer or multi-death web;
- fused expression operands: fresh short-lived compiler webs;
- reused result variable: destination overlaps an input web;
- fresh result variable: independent destination web.

For a lone commutative `mult` or ALU operand-order mismatch, try changing
whether the result is fresh or reuses an input. Swapping source operands alone
may be canonicalized away.

### Store-block initializers: order from the data, never from emission

When a mismatch is order-only inside a block of constant/pointer stores
(opcodes, values, and offsets all correct), the cause is almost always source
statement order, and the correct order is the natural DATA order.

- The scheduler freely rearranges store emission, but three things are
  inherited directly from statement order and survive scheduling: constant
  birth order (CSE materializes a shared constant at its FIRST use in source
  order), LUIDs, and live-range extents (hence register pressure and
  assignment). Never reverse-engineer statement order from the emitted store
  order: that chases an invariant the scheduler does not preserve while
  silently destroying the ones it does.
- Before any scheduler forensics, run
  `npx tsx tools/agent/analyzeStoreBlock.ts <func>`. It mines the target for
  parallel arrays, arithmetic relations among stored values (e.g. pointers
  that are running sums of a parallel count array times an element size —
  a pool-carving table), repeated constants (one CSE web per distinct
  value), and the birth-order fingerprint: if the target's `li` order equals
  first-use order under ascending-offset stores, write the source in
  ascending order and let the scheduler shuffle.
- A diagnosis that implies the original programmer wrote something bizarre
  (leapfrogging merged temps, unsuppressible boosts, permuted store lists)
  is evidence the frame is wrong, not that the problem is deep. Period
  source is mundane; re-check shallow assumptions before going deeper.
- Validated: func_80021E60 sat at 63/92 through five web-shape experiments,
  a SAT search, and a sched1 simulator, all built on a store order
  reverse-engineered from emission; rewriting both arrays in natural
  ascending offset order matched 92/92 on the first compile.

## 3. Use natural arrays, structs, and addresses

### Array indexing

Prefer:

```c
value = D_TABLE[i];
(&D_SCALAR_BASE)[index] = value;
```

Avoid:

```c
value = *((s32 *)((char *)D_TABLE + (i << 2)));
```

A GP-relative indexed access usually appears as `sll`, `addiu $gp`, `addu`,
then `lw/sw`. Array indexing naturally produces that form.

### Struct fields

Prefer:

```c
obj->field_0C = 1;
```

rather than offset casts:

```c
*(s32 *)((char *)obj + 0x0C) = 1;
```

Pointer-cast chains can change expression birth, operand order, and address
canonicalization. A natural array or struct-field MEM expression also creates
a fresh address-result web, which can be essential for matching.

### Address-expression clues

| Target shape | Source family to try |
|---|---|
| `sll`, `addu`, `lw/sw` | array indexing |
| `addiu` from `$gp` | GP-relative scalar or small aggregate |
| `lui` plus `%lo` load/store | absolute global above the small-data threshold |
| base load plus field offset | struct field |
| scaled index before base | array/index expression |
| base before scaled index | separately materialized base or pointer expression |

### Large address constants

The MIPS backend's address legitimizer splits a large constant only when the
final memory address reaches it as `plus(REG, CONST_INT)`. This target:

```text
li    t,C & ~0x7fff
addu  p,p,t
lhu   v,C & 0x7fff(p)
```

usually requires materializing the base-plus-scaled part first and attaching
the large offset only to the dereference:

```c
ptr = base + index * size;
value = *(u16 *)(ptr + LARGE_OFFSET);
```

Folding everything into `*(base + index * size + LARGE_OFFSET)` presents a
nested `plus(plus(reg,reg),const)` and commonly materializes the whole constant
instead.

## 4. Classify before editing

Use tools in layers:

```bash
npx tsx tools/agent/explainDiff.ts <func>
npx tsx tools/agent/compilerTrace.ts <func>
npx tsx tools/agent/analyzeTargetSchedule.ts <func> [--block <n>]
npx tsx tools/agent/searchSchedulerState.ts <func> [--block <n>]
npx tsx tools/agent/diffFunc.ts <func>
```

`diffFunc.ts` is the exact oracle, not the diagnosis. Route the next edit from
the structural classifier:

| Category | First response |
|---|---|
| `instruction-selection` | Fix semantics, types, signedness, casts, control flow, idiom, or declaration shape |
| `register-allocation` | Change temporary birth, reuse, death count, lifetime, declaration order, or expression grouping |
| `operand-order` | Test fresh-result versus input-reuse structure and natural address forms |
| `scheduling` | Change statement order, expression birth site, dependencies, or sequence points |
| `relocation-or-immediate` | Check symbol declarations, small-data shape, and linked-layout noise |
| `mixed-operands` / `scheduling-and-operands` | Inspect compiler pass dumps before changing source again |

Run `compilerTrace.ts` for allocation, scheduling, stubborn operand-order, and
mixed cases. It stores GCC dumps and a typed `report.json` under
`build/compilerTrace/<func>/`. The report connects observed pseudo SET/use/death
UIDs, reconstructed lifetime endpoints, `.lreg` versus `.greg` assignments,
scheduler ready-list decisions, and allocation-created hard-register hazards.
Use `--pseudo <n>` or `--scheduler-window <start:end>` to focus dense output.

Treat each confidence label literally. Dumped UIDs, dependency notes, conflicts,
preferences, assignments, and ready lists are exact observations. Lifetime
endpoints and untyped dependency kinds/costs remain reconstructed or inferred.
For the configured legacy scheduler, `analyzeTargetSchedule.ts` reconstructs
priority, relation to the last scheduled instruction, and block-local LUID;
call a tie exact only when the modeled comparator reproduces the dumped order.
A target order that is legal under the candidate DAG is not yet reproduced:
require exact baseline replay and a supported bounded counterfactual. Target
RTL dependencies remain unavailable. A target-register recurrence hint is an
experiment to test, not proof of original source.

When an order-only block remains stuck after mechanism-directed source shapes,
or the counterfactual requires several coupled boost/LUID/dependency changes,
run `searchSchedulerState.ts` before expanding the C grammar again. It builds a
function-agnostic finite constraint domain from the trace and target analysis,
and refuses target search unless its parameterized scheduler first reproduces
the candidate block exactly. Interpret its terminal states literally:

- `SAT` is a concrete hidden compiler-state specification—boost bits, LUID
  relations, bounded phantom copies, and justified dependencies—not a matching
  source;
- `UNSAT` excludes only the serialized finite domain and is useful for stopping
  repeated source investment in that domain;
- `INCONCLUSIVE` means the assignment bound ended first and proves nothing; and
- `MODEL-REPLAY-FAILED` invalidates target claims until observability improves.

A SAT witness should drive one small complete-source batch that attempts all
coupled requirements together. Check the predicted pseudo SET counts, phantom
survival/deletion, sched1 order, allocation, and sched2 result before ranking
instruction score. Use any generated `source-search-spec.json` only as a
proof-admitted handoff; inspect its mechanism coverage because the current
source catalog may represent a witness only partially. Never describe SAT as a
solution or UNSAT as a proof over all clean C.

Start with the cross-pass feedback category: `sched1-reordered`, `sched2-fixed`,
`allocation-blocked`, or `memory-or-control`. For a stubborn scheduling window,
run target-schedule analysis and check its emission alignment before using UIDs;
proven zero-width RTL barriers may be skipped, but ambiguous links may not be
forced. Prefer the bounded intervention set: test birth eligibility for a
`priority-relation`, source birth/constant sites for a `luid-order`, and natural
dataflow only for a dependency relation. Each edit should name the pseudo
lifetime, conflict, assignment pass, canonicalization rule, or scheduler
decision it intends to change. Do not run random declaration or statement
permutations.

When several source shapes test the same diagnosis, use the variant laboratory
with a hypothesis manifest. Every variant must name its mechanism, predicted
pass/effect, and semantic invariants. Enable pass tracing to distinguish a real
web or scheduling change from syntax that compiles equivalently. Read
`confirmed` / `partially-confirmed` / `rejected` / `inconclusive` before match
counts; a lower match can provide stronger causal evidence. A cc1-only result
is triage and cannot be promoted without the preserved hypothesis reproducing
in full mode.

### When source-order changes do nothing

If both orders of a commutative source expression compile identically, a
compiler pass is discarding source order. Find the first dump where the target
shape is lost by comparing `.rtl`, `.jump`, `.cse`, `.combine`, `.regmove`,
`.lreg`, and scheduler dumps. Read that exact rule in the vendored GCC sources
before designing another shape.

A known address case occurs in CSE: a commutative operand whose pseudo has a
recorded constant-equivalent value, such as a symbol's `lo_sum` address, is
placed second. Reassigning a base variable and then adding an offset is exactly
the shape that triggers it. Defeat it with a fresh compiler address web inside
a natural array or struct-field expression—not by swapping source operands
again.

If `explainDiff.ts` cannot find archived assembly, continue with the exact diff
oracle. A diagnostic setup failure is not a source mismatch.

## 5. Allocation and scheduling mechanisms

Use these mechanisms to design source, not as reasons to hand-assign registers.
They were confirmed against the compiler sources used by the projects from
which these matching lessons were distilled.

| Mechanism | Source consequence |
|---|---|
| Local allocation requires one death | A local reassigned to independent values becomes a multi-death global web; fresh single-set values stay locally allocatable |
| Dying-input tie | A fresh output can share the register of an input that dies in the same instruction |
| Hard-register suggestion | A pseudo born where an argument hard register dies can inherit `$a0`–`$a3` |
| Priority uses references and lifetime; ties use birth order | Statement and expression birth order can change allocation |
| Fake lifetime extension with post-allocation scheduling | Moving a birth by one statement can create or remove a pseudo-conflict |
| Pre-allocation scheduler works backward | Independent source statements do not necessarily retain source order |
| Legacy scheduler ties use priority, last-scheduled dependency class, then LUID | Separate birth-priority changes from block-local source/RTL birth-order changes |
| Distinct symbol bases may not alias | Stores through independently proven bases can reorder freely |
| Post-allocation scheduling sees hard-register hazards | A scheduling mismatch can be downstream of the wrong register allocation |
| CSE commutative constant-second rule | Source operand swaps can be no-ops; change the web/address family |

### Argument reassignment

Do not reassign an argument when the target keeps it in its incoming hard
register. A statement such as `arg0 <<= 1` forces an entry copy and reshapes
the scheduler ready list and allocator suggestion table. Compute the derived
value in a fresh temporary or inline at the first consumer:

```c
p16 = (s16 *)((char *)&D_HALFWORD_BASE + (arg0 << 1));
```

An inline repeated expression may be CSE'd into one value born at the first
consumer. Hoisting it to a standalone statement births it earlier. Match the
birth site shown by the target.

### Allocation before scheduling

If an instruction moves only in post-allocation scheduling, first ask whether
the candidate has the wrong register web. Target hard-register read/write
hazards can pin an order that the candidate's allocation leaves independent.
Fixing allocation can fix scheduling without any source-order workaround.

### Operand and field order

Old GCC expansion follows expression-tree and statement structure closely
enough that source order is a useful first lever:

```c
result = a + b;  /* tends to load/expand a before b */
result = b + a;  /* tests the reverse birth order */
```

Likewise, read struct fields in the order the target loads them. If source
swaps have no effect, stop and attribute the canonicalizing pass rather than
continuing permutations.

## 6. Scheduling barriers are a governed last resort

First exhaust statement order, operand order, natural expression structure,
expression birth sites, and allocation diagnosis. For a proven order-only
mismatch of independent instructions, project policy may permit a
zero-instruction barrier:

```c
__asm__ volatile("" : "=r"(value) : "0"(value));
```

It emits no target instruction but creates a dependency. Every barrier must
carry a comment stating the exact target-versus-compiler order it fixes and is
tracked debt.

For two absolute pointer loads where GCC interleaves `lui` pairs but the target
completes one `lui/lw` pair before starting the next:

```c
a = GLOBAL_A[0];
__asm__ volatile("" : "=r"(a) : "0"(a)); /* Complete A before loading B. */
b = GLOBAL_B[0];
```

For a prologue memory store stolen into a branch delay slot, a narrower memory
barrier may be appropriate after the mismatch has been proven:

```c
__asm__ volatile("" ::: "memory");
```

A barrier does not prevent CSE and is never a substitute for fixing types,
allocation, or an address web.

## 7. Declarations, globals, and C89

### Generated globals

`common.h` includes `globals.h`, which declares generated `D_XXXXXXXX`
symbols. Do not redeclare them in `.c` files. If a global needs a struct or
aggregate type, put the override in `include/globals_override.h`.

Use `&D_XXXXXXXX` to obtain a generated global's address. Never use the
underscore-prefixed implementation symbol `_D_XXXXXXXX`.

Some linker or hand-named symbols may genuinely be absent from `globals.h`.
Check generated headers before adding an extern. If one is needed, make its
type and aggregate size agree with the target access and addressing mode.

### Small-data addressing

The active `-G` threshold is in `configs/project-profile.md`.

- declarations at or below the threshold generally use one `%gp_rel` access;
- larger declarations generally use an absolute `lui` plus `%lo` access.

If the candidate emits `%gp_rel` but the target uses `lui`/`lw`, the declared
object is probably too small. The original may have declared an array or
aggregate even if only element zero is accessed. Do not hardcode an assumed
threshold; use the generated profile.

### Shared types

- parameter/local structs shared across files: `include/game_types.h`
- global struct/aggregate overrides: `include/globals_override.h`
- one-file local types: the source file, if project policy permits

Use padding fields for unknown gaps and fields only where access widths prove
them. Do not cast a `void *` at every access when the parameter's struct type
is known.

### C89 form

Declare locals at the top of each block and use `/* */` comments:

```c
void func(void) {
    s32 i;
    s32 *ptr;

    ptr = &D_SCALAR_BASE;
    for (i = 0; i < 10; i++) {
        /* ... */
    }
}
```

## 8. Control flow and native compiler idioms

### Switches

Use a `switch` when the target has jump-table dispatch. The compiler supports
it. Case body order matters because bodies are emitted in source order; reorder
case clauses to match binary layout rather than replacing the switch with an
if/else chain.

### Native operators, not forged instructions

The compiler naturally emits these patterns:

| Target pattern | C source |
|---|---|
| `sll x,16; sra x,16` | `(s16)x` |
| `sll x,24; sra x,24` | `(s8)x` |
| `div`, zero check, `break 7`, `mflo` | signed `/` |
| same sequence with `mfhi` | signed `%` |
| magic constant, `multu`, `mfhi`, shifts | unsigned division/modulo by a constant |
| `addiu x,x,1` | `x + 1` or `x++` |
| generated labels | ordinary C control flow or `goto` labels |

Do not write assembly for operations the compiler emits itself. `M2C_BREAK`
or `BREAK` macros already supplied by project headers may remain when they are
part of raw m2c output, but ordinary division should normally be expressed as
`/` or `%` and allowed to generate its own checks.

### Common concise forms

```c
return D_FLAG != 0;                     /* sltu zero,value Boolean */
(&D_SCALAR_BASE)[index] = value;         /* indexed setter */
return (&D_SCALAR_BASE)[index];          /* indexed getter */
if ((u32)a < (u32)b) { /* sltu */ }
if (a < b) { /* slt */ }
```

### CSE of address high halves

The compiler may merge identical `lui` high halves for nearby globals. A
scheduling barrier does not prevent this. Before calling it an assembler or
compiler limitation, verify the declarations, source web, compiler assembly,
relocations, and both assembler boundaries.

## 9. Cleaning raw m2c and legacy hacks

### Raw m2c first pass

Replace unknown types from load/store width, recover parameter/local structs
from fixed offsets, and check generated function/SDK declarations before
inventing prototypes. Convert `D_XXXXXXXX.unkN`-style guesses into a proven
aggregate override, array access, or temporary pointer view; do not apply a
field to a scalar generated global.

Variable names do not affect code generation. Rename `temp_v0`, `phi_a0`, and
similar names after the source structure is understood.

### Strip legacy workarounds before trusting them

When repairing a previously matched file containing pins, barriers, forged asm,
or unusual flag assumptions:

1. remove the workaround while preserving the surrounding C;
2. run the exact function diff;
3. if it still matches, the workaround was residue;
4. otherwise classify and trace the clean mismatch;
5. if clean C cannot be restored in the current task, restore the known-good
   source rather than leaving a broken file, and report the signature.

Comments saying a pin is “required” are not evidence. Many such comments in
this project were disproven by natural C under the verified compiler.

Top-level assembly is legitimate only for functions independently classified
as handwritten assembly, including established GTE/cop2 routines and the
known pure-assembly function. A tail call, difficult allocation, or stubborn
diff does not establish handwritten origin.

## 10. Escape hatch and targeted research

When several traced, mechanism-directed source edits fail, stop permuting and
locate the active compiler's exact source in the project. Relevant passes often
include CSE, combine, arithmetic expansion, address legalization, local/global
allocation, and scheduling. This is observability only; never patch the
compiler to make reconstructed source match.

Load historical research by signature, not as a wildcard. Inspect titles and
opening summaries first, then select only the case study matching the current
problem family: allocation/scheduling dependencies, persistent operand webs,
semantic arithmetic decoding, address legalization, canonicalization, or a
compiler/assembler boundary.

An assembler-emulation gap is proven only by assembling identical compiler
output through the reference and replacement assemblers and comparing objects.
Failure to find a C shape is not proof of an assembler bug.

## 11. Flag hypothesis: probe early, escalate on evidence

Per-file flag overrides remain a governed workaround, not a matching tool.
But when a target carries a structural fingerprint that is hard or impossible
to reach from natural C under the baseline flags, run
`npx tsx tools/agent/flagProbe.ts <func>` EARLY — before deep source
archaeology — and read its three evidence sources: target fingerprints
(decoded from original bytes, no source needed), a flag-matrix score of the
current source, and nearby overrides (flags are per-TU, so neighbors share
them). The escalation bar for proposing an override: a fingerprint, plus a
flag column that dominates baseline, plus no contrary witness in the same
region. A probe that shows baseline equal to the flag delta means the flag
is NOT the answer and the source shape is (func_8001FF98: the probe's matrix
exposed exactly this, killing a wrong override within minutes).

## 12. Period idiom priors (validated 2026-07-31)

When choosing candidate source shapes, prefer what 1999 corpora actually
show (PSY-Q samples, matched Silent Hill/ESA/soul-re, Net Yaroze, libsnd):

- Count-up indexed `for` loops (`for (i = 0; i < N; i++) a[i] = x;`).
  Countdown loops in targets are check_dbra_loop reversals of count-up
  source, not source-level countdowns.
- Naive indexed bodies; walking pointers are strength-reduction products.
  Do not hand-write the post-transformation shape.
- ONE counter variable reused across sequential loops. This is also a
  NATURAL PRE isolation shield: the later loop's `i + 1` is a post-loop
  occurrence that isolates the earlier loop's bottom increment under gcse.
  If the target's last loop's counter register equals an earlier loop
  counter's register, write one shared variable.
- True multidimensional types even when a dimension is 1 (libsnd
  `[s_max][t_max]` tables with t_max == 1 for SEQ-only sound code); put the
  type in the globals override header.
- Literal bounds or simple `#define`s; plain signed int counters; `-1`
  sentinels; "max+1" constants for minimum scans.
- Codegen no-ops on GCC 2.95 (do not waste turns): `register`, declaration
  order, init-statement order, `if (var) {}` dead refs on locals,
  `do { } while (0)` fences. A named constant local (`s32 neg1 = -1;`)
  does shift materialization order and is clean C.
- Flat-initialized lookup tables written in natural ascending offset order:
  parallel arrays (e.g. a pointer run adjacent to a u16 count run) whose
  values are arithmetically related — each pointer the running sum of the
  counts times the element size (pool carving). Stored constants are rarely
  independent; mine them for structure (`analyzeStoreBlock.ts`) before
  treating a store block as a list of unrelated literals
  (validated 92/92 on func_80021E60).

## Final checklist

Before accepting a function:

1. semantics, constants, signedness, and addresses are decoded;
2. the source uses natural arrays, structs, operators, and expressions;
3. every nontrivial edit followed a classified diff or compiler trace;
4. no forbidden workaround, generated-global redeclaration, `_D_` symbol, or
   C99 construct was introduced;
5. the exact function diff is 100% AND byte-verified — a masked 100% cannot
   see symbol identity (two same-shaped globals transposed between registers
   still scores 100%); `diffFunc` auto-escalates to the linked-binary byte
   verdict and only "VERIFIED" counts; and
6. context export, the full binary check, modification-scope check, and
   clean-source gate pass.
