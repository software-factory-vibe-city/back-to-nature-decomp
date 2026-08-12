# func_8001A808 — D_80049084 address-split returns the delay slot (2026-08-11)

**Symptom.** `func_8001A808` sat at 24/26 with a "scheduling" residual after its
final call block. The target's second `jal func_80017E34` had `move a0,v0`
(standalone) *before* `lui a1,%hi(D_80049084)`, with the address addiu half in
the `jal`'s delay slot:

```
jal  func_80017E34        ; 8001A844
  addiu a1,a1,4           ; 8001A848 (delay)
move a0,v0                ; 8001A84C
lui  a1,%hi(D_80049084)   ; 8001A850
jal  func_80017E34        ; 8001A854
  addiu a1,a1,%lo(D_80049084)  ; 8001A858 (delay)
move a0,v0                ; 8001A85C
```

Any clean-C nesting of the two calls compiled to the *opposite* order: the whole
`la a1,D_80049084` stayed before the `jal` and `move a0,v0` filled the delay
slot. The residual-source search exhausted its grammar with no match; the two
`move a0,v0` swaps looked like a dbr delay-slot tie that no source shape moved.

## Cause: declaration size, not scheduling

The address was left as a **single unsplit `la` macro**. In GCC 2.95 mips,
`ENCODE_SECTION_INFO` (mips.h) sets `SYMBOL_REF_FLAG` (the symbol's `volatil`
bit) whenever `size <= mips_section_threshold` (`-G8`, so ≤ 8 bytes). With the
flag set, `mips_check_split()` (mips.c) returns 0, so cc1 emits one `movsi`
insn that dbr cannot relax across a delay slot — the `addiu` half stays glued
to the `lui` and the `move a0,v0` takes the slot instead.

When the declared size is **> 8 bytes** the flag is clear, the address is split
into separate `lui`/`addiu` RTL insns, and dbr relaxes the `addiu` into the
second `jal`'s delay slot — exactly the target's layout. This is the same
ADR-0001 §1 mechanism (split addresses were on) applied to *address
materialization* rather than to a load, and it is the ONLY lever: the residual
search could never reach it because it searched source statement shapes, not
the declaration size.

## Verified boundary

- `extern u16 D_80049084[3]` (6B): unsplit → 24/26.
- `extern u16 D_80049084[4]` (8B): still ≤ -G8, unsplit → 24/26.
- `extern u16 D_80049084[5]` (10B): split → 26/26 byte-identical.

The binary data at 0x80049084 is 4 u16 (8B, `51 00 FE FF FF FF 00 00`), so the
original TU that produced split addressing declared it larger than its content
(> -G8). The declaration lives in `include/globals_override.h`.

## Generalisation

A target whose `lui`/`%lo` halves straddle a delay slot proves the symbol was
declared > -G8 in its original TU even when the visible data region is small.
Do not chase scheduler delay-slot ties on such an address until the symbol's
declared size has been checked.
