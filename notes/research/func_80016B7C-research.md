# func_80016B7C — Research Notes

**Date:** 2026-08-10
**Status:** Initial research; not yet decompiled.

## Function facts

- **Address:** 0x80016B7C, ROM 0x737C, size 0x8C (140 bytes)
- **Parameters:** 5 — `$a0` pointer, `$a1`/`$a2`/`$a3` s32, and `arg4` on the
  stack (read at `0x40($sp)` = `caller_sp+0x10`). *Corrected 2026-08-10: this
  line previously read "3 register args — no stack args", which was wrong and
  cost roughly 20 variants. See `notes/retros/func_80016B7C.md`.*
- **Frame:** 0x30, saves $s0-$s3 + $ra
- **Return:** s32
- **Tier:** 3 (game callers), priority 83

## Call graph

- **Called by:** func_80016C08 (sole caller, invoked twice per loop iteration)
- **Calls:** func_80015B24 (entry searcher with bcmp), func_8001782C (tile/image loader with LoadImage)
- **Sibling consumer:** func_80017284 calls the same two callees (func_80015B24 + func_8001782C) but with different argument preparation (includes func_80015AAC call and D_8005EA28 global)

## Address adjacency

func_80016B7C sits at the tail of the sprite-renderer range:

```
func_800165D8  (ROM 0x6DD8–0x737B) — 0x5A4 bytes, direct-primitive renderer
func_80016B7C  (ROM 0x737C–0x7407) — 0x8C bytes, this function
func_80016C08  (ROM 0x7408–0x799B) — 0x594 bytes, loop driver calling 6B7C
```

func_80016B7C and func_80016C08 are exactly contiguous (no gap). Both are
between func_800165D8 and the next function func_8001719C.

## Semantic analysis

### Prologue

```
$s2 = $a0          /* pointer to struct with field_0x18 */
$s3 = $a2          /* count or index */
$a2 = $a1 & 0xFFFF /* width/height, truncated to u16 */
```

### Body (two-phase computation)

**Phase 1 — entry search via func_80015B24:**

```
$a0 = arg0             /* unchanged: the struct pointer itself */
$a1 = lw(0x18($s2))    /* struct->field_0x18: entry data base pointer */
$a2 = arg1 & 0xFFFF    /* u16 parameter of the callee */
$v0 = func_80015B24($a0, $a1, $a2)
$s1 = arg3             /* delay-slot save, NOT the call result */
```

*Corrected 2026-08-10: this block previously showed `$a0 = lw(0x18($s2))`,
transposing the first two arguments, and read `$s1` as the call's result.*

func_80015B24 iterates through entries (lhu at offset 2 gives count),
comparing 8-byte chunks with bcmp against data from `struct->field_0x1C`.
Returns an index (rounded up to 4-byte boundary + 0xC per entry) or an
error code. It also calls func_800129E8 (tiny 12-byte leaf) in a retry loop.

**Phase 2 — tile loading via func_8001782C:**

```
$a0 = lw(0x18($s2))   /* same field_0x18 reload */
$a1 = $s3             /* original $a2: count/index */
$a2 = $v0 & 0xFFFF    /* func_80015B24 result, truncated */
$a3 = (s16)$s1        /* sign-extended search index */
$v0 = func_8001782C($a0, $a1, $a2, $a3)
```

func_8001782C is a substantial tile/image loader (0x1BC bytes). It:
- Reads a header byte; if 0xD, initializes to zero and skips decompression
- Parses width/height from the entry data
- Optionally decompresses (run-length style) into a temporary buffer
- Calls LoadImage (PSY-Q SDK) to blit to VRAM
- Returns width * height (pixel count) or 0 on early exit

**Return computation:**

```
result = floor_div($v0, 4) + 0x20
```

The `addiu $v0, $v0, 3; sra $v0, $v0, 2; sll $v0, $v0, 2` sequence is
round-down-to-nearest-4 (handles negative values correctly). Then 0x20
(32) is added as a base offset.

### What the function computes

func_80016B7C takes a struct pointer, searches for matching entries in a
data table, loads the corresponding tile/image data, and returns the
aligned data size plus a 32-byte header offset. This is a **sprite data
size calculator** — it determines how many bytes of OT (Order Transparent)
or display list space a sprite entry needs.

## Evidence for sprite-renderer family membership

### Positive evidence (strong)

1. **Address adjacency** — func_80016B7C is the last function before
   func_80016C08 in the contiguous sprite-renderer block. func_80016C08
   is its sole caller.

2. **func_80016C08 accesses the same struct fields** — the caller reads
   `field_0x18`, `field_0x1C`, `field_0x20`, `field_0x24`, `field_0x28`,
   `field_0x2C` from the same struct pointer that 6B7C receives. These are
   the exact fields documented in file-groupings.md as the shared source-data
   layout for the sprite renderer family.

3. **Shared data pointer (field_0x18)** — both func_80016B7C and
   func_80015B24 access `lw 0x18($struct)` as an entry data base pointer.
   The matched renderer functions (80016280, 800165D8) decode the same
   source-data layout with `field_1C`, `field_20`, `field_24`, `field_28`,
   `field_2C`.

4. **Shared global T_8005E438** — func_80016C08 writes to T_8005E438
   (GP-relative s16) and then passes it as $a1 to func_80016B7C. This
   is a per-sprite state or ID tracked across the loop iterations.
   T_8005E438 is at address 0x8005E438, within the sprite family's known
   global cluster (D_8005E3A8, D_8005E3AC, D_8005E43C are all sprite-related).

5. **func_80016C08 loop structure** — the caller iterates through sprite
   entries, calling func_80016B7C twice per iteration with different
   arguments (different struct fields), accumulating the results. This
   is the natural "calculate sprite data sizes" pattern.

6. **Shared callees with func_80017284** — func_80017284 at 0x80017284
   also calls func_80015B24 + func_8001782C, suggesting these are library
   helpers used by multiple sprite-related functions. func_80017284 has
   0 callers (leaf in call graph) and takes different arguments
   (includes func_80015AAC call and D_8005EA28), suggesting it may be
   from a different TU or a different sprite subsystem.

### Negative evidence (none found)

No evidence contradicts sprite-renderer family membership.

### Confidence: **high**

Multiple independent fingerprints: address adjacency, caller's struct field
accesses, shared global cluster, and semantic role (sprite data size
calculation).

## func_80015B24 — entry searcher (calle
