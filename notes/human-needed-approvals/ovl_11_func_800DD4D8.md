# ovl_11_func_800DD4D8 — human decision needed

- **Parked:** 2026-10-07T09:38:51.479Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800DD4D8.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 1, 2] at 48/52 words, measured 2026-10-07T09:35:22, first scored from src/overlays/ovl_11/ovl_11_func_800DD4D8.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800DD4D8 verdict UNKNOWN — 0/0 words (0%).
```

## Preserved attempt

```c
#include "common.h"

s32 func_8001AF44(u32 arg0);
void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_800DD4D8(void) {
    auto s32 nested_800DD45C(void *arg0, void *arg1, s32 arg2) __asm__("ovl_11_func_800DD45C");
    void *p = D_80129178.unk0;
    s32 one;
    if (p != 0) {
        one = 1;
        if (D_80129184 == one) goto L1;
        if (D_80129184 == 0) goto L0;
        if (D_80129184 == 2) goto L2;
        if (D_80129184 == 3) goto L3;
    }
    return;
L0:
    if (func_8001AF44(7U) == one) {
        D_80129184 = one;
    }
    return;
L1:
    nested_800DD45C(p, D_80129178.unk4, 2);
    return;
L2:
    nested_800DD45C(D_80129178.unk4, D_80129178.unk8, 3);
    return;
L3:
    if (nested_800DD45C(D_80129178.unk8, p, 0) == one) {
        func_8001AF70(7U, 0U);
    }
    return;
}
```
