# C Style Guide for PSX Decompilation

Idiomatic C patterns that produce correct codegen with old (2.x-era) PSY-Q GCC at `-O2` on MIPS I. When two C expressions are semantically equivalent, the simpler one almost always matches the original programmer's intent — and the original compiler output. Concrete toolchain facts (compiler version, flags, `-G` threshold, SDK version) are in the **project profile** injected alongside this guide.

**The project's compiler is proven byte-identical to the one that built the original binary** (see project profile). For every function that was originally C, clean matching source exists. If you cannot find it, STOP and report the diff signature — do not reach for inline asm, `register __asm__` pinning, or flag overrides. Scheduling barriers (below) are the one tolerated workaround, and even they require a justification comment and are treated as debt pending re-validation.

## Array and pointer access

### GP-relative indexed access

When the assembly shows `sll` + `addiu $reg, $gp, %gp_rel(sym)` + `addu` + `lw/sw`, this is indexed array access into a GP-relative variable. Use the simple array form:

```c
/* GOOD — clean array indexing */
(&D_8005E4C8)[arg0] = arg1;

/* BAD — pointer arithmetic produces the same instructions but is unreadable */
*(s32 *)((u8 *)&D_8005E4C8 + (arg0 << 2)) = arg1;
```

If the instruction ordering doesn't match (e.g., `sll` before `addiu` in the target but `addiu` before `sll` in your output), use a scheduling barrier — see "Scheduling barriers" below.

### Use `array[index]` not pointer arithmetic

```c
/* GOOD */
value = D_80048190[i];

/* BAD — equivalent but may reorder instructions */
value = *(D_80048190 + i);
value = *((s32 *)((char *)D_80048190 + i * 4));
```

### Use struct field access, not offset casts

```c
/* GOOD */
obj->field_0C = 1;

/* BAD */
*(s32 *)((char *)obj + 0x0C) = 1;
```

Pointer-cast chains produce different instruction ordering than struct access, even when they compute the same address.

## Expression simplicity

### Prefer the simplest expression that matches the semantics

The original programmers wrote straightforward C. When you see a pattern, write the obvious version first:

```c
/* GOOD — what a programmer would write */
result = table[index];
obj->flags |= 0x10;
if (count > 0) { ... }

/* BAD — over-engineered equivalents */
result = *((s32 *)((u8 *)table + (index << 2)));
*(s32 *)((char *)obj + 0x08) = *(s32 *)((char *)obj + 0x08) | 0x10;
if (count >= 1) { ... }
```

### Don't fight the compiler — match the assembly pattern

If the assembly does something one way, write C that naturally produces that pattern:

| Assembly pattern | C pattern |
|---|---|
| `sll` then `addu` then `lw/sw` | Array index: `arr[i]` or `(&var)[i]` |
| `addiu` from `$gp` | GP-relative scalar or small array access |
| `lui` + `addiu`/`lw`/`sw` | Absolute-addressed global (> 8 bytes) |
| `lw` + field offset | Struct field: `ptr->field` |
| `sll $a0, $a0, 2` before base addr | Index is first operand: `arr[index]` |
| Base addr before `sll` | Pointer arithmetic: `*(base + offset)` |

## Reconstruct expressions, not assembly-shaped temporaries

A named temporary is not free in pre-SSA GCC. Reusing one local for several
independent loads gives the compiler one multi-death pseudo, often forcing it
through global allocation. Translating each assembly instruction into a C
statement can therefore lock in the wrong register structure even when every
statement is semantically correct.

Before manipulating allocator preferences, write the complete operation a
programmer would naturally write. For a component-wise pointer walk:

```c
/* BAD reconstruction — one reusable RHS pseudo dies in every check. */
rhs = *q;
q++;
delta = *p;
delta -= rhs;
p++;

/* GOOD natural expression — fresh operand pseudos for this component. */
delta = *p++ - *q++;
```

The good form may create *more* RTL pseudos. That is often desirable: each load
gets a fresh, single-set, short-lived pseudo eligible for local allocation,
while only `delta` remains a recurring user web. In `func_8001E7DC`, this one
change turned a 14-pseudo global-allocation deadlock into a 19-pseudo exact
match: the pointer moved from incoming `$a0` to `$a2`, the RHS load naturally
used the freed `$a0`, and the result stayed in `$v1`.

### Signature: the reconstructed temp web is probably wrong

Try a fused natural expression early when all of these are true:

1. The computation and opcode sequence are already correct or nearly correct.
2. The diff is a stable register-role swap, especially pointer versus loaded
   operand.
3. The target moves an argument out of its incoming `$a0`–`$a3` register and
   immediately reuses that hard register for a load or short-lived result,
   while the candidate keeps the argument there and omits the move.
4. `compilerTrace.ts` shows a reused operand temporary with multiple deaths and
   a `global/reload` assignment.
5. Reordering statements changes priorities or scheduling but never gives the
   temporary the target hard register.

### Directed fix recipe

1. Keep a named local only for a value that is semantically carried across
   statements, such as the recurring `delta` or bound.
2. Remove named locals used only to spell out one operation's operands.
3. Fuse the load, arithmetic, and natural pointer update into the consuming
   expression: `result = *p++ - *q++`, `sum += *p++`, or the analogous array or
   struct expression.
4. For a final non-walking operation, use the corresponding non-incrementing
   form, such as `result = *p - *q`.
5. Run `diffFunc.ts`. For a remaining allocation mismatch, run
   `compilerTrace.ts` again and verify that the old multi-death user pseudo was
   replaced by fresh local pseudos. Do not judge a candidate by having fewer
   pseudos; judge the final instructions.

This is related to, but distinct from, using a fresh *result* temporary for a
commutative operand-order mismatch. The general rule is to vary the RTL web
shape deliberately:

- reused named operand → one longer or multi-death web;
- fused expression operands → fresh short-lived compiler webs;
- reused result variable → destination overlaps an input web;
- fresh result variable → independent destination web.

Preserve semantics and signedness. Fuse one natural operation at a time rather
than building an artificial giant expression, and verify each change with the
exact diff oracle.

## Instruction ordering

Old GCC evaluates expressions roughly left-to-right and emits instructions following the expression tree structure. This means:

### Operand order in source = instruction order in output

```c
/* Produces: load a, load b, add */
result = a + b;

/* Produces: load b, load a, add */
result = b + a;
```

If the diff shows correct instructions in the wrong order, check whether swapping operands or reordering statements fixes it.

### Field access order matters

```c
/* If assembly reads offset 0x10 before 0x04: */
x = obj->field_10;
y = obj->field_04;

/* NOT: */
y = obj->field_04;
x = obj->field_10;
```

## Tool-assisted classification

Do not use `diffFunc.ts`'s aggregate percentage as the diagnosis. It is the
exact match oracle, but source changes should be selected from a structural
classification first:

```bash
npx tsx tools/agent/explainDiff.ts <func>
npx tsx tools/agent/compilerTrace.ts <func>  # allocation/scheduling cases
npx tsx tools/agent/diffFunc.ts <func>       # exact progress oracle
```

`explainDiff.ts` compares target and compiled objects while normalizing
relocation aliases and tracking both hard registers and separate live-range
webs. Apply its categories as follows:

| Category | First response |
|---|---|
| `register-allocation` | Change temporary birth, reuse, lifetime, declaration order, or statement order |
| `operand-order` | Change fresh-result vs. input-reuse structure; use natural address forms for address `addu` |
| `scheduling` | Reorder independent statements, fuse/split the expression birth site, or reproduce variable dependencies |
| `instruction-selection` | Fix types, signedness, casts, idioms, control flow, or extern shape |
| `relocation-or-immediate` | Check declarations and linked-layout/GP noise before changing C |
| `mixed-operands` / `scheduling-and-operands` | Inspect compiler pass dumps before further source search |

`compilerTrace.ts` stores GCC 2.95 `-da` dumps under
`build/compilerTrace/<func>/`. Its report distinguishes assignments visible in
`.lreg` from those appearing only post-local in `.greg`, and summarizes
scheduler decisions in `.sched`/`.sched2`. The `priority~` field approximates
the GCC quantity priority from stock dump data; it is evidence, not an exact
quantity trace. Compare traces from deliberately different source shapes and
state which pseudo lifetime, conflict, or pass decision each edit is intended
to change.

If `explainDiff.ts` cannot find archived original assembly, fall back to
`diffFunc.ts`; do not interpret a diagnostic setup failure as a source diff.

## Scheduling barriers (governed workaround — last resort)

GCC's instruction scheduler reorders independent instructions to hide pipeline stalls. The original PSY-Q toolchain did not always do this. When you get a 100% instruction match except for ordering of independent instructions — and only after exhausting operand-order and statement-order fixes — a zero-cost barrier is permitted:

```c
__asm__ volatile("" : "=r"(var) : "0"(var));
```

This emits zero instructions. It tells GCC that `var` is consumed and produced at that point, preventing instruction movement across it.

### Interleaved pointer loads

When loading two absolute-addressed pointers, GCC interleaves the `lui+lw` pairs. The original keeps them sequential. Fix:

```c
/* Target: lui v0 / lw v0 / lui v1 / lw v1 (sequential) */
/* GCC:    lui v0 / lui v1 / lw v0 / lw v1 (interleaved) */

Foo *a = GLOBAL_A[0];
__asm__ volatile("" : "=r"(a) : "0"(a));  /* barrier: complete a before starting b */
Foo *b = GLOBAL_B[0];
```

Only needed for absolute-addressed symbols (outside GP range). GP-relative loads are single instructions and don't get interleaved. Existing barrier examples in this project: grep `src/` for `__asm__ volatile`.

Every barrier must carry a comment stating the exact target-vs-GCC ordering it fixes. Barriers are tracked debt: they are periodically re-tested and removed when clean C is found to match without them.

### Address load before ALU op

GCC emits address loads (`la`/`addiu $gp`) before independent shifts. The original has the shift first. Fix:

```c
/* Target: sll a0 / addiu v0,gp,offset / addu a0,a0,v0 */
/* GCC:    addiu v0,gp,offset / sll a0 / addu a0,a0,v0 */

/* Natural C (mismatches): (&D_8005E4C8)[arg0] = arg1; */

/* With barrier (matches): */
arg0 <<= 2;
__asm__ volatile("" : "=r"(arg0) : "0"(arg0));
base = &D_8005E4C8;
*(s32*)((char*)base + arg0) = arg1;
```

## Escape hatch: read the exact compiler source

When a function resists the playbook — especially allocation or scheduling
mismatches that survive many mechanism-targeted source edits — stop
permuting and read the compiler. The exact GCC 2.95.2 sources are vendored
at `notes/scratch/gcc-2.95.2-reference/` (`local-alloc.c`, `sched.c`); if
absent, fetch `local-alloc.c` and `sched.c` from the gcc-mirror GitHub
(`releases/gcc-2.95.2` tag). One hour reading allocator source replaces
days of blind source search. This is diagnostics-only: never patch or
instrument cc1 itself, since that would invalidate toolchain identity.

Mechanisms already extracted (full case study:
`notes/research/func_8001B4E4-scheduler-allocator-resolution.md`):

| Mechanism | Where | Consequence for source shape |
|---|---|---|
| local-alloc eligibility: `REG_BASIC_BLOCK >= 0 && REG_N_DEATHS == 1` | `local_alloc` | A variable reassigned to *independent* values dies multiple times → global-alloc → will not reproduce a tight register relay race (deterministic — same RTL, same compiler, same output). Reassignment that *reads* the variable (`x <<= 1`, `p += n`) keeps one continuous range: stays local AND still creates anti-dependencies that pin the scheduler. |
| Dying-input tie (`combine_regs`) | `block_alloc` insn scan | An output shares the register of an input that dies in the same insn. The `addu v0,v0,v1` / `addu a0,a0,v0` relay chains come from *fresh* pseudos tying to dying inputs, not from variable reuse. |
| Hard-register suggestions | `combine_regs` hard-reg path | A pseudo born where a hard register dies (argument's last use) inherits it; suggested quantities are allocated first, with true lifetimes. This is how a temp lands in `$a0`–`$a3`. |
| Priority `floor_log2(refs)*refs*size/(death-birth)`, ties → birth order | `QTY_CMP_PRI` | Short-lived, multiply-referenced quantities grab registers first. Birth position (which statement expands an expression) is a controllable input. |
| Fake lifetimes (±1 insn) with `-fschedule-insns2` | `block_alloc` tail | Quantities pseudo-conflict across one-instruction gaps; shifting a birth by one statement can change its register. |
| Pre-alloc scheduler is a backward list scheduler; `potential_hazard` tie-break favors memory-unit insns | `sched.c` `schedule_select` | Independent stretches do NOT keep source order — they bubble. Only dependencies (data, anti, memory output) pin order. |
| Store output deps require may-alias | alias analysis via cselib base values | Stores through provably-distinct symbol bases (`&A+x` vs `&B+y`) are freely reorderable. Sequential target stores with independent address chains imply an arg-death/RMW structure, not variable reuse. |

## Declarations

### Don't redeclare globals from `globals.h`

`common.h` includes `globals.h`, which declares all `D_XXXXXXXX` symbols with correct addressing modes. Do NOT add your own `extern` declarations for symbols that are already there:

```c
/* BAD — conflicts with globals.h macro */
extern s32 D_80061F08;

/* GOOD — just use it, it's already declared */
D_80061F08 = value;
```

However, some symbols (e.g., `.sdata` symbols defined by splat) are NOT in `globals.h`. For those, you DO need a local extern. Check whether the symbol compiles without a declaration before adding one.

### NEVER use `_D_XXXX` — use `&D_XXXX` instead

`globals.h` macros expand `D_XXXX` to a dereference: `(*((s32*)_D_XXXX))`. To get the address, use `&D_XXXX` — it naturally cancels the dereference:

```c
/* GOOD — &D_XXXX gives the address */
s32 *base = &D_8006C838;

/* BAD — uses internal __asm__ identifier, leaks implementation detail */
s32 *base = (s32 *)_D_8006C838;
```

**NEVER reference `_D_XXXX`** (the underscore-prefixed internal name) in source files. This is an internal implementation detail of `globals.h`. If you find yourself writing `_D_`, you are doing it wrong — use `&D_` to get the address.

### Match the extern type to the access pattern

```c
/* Assembly: lbu → unsigned byte */
extern u8 D_80062000;

/* Assembly: lh → signed halfword */
extern s16 D_80062004;

/* Assembly: lw → word (s32 or pointer) */
extern s32 D_80062008;
```

### GP-relative vs absolute: match the addressing mode

The `-G` small-data threshold (value in the project profile) means externs declared **at or below the threshold** get GP-relative addressing (single `lw %gp_rel(sym)($gp)` instruction). Larger externs get absolute addressing (`lui` + `lw %lo(sym)($reg)` two-instruction pair).

**If the assembly shows `lui`/`lw` but your code emits `lw %gp_rel`, your extern declaration is too small.** This is the most common cause of addressing mode mismatches.

Fix: declare the extern as something above the threshold. Common patterns (assuming an 8-byte threshold):

```c
/* 4-byte pointer → GP-relative (WRONG if asm shows lui/lw) */
extern SomeStruct *D_8005E3AC;

/* Array of 3 pointers → 12 bytes → absolute (CORRECT if asm shows lui/lw) */
extern SomeStruct *D_8005E3AC[3];
/* Then access as: D_8005E3AC[0]->field */
```

This happens when the original source file declared multiple variables together (e.g., as part of the same array or struct), making the total declaration exceed the threshold, even though each individual access only uses one element.

### Switch statements

Old GCC compiles switch statements predictably, including jump table dispatch. Use them freely.

**Case order matters.** The compiler emits case bodies in source order. If the diff shows the right case values but in the wrong order, reorder the cases in your switch to match the original binary's layout:

```c
/* If the original binary has case bodies in order: 99, 98, 105, 106, 107, 0xFFFE, default */
switch (x) {
    case 23: return 99;   /* emitted first */
    case 53: return 98;   /* emitted second */
    case 35: return 105;  /* etc. */
    case 30: return 106;
    case 31: return 107;
    case 0:  return 0xFFFE;
    default: return 4093;
}
```

### Prefer natural C over hand-tuned variables

The register allocator often picks the right registers with natural C. Don't manually name variables `v0`/`v1` or hand-order assignments to influence allocation — write the simplest C first:

```c
/* GOOD — natural, often matches */
arg0->field_0 -= arg1->field_0;
arg0->field_4 -= arg1->field_4;
arg0->field_8 -= arg1->field_8;

/* BAD — hand-tuned for a different compiler's allocator */
s32 v0 = arg0->field_0;
s32 v1 = arg1->field_0;
v0 = v0 - v1;
/* ... carefully ordered to steer register assignment ... */
```

### Register allocation: do NOT pin registers

If the target uses registers the compiler won't naturally pick, that means your C's temporary-variable structure differs from the original — not that the compiler needs forcing. Restructure: change declaration order, introduce or eliminate temporaries, swap operand order, change types (`s16` vs `s32`).

**Do not use `register __asm__` pinning.** Existing uses in `src/` are legacy from before this project's toolchain was verified, and have repeatedly proven unnecessary when re-tested with plain natural C. If you are truly stuck after restructuring, stop and report the diff — a stuck function is useful signal, a pinned match is not.

## Legacy hacks: strip first, decode the idiom

Some older `src/` files contain `register __asm__` pins, scheduling barriers, or hand-written asm dating from before the toolchain was verified. When you touch such a file, your first move is **strip and re-test** — in the 2026-07 sweep, 15 of 18 pinned files matched clean with zero or minor restructuring. A 100% match tells you nothing about whether a hack is needed; only stripping does. Comments claiming a pin is "required" were wrong every single time they were re-tested.

Protocol:

1. Remove `__asm__("reg")` from declarations (keep the temp variables themselves) and any barrier/forged-asm lines. Run `diffFunc`.
2. Still 100% → done; the hack was residue.
3. Not 100% → run `explainDiff.ts`; for allocation/scheduling/mixed results also run `compilerTrace.ts`, then fix the reported class (usually temp structure or statement order — see "Register allocation" above and "Instruction ordering").
4. Cannot restore 100% → restore the hacked file exactly (`git checkout src/<file>`) and record the diff signature. Never leave a file in a non-matching state.

### Hand-written asm is usually a native C operator

Agents sometimes hand-forge instructions the compiler generates on its own. Before concluding any asm is needed (in an existing file or in code you are writing), decode the pattern:

| Asm pattern | What it actually is |
|---|---|
| `sll x,16` + `sra x,16` | `(s16)` cast |
| `sll x,24` + `sra x,24` | `(s8)` cast |
| `div $zero,a,b` + `mflo` + `bnez b` + `break 7` | plain signed `a / b` (`mfhi` for `%`) — GCC emits the zero-check automatically |
| `lui`/`ori` magic constant + `multu` + `mfhi` (+ shifts) | unsigned division/modulo by a constant (e.g. `0x92492493` → ÷7; an even divisor may appear as a shift plus magic: `/14` = `>>1` then magic ÷7) |
| forged `addiu x,x,1` | plain `x + 1` / `x++` |
| label-only asm lines (`_L8001E818:`) | block markers — delete them; `goto` labels generate their own |

Every one of these has been found hand-written in this repo where the plain C operator produces byte-identical output.

### CSE of address high halves

The compiler has aggressive common subexpression elimination. When two globals share the same `lui` high half, the compiler merges them into one `lui`. The original binary may have two independent `lui` instructions. This is a known limitation — scheduling barriers do NOT prevent CSE.

### Declare locals at the top of the block (C89)

```c
void func(void) {
    s32 i;
    s32 *ptr;
    /* statements after ALL declarations */
    ptr = &D_8005E4C8;
    for (i = 0; i < 10; i++) { ... }
}
```

## Common patterns

### Boolean return from global

```c
/* "return nonzero" pattern — sltu $v0, $zero, $v0 */
return D_80061F1C != 0;
```

### Array setter/getter

```c
/* setter: sll + addiu gp_rel + addu + sw */
void set(s32 index, s32 value) {
    (&D_8005E4C8)[index] = value;
}

/* getter: sll + addiu gp_rel + addu + lw */
s32 get(s32 index) {
    return (&D_8005E4C8)[index];
}
```

### Void return with single store

```c
/* lui + sw: absolute-addressed store */
void func(void) {
    D_80061F08 = 0;
}
```

### Casting for signedness

```c
/* slt = signed comparison */
if (a < b) { ... }

/* sltu = unsigned comparison */
if ((u32)a < (u32)b) { ... }
```
