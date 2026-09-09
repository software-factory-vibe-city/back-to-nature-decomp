# ovl_11_func_8011FEA0 — human decision needed

- **Parked:** 2026-09-09T02:40:30.313Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_8011FEA0.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 2, 2] at 21/26 words, measured 2026-09-09T02:25:49, first scored from src/overlays/ovl_11/ovl_11_func_8011FEA0.c) rather than the source left on disk, which measured [0, 0, 2, 2] at 21/26 words, measured 2026-09-09T02:37:56

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_8011FEA0 verdict MISMATCH — 21/27 words (77.8%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 2, allocation 2.
Next block: 0 (0x8011FEA0) — population 0, schedule 2, allocation 2. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.
```

## Preserved attempt

```c
#include "common.h"

void ovl_11_func_8011FEA0(s16 arg0, s16 arg1) {
    char *base;
    char *p;

    base = (char *)&D_8006C838;
    p = base + arg0 * 0x1D4;
    if (*(s16 *)(p + 0x8000 + 0x19EA) < 0xFF - arg1) {
        *(s16 *)(p + 0x8000 + 0x19EA) = (s16)(arg1 + *(u16 *)(p + 0x8000 + 0x19EA));
    } else {
        *(s16 *)(p + 0x8000 + 0x19EA) = 0xFF;
    }
}
```
