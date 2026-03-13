# Current Task: Local Decompilation Testing Pipeline

## Context

We've confirmed PSY-Q 4.7 libraries + GCC 2.8.0 compiler. We have a test function
(`func_8001FE00`) and a C source attempt (`src/func_8001FE00.c`). The compile pipeline
works (cpp → cc1 → maspsx → as), but we can't yet produce matching output.

## Blockers

### 1. Division expansion mismatch

The original binary's signed `div` expansion has only a zero check:
```
div   zero,v0,a0
mflo  v0
bnez  a0, .Lok
nop
break 0,7
```

Both maspsx `--expand-div` and GNU `as` emit a two-part check (zero + overflow).
maspsx's README mentions "partial div expansion" for ASPSX's `-0` flag, but no
maspsx flag produces the partial version. Need to either:
- Find the right maspsx flag/version
- Patch maspsx to support partial expansion
- Write our own post-processing step

### 2. Register allocation difference

Target uses `a1` for struct pointer, compiled uses `v1`. May be a compiler flags
issue (`-G` value, optimization level) or a source code issue.

## Done

- **diffFunc.ts** — `npx tsx tools/diffFunc.ts src/func_8001FE00.c build/asm/10600.s.o`
  - Compiles via full pipeline (cpp → cc1 → maspsx → as)
  - Side-by-side diff via `diff --color -y`
  - Match percentage (positional instruction comparison)
  - Watches source file for changes via `fs.watchFile`
- **Removed asm-differ** from git submodules

## Next Steps

### A. Bulk convert to INCLUDE_ASM stubs

Convert all asm segments to C with INCLUDE_ASM stubs so we can replace them one at a time:

1. Write a tool that converts all `asm` segments in `splat.yaml` to `c` segments
2. Generate a `.c` file for each with `INCLUDE_ASM` stubs
3. Verify build still works (`make split && make check`)
4. From there, replace stubs with real C one function at a time

### B. First matching function

Get a confirmed match to validate the pipeline. Candidates:

- **`102B4.s`** — `func_8001FAB4`: returns 0
- **`272C.s`** — `func_80011F2C`: gp-relative byte store (setter)
- **`2738.s`** — `func_80011F38`: gp-relative byte load (getter)
- **`2744.s`** / **`2750.s`** — gp-relative word store (setters)

### C. Fix the div expansion

Investigate options:
- Check if newer maspsx has a partial-expansion flag
- Look at how other decomp projects handle this (silent-hill-decomp, sotn-decomp)
- Consider writing a post-processing step that strips the overflow check from
  maspsx output

### C. Tune compiler flags

Once div is fixed, iterate on more complex functions:
- Try different `-G` values (0, 4, 8)
- Try `-O1` vs `-O2`
- Adjust C source (struct layout, types, etc.)

