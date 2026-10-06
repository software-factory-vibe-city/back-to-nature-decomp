# ovl_11_func_80108B8C — resolved with byte-exact clean C

The parked-function campaign replaced the cached-pointer access with an
indexed byte member in a shared access view. The first probe and integrated
source matched 23/23 words under baseline flags. Full finalization passed
(`build/parked-recovery/80108B8C-finalize.json`); no exception or approval was
needed. The earlier pointer-only closure did not cover this storage origin.
The original handoff is retained below as historical evidence.

- **Parked:** 2026-08-24T20:09:46.896Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_80108B8C.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 0, 4] at 15/23 words, measured 2026-08-24T19:36:39, first scored from src/overlays/ovl_11/ovl_11_func_80108B8C.c) rather than the source left on disk, which measured zero residual, bytes still differ at 22/23 words, measured 2026-08-24T19:57:31

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_80108B8C verdict UNKNOWN — 0/0 words (0%).
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ s16 field_2;
} Ovl11D050Entry;

extern Ovl11D050Entry D_8012D050[3];

void ovl_11_func_80108B8C(void) {
    s16 y;
    int d;
    u8 *base;

    y = D_8012D050[2].field_2;
    if (y == 2) {
        d = D_8012D050[2].field_0 - 0x258;
        if ((unsigned)d < 9U) {
            /* Two-stage base formation keeps +0xE7A2 as runtime ori/addu (matched idiom) */
            base = (u8 *)&D_8006C838;
            base += 0xE7A2;
            base += d;
            if (*base == 1) {
                *base = y;
            }
        }
    }
}
```
