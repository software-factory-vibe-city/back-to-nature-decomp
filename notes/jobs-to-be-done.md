# Jobs To Be Done

## GCC 2.95.2 compiler switch follow-up

After switching from GCC 2.8.1 to 2.95.2, the build has **14 bytes** mismatching across **2 functions**.

### Completed
- `func_8001F39C` — rewrote as `arg0->field -= arg1->field` (100% match)
- `func_8002261C` — removed `register __asm__("v0")` hack (100% match)
- `func_8001A8D0` — replaced INCLUDE_ASM with clean C switch statement (100% match). Required:
  - Reordering switch cases to match original binary's case body layout
  - `mergeFragments.ts` updated to split monolithic rodata segment when a C function owns a jump table (new `.rodata` subsegment insertion + rodata continuation)
  - `mergeFragments.ts` fixed to not reset C source files to INCLUDE_ASM stubs (only resets inline `__asm__` blocks)

### Still mismatching (14 bytes)

| Function | Address | Issue |
|----------|---------|-------|
| `SetGfxOffset` | 0x80013AA4 | 2.95.2 CSEs `lui 0x8006` across two pointer loads; target has two independent `lui`. Neither volatile, scheduling barriers, nor `register __asm__` prevents CSE. |
| `SetGfxClip` | 0x80013AC8 | Same pattern/issue as SetGfxOffset |

Source files: `src/SetGfxOffset.c`, `src/SetGfxClip.c`

### Functions reverted to stubs

| Function | Address | Reason |
|----------|---------|--------|
| `func_80021820` | 0x80021820 | Heavily register-hacked for 2.8.1, 4 bytes too big with 2.95.2. Needs full re-decomp. |
