# Population residual — the two programs do not contain the same instructions

The owning passes are expand, cse, gcse, loop and combine. While the
populations disagree, no scheduling or allocation reading applies: a pass
downstream of the difference cannot add or remove an instruction, so
everything it appears to say is an artefact of the mismatch.

Fix semantics, types, control flow and idiom here. Nothing else.

Loaded on demand by `psx_reference`. Read the sheet for the pass the
pipeline reversal named, and only that one.

---

## 1. Decode semantics before searching source shapes

Do not fuzz syntax around a misread computation. If many different source
shapes diverge at the same early instruction, stop and recompute the target's
arithmetic, constants, signedness, and address.

### A control-flow diff is a semantics question until proven otherwise

The signature is an instruction-count delta **plus** branch-sense differences.
Before any allocation or scheduling interpretation, state in words what the
target computes and returns, read out of the target's own branches — not out
of the candidate, and not out of a header comment. An inherited comment is not
evidence; re-derive it. Two checks, both cheap:

- **Say what the function returns, from the target.** Name the compare, the
  branch sense, and which block each side reaches. A predicate that is
  inverted, or `<=` where the target has `<`, produces exactly the diff
  signature that reads as a web-parity or allocation blocker — and every
  downstream tool will analyse the wrong function without complaint.
- **Does a matched neighbour in the same TU disagree with you?** Prefer an
  already-matched sibling over the raw disassembly when one exists; it states
  the predicate unambiguously in C.

### Call wrappers and unchanged argument registers

Reconstruct a call from the complete ABI argument state at the `jal`, not only
from registers explicitly defined in the wrapper. Untouched `$a0`–`$a3` remain
live incoming arguments and may be forwarded directly to the callee. Their
absence from the wrapper's instruction stream does not mean they are unused.

After a prologue allocates `frame_size` bytes, an incoming stack argument at
`frame_size + 16 + 4*n($sp)` is argument `4+n`. Outgoing stores beginning at
`16($sp)` are callee arguments 4 onward. Use both facts to determine the
callee's full arity and argument mapping before diagnosing instruction-count,
web-parity, allocation, or scheduling differences.

GCC 2.95 places the first incoming stack argument at offset **16** from old
`$sp`, not 8 (the standard MIPS O32 ABI). The slot at offset 8 is unused.
Always use the `frame_size + 16 + 4*n` formula; applying the standard ABI
offset produces an argument count that is 2 too high (func_80015F80: 11
versus the correct 9).

### Indirect calls: live caller-saved registers are not proof of callback arity

At `jalr`, `$a1`--`$a3` may still contain meaningful-looking values that are
not arguments: an entry address used to load the function pointer, a dead table
base, or a value consumed in the call delay slot. O32 caller-saved registers do
not get cleared when their role ends. Inferring callback arity from every
nonzero argument register can therefore create extra call-setup copies and a
convincing web-parity failure.

For a function-pointer table, identify the plausible table members from data,
adjacency, callers, and the file group, then inspect which incoming argument
registers those callees actually read before redefining. Build the callback
prototype from the callee family and verify that prototype against the caller's
necessary setup instructions. If changing the prototype removes only compiled-
side argument copies and makes instruction count/web parity exact, treat that as
a semantic correction before any allocator analysis.

Validated on func_8001A574: `$a1` held the dispatch-entry address, `$a2` a table
base, and `$a3` a delay-slot offset, but the selected callback consumed only
`$a0`. See `notes/retros/2026-08-10-func_8001A574-retro.md`.

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

### Target registers are a web census

Before interpreting a register-role swap as an allocation event, read the
TARGET's hard-register usage as evidence about the original's variables: the
same hard register serving the same role in two different blocks (same-shaped
loads, disjoint windows) is one shared user variable more often than two
coincidentally colored locals — and near-certain when the coloring repeats in
sibling functions of the same TU. A variable set in two blocks is a global
allocno, so local-allocation tie analysis does not apply to it at all; its
register comes from conflicts with overlapping locals. See
`notes/research/func_80017E34-shared-web-global-allocno.md`.

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
  `psx_analyze_store_block`. It mines the target for
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

### Epilogue return/join rotations are a shallow CFG-shape problem first

A small scheduling residual can consist solely of a constant return move
crossing stack restores:

```text
target:     move v0,zero; lw ra,...; lw s0,...
candidate:  lw ra,...; lw s0,...; move v0,zero
```

When instruction count, inventory, web parity, and the rest of the body are
exact, test source-level return/join provenance before modelling scheduler
state. Semantics-equivalent C control flow can produce different basic-block
notes and post-reload scheduling even when every executable body instruction is
unchanged. Batch only the natural forms justified by the target's own branch
senses:

```c
/* Positive body with one trailing return. */
if (active) {
    body();
}
return 0;

/* Inverted guard with the same body and result. */
if (!active) {
    return 0;
}
body();
return 0;
```

Also test a return in each predecessor when that reflects the source logic.
Do not invert a predicate from the candidate by algebra alone: read the target
branches and state which path reaches the body. A named zero local is a
constant-birth experiment, not a CFG experiment, and often compiles identically.
`explainDiff.ts` prints `EPILOGUE RETURN/JOIN SIGNATURE` when it recognizes this
exact residual. Run the required trace once, then try this small batch before
target-schedule analysis, scheduler-state search, or broad source grammars.

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

**Spot-check every negative result before believing it.** A search's
"exhausted, no exact match" is a claim about its own domain and its own
canonicalization, not about the world — one residual search reported
`exhausted-no-exact` while holding a byte-exact candidate, because cc1 spells
negation `subu $t0,$zero,$a1` and the disassembler prints the same word as
`negu t0,a1`. Check the best-scoring class against `psx_residual_objective` before ending a
search on a negative: its `EXACT` verdict is a byte comparison and does not
care how a disassembler spells a word. And no pre-link comparison is itself the
verdict — it can false-fail byte-identical code. `psx_finalize_function`, which
includes `make check`, is the verdict. See
`notes/research/tooling-false-verdicts.md`.

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

Do not launch alternate-source compiles concurrently. They can share
intermediate paths; concurrent runs have produced one variant's
frame/allocation under another variant's label. Use `psx_fuzz_variants`, the
isolated search tools, or one `psx_residual_objective` call listing every
candidate; otherwise serialize them.

A residual-source-space `deriveOnly` run compiles a bounded pilot sample to
price the full domain. Inspect the preserved source for its best pilot classes
before deciding whether to exhaust the domain. The pilot itself can expose the
missing declaration initializer, web reuse, or statement interaction. Confirm
any promising class with the sequential exact function oracle; search scores
may align delay slots or compiler instructions differently from the relocated
byte comparison.

## 8. Control flow and native compiler idioms

### Switches

Use a `switch` when the target has jump-table dispatch. The compiler supports
it, and matched witnesses exist (`func_8001A8D0`, `func_80013B04`,
`func_80011370`). Case body order matters because bodies are emitted in source
order; reorder case clauses to match binary layout rather than replacing the
switch with an if/else chain.

The target's fingerprint is a bounds check into a table load and a computed
jump:

```asm
sltiu $v0, $v1, 0x7                  # case count
beqz  $v0, .Ldefault
lui   $v0, %hi(jtbl_8001005C)        # 2.95.2 loads the table with lui+addiu,
addiu $v0, $v0, %lo(jtbl_8001005C)   # not GP-relatively
sll   $v1, $v1, 2
addu  $v1, $v1, $v0
lw    $a0, 0x0($v1)
jr    $a0
```

The table itself lives in a `.rodata` segment attached to the function, not in
the function's own `.s`. `psx_m2c` detects `jtbl_*` references and passes the
rodata file automatically; without it m2c raises `DecompFailure` on the
computed jump and produces nothing.

**A table whose entries are function symbols is a symbol-boundary signal, not
a tail-call dispatch table.** If the targets land inside another function's
range they are case labels the symbol map promoted — see
`notes/research/symbol-boundary-verification.md` §1a, where exactly this was
misread as needing a top-level `__asm__` block.

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

