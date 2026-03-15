# Toolchain Version Detection Strategy

## Problem

The build pipeline currently hardcodes `GCC_VERSION := 2.8.0` and `--aspsx-version 2.67`. For general-purpose use across arbitrary PSX ROMs, these must be detected automatically. Getting either wrong produces correct-looking code that fails to byte-match.

## What Needs Detecting

| Parameter | Current Hardcode | Affects |
|-----------|-----------------|---------|
| GCC version (2.6.3, 2.7.2, 2.8.0, 2.8.1, 2.91, 2.95.2) | `GCC_VERSION := 2.8.0` | Code generation, register allocation, instruction selection |
| ASPSX version (1.05 through 2.86) | `--aspsx-version 2.67` | `li` expansion (addiu vs ori), div expansion, $at usage, nop insertion |
| PSY-Q SDK version | Implicit (lib/ contents) | Available library functions, header signatures |
| Optimization level (-O0, -O1, -O2) | `-O2` | Inlining, loop transforms, dead code elimination |
| -G flag value (sdata threshold) | `-G8` | Small data section usage, $gp-relative addressing |

## Detection Signals

### GCC Version

**Signal 1: Function epilog pattern (strongest)**

GCC 2.7.2 adjusts `$sp` before the jump:
```
addiu $sp, $sp, N
jr    $ra
nop
```

GCC 2.8.0+ puts the `$sp` adjustment in the delay slot:
```
jr    $ra
addiu $sp, $sp, N
```

Detection: scan the binary for function epilogs. If `jr $ra` is consistently followed by `addiu $sp, $sp, N` in the delay slot, it's 2.8.0+. If `addiu $sp` precedes `jr $ra`, it's 2.7.2.

**Signal 2: Comment header in .s output**

GCC 2.7.2 (Sony variant) emits:
```
# GNU C 2.7.2 [AL 1.1, MM 40] Sony Playstation compiled by GNU C
```

GCC 2.8.0 emits no comment header. This is only visible in intermediate `.s` files, not the final binary, so it's useful for confirming but not for detection from a ROM.

**Signal 3: Unnecessary stack frames**

GCC 2.7.2 allocates stack frames even for simple leaf functions that don't need them. GCC 2.8.0 eliminates unnecessary frames. A function that's clearly a leaf but has `addiu $sp, $sp, -N` / `addiu $sp, $sp, N` without saving any registers suggests 2.7.2.

**Signal 4: `li` literal format in assembly**

GCC 2.7.2: `li $2,0x00000001  # 1` (hex primary, decimal comment)
GCC 2.8.0: `li $2,1  # 0x00000001` (decimal primary, hex comment)

Only visible in intermediate `.s` files. Not detectable from the final binary since both produce the same machine code (after assembler expansion).

### ASPSX Version

The ASPSX version determines how pseudo-instructions are expanded. These are detectable from the final binary since they produce different opcodes.

**Signal 1: `li` expansion — `addiu` vs `ori` (strongest)**

| Pattern | ASPSX Version |
|---------|---------------|
| `li $reg, <small positive>` → `ori $reg, $zero, val` (opcode 0x34) | < 2.56 |
| `li $reg, <small positive>` → `addiu $reg, $zero, val` (opcode 0x24) | >= 2.56 |

Detection: scan for instructions matching `addiu $reg, $zero, <0-0x7FFF>` and `ori $reg, $zero, <0-0x7FFF>`. The dominant pattern indicates the version boundary. Note: values >= 0x8000 always use `ori` (sign-extension semantics differ), so only count values < 0x8000.

**Signal 2: Division overflow check — `break` vs `tge`**

| Pattern | ASPSX Version |
|---------|---------------|
| `div; ...; break 7` | All except 2.05/2.08 |
| `div; ...; tge` | 2.05/2.08 only |

Detection: search for `tge` instructions near `div`/`divu`. If present, ASPSX is 2.05-2.08. If only `break` is used, it's any other version.

**Signal 3: `$at` usage in `sltu` expansion**

| Pattern | ASPSX Version |
|---------|---------------|
| `sltu $reg, $at` (load immediate into $at first) | < 2.70 |
| `sltiu $reg, $reg, imm` (direct immediate) | >= 2.70 |

Detection: look for `sltu` with `$at` as operand preceded by `li $at, imm`. If absent and `sltiu` is used instead, ASPSX >= 2.70.

**Signal 4: Nop insertion at `$at` expansion**

| Pattern | ASPSX Version |
|---------|---------------|
| Extra nop between value load and `$at` use | < 2.30 |
| No extra nop | >= 2.30 |

**Signal 5: `mflo`/`mfhi` gap enforcement**

| Pattern | ASPSX Version |
|---------|---------------|
| No enforced gap between `mflo`/`mfhi` and `div`/`mult` | < 2.30 |
| 2-instruction gap enforced (nops inserted if needed) | >= 2.30 |

### ASPSX Version Decision Tree

```
Has tge instructions near div?
  YES → 2.05/2.08
  NO →
    li small positive → ori?
      YES → < 2.56
        Has nop at $at expansion?
          YES → < 2.30
            Has mflo/mfhi gap enforcement?
              NO  → < 2.30 (confirmed)
              YES → contradiction, manual review
          NO → 2.30-2.55
      NO (addiu) → >= 2.56
        sltu uses $at?
          YES → 2.56-2.69
          NO (sltiu) → >= 2.70
            gp-relative with offset?
              NO  → 2.70-2.79
              YES → >= 2.80
                la uses gp?
                  NO  → 2.70-2.79 (recheck)
                  YES → >= 2.80
```

### PSY-Q SDK Version

**Signal 1: `$Id` tags in binary**

PSY-Q library objects embed RCS `$Id` tags with dates. These survive linking into the final binary. Example from SLUS-01115:
```
$Id: intr.c,v 1.75 1997/02/07
$Id: bios.c,v 1.86 1997/03/28
$Id: sys.c,v 1.140 1998/01/12
```

The latest date gives a lower bound on the SDK version. Cross-reference with known PSY-Q release dates:
- PSY-Q 3.5: mid 1996
- PSY-Q 3.6: late 1996
- PSY-Q 4.0: early 1997
- PSY-Q 4.3: mid 1997
- PSY-Q 4.6: late 1997 / early 1998
- PSY-Q 4.7: mid 1998

**Signal 2: Copyright string**

The standard PSY-Q copyright:
```
Library Programs (c) 1993-YYYY Sony Computer Entertainment Inc.
```

The end year gives a rough SDK era.

**Signal 3: Library function signatures**

Different SDK versions have slightly different implementations. Matching `.obj` files from known SDK versions against the binary's library segments identifies the exact SDK release.

### Optimization Level

**Signal 1: Instruction scheduling**

`-O2` aggressively reorders instructions to fill delay slots. `-O0` leaves nops. `-O1` does some reordering. Count the ratio of `nop` instructions after branches — a high ratio suggests lower optimization.

**Signal 2: Function inlining**

`-O2` inlines small functions. If the binary has many tiny functions that are never inlined, it's likely `-O1` or `-O0`.

**Signal 3: Register allocation patterns**

`-O0` spills everything to the stack. `-O2` keeps values in registers across basic blocks.

### -G Flag (sdata threshold)

Detection: look for `$gp`-relative loads/stores (`lw $reg, offset($gp)`). The maximum offset used reveals the sdata threshold. If no `$gp`-relative accesses exist, `-G0`. If accesses exist for symbols up to 8 bytes, `-G8`. The splat disassembler can report which symbols use `$gp`-relative addressing.

## Implementation Plan

### Phase 1: Detection Tool (`tools/detectToolchain.ts`)

Takes a PSX EXE as input, outputs detected parameters:

```
$ npx tsx tools/detectToolchain.ts extracted/iso/slus_011.15

Detected toolchain:
  GCC version:   2.8.0  (confidence: high — delay-slot epilog pattern)
  ASPSX version: 2.56+  (confidence: high — addiu dominant for li)
  ASPSX version: <2.70  (confidence: medium — sltu uses $at)
  ASPSX version: ~2.67  (best estimate)
  PSY-Q SDK:     4.6+   (confidence: medium — $Id dates to 1998/01)
  Optimization:  -O2    (confidence: high — delay slot fill rate >90%)
  -G value:      8      (confidence: high — gp-relative accesses present)
```

Implementation steps:
1. Parse the PSX EXE header to locate the code segment
2. Disassemble the code segment (use existing spimdisasm infrastructure)
3. Run each heuristic, collect votes with confidence levels
4. Output detected parameters as JSON for consumption by other tools

### Phase 2: Config Generation

The detection tool outputs a `toolchain.json` that the Makefile and all tools read:

```json
{
  "gcc_version": "2.8.0",
  "aspsx_version": "2.67",
  "psyq_sdk": "4.6",
  "optimization": "-O2",
  "sdata_limit": 8
}
```

The Makefile reads this instead of hardcoding:
```makefile
TOOLCHAIN := $(shell cat build/toolchain.json)
GCC_VERSION := $(shell echo '$(TOOLCHAIN)' | jq -r '.gcc_version')
ASPSX_FLAGS := --aspsx-version $(shell echo '$(TOOLCHAIN)' | jq -r '.aspsx_version')
```

### Phase 3: Validation

After detection, validate by compiling a few already-matched functions (or trivial stubs) and checking byte-match. If the detected versions produce mismatches, try neighboring versions. This creates a feedback loop that narrows the detection.

### Phase 4: Per-File Overrides

Some games use multiple compilation units with different flags (e.g., library code compiled with different optimization than game code). Support per-file or per-segment overrides in `toolchain.json`:

```json
{
  "default": { "gcc_version": "2.8.0", "optimization": "-O2" },
  "overrides": {
    "lib_*": { "optimization": "-O1" },
    "func_80018000-80019FFF": { "gcc_version": "2.7.2" }
  }
}
```

## Known Limitations

1. **GCC 2.7.2 vs 2.7.2.1**: Minor point releases may be indistinguishable from the binary alone.
2. **ASPSX 2.56 vs 2.67**: The `addiu`-for-`li` signal only distinguishes `>= 2.56` from `< 2.56`. Narrowing further requires the `sltu` and `$gp` signals, which may have few instances.
3. **Mixed toolchains**: Some games link objects compiled with different compiler versions (e.g., middleware compiled separately). The detection needs to handle non-uniform signals gracefully.
4. **Custom compiler patches**: Some studios patched GCC. The Sony PSX variant of GCC 2.7.2 has specific codegen differences from upstream 2.7.2. Detection heuristics are trained on known variants.
