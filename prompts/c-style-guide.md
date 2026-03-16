# C Style Guide for PSX Decompilation

Idiomatic C patterns that produce correct codegen with GCC 2.8.1-psx `-O2 -G8 -mips1`. When two C expressions are semantically equivalent, the simpler one almost always matches the original programmer's intent — and the original compiler output.

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

## Instruction ordering

GCC 2.8.1-psx evaluates expressions roughly left-to-right and emits instructions following the expression tree structure. This means:

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

## Scheduling barriers

GCC's instruction scheduler reorders independent instructions to hide pipeline stalls. The original PSY-Q toolchain did not always do this. When you get a 100% instruction match except for ordering of independent instructions, use a zero-cost barrier:

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

Only needed for absolute-addressed symbols (outside GP range). GP-relative loads are single instructions and don't get interleaved. See `src/func_80013AA4.c`.

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

See `src/func_8001B4D0.c`.

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

The `-G8` flag means externs declared as **8 bytes or smaller** get GP-relative addressing (single `lw %gp_rel(sym)($gp)` instruction). Externs **larger than 8 bytes** get absolute addressing (`lui` + `lw %lo(sym)($reg)` two-instruction pair).

**If the assembly shows `lui`/`lw` but your code emits `lw %gp_rel`, your extern declaration is too small.** This is the most common cause of addressing mode mismatches.

Fix: declare the extern as something > 8 bytes. Common patterns:

```c
/* 4-byte pointer → GP-relative (WRONG if asm shows lui/lw) */
extern SomeStruct *D_8005E3AC;

/* Array of 3 pointers → 12 bytes → absolute (CORRECT if asm shows lui/lw) */
extern SomeStruct *D_8005E3AC[3];
/* Then access as: D_8005E3AC[0]->field */
```

This happens when the original source file declared multiple variables together (e.g., as part of the same array or struct), making the total declaration > 8 bytes, even though each individual access only uses one element.

### Register allocation: accept rare quirks

In rare cases (~3% of functions), the target binary uses two registers where the compiler insists on reusing one. For example, the target loads two constants into `$v0` and `$v1` before any stores, but every C pattern produces single-register code that reuses `$v0`.

When this happens, `register s16 temp __asm__("v1")` can force the register assignment. This is a last resort — try all natural C patterns first (temp variables, reordering declarations, reordering statements). If nothing works after exhausting natural approaches, `register __asm__` is acceptable. Always add a comment explaining why:

```c
/* register __asm__ required: compiler reuses $v0, target uses $v0 and $v1 */
register s16 temp_v1 __asm__("v1");
```

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
