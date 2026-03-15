# Jump Table Problem

## Summary

7 functions with switch/case jump tables crash m2c and are silently skipped by the orchestrator. The fix is straightforward: pass the rodata file containing jump table data as an additional input to m2c.

## Root Cause

The orchestrator (`tools/orchestrator.ts`) only passes the function's `.s` file to m2c. But jump table data lives in a separate file: `build/asm/data/800.rodata.s`. When m2c encounters a `jr $reg` (computed jump) and can't find the referenced `jtbl_*` symbol, it throws `DecompFailure` and the orchestrator skips all remaining stages.

m2c natively supports multiple input files — passing both the function `.s` and the rodata `.s` makes it work.

## Affected Functions

| Function | Jump Table | # Cases | Size (bytes) | Tier |
|---|---|---|---|---|
| `func_80011370` | `jtbl_80010008` | 21 | 2228 | 3 |
| `func_80013B04` | `jtbl_8001005C` | 7 | 460 | 3 |
| `func_800183E0` | `jtbl_800100B4` | 10 | 1964 | 3 |
| `func_8001A284` | `jtbl_800100DC` | 25 | 752 | 3 |
| `func_8001A910` | `jtbl_80010144` | 54 | 48 | 3 |
| `func_80020E58` | `jtbl_80010224` | 61 | 1104 | 3 |
| `func_80022B98` | `jtbl_80010378` | 14 | 472 | 3 |

All are tier 3 (complex callers). 7 of 512 nonmatching functions (1.4%).

## Jump Table Structure in .s Files

Setup sequence (from `func_80013B04`):
```asm
sltiu  $v0, $v1, 0x7              # bounds check
beqz   $v0, .L80013C70            # branch to default
lui    $v0, %hi(jtbl_8001005C)    # load table address (high)
addiu  $v0, $v0, %lo(jtbl_8001005C) # load table address (low)
sll    $v1, $v1, 2                # index * 4
addu   $v1, $v1, $v0              # table_base + offset
lw     $a0, 0x0($v1)              # load target address
nop
jr     $a0                        # computed jump
nop
```

Case labels use `jlabel` macro. Jump table data is in `build/asm/data/800.rodata.s`:
```asm
dlabel jtbl_8001005C
    .word .L80013B94   # case 0
    .word .L80013B94   # case 1
    .word .L80013C70   # case 2 (default)
    .word .L80013C70   # case 3 (default)
    .word .L80013BE8   # case 4
    .word .L80013BE8   # case 5
    .word .L80013C04   # case 6
enddlabel jtbl_8001005C
```

## Fix

### Option A: Pass rodata to m2c (recommended)

In `tools/m2cFunc.ts` (or `tools/orchestrator.ts`), detect if the function's `.s` file references a `jtbl_*` symbol and pass `build/asm/data/800.rodata.s` as an additional positional argument:

```
python3 tools/m2c/m2c.py --target mipsel-gcc-c -f func_80013B04 \
  build/asm/nonmatchings/func_80013B04/func_80013B04.s \
  build/asm/data/800.rodata.s
```

This was tested and confirmed to work — m2c produces valid C with proper `switch` statements.

### Option B: Don't skip on m2c failure

Change the orchestrator to still invoke the Stage 2 agent when m2c fails, providing the agent with the raw assembly and a stub source file. The agent prompt already teaches reading assembly and writing C from scratch.

### Recommended: both

Do A first (most functions will get valid m2c output). For any remaining failures, fall back to B.

## Special Case: func_8001A910

This function's jump table uses **function names** instead of local labels (e.g., `.word func_8001A960`). It's a tail-call dispatch table — it jumps to other function entry points without returning. This pattern may need a top-level `__asm__` block rather than a C switch statement.

## Notes

- No existing matched functions use switch statements, so there are no in-project examples yet.
- All 7 functions are tier 3 (processed last), so this isn't blocking near-term progress.
- GCC 2.8.0 switch codegen uses `lui+addiu` for table address loading (confirmed matching the binary), unlike GCC 2.7.2 which uses GP-relative table loads.
