# ovl_15_func_80135AE0 — resolved

- **Parked:** 2026-10-04T15:46:52.960Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_15/ovl_15_func_80135AE0.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 0, 1, 0] at 33/33 words, measured 2026-10-04T15:36:31, first scored from src/overlays/ovl_15/ovl_15_func_80135AE0.c) rather than the source left on disk, which measured [0, 6, 2, 8] at 11/31 words, measured 2026-10-04T15:46:52

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_15_func_80135AE0 verdict MISMATCH — 33/34 words (97.1%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 1, allocation 0.
Next block: 0 (0x80135AE0) — population 0, schedule 1, allocation 0. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.
```

## Preserved attempt

```c
#include "common.h"

typedef struct {
    u8 data[0x7F];
    u8 sum;
} Blk;

void ovl_15_func_80135AE0(void) {
    u8 sum;
    u8 c;
    s32 i;
    s32 j;
    s32 off;
    u8 *q;

    sum = 0;
    off = 0x280;
    for (i = 0; i < 251; i++) {
        c = 0;
        for (j = 0; j < 127; j++) {
            c ^= D_80137830[off + j];
        }
        ((Blk *)(D_80137830 + off))->sum = c;
        sum ^= c;
        off += 0x80;
    }
    i = off + 0x80;
    D_80137A30[0x38] = sum;
    c = 0;
    q = D_80137A30;
    for (i = 0; i < 127; i++) {
        c ^= *q++;
    }
    D_80137830[0x27F] = c;
}
```

## Resolution

Transferred the matched verifier sibling's count-up indexing idiom to the writer.
34/34 words are exact; full finalization passed without an exception.
The historical park record is retained above.
