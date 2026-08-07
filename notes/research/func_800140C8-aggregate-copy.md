# func_800140C8 — two-byte aggregate copy preserves the source base

**Status:** byte-verified 29/29 under baseline flags, clean C89.

## Symptom

The scalar reconstruction loaded `D_8005E2AC[0]` and `[1]` into two named
`s32` temporaries before storing them into a two-byte local array. Expansion
initially created one source-base pseudo, but local CSE replaced the offset-zero
load address with the symbol's `lo_sum`. The base then served only the offset-1
load, changing web parity, allocation, and prologue scheduling.

The same target prefix occurs in adjacent `func_80013B04`: materialize
`D_8005E2AC`, load signed bytes at offsets 0 and 1 through that base, then copy
them to adjacent local bytes. That was evidence for a shared data idiom rather
than a register pin or caller-capture hook.

## Source shape

`D_8005E2AC` is an incomplete array of two-byte records:

```c
typedef struct PadPortPair {
    s8 port0;
    s8 port1;
} PadPortPair;
extern PadPortPair D_8005E2AC[];
```

The function copies the record as one object:

```c
PadPortPair ports;

ports = D_8005E2AC[0];
```

The whole-object assignment enters RTL as one `movstrsi_internal` BLKmode
operation rather than two independent scalar expressions. CSE still
canonicalizes its source to `mem:BLK(lo_sum(high, D_8005E2AC))`; the important
point is that there is no scalar offset-zero load for CSE to emit directly.
The block move remains one 20-byte RTL instruction through delay-slot
scheduling.

At final emission, MIPS `output_block_move` has an explicit `LO_SUM` case: it
uses one of `movstrsi_internal`'s four early-clobber scratch registers to emit
`addiu base,high,%lo(symbol)`. A two-byte, one-byte-aligned record then selects
two `lb`/`sb` pairs. Scratch allocation gives the target `$a3` base and
`$v1`/`$a1` byte values, while the scheduler treats the whole copy as one
packet. This simultaneously explains the shared base, registers, contiguous
loads/stores, and prologue placement.

## Rejected diagnosis

This is not analogous to `CAPTURE_RA`. The target has no non-C instruction or
hard-register fingerprint. Empty asm barriers and register pins only perturbed
the symptom. The matching mechanism is the original aggregate semantics, fully
expressible in clean C.

The frame's bytes at `sp+0x10` and `sp+0x11` are the copied local record, not
fifth/sixth outgoing arguments; `PadGetState` uses its SDK one-argument
prototype.
