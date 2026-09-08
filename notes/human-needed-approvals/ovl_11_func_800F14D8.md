# ovl_11_func_800F14D8 — human decision needed

- **Parked:** 2026-09-08T20:25:35.146Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800F14D8.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 2, 0, 0] at 23/24 words, measured 2026-09-08T20:19:32, first scored from src/overlays/ovl_11/ovl_11_func_800F14D8.c) rather than the source left on disk, which measured [0, 2, 0, 0] at 25/26 words, measured 2026-09-08T20:23:27

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800F14D8 verdict MISMATCH — 23/26 words (88.5%).
Residual (steer by this, not the word count): control-flow 0, population 2, schedule 0, allocation 0.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 3 (0x800F14F8) — population 2, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.
```

## Preserved attempt

```c
#include "common.h"

s32 ovl_11_func_800F14D8(s32 arg0, s32 arg1, s32 arg2) {
    s32 i;
    s32 x;
    s32 target;
    s32 found;

    arg0 &= 0xFFFF;
    arg1 &= 0xFFFF;
    if ((arg0 == 31) || (arg1 == 31)) {
        return 1;
    }
    i = 0;
    target = *(s16 *)(arg2 + 4);
    if (arg1 >= 30) {
        arg1 = 29;
    }
    found = 0;
    arg1++;
    for (; i < arg1; i++) {
        x = arg0 + i;
        if (x >= 31) {
            x -= 29;
        }
        if (x == target) {
            found = 1;
            break;
        }
    }
    return found;
}
```
