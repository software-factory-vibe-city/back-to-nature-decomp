# BTN Decompilation

Matching decompilation of PS1 game SLUS-01115. Goal: C source that compiles to a byte-identical binary.

For tools, this is typescript only. do not check in python scripts.

## Key Facts
- PS-X EXE at `extracted/iso/slus_011.15` — load addr `0x80010000`, entry `0x80011278`, 321,536 byte payload at offset `0x800`
- 761 disassembled functions in `asm/functions/`, metadata in `asm/functions.csv`
- PSX-era GCC 2.8.0 cross-compiler built via Docker in `tools/old-gcc/`
- Build: `make split` (splat) → `make` (compile+link) → `make check` (verify match)
- Custom tooling is TypeScript, run via `npx tsx`

## Conventions
- Never commit `extracted/` or `build/` directories
- Tools go in `tools/`, configs in `configs/`, headers in `include/`
- Do not commit without being asked

NEVER USE GIT COMMIT TO CHECK IN CHANGES 