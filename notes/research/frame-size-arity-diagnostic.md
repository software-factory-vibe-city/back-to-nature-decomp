# Frame size as an arity and prototype diagnostic

**Status:** general, mechanism-backed. Encoded as the `arity-frame` and
`arity-stack` detectors in `tools/agent/triage.ts`.
**Updated:** 2026-08-10

GCC 2.95.2's frame layout is fully determined by facts you control from the
source: how many parameters the function declares, and how many arguments its
widest outgoing call takes. That makes a frame-size mismatch one of the
cheapest and most reliable signals available — it costs one compile, needs no
diff classification, and points at a specific class of source defect.

## Frame decomposition

```
+--------------------------+  <- caller_sp  (= sp + framesize)
| incoming args 5..n       |     at caller_sp+0x10, 0x14, ...
| home slots for a0..a3    |     at caller_sp+0x00..0x0F
+==========================+  <- sp + framesize
| saved registers          |     $s0-$s7, $fp, $ra, $gp
+--------------------------+
| locals / spills          |
+--------------------------+
| outgoing argument area   |     always >= 16 bytes, rounded up to 8
+--------------------------+  <- sp
```

Two independent quantities to compare against the target:

- **Outgoing argument area** = 4 × (arguments of the *widest call this
  function makes*), floored at 16 bytes and rounded up to a multiple of 8.
  It is shared across all calls — it does not grow with the number of calls,
  only with the widest one. In target assembly it is the region below the
  lowest register save slot.
- **Saved-register count** — driven by how many values must survive calls,
  which tracks this function's own parameter count and live locals.

Because the argument area rounds to 8, an area of A bytes is consistent with
a widest call of n arguments for n in (A/4 − 2, A/4]. A 24-byte area means 5
or 6 arguments, never 4. Report the range; a single number is false precision.

## Reading the mismatch

| symptom | cause |
|---|---|
| compiled arg area **narrower** than target | a **callee** prototype declares too few parameters |
| compiled arg area **wider** than target | a callee prototype declares too many |
| arg areas equal, compiled frame **smaller** | **this** function declares too few parameters, or is missing locals |
| arg areas equal, compiled frame **larger** | too many parameters, or spurious locals/spills |

Identifying a save slot: a stack offset is a register save iff the same
register is both stored to it and reloaded from it. Filtering by register
class does not work — outgoing argument stores routinely use callee-saved
registers (`sw $s0, 0x10($sp)` is an argument store, not a save).

## Incoming stack arguments are determinate

In O32 the first four arguments arrive in `$a0`–`$a3`; the fifth onward are
written **by the caller** into its own frame at `caller_sp + 0x10`, `+0x14`,
… The callee never saves them in its prologue — it only loads them. So:

> A load from `$sp + framesize + 0x10` or above **is** an incoming stack
> parameter. There is no other thing it can be.

Subtract the frame size and the offset names the parameter:
`(offset − framesize) / 4 + 1`. The load width names the type — `lw` is a
32-bit parameter, `lh`/`lhu`/`lb`/`lbu` a narrow one.

This is worth stating flatly because it has been misread as the function
reaching for its **caller's** saved `$ra`. It never is. The caller's `$ra`
sits high in the caller's own frame, far above the argument region — in the
worked example below, at `caller_sp + 0x84` while the argument load was at
`caller_sp + 0x10`. And C has no way to express reading it, so that misreading
leads directly to inventing embedded asm for something that was ordinary
parameter handling.

Conversions at the call site (`andi $x,$y,0xffff`, `sll`/`sra 16`) come from
the **callee's** prototype declaring `u16`/`s16`, not from casts in the
caller's source. If the parameter were declared narrow in *this* function's
signature, the load itself would be narrow (`lh` at the stack slot) rather
than a `lw` followed by a shift pair.

## Worked example — func_80016B7C

Target frame 0x30; the wrong source compiled to 0x20.

```
target:    arg area 0x18 (lowest save slot), saves $s0-$s3+$ra   = 24 + 20 -> 48
compiled:  arg area 0x10, saves 3 + $ra                          = 16 + 16 -> 32
```

Both quantities were short, which named both defects at once: the callee
`func_8001782C` was declared with 4 parameters instead of 5 (narrow argument
area), and `func_80016B7C` itself with 4 instead of 5 (fewer saved
registers). The caller confirmed it independently —
`build/functions/func_80016C08.s:130` and `:162` both store a fifth outgoing
argument in the `jal` delay slot:

```
    lh   $a3, 0x4($s1)
    lh   $v0, 0x6($s1)
    jal  func_80016B7C
     sw  $v0, 0x10($sp)      <- fifth argument
```

Fixing both prototypes matched the function on the first compile. Roughly 20
variants had been spent instead on an embedded-asm reconstruction of the
`lw $s0, 0x40($sp)` load. See `notes/retros/func_80016B7C.md`.

## Worked example — the packet wrappers

The sprite family's setup/teardown wrappers share one structure
(`func_80011F5C` + `func_800165D8` + `func_80011FD8`) and differ only in
parameter count, which makes them a clean illustration:

- `func_80015F80` — 9 parameters, frame 0x68
- `func_800160C8` — 13 parameters, frame 0x70

The 0x08 difference is exactly two more saved registers (`$s2` and `$a1`);
the outgoing argument area is identical because both call the same callee.
A compiled frame of 0x68 against a target of 0x70 means too few declared
parameters, or types that make GCC pack them differently.

## Cross-checking, and which side to trust

Read both sides; they answer different questions.

- The **callee** tells you what it consumes: incoming stack loads, and the
  width of its outgoing argument area.
- The **caller** tells you what it supplies: stores to `0x10($sp)` and above
  before the `jal`, frequently in the delay slot.

Neither is inherently more trustworthy. In the func_80016B7C case the caller
was unambiguous and correct while a research note's stated arity was wrong,
so a rule of "verify from the callee, not the caller" would have been exactly
backwards. Prefer the assembly of either side over any prose claim about it.
