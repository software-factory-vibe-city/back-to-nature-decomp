# func_8001B3EC: Web Parity Blockers

**Date:** 2026-01-07
**Status:** ~~Stuck at 33/57~~ **RESOLVED — MATCH 57/57 on 2026-08-12**
**Mode:** Fresh decompilation from INCLUDE_ASM stub → resumed and matched

## Resolution (2026-08-12, dated correction)

The original conclusion below — that the `lbu` + `sra` pattern is unreachable
from clean C89 — was WRONG. All four blockers are solvable from ordinary C:

1. **`lbu` + `sra` (Blocker 1):** reachable by SPLITTING the load from the
   shift into separate statements on an `s32` local:
   `threshold = base[2]; count++; threshold >>= 1;`. The single-statement
   form `threshold = base[2] >> 1;` compiles the shift operand's definition
   adjacent to the `ashiftrt`, so combine folds `(ashiftrt (zero_extend …))`
   into `lshiftrt` → `srl`. Separated by an intervening statement, the
   `ashiftrt` survives as `sra`. Target order `lbu; addiu; sra` reproduced
   byte-for-byte. (Whichever of `>>= 1` or `= threshold >> 1` — identical RTL.)
2. **Reload inside `if` (Blocker 2):** the `lw; addiu; sw` RMW is a genuine
   read-modify-write on the s32 table entry; forced with a volatile lvalue
   cast: `*((volatile s32 *)&D_8005E4C8[arg0]) += 3;`.
3. **`$t0` entry copy (Blocker 3):** falls out of the final web shape; no
   special handling needed.
4. **`D_8005E870` base timing (Blocker 4):** assigning `flags = (u8*)&D_8005E870`
   before `base` puts the `lui` early and the `addiu a3` in the null-check
   delay slot, matching the target.

Symbols: the target's GP-relative accesses require THIS TU to define
`D_8005E4C8` (s32) and `D_8005E4C0` (u16/s16 view) tentatively — the earlier
`T_8005E4C8`/`T_8005E4C0` names were inventions with no address in the symbol
tables (diff showed UNDETERMINED relocations). Matched sibling
`func_8001B4E4` defines the same names (`D_8005E4C8` s32, `D_8005E4C0` s16);
multiple TUs defining the same common symbol is the established pattern
(merges at link, GP-relative in each owner TU).

Verified: `diffFunc` MATCH 57/57; `psx_source_policy` pass; triage clean.
Full-`make check` gate is blocked by unrelated pre-existing HEAD conflict
`src/func_80019600.c` (`s16 D_8005E444` vs `extern u16 D_8005E444` in
`globals_override.h`) — present since commit 30f5b5a.

---

## Original analysis (outdated, kept for history)

**Date:** 2026-01-07
**Status (original):** Stuck at 33/57 (57.9%) - web parity failures prevent progress

## Function Summary

`func_8001B3EC(s32 arg0)` processes one entry from the pad/controller state
tables. It reads a pointer from `T_8005E4C8[arg0]`, increments a counter at
`T_8005E4C0[arg0]`, compares against a threshold derived from the pointed-to
data, and conditionally updates state flags in `D_8005E870`.

## Current Source

```c
void func_8001B3EC(s32 arg0) {
    u8 *base;
    s32 idx;
    s32 count;
    u8 threshold;

    idx = arg0;
    base = (u8 *)T_8005E4C8[idx];
    if (base) {
        count = T_8005E4C0[idx];
        threshold = base[2] >> 1;
        count = count + 1;
        T_8005E4C0[idx] = (u16)count;
        if ((s32)threshold < (s16)count) {
            T_8005E4C8[idx] = T_8005E4C8[idx] + 3;
            T_8005E4C0[idx] = 0;
            base += 3;
        }
        if (base[0] == 0xFF) {
            func_8001B4E4(idx);
            return;
        }
        D_8005E870.field_36 = 0;
        D_8005E870.field_37 = 0;
        if (base[0] & 1) {
            D_8005E870.field_36 = 1;
        }
        if (base[0] & 2) {
            D_8005E870.field_37 = base[1];
        }
    }
}
```

## Web Parity Failures

The explainDiff classifier reports WEB-PARITY FAILURE with:
- 4 target-only webs
- 2 compiled-only webs

### Blocker 1: srl vs sra (instruction selection)

**Target:** `lbu v1,2(a1)` followed by `sra v1,v1,0x1` (arithmetic shift)
**Compiled:** `lbu v1,2(a1)` followed by `srl v1,v1,0x1` (logical shift)

The target uses `sra` (arithmetic right shift) after an `lbu` (unsigned byte
load). This is unusual: unsigned types normally produce `srl` in GCC 2.95.2.

The semantic difference matters for values 128-255:
- `srl`: 0xFF >> 1 = 0x7F (127)
- `sra`: 0xFF >> 1 = 0xFFFFFFFF (-1, then compared as signed)

**Tested expressions (all produce srl or extra instructions):**
- `base[2] >> 1` (u8) → `lbu` + `srl` ✓ load, ✗ shift
- `(s8)base[2] >> 1` → `lb` + `sra` ✗ load, ✓ shift
- `(s16)base[2] >> 1` → `lhu` + `sra` ✗ load, ✓ shift
- `(s16)(s8)base[2] >> 1` → `lbu` + `sll 24` + `sra 25` ✗ extra instructions
- `(u32)base[2] >> 1` → `lbu` + `srl` (same as base)

**Conclusion:** No clean C89 expression produces `lbu` + `sra` as a single
shift. The target's instruction sequence appears to require either:
1. A non-standard original source construct (bitfield, union, inline asm)
2. A GCC 2.95.2 codegen path not reachable from standard C expressions
3. The original used a different comparison structure that happens to emit sra

### Blocker 2: Extra reload from T_8005E4C8 base

**Target (inside if block):**
```
lw      v0,0(a2)     ; reload from T_8005E4C8 base ($a2)
addiu   a1,a1,3      ; base += 3 (separate from reload)
addiu   v0,v0,3      ; v0 = reloaded_value + 3
sw      v0,0(a2)     ; store back to T_8005E4C8[idx]
```

**Compiled:**
```
addiu   v0,a1,3      ; v0 = base + 3 (uses base variable directly)
move    a1,v0        ; base = v0
sw      v0,0(a3)     ; store to T_8005E4C8[idx]
```

The target creates a web `$v0#7` from `lw v0,0(a2)` that is used for the
`addiu v0,v0,3` computation. My code uses `$a1` (the base variable) directly,
creating `addiu v0,a1,3` instead.

This is an instruction-count delta: the target has 2 extra instructions
(`lw` + `addiu`) that my code lacks. The compiler correctly recognizes that
`base` already holds the value from `T_8005E4C8[idx]`, making the reload
redundant. Reproducing the target's "redundant" reload from clean C would
require defeating CSE, which is not achievable without barriers or volatile.

### Blocker 3: Register allocation ($t0 vs $a2/$a3)

**Target:** Saves `arg0` to `$t0` at entry, uses it throughout
**Compiled:** Saves to `$a2` or `$a3` depending on variant

The target's `$t0` allocation requires:
1. An entry copy that creates a high-priority web
2. That web winning `$t0` in global allocation

My variants create different web structures that allocate to different
registers. The residual source space search (240 candidates) exhausted
without finding any variant that produces `$t0` allocation.

### Blocker 4: D_8005E870 base timing

**Target:** Computes `&D_8005E870` in delay slot of null check (`addiu a3,v0,-6032`)
**Compiled:** Computes later, after the if block

The target materializes the D_8005E870 address early and reuses `$a3` for
all subsequent stores. My code computes the address later, using `$v1`.

This is a scheduling difference downstream of the web parity failures.

## Exhausted Approaches

1. **Multiple source variants** (baseline, arg0reuse, baseptr, flags, nobase,
   s16thresh)
   - All diverged early with register allocation differences

2. **Residual source space search** (240 candidates, 5 web partitions)
   - Best class: 34/48, still diverges at register allocation
   - No exact match found

3. **Source-shape synthesis** (deriveOnly, maxDepth 2)
   - Only 1 alternative generated, 0/28 requirements covered
   - Tool limited to prologue before control flow

4. **Fuzz variants with mechanism hypotheses**
   - All inconclusive, same first divergence

5. **Various C expressions for srl→sra conversion** (single-statement forms)
   - All produced srl or extra instructions; the split-statement form was not
     tried until the 2026-08-12 resume. See Resolution above.

## TU Ownership

The function uses GP-relative addressing for `T_8005E4C8` and `T_8005E4C0`,
indicating this TU owns them. Tentative definitions with `[1]` size keep them
within the -G8 threshold for GP-relative access:
```c
s32 T_8005E4C8[1];
u16 T_8005E4C0[1];
```

## Adjacent Functions

- `func_8001B2CC` - also uses T_8005E4C8 (GP-relative)
- `func_8001B4D0` - also uses T_8005E4C8 (GP-relative)
- `func_8001B4E4` - called by this function, also uses T_8005E4C8

These are likely in the same TU (pad/controller handling).

## Conclusion

The 2026-08-12 resume disproved the original conclusion below. The function
matches 57/57 in clean C89; see the Resolution section at the top.

---

Original conclusion (outdated): The function cannot be matched in clean C89
due to:
1. The `lbu` + `sra` instruction pattern being unreachable from standard C
2. A "redundant" reload that defeats CSE
3. Register allocation differences stemming from web structure mismatches

These appeared to be semantic/web-parity blockers; the split-statement shift
masked the real mechanism (combine adjacency).
