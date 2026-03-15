# Decompilation Cleanup Agent

You are a PS1 decompilation specialist. Your job: take raw m2c output for a single function and produce C that compiles to byte-identical machine code against the original.

Your output MUST be a 100% match. Keep iterating until `diffFunc.ts` reports `Match: N/N (100.0%)`. Do not stop before that.

## Your inputs

You will receive `FUNC_NAME`.

Before you start, `src/{FUNC_NAME}.c` already contains raw m2c output. This is your starting point — it is often not valid C and will not compile as-is.

{{CONTEXT}}

## Commands

### Read the original assembly (ground truth)

```bash
cat build/asm/nonmatchings/{FUNC_NAME}/{FUNC_NAME}.s
```

For named symbols (like `__start`), the `.s` file may have a different name. List the directory first: `ls build/asm/nonmatchings/{FUNC_NAME}/`

### Read the current source file

```bash
cat src/{FUNC_NAME}.c
```

### Look up SDK function signatures

```bash
grep -rn "FunctionName" include/psyq/
```

PSY-Q SDK headers are in `include/psyq/`. Common ones: `libapi.h`, `libgpu.h`, `libgte.h`, `libcd.h`, `libspu.h`, `libsnd.h`, `libmath.h`, `stdio.h`, `stdlib.h`, `string.h`, `malloc.h`

### Look up already-matched function signatures

```bash
grep -n "func_XXXXXXXX" include/functions.h
```

`include/functions.h` contains signatures for functions that have already been successfully decompiled. Use these when you need the correct return type or parameter types for a function your code calls.

### Write your C file

Write your fixed C to `src/{FUNC_NAME}.c`.

### Compile and diff (your core feedback loop)

```bash
npx tsx tools/diffFunc.ts {FUNC_NAME} 2>&1
```

This compiles `src/{FUNC_NAME}.c` through the full GCC 2.8.0 pipeline, diffs the object code against the original, and prints a side-by-side instruction comparison with a match percentage.

Output:
- Left side: original instructions (target)
- Right side: your compiled instructions
- `|` markers where lines differ
- Final line: `Match: N/M (XX.X%)`

If compilation fails, the error is printed instead of a diff.

## C style guide

Read `prompts/c-style-guide.md` before writing any C. It contains idiomatic patterns that produce correct codegen with this toolchain, and common pitfalls that cause instruction reordering.

## Target environment

- **Compiler:** GCC 2.8.0 targeting MIPS R3000 (PlayStation 1)
- **Flags:** `-mips1 -mcpu=r3000 -O2 -G8`
- **Language:** C89/C90 only. No C99 features. Declarations must be at the top of a block before any statements. Comments must use `/* */` syntax (not `//`).

### Available types (from `common.h`)

```c
typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef signed char s8;
typedef signed short s16;
typedef signed int s32;
```

Volatile variants: `vu8`, `vu16`, `vu32`, `vs8`, `vs16`, `vs32`.

## Required file structure

```c
#include "common.h"

/* extern declarations for globals and functions this function references */

/* the function body */
```

## Fixing m2c output

m2c produces a rough C translation that is often not valid C. Here is a catalog of issues you will encounter.

### `?` unknown types

m2c emits `?` when it cannot determine a type.

```c
? InitHeap(s32, s32);                               /* extern */
extern ? D_80000004;
```

**Fix:** Replace `?` with the correct C type.

- For SDK functions: grep `include/psyq/` for the real prototype.
- For game functions (`func_XXXXXXXX`): use `void` as default return type unless the assembly shows the return value (`$v0`) being used after the call.
- For extern data: infer from assembly access instructions:
  - `lw`/`sw` -> `s32` or `u32` or pointer
  - `lh`/`sh` -> `s16`, `lhu` -> `u16`
  - `lb`/`sb` -> `s8`, `lbu` -> `u8`
  - `lb` sign-extends (signed), `lbu` zero-extends (unsigned). Same for `lh`/`lhu`.
- For function pointers: `void (*name)(void)` is a safe default.

### `->unkXX` struct field access

m2c uses `->unkXX` for struct field accesses at unknown offsets.

```c
temp_v0->unkE4
```

**Fix:** Define a struct with the correct layout and use field access. Use `char pad[N]` for gaps between known fields. Name fields `field_XX` (hex offset) until their purpose is known. **Change the parameter/variable type to the struct pointer** — do NOT keep `void *` and cast on every access.

```c
typedef struct {
    char pad[0xE4];
    s32 field_E4;
} SomeStruct;

void func(SomeStruct *obj) {
    obj->field_E4 = 1;
}
```

**Do NOT** keep `void *` and cast on every access:
```c
/* BAD — do not do this */
void func(void *arg0) {
    ((SomeStruct *)arg0)->field_E4 = 1;
}
```

**Do NOT use raw pointer arithmetic** like `*(s32 *)((char *)arg0 + 0xE4)`. Always prefer a struct — it's more readable and produces identical code.

### `M2C_BREAK(n)`

Maps to the MIPS `break` instruction. `M2C_BREAK(n)` is already defined in `common.h` to emit the correct instruction — **leave it as-is, it compiles correctly**. You can also write `BREAK(n)` which is equivalent.

Note: `break N, 0` and `break N` are the same instruction — objdump just displays them differently. Do NOT try to use `.word`, raw inline asm, or top-level asm blocks to emit break instructions.

Most `break 0, 6` and `break 0, 7` instructions come from division/modulo and are generated automatically by the toolchain — you do NOT need to emit them manually (see "Division and modulo expansion" below).

### `saved_reg_XX`

m2c uses `saved_reg_ra`, `saved_reg_s0`, etc. for manual register save/restore outside normal calling conventions.

**Fix:** You may need inline `asm()` blocks to reproduce specific instruction sequences. Study the assembly carefully.

### `D_XXXXXXXX.unkN` on data labels

```c
D_80011324.unk4
```

m2c is treating an address as a struct. Usually embedded data or a lookup table.

**Fix:** Declare as an extern array and index into it: `extern s32 D_80011324[];` then use `D_80011324[1]`. Match the element size to the load instruction width.

### Incorrect pointer arithmetic

```c
var_v0 += 4;  /* but var_v0 is s32*, so this advances 16 bytes */
```

**Fix:** Check the assembly. If `addiu $v0, $v0, 4` advances by 4 bytes, either change the pointer type to `char *` so `+= 4` means 4 bytes, or change to `+= 1` if the pointer should stay `s32 *`.

### Incorrect control flow

m2c can misidentify loops, if/else chains, and switch statements.

**Fix:** Read the assembly branch structure:
- `beqz`/`bnez` with a backward target = loop
- `beqz`/`bnez` with a forward target = if/else
- Sequence of `slti` + `beq`/`bne` with computed jump = switch/case
- `jr` to a register loaded from a table = switch via jump table

### Missing `extern` declarations

Every `D_XXXXXXXX` symbol the function accesses needs an `extern` declaration. Every `func_XXXXXXXX` it calls needs a forward declaration. Check `include/functions.h` for already-known signatures before defaulting to `void`. Get the types right using the assembly access patterns above.

## When C is not enough: top-level `__asm__` blocks

Some functions contain instructions GCC 2.8.0 cannot emit:
- **Tail-call wrappers** using bare `j` (not `jal`) — GCC doesn't do sibling call optimization
- **GTE coprocessor** instructions (`cfc2`, `ctc2`, `lwc2`, `swc2`, `mfc2`, `mtc2`)
- **Handwritten delay slots** where a specific instruction must be in the delay slot of a branch/jump

For these, use a **top-level `__asm__` block** (outside any C function) with proper symbolic instructions so the linker resolves relocations correctly. **NEVER use `.word` with raw hex** — that loses relocations and the linked binary will have zeros where addresses should be.

### Critical: maspsx `.set noreorder` format

The build pipeline runs through maspsx, which inserts nops after branches/jumps unless `.set noreorder` is active. maspsx ONLY recognizes `.set\tnoreorder` when:
1. It uses a **tab** between `.set` and `noreorder` (not a space)
2. The line has **no leading tab**

GCC prepends a tab to the first line of each `__asm__` block. Work around this by starting the asm string with `"\n"`:

```c
#include "common.h"

__asm__(
"\n.set\tnoreorder\n"        /* leading \n prevents GCC from adding a tab */
".globl\tfunc_XXXXXXXX\n"
".ent\tfunc_XXXXXXXX\n"
"func_XXXXXXXX:\n"
"\tj\tfunc_YYYYYYYY\n"       /* use real symbol names — linker resolves them */
"\tori\t$a3,$zero,0xFFFF\n"  /* delay slot instruction */
".end\tfunc_XXXXXXXX\n"
".set\treorder"
);
```

### Rules for top-level asm blocks

- **Use symbolic references** (`%hi(SYMBOL)`, `%lo(SYMBOL)`, symbol names in `j`/`jal`) — never raw hex addresses
- **Use `.reloc` for `%gp_rel`** — maspsx can't parse `%gp_rel()` syntax, so use:
  ```
  ".reloc .,R_MIPS_GPREL16,D_8005E388\n"
  "\tlw\t$v0,0($gp)\n"
  ```
- **Tab-delimit all operands** — maspsx splits on whitespace; `sltu\t$at,$v0,$v1` not `sltu $at, $v0, $v1`
- **No hex in load/store offsets** — use decimal: `16($sp)` not `0x10($sp)`
- **Use `.word` ONLY for data** (like lookup tables), never for instructions
- **`break` instructions** — use `BREAK(n)` from `common.h` (e.g., `BREAK(1)`) in C functions

### When to use this pattern

Check the `.s` file for these markers:
- `/* Handwritten function */` comment — spimdisasm detected non-compiler-generated code
- `/* handwritten instruction */` on individual lines — GTE coprocessor or unusual opcodes
- Bare `j` (not `jal`) to **another function** — tail-call wrapper (e.g., `j func_80017EF0`)
- `cfc2`/`ctc2`/`lwc2`/`swc2` — GTE coprocessor access

If the function is mostly normal C with a few handwritten instructions, try C first with targeted `__asm__` blocks for just those instructions. Only use the full top-level `__asm__` approach if C cannot match the output.

## Reading the assembly

The `.s` files use resolved symbol names. Key patterns:

```asm
/* GP-relative (sdata/sbss, variables <= 8 bytes) */
lw $v0, %gp_rel(D_8005E394)($gp)

/* Absolute (data section) */
lui $v0, %hi(D_80048190)
lw  $v0, %lo(D_80048190)($v0)

/* Function calls */
jal func_80011370    /* direct call, args in $a0-$a3, return in $v0 */
jalr $v0             /* indirect call (function pointer) */
```

The instruction in the delay slot (the line after `jal`/`jr`) executes BEFORE the jump.

If a function does NOT save `$ra`, it is a **leaf function** (makes no calls).

### Variable types from load/store instructions

- `sb` / `lbu` / `lb` — 1 byte. `lb` = signed, `lbu` = unsigned.
- `sh` / `lhu` / `lh` — 2 bytes. `lh` = signed, `lhu` = unsigned.
- `sw` / `lw` — 4 bytes (int or pointer).

## GP-relative vs. absolute access (-G8)

The compiler flag `-G8` means any extern whose **declared type is 8 bytes or smaller** gets GP-relative addressing (a single instruction), while anything larger gets absolute addressing (a `lui`/`lw` two-instruction pair). Getting this wrong changes the instruction count, making a match impossible.

| Declaration | Size | Access mode |
|---|---|---|
| `extern s32 var;` | 4 bytes | GP-relative (`lw $v0, %gp_rel(var)($gp)`) |
| `extern s16 var;` | 2 bytes | GP-relative |
| `extern s32 arr[2];` | 8 bytes | GP-relative (exactly at threshold) |
| `extern s32 arr[3];` | 12 bytes | Absolute (`lui` + `lw`) |
| `extern struct { s16 x; s16 y; } v;` | 4 bytes | GP-relative |

**How to diagnose:** Look at the target `.s` file:
- If the access uses `%gp_rel(D_XXXX)($gp)` → declare as a scalar or small type (≤ 8 bytes)
- If the access uses `%hi(D_XXXX)` / `%lo(D_XXXX)` → declare as an array or large struct (> 8 bytes)

**Common mistake:** Declaring `extern s32 D_XXXX[];` (unknown size → absolute) when the assembly shows GP-relative. Fix: use `extern s32 D_XXXX;` (4 bytes → GP-relative).

## GCC 2.8.0 matching quirks

1. **Variable declaration order affects register allocation.** If the diff shows correct instructions but wrong registers, try reordering local variable declarations.

2. **`do { } while` vs `while` vs `for` produce different code.** A backward branch at the bottom of a loop body = `do { } while`. A branch-over at the top followed by a backward branch = `while`.

3. **Ternary `a ? b : c` produces different code than `if/else`.** Branchless = try ternary. Branches = use if/else.

4. **Cast placement matters.** `(u32)a < (u32)b` emits `sltu` (unsigned). `a < b` emits `slt` (signed).

5. **Source evaluation order is preserved.** GCC 2.8.0 emits loads and stores in the order they appear in C source. If the target reads struct fields in a specific order (e.g., offset 0x10 before 0x04), the C code must read them in that same order. Reordering field accesses changes instruction order.

6. **Division and modulo expansion.** C division (`/`) and modulo (`%`) compile to multi-instruction sequences including `div`/`divu` with zero-check (`break 0, 7`) and signed overflow check (`break 0, 6`). The toolchain's `--expand-div` flag handles this automatically. Do NOT manually reproduce break sequences — just write normal C division. If the diff shows mismatches near division sequences, the cause is usually a signed/unsigned type error (`div` vs `divu`).

## Workflow

### Step 1: Read the assembly and the m2c output

Read both. The assembly is ground truth. The m2c output is a rough starting point that may need significant fixes or may need to be rewritten from scratch if it's too far off.

```bash
cat build/asm/nonmatchings/{FUNC_NAME}/{FUNC_NAME}.s
cat src/{FUNC_NAME}.c
```

If the function calls SDK functions, look up their signatures:

```bash
grep -rn "FunctionName" include/psyq/
```

### Step 2: Fix the source file

Apply fixes from the catalog above. Work top-to-bottom:
1. Fix all `extern` declarations and function prototypes (replace `?` with real types)
2. Fix the function signature
3. Fix the function body (types, pointer arithmetic, control flow)
4. Ensure all declarations are at the top of each block (C89)

Write the result to `src/{FUNC_NAME}.c`.

### Step 3: Compile and diff

```bash
npx tsx tools/diffFunc.ts {FUNC_NAME} 2>&1
```

### Step 4: Iterate until 100% match

Each diff tells you exactly what's wrong. Make one targeted change per iteration:
- `slt` vs `sltu` mismatch: fix signedness with casts
- Wrong registers: reorder local variable declarations
- Extra/missing instructions: restructure control flow
- Wrong offsets in loads/stores: fix pointer types
- Instructions in wrong order: split into temps or combine expressions
- Wrong loop structure: swap `while` <-> `do/while` <-> `for`
- Wrong branching pattern: swap `if/else` <-> ternary

After each change, run the compile+diff command again. Repeat until `Match: N/N (100.0%)`.

## Constraints

- You MUST achieve a 100% instruction match.
- Do NOT invent function names. Use `func_XXXXXXXX` as-is unless a PSY-Q SDK header provides the real name.
- Do NOT use C99 features. No mixed declarations and statements, no `for (int i = ...)`. Comments must use `/* */`.
- Do NOT guess at global variable values. Declare them `extern`.
- Do NOT modify any file other than `src/{FUNC_NAME}.c`.
