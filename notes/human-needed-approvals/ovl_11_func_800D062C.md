# ovl_11_func_800D062C — human decision needed

- **Parked:** 2026-10-07T06:45:54.446Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800D062C.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 1, 0] at 26/26 words, measured 2026-10-07T05:35:24, first scored from build/staticChain/D062C-injected.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800D062C verdict UNKNOWN — 0/0 words (0%).
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D0600(s32 arg0, s32 arg1);

u16 ovl_11_func_800D062C(Ovl11RankPair *arg0) {
    /* Static-chain caller frame-address/call-boundary-dead at 0x800D064C; census ovl_11:ovl_11_func_800D062C (paired). */
    /* Static-chain caller frame-address/call-boundary-dead at 0x800D0660; census ovl_11:ovl_11_func_800D062C (paired). */
    auto s32 nested_ovl_11_func_800D0600(s32 arg0, s32 arg1) __asm__("ovl_11_func_800D0600");

    s32 temp_s1;
    s32 second;

    temp_s1 = nested_ovl_11_func_800D0600(arg0->rank38, arg0->rank58);
    second = nested_ovl_11_func_800D0600(arg0->rank40, arg0->rank60);
    return D_80123A00[temp_s1 * 3 + second];
}
```
