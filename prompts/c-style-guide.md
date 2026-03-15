# C Style Guide for PSX Decompilation

Idiomatic C patterns that produce correct codegen with GCC 2.8.0 `-O2 -G8 -mips1`. When two C expressions are semantically equivalent, the simpler one almost always matches the original programmer's intent — and the original compiler output.

## Array and pointer access

### GP-relative indexed access

When the assembly shows `sll` + `addiu $reg, $gp, %gp_rel(sym)` + `addu` + `lw/sw`, this is indexed array access into a GP-relative variable. Use the simple array form:

```c
/* GOOD — clean array indexing */
(&D_8005E4C8)[arg0] = arg1;

/* BAD — pointer arithmetic produces the same instructions but is unreadable */
*(s32 *)((u8 *)&D_8005E4C8 + (arg0 << 2)) = arg1;
```

The `--reorder-la` flag in maspsx handles the `sll`/`addiu` instruction ordering automatically.

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

GCC 2.8.0 evaluates expressions roughly left-to-right and emits instructions following the expression tree structure. This means:

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

### Use `&D_XXXX` to get a global's address, never `_D_XXXX`

`globals.h` macros expand `D_XXXX` to a dereference: `(*((s32*)_D_XXXX))`. To get the address, use `&D_XXXX` — it naturally cancels the dereference:

```c
/* GOOD — &D_XXXX gives the address */
s32 *base = &D_8006C838;

/* BAD — uses internal __asm__ identifier, leaks implementation detail */
s32 *base = (s32 *)_D_8006C838;
```

Never reference `_D_XXXX` (the underscore-prefixed internal name) in source files.

### Match the extern type to the access pattern

```c
/* Assembly: lbu → unsigned byte */
extern u8 D_80062000;

/* Assembly: lh → signed halfword */
extern s16 D_80062004;

/* Assembly: lw → word (s32 or pointer) */
extern s32 D_80062008;
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
