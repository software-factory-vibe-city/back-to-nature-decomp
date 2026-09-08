# ovl_11_func_800D0BC8 — human decision needed

- **Parked:** 2026-09-08T23:08:52.747Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D0BC8.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 6, 1, 6] at 13/25 words, measured 2026-09-08T23:07:07)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D0BC8 verdict MISMATCH — 13/27 words (48.1%).
Instruction count delta versus target: -1.
Residual (steer by this, not the word count): control-flow 0, population 6, schedule 1, allocation 6.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 1 (0x800D0BD8) — population 1, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    char pad_000[0x44D0];
    u16 field_44D0;
    u16 field_44D2;
    char pad_44D4[0x99C8 - 0x44D4];
    s16 field_99C8[0x3C];
} D8006C838ViewD0BC8;

s32 ovl_11_func_800D0BC8(s32 arg0) {
    char *base = (char *)&D_8006C838;

    if (arg0 == 1) {
        if (*(u16 *)(base + 0x44D0) == 0) {
            return 2;
        }
    }
    if ((arg0 == 3) && (*(u16 *)(base + 0x44D2) == 0)) {
        return 2;
    }
    return ~*(s16 *)(base + 0x99C8 + arg0 * 4) != 0;
}
```
