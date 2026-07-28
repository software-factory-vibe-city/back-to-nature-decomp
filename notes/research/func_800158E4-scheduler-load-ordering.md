# func_800158E4 — narrow loop metadata resolves a global allocation swap

**Status: SOLVED in clean C.** `src/func_800158E4.c` matches all **77/77
instructions**. The full binary check passes. The matching source contains no
embedded assembly, hard-register pinning, compiler flag override, or assembly
stub.

## 1. Executive summary

The difficult part of this function was not reconstructing its behavior. Once
the types, arithmetic, and control flow were corrected, GCC emitted the same 77
opcodes in the same order as the target. The final clean candidate still put two
overlapping, long-lived values in the opposite temporary registers:

| Value | Target | 71/77 candidate |
|---|---:|---:|
| table element pointer | `$t0` | `$t1` |
| masked state flags | `$t1` | `$t0` |

That swap affected only six instructions, but it prevented byte identity.
`explainDiff.ts` classified the 71/77 candidate as pure `register-allocation`:
all 77 opcodes matched, and a consistent `$t0` ↔ `$t1` renaming explained every
remaining difference.

The exact clean-C fix was to load the signed table limit into a named temporary
inside a very narrow single-iteration loop:

```c
s32 temp_table_limit;

/* ... */

temp_a1 = temp_t1 | 0x100;
do {
    temp_table_limit = temp_t0->field_0;
} while (0);
if ((s32)(temp_v0 & 0xFF) >= temp_table_limit) {
    /* ... */
}
```

The `do { ... } while (0)` emits no branch and no loop-control instruction.
It does, however, leave loop notes around the signed table load through the
allocation passes. GCC's loop-sensitive reference accounting then allocates
the table pointer before the masked-flags web:

- table pointer → `$t0`;
- masked flags → `$t1`;
- loaded signed limit → `$v1`;
- incremented frame index and comparison result → `$v0`.

Restricting the loop to the one load was essential. Wrapping the whole
comparison also fixed `$t0`/`$t1`, but disturbed local allocation and load-delay
scheduling, added a `nop`, and produced 78 instructions.

This note supersedes the earlier conclusion that the function was blocked by
an unavoidable scheduler limitation.

## 2. Function behavior

The function updates animation or frame state stored in `Struct_S`:

1. Return without updating when `field_0 & 4` is set.
2. Select a four-byte table entry using `field_4` and `field_28`.
3. Select a ten-byte frame entry using the table entry's `field_2`, `field_5`,
   and `field_2C`.
4. Clear flag bits `0x0300` from `field_2` and increment `field_6`.
5. Compare the signed timer against half of the frame entry's timing byte.
6. On expiry, reset the timer, advance `field_5`, and process the selected
   frame entry's control byte and flag bits.
7. Set `D_8005E43C` to one whenever the outer update executes.

The local layouts proven by access width and offsets are:

```c
typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ u16 field_2;
} Struct_T; /* sizeof = 4 */

typedef struct {
    /* 0x00 */ char pad_0[6];
    /* 0x06 */ u8 field_6;
    /* 0x07 */ u8 field_7;
} Struct_A;
```

Important semantic details include:

- `Struct_T.field_0` is signed because the target uses `lh`.
- `Struct_T.field_2` and `Struct_S.field_2/field_6` use `lhu`/`sh`.
- The frame-entry stride is ten bytes, emitted as `4i + i`, then doubled.
- `(s16)temp_v1` produces the target `sll 16` / `sra 16` sign extension.
- `++arg0->field_5` produces the required load, increment, store, and retained
  incremented value without a reload.

## 3. Progression to the final allocation-only mismatch

The resumed clean source initially matched 52/77 instructions. Four deliberate
source-shape changes reproduced the target's instruction selection and
schedule:

1. **Assign the timing threshold in the comparison.**

   ```c
   if ((s16)temp_v1 >=
       (s32)(temp_a2 = (u32)(temp_a0->field_6 + 1) >> 1)) {
   ```

   This aligned the threshold web's birth and use with the target.

2. **Use the natural pre-increment expression for `field_5`.**

   ```c
   temp_v0 = ++arg0->field_5;
   ```

   This retained the increment result for the comparison and avoided the wrong
   operand web.

3. **Write the two initial stores in the source order required by the backward
   scheduler.**

   ```c
   arg0->field_2 = temp_t1;
   arg0->field_6 = temp_v1;
   ```

   GCC emits these in the target's opposite machine order: `field_6` first,
   then `field_2`.

4. **Keep the natural table and frame address expressions.**

   ```c
   temp_t0 = (Struct_T *)(arg0->field_28
       + (arg0->field_4 * sizeof(Struct_T)));
   temp_a0 = (Struct_A *)(arg0->field_2C
       + temp_t0->field_2
       + (arg0->field_5 * 0xA));
   ```

After these changes the candidate was 71/77. Instruction selection, load order,
store order, branches, delay slots, relocations, and instruction count all
matched. Only the two global register assignments remained reversed.

## 4. The 71/77 allocator diagnosis

In the 71/77 trace, the relevant global pseudos were:

| Candidate pseudo | Meaning | Flow summary | Assignment |
|---:|---|---|---:|
| 82 | carried table pointer | 3 references across 33 instructions | `$t1` |
| 108 | masked flags | 3 references across 19 instructions | `$t0` |

The global allocation order ended with:

```text
... 120 108 87 82
```

The masked flags therefore claimed `$t0` before the conflicting table pointer,
leaving `$t1` for the pointer. The resulting exact differences were:

```text
addu target: t0,v1,v0       candidate: t1,v1,v0
lhu  target: a2,2(t0)       candidate: a2,2(t1)
andi target: t1,v0,0xfcff   candidate: t0,v0,0xfcff
sh   target: t1,2(a3)       candidate: t0,2(a3)
lh   target: v1,0(t0)       candidate: v1,0(t1)
ori  target: a1,t1,0x100    candidate: a1,t0,0x100
```

This was not an instruction-selection or source operand-order problem. A
single consistent hard-register renaming explained the complete diff.

## 5. Why most plausible source changes failed

### 5.1 Equivalent pointer expressions disappeared before allocation

The following families all returned to the same allocator input:

- pointer aliases;
- block-local aliases on the taken edge;
- pointer `+= 0` or `-= 0`;
- byte-pointer casts plus zero;
- self-indexing expressions that simplify to zero;
- pointer/integer union round trips;
- declaration-order changes;
- `register` storage class without hard-register pinning;
- repeated base/index expressions CSE'd to the same carried pointer.

CSE, combine, or regmove removed the additional copy or identity operation
before it could affect global allocation. They remained 71/77.

### 5.2 A dead post-increment changed early RTL but not allocation

Using the final access as:

```c
(temp_t0++)->field_0
```

created a second source-level pointer set in early RTL. Because the incremented
pointer was dead, optimization removed the update before global allocation.
The final machine code and `$t0`/`$t1` swap were unchanged.

### 5.3 A live post-increment proved the multi-set mechanism

Keeping the incremented pointer live and compensating the final address:

```c
temp_a0 = /* ... */ + (temp_t0++)->field_2 + /* ... */;
if (value >= (temp_t0 - 1)->field_0) {
```

reversed the global allocation exactly:

- table pointer became `$t0`;
- masked flags became `$t1`.

It reached 74/77, but necessarily emitted:

```text
addiu t0,t0,4
lh    v1,-4(t0)
```

instead of the target's no-update `lh v1,0(t0)`. This was strong causal
evidence, not a promotable solution.

### 5.4 Multi-set table construction fixed allocation but damaged the input web

Constructing the pointer as a base assignment followed by typed compound
addition also raised its allocation priority:

```c
temp_t0 = (Struct_T *)arg0->field_28;
temp_t0 += arg0->field_4;
```

However, the base load then entered the same user web and was allocated to
`$t0`. The candidate emitted `lw t0,40(a3)` and `addu t0,t0,v0`, whereas the
target requires a dying base in `$v1` followed by `addu t0,v1,v0`. Scheduling
also changed as a consequence.

### 5.5 Inline assembly was diagnostic proof, not a solution

A zero-instruction `__asm__ volatile` dependency produced 77/77, proving that
the remaining problem was allocator recurrence rather than semantics or
instruction selection. The clean-source finalizer correctly rejected it. It
was removed and never promoted.

## 6. Discovering the loop-metadata lever

A single-iteration loop around the entire table comparison was the first clean
C shape to reverse the allocation without pointer arithmetic:

```c
do {
    if ((s32)(temp_v0 & 0xFF) >= temp_t0->field_0) {
        /* ... */
    }
} while (0);
```

The relevant global registers became correct through instruction 31:

```text
addu t0,v1,v0
lhu  a2,2(t0)
andi t1,v0,0xfcff
sh   t1,2(a3)
```

But the loop covered too much. Local allocation around the comparison changed
to the wrong roles, the signed table load could no longer hide its load delay,
and GCC inserted a `nop`. The candidate had 78 instructions and shifted the
rest of the function.

This established two facts:

1. Loop metadata was sufficient to reverse the table/flags allocation.
2. The metadata had to affect the table pointer without enclosing the local
   counter-mask-and-compare web.

## 7. Exact fix: loop only the signed table load

The final source introduces a named signed limit and places only its load
inside the single-iteration loop:

```c
temp_a1 = temp_t1 | 0x100;
do {
    temp_table_limit = temp_t0->field_0;
} while (0);
if ((s32)(temp_v0 & 0xFF) >= temp_table_limit) {
    arg0->field_2 = temp_a1;
    /* ... */
}
```

The pre-allocation RTL contains:

```text
NOTE_INSN_LOOP_BEG
(set temp_table_limit
     (sign_extend (mem:HI table_pointer)))
NOTE_INSN_LOOP_END
```

The notes survive through global allocation even though no machine loop is
emitted. In the exact candidate, pseudo numbers after adding the named limit
are:

| Candidate pseudo | Meaning | Assignment |
|---:|---|---:|
| 82 | table pointer | `$t0` |
| 109 | masked flags | `$t1` |
| 86 | flags with `0x100` set | `$a1` |
| 91 | signed table limit | `$v1` |

The global allocation order now places the table pointer before the masked
flags:

```text
... 81 83 82 86 109 87
```

The narrow scope preserves the original local instruction sequence:

```text
lbu   v0,5(a3)
sh    zero,6(a3)
addiu v0,v0,1
sb    v0,5(a3)
lh    v1,0(t0)
andi  v0,v0,0xff
slt   v0,v0,v1
bnez  v0,...
ori   a1,t1,0x100
```

The independent `andi` fills the signed load's delay, so no `nop` is added.
Every later instruction retains its target register and schedule.

## 8. Verification

The promoted source was checked with the exact function oracle:

```text
Match: 77/77 instructions (100.0%)
```

The full binary `make check` also passed. The clean-source scan found no asm,
register pins, assembly stub, or flag override. During the original function
turn, the combined finalizer's only reported failure was modification scope for
this research note itself; exact diff, full build, and source policy passed.

Primary preserved evidence:

- `src/func_800158E4.c` — promoted exact source;
- `build/functions/func_800158E4.s` — target assembly;
- `build/fuzz/func_800158E4/04eb88d082b1b86d/` — exact narrow-loop experiment;
- `build/fuzz/func_800158E4/633124ba1b1e5e60/` — whole-comparison loop experiment;
- `build/fuzz/func_800158E4/a2ee0aa512baf187/` — live pointer increment evidence;
- `build/fuzz/func_800158E4/e459b2ad82c1dd46/` — multi-set pointer construction.

`build/` artifacts are diagnostic and may be regenerated or cleaned; this note
is the durable record.

## 9. Reusable lessons

1. **A same-opcode diff can still require a source-level control construct.**
   The final mismatch looked like a simple two-register swap, but the clean
   lever was loop metadata around one expression.
2. **Trace allocation before perturbing scheduling.** The wrong hard registers
   created downstream scheduler hazards; statement permutations did not solve
   the allocator's input.
3. **Treat a no-effect variant as pass evidence.** Identity pointer operations
   and aliases were removed before allocation, which ruled out entire source
   families rather than merely producing bad percentages.
4. **A lower-scoring experiment can reveal the right mechanism.** The live
   post-increment and whole-comparison loop were not promotable, but each proved
   one half of the final solution.
5. **Control the scope of compiler metadata.** Wrapping the whole comparison
   fixed global allocation and broke local allocation. Wrapping only the load
   retained both.
6. **A diagnostic exact match is not automatically a valid solution.** The
   inline-assembly result proved the register diagnosis but failed policy.
7. **Do not infer impossibility from a stable allocator swap.** The previous
   note parked this function at a much earlier frontier. GCC's source-visible
   metadata provided a clean lever that ordinary expression rewrites could not.

The exact source shape demonstrates what this compiler needs for byte identity.
It does not by itself prove that the original programmer wrote the identical
`do { ... } while (0)` construct, but it is a clean, reproducible C89 solution
under the project's verified compiler and flags.
