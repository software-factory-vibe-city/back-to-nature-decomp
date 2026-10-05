# ovl_11_func_800F9F58 — human decision needed

- **Parked:** 2026-10-05T11:02:30.750Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800F9F58.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 1] at 37/39 words, measured 2026-10-05T10:40:58, first scored from build/preparation/ovl_11_func_800F9F58/81c26fd63a314e2eeb97e5ca3c680d4822b6b13f8d72a899f913f0baf3235fbc/draft.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800F9F58 verdict MISMATCH — 37/39 words (94.9%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 0, allocation 1.
Next block: 2 (0x800F9F8C) — population 0, schedule 0, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s32 func_800226B0 (void);
void func_80022738 (void);
void func_8001FABC (s16 arg0);
void ovl_11_func_800F6640 (void);
s32 func_800212A8 (s32 soundId, s32 lo, s32 hi);
void SetVal8005E2BC (s32 arg0);
void SetVal8005E334 (s32 arg0);

extern s32 D_80126F7C;
extern s32 D_80126F80;
extern s32 D_80126F88;

void ovl_11_func_800F9F58(void) {
    s32 temp_v1;

    if (func_800226B0() != 0) {
        temp_v1 = *(s32 *) ((u8 *) D_8005E3A8 + 8);
        if (temp_v1 & 0x50) {
            func_80022738();
            func_8001FABC(0);
            D_80126F80 = 0;
            return;
        }
        if (temp_v1 & 0x20) {
            if (D_80126F88 == 1) {
                ovl_11_func_800F6640();
            }
            func_80022738();
            D_80126F7C = 2;
            func_8001FABC(3);
        }
    }
}
/* Warning: struct GfxObj is not defined (only forward-declared) */
```
