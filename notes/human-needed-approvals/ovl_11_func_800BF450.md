# ovl_11_func_800BF450 — human decision needed

- **Parked:** 2026-10-04T00:54:33.390Z
- **Reason:** asm-needs-human-approval
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800BF450.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 2, 0, 1] at 20/22 words, measured 2026-10-04T00:49:59, first scored from build/bf450var6/v_neg.c) rather than the source left on disk, which was never measured

## What the loop needs

The top escalation tier proposed a source construct the clean-source policy forbids,
and there is no higher agent to adjudicate it. Decide whether the construct is the
correct answer for this function. If it is, add the allowlist entry to
`.pi/autoloop.json` under `sourcePolicy.allowlist` and re-run the loop on this
target. If it is not, the function needs a different structural hypothesis.

## Policy findings

- `src/overlays/ovl_11/ovl_11_func_800BF450.c:34` — **register-asm** — Hard-register pinning is forbidden
  `register s32 *p asm("$3");`

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800BF450 verdict UNKNOWN — 0/0 words (0%).
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"

void *func_8001EF98(void);

register s32 *p asm("$3");

s32 ovl_11_func_800BF450(void) {
    s32 v;
    s32 w;

    p = func_8001EF98();
    D_80128808 = (s32)p;
    if (p == 0) {
        return 1;
    }
    v = *p;
    D_8012880C = v & 0xFFFF;
    if ((v & 0x2000) == 0) {
        p = (s32 *)0x8000;
        w = (s32)p - 0x8000;
        return w;
    }
    return 0;
}
```
