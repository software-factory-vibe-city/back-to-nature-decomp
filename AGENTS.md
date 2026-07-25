# BTN Decompilation — Agent Guide

You are working on a **matching decompilation** of *Harvest Moon: Back to Nature*
(SLUS-01115, PlayStation 1). Goal: C source that compiles to a **byte-identical
binary** of the original PS-X EXE, verified by SHA-256 on every build.

**Read first:**
1. `README.md` — full project overview (toolchain, pipeline, tools inventory)

## Ground rules (non-negotiable)

- **NEVER use git commit** — do not commit, ever, unless the user explicitly asks
- Never commit `extracted/` or `build/`
- Tooling is **TypeScript only** (run via `npx tsx`). Do not check in Python scripts
- Tools go in `tools/`, configs in `configs/`, headers in `include/`
- C is **C89**: declarations at top of block, `/* */` comments only, no `//`

## The #1 rule of decompilation work here

**Do not "solve" functions with inline assembly, `INCLUDE_ASM`, `register
__asm__` pinning, or new entries in `configs/flag_overrides.mk`.** The compiler
is *proven* byte-identical to the original (see below), so for every function
that was originally C, matching source exists — a hack is a search failure, not
a solution. If you cannot match a function in clean C:

1. Classify the diff (see playbook below) and apply the matching fix class
2. If still stuck, **say so and stop** — report the diff signature. A stuck
   function is useful signal; a hacked match is poison.

Exceptions that are legitimate (do not "fix" these): GTE/cop2 functions and the
one pure-asm function — they were handwritten assembly in the original game.

## Proven toolchain facts (trust these, don't re-investigate)

| Parameter | Value | Proof |
|---|---|---|
| Compiler | GCC 2.95.2-psx (`tools/vendor/old-gcc/build-gcc-2.95.2-psx/cc1`) | Byte-identical output to original PSY-Q 4.6 `CC1PSX.EXE` |
| Assembler | ASPSX 2.77 via `tools/vendor/maspsx` | `li` expansion statistics |
| Runtime libs | PSY-Q SDK 4.7 | Signature matching (`tools/vendor/psx_psyq_signatures/470/`) |
| Flags | `-O2 -G8 -mips1 -mcpu=r3000 -funsigned-char -fpeephole -ffunction-cse -fpcc-struct-return -fcommon -msoft-float` | — |

It is **2.95.2, not 2.8.1** (switch-dispatch register `$a0` vs `$v0`). Register
hacks in older files date from the wrong-compiler era and are often unneeded now.

## Binary facts

- EXE: `extracted/iso/slus_011.15` — load `0x80010000`, entry `0x80011278`,
  payload 321,536 bytes at file offset `0x800`, GP `0x8005E274`
- Sections contiguous: `.rodata` → `.text` (0x80011270–0x80048190) → `.data` → `.sdata`
- ~463 functions total: 257 live (93 decompiled), 206 dead PSY-Q library code,
  10 GTE, 1 pure-asm

## Commands

```bash
make                              # build + verify byte-identical (the source of truth)
make check                        # verify only
make split                        # regenerate splat output (asm + linker script)
make progress                     # decompilation progress
npx tsx tools/agent/diffFunc.ts <func>  # per-function compile + diff + match %
npx tsx tools/agent/m2cFunc.ts <func>   # m2c first-pass decompilation
npx tsx tools/agent/callGraph.ts --top 20   # priority ranking
```

## Repo map

- `src/` — one C file per function (466 files); `build/asm/nonmatchings/` has original asm
- `include/` — `common.h` (types), `globals.h` (auto-generated `D_XXXXXXXX`
  externs — never redeclare these in .c files), `globals_override.h` (struct
  types for globals), `functions.h` (auto-generated signatures), `game_types.h`
  (shared structs), `psyq/` (SDK headers)
- `configs/` — `splat.yaml`, `symbol_addrs.txt`, `flag_overrides.mk`
- `tools/` — TypeScript tooling: `agent/` (LLM loop), `build/` (make split pipeline), `diagnostics/`, `lib/`, `vendor/` (old-gcc, maspsx, m2c, SDK data). See `notes/tools-directory-structure.md`
- `notes/` — institutional memory; `prompts/` — LLM agent prompt templates
- `build/` — all generated artifacts (gitignored); `extracted/` — original game (gitignored)

## Decompilation playbook

The full pattern catalog is `prompts/c-style-guide.md` (canonical C style
guide — read it before matching work). The short version: match diffs by
**classifying first**, then applying the known fix class:

| Diff kind | Meaning | Fix class |
|---|---|---|
| Same instructions, different registers | Allocation order | Temp variable structure/count, operand order, expression grouping |
| Same instructions, different order | Scheduling | Statement order, sequence points, comma expressions, `volatile` |
| Different instruction selection | Wrong types/idiom | Signedness (`lh`/`lhu`), `x*8` vs `x<<3`, cast placement |
| `lui` grouping, self-clobbering loads | Temp reuse | Global access pattern, reused temporaries across statements |
| Different stack frame | Locals | Local count/order, spills |

Workflow per function: m2c first pass → classify diff → apply fix class →
`diffFunc.ts` until 100% → `make check` (catches relocation/linker issues).
Struct types inferred from access patterns go in `game_types.h` (locals) or
`globals_override.h` (globals). Use load widths to infer types: `lw/sw`→s32,
`lh/sh`→s16, `lhu`→u16, `lb/sb`→s8, `lbu`→u8.

## Notes index (read before changing fundamentals)

- `notes/toolchain-version-detection.md` — the 2.95.2 proof
- `notes/compiler-identification.md` — SDK/compiler identification method
- `notes/bootstrapping.md` — how this project was built from scratch
- `notes/decompiling-any-psx-game.md` — generalized playbook for other games
- `notes/jump-table-problem.md` — switch/jump-table handling
- `notes/maspsx-issue*.md` — known assembler-emulation gaps (some mismatches
  are unfixable in C; suspect this only after exhausting the playbook)
- `notes/jobs-to-be-done.md` — **stale**, superseded by next-steps note
