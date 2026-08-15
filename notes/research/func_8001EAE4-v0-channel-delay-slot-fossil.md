# func_8001EAE4 — nested-function static chain and polygon-list iterator

**Resolved 2026-08-14: 298/298 words, exact relocated function match.**

The previous interpretation of the eight `addiu $v0,$sp,16` instructions as a
caller-side debug-channel fossil was wrong. They are ordinary GCC nested-function
static-chain setup. This correction also supersedes the nested-function rejection
in `notes/research/func_8001E9F8.md` and the historical-origin claim in
`notes/research/func_8001E878-dead-spill-allocation.md`.

## Decisive evidence

`func_8001EAE4` calls `func_8001E878` and `func_8001E9F8` four times each. Every
call path establishes `$v0 = $sp + 16`:

- before the E878 calls, the instruction fills the flag-check branch delay slot;
- before the E9F8 calls, it fills the `jal` delay slot.

The vendored GCC source fixes `$v0` as `STATIC_CHAIN_REGNUM`. In
`lookup_static_chain`, a callee whose declaration context is the current function
receives `virtual_stack_vars_rtx`; in this target's 0x18-byte frame that resolves
to `$sp + 16`. A block-local `auto` function declaration is GCC's documented
forward-declaration form for a nested function. Adding those declarations
reproduced all eight instructions and the associated `$v0`/`$v1` allocation
rotation on the first mechanism test.

The callee targets independently confirm the same relationship:

- E878 reads incoming `$v0` before defining it;
- E9F8 saves incoming `$v0` in `$s0` and restores it to `$v0` before its E878
  calls, forwarding the parent's static chain.

Thus the three contiguous symbols are nested-function family members from one
original translation unit. The project's per-function source layout retains
separate compiled definitions for E878/E9F8. The block-local declarations use
local C names with declaration-only assembler labels naming `func_8001E878` and
`func_8001E9F8`; this preserves nested-call static-chain generation while
relocating directly to the separately placed function symbols. An assembler
label renames a symbol and emits no assembly instruction; the clean-source gate
distinguishes it from embedded assembly.

## Function behavior

The function scans a mixed polygon-record list through eight type groups. For
each record it checks `D_8005E4F4`, tests the masked header word, optionally
calls the triangle or quad predicate, then advances `D_8005E4F8` and decrements
the shared count. A zero callee result records the current record in
`D_8005E524` and returns zero; exhaustion or an unsupported final type returns
one.

| group | type code | callee | stride | vertex halfwords |
|---|---:|---|---:|---|
| 0 | `0x21010000` | E878 | `0x10` | 4, 5, 6 |
| 1 | `0x31010000` | E878 | `0x18` | 8, 9, 10 |
| 2 | `0x25010000` | E878 | `0x1C` | 10, 11, 12 |
| 3 | `0x35010000` | E878 | `0x24` | 14, 15, 16 |
| 4 | `0x29010000` | E9F8 | `0x10` | 4, 5, 6, 7 |
| 5 | `0x39010000` | E9F8 | `0x1C` | 10, 11, 12, 13 |
| 6 | `0x2D010000` | E9F8 | `0x20` | 12, 13, 14, 15 |
| 7 | `0x3D010000` | E9F8 | `0x2C` | 18, 19, 20, 21 |

`psx_frame_map` measured a 24-byte frame: a 16-byte outgoing argument area,
no local stack objects, and `$ra` saved at offset 16. The address formed at
that offset is the parent-frame/static-chain base, not the address of a source
local and not an attempted address of the saved return slot.

## Remaining source-shape facts

Three independent source details completed the match:

1. Fresh `baseN`/`typeN` locals keep each record-base web local to one loop,
   producing `$a2` for E878 groups and `$a3` for E9F8 groups.
2. A shared trailing `ret0` label places the return-zero block after the final
   loop bottom. This gives the target final `beqz` and the return-one
   jump/delay-slot layout.
3. Declaration initializers for `field_14`, `field_0`, and `field_10`, in that
   order, overlap the three entry values. Local allocation assigns them
   `$v1`, `$v0`, and `$a2`; `$v1` is then free for `D_8005E2E8`. A lone
   `field_10` initializer fixed allocation but rotated the three loads, while
   direct global assignments birthed `field_10` too late.

The exact inventory is empty, and `psx_scan_read_before_def` is clean for
EAE4 itself: the hard `$v0` read belongs to its nested callees, while EAE4 is
the parent that supplies the static chain.
