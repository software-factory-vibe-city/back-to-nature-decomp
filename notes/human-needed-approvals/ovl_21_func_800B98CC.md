# ovl_21_func_800B98CC — resolved

**Resolved:** 16/16 byte-exact clean C, fully finalized. Fresh candidate flag
measurements and the original store/return fingerprint support the sched1-only
override; its allowlist audit trail is now present. See the techniques ledger.
Historical record follows.

- **Parked:** 2026-10-03T20:59:10.060Z
- **Reason:** asm-needs-human-approval
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_21/ovl_21_func_800B98CC.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program (EXACT at 16/16 words, measured 2026-10-03T20:58:34)

## What the loop needs

The top escalation tier proposed a source construct the clean-source policy forbids,
and there is no higher agent to adjudicate it. Decide whether the construct is the
correct answer for this function. If it is, add the allowlist entry to
`.pi/autoloop.json` under `sourcePolicy.allowlist` and re-run the loop on this
target. If it is not, the function needs a different structural hypothesis.

## Policy findings

- `configs/flag_overrides.mk:303` — **flag-override** — Per-function compiler flag override is not allowlisted
  `CC1FLAGS_ovl_21_func_800B98CC := -fno-schedule-insns`
- `configs/flag_overrides.mk:303` — **flag-override** — New per-function compiler flag overrides are forbidden
  `CC1FLAGS_ovl_21_func_800B98CC := -fno-schedule-insns`

## Oracle report for the preserved attempt

```
top tier proposed a forbidden construct with no higher tier to adjudicate it
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    char pad_0[0x2];
    s16 unk2;
    char pad_4[0x14];
    s32 unk18;
    u16 unk1C;
} Ovl21Unk800B98CC;

s32 ovl_21_func_800B98CC(Ovl21Unk800B98CC *arg0) {
    s32 result;
    if (arg0->unk2 >= 3) {
        result = ((u32)arg0->unk1C) < (u32)3;
        arg0->unk18 = result;
        return result;
    } else {
        result = ((u32)(arg0->unk1C + -3)) < (u32)3;
        arg0->unk18 = result;
        return result;
    }
}
```
