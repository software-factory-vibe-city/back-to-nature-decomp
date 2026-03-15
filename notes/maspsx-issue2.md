# maspsx issue: `la` before `sll` instruction scheduling mismatch

## Summary

GCC 2.8.0 with `-msplit-addresses` (the PSX default) emits `la $reg, SYMBOL` before independent ALU instructions like `sll`. The original PSY-Q assembler (aspsx) would have seen these in the opposite order, because without `-msplit-addresses`, cc1 emits `sw $reg, SYMBOL($base)` as a single macro after the ALU instruction, and aspsx expands the macro in place.

This causes instruction ordering mismatches for **indexed GP-relative array access** — the instructions are correct but in the wrong order.

## The pattern

Target binary (compiled with original toolchain):
```
sll   $a0, $a0, 2                         # index <<= 2
addiu $v0, $gp, %gp_rel(D_8005E4C8)       # base address
addu  $a0, $a0, $v0                        # combine
jr    $ra
sw    $a1, 0($a0)                          # store (delay slot)
```

Our toolchain (GCC 2.8.0-psx with `-msplit-addresses`):
```
addiu $v0, $gp, %gp_rel(D_8005E4C8)       # base address FIRST
sll   $a0, $a0, 2                         # index <<= 2
addu  $a0, $a0, $v0                        # combine
jr    $ra
sw    $a1, 0($a0)                          # store (delay slot)
```

The first two instructions are independent (different dest registers, no data dependency) but GCC schedules `la`/`addiu` first.

## Scale

11 instances across 6 functions in the BTN binary. Affects ~1/3 of functions that use GP-relative addressing with computed indices.

## Why this happens

With `-msplit-addresses` (PSX default), GCC's cc1 splits address loads into explicit `la` pseudo-instructions. The instruction scheduler places `la` early because it treats address computation as having higher priority than ALU operations.

Without `-msplit-addresses`, cc1 emits `sw $5, D_8005E4C8($4)` as a single macro. The `sll` naturally comes before it because cc1 emits the index computation first. The assembler then expands the store macro *in place*, so `sll` stays first.

Since we use `-msplit-addresses` (required for the PSX target), we need maspsx to fix the scheduling after cc1.

## Proposed fix

Add a `--reorder-la` flag to maspsx. When enabled, detect `la $X, SYMBOL` (expanded to `addiu $X, $gp, %gp_rel(...)` by the time maspsx sees it) followed by an instruction that doesn't read or write `$X`, and swap them.

The detection operates on GCC's raw output (before maspsx's own transformations), looking for:
```
la  $REG, SYMBOL
OP  $OTHER_REG, ...     # doesn't touch $REG
```

And reordering to:
```
OP  $OTHER_REG, ...
la  $REG, SYMBOL
```

This is the same class of transformation maspsx already does for delay slot filling — reordering independent instructions to match aspsx's output.

## Evidence from the binary

Scanned all `addiu $reg, $gp, offset` instructions in the original binary. Of the ones preceded by an independent ALU instruction, 11 have the ALU instruction first (sll before addiu) and only 1 has addiu first. The 11:1 ratio confirms the original toolchain strongly preferred the ALU-first ordering.
