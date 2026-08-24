# ovl_11_func_8011FF74 — human decision needed

- **Parked:** 2026-08-24T06:51:14.310Z
- **Reason:** asm-needs-human-approval
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_8011FF74.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 0, 0, 2] at 10/13 words, measured 2026-08-24T06:38:44)

## What the loop needs

The top escalation tier proposed a source construct the clean-source policy forbids,
and there is no higher agent to adjudicate it. Decide whether the construct is the
correct answer for this function. If it is, add the allowlist entry to
`.pi/autodecomp.json` under `sourcePolicy.allowlist` and re-run the loop on this
target. If it is not, the function needs a different structural hypothesis.

## Policy findings

- `configs/flag_overrides.mk:258` — **flag-override** — Per-function compiler flag override is not allowlisted
  `CC1FLAGS_ovl_11_func_8011FF74 := -fno-schedule-insns`
- `configs/flag_overrides.mk:258` — **flag-override** — New per-function compiler flag overrides are forbidden
  `CC1FLAGS_ovl_11_func_8011FF74 := -fno-schedule-insns`

## Oracle report for the preserved attempt

```
top tier proposed a forbidden construct with no higher tier to adjudicate it
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    /* 0x00 */ char pad00[0x16];
    /* 0x16 */ s16 unk16;
} UnkStruct8011FF74;

void ovl_11_func_8011FF74(UnkStruct8011FF74 *arg0, s16 arg1) {
    s32 limit = 0xFF - arg1;
    if (arg0->unk16 < limit) {
        arg0->unk16 = (s16)(arg1 + (u16)arg0->unk16);
        return;
    }
    arg0->unk16 = 0xFF;
}
```
