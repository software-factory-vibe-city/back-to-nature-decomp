# ovl_10_func_800BADA4 — human decision needed

- **Parked:** 2026-08-22T12:29:58.051Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_10/ovl_10_func_800BADA4.c` (INCLUDE_ASM restored)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Last oracle report

```
Oracle: ovl_10_func_800BADA4 verdict MISMATCH — 299/304 words (98.4%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 3, allocation 1.
Next block: 45 (0x800BB0E4) — population 0, schedule 1, allocation 0. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.
```

## Preserved attempt

```c
#include "common.h"

int FntPrint();
int McxReadDev(int, int, unsigned char *, unsigned char *);
s32 ovl_10_func_800BB728(s32);
int sprintf(char *, const char *, ...);

int ovl_10_func_800BADA4(int arg0, int arg1) {
    char buf[16];
    int s1;
    int s2;
    int s3;

    switch (arg0) {
    case 0:
        if (D_800BBA40 == 0) {
            if (arg1 & 0x2000) {
                if (D_800BB8A4 < 0x1F) {
                    D_800BB8A4 += 1;
                }
            } else if ((arg1 & 0x8000) && (D_800BB8A4 >= 0)) {
                D_800BB8A4 -= 1;
            }
            if (arg1 & 0x1000) {
                D_800BB8A4 -= 0x10;
                if (D_800BB8A4 < 0) {
                    D_800BB8A4 = -1;
                }
            } else if (arg1 & 0x4000) {
                if (D_800BB8A4 < 0) {
                    D_800BB8A4 = 0;
                } else if (D_800BB8A4 + 0x10 < 0x20) {
                    D_800BB8A4 += 0x10;
                }
            }
        }
        D_800BBA40 = arg1 & 0xF000;

        if (arg1 & 0x10) {
            s32 v = D_800BB8A8 + 1;
            D_800BB8A8 = v;
            if (ovl_10_func_800BB728(v) != 0) {
                D_800BBA4C[D_800BB8A4 + 1] += 0x10;
            }
        } else {
            D_800BB8A8 = 0;
            if (arg1 & 0x80) {
                s32 v = D_800BB8AC + 1;
                D_800BB8AC = v;
                if (ovl_10_func_800BB728(v) != 0) {
                    D_800BBA4C[D_800BB8A4 + 1] += 0xF0;
                }
            } else {
                D_800BB8AC = 0;
            }
        }

        if (arg1 & 0x20) {
            s32 v = D_800BB8B0 + 1;
            D_800BB8B0 = v;
            if (ovl_10_func_800BB728(v) != 0) {
                D_800BBA4C[D_800BB8A4 + 1] =
                    (D_800BBA4C[D_800BB8A4 + 1] & 0xF0) +
                    (((D_800BBA4C[D_800BB8A4 + 1] & 0xF) + 1) & 0xF);
            }
        } else {
            D_800BB8B0 = 0;
            if (arg1 & 0x40) {
                s32 v = D_800BB8B4 + 1;
                D_800BB8B4 = v;
                if (ovl_10_func_800BB728(v) != 0) {
                    D_800BBA4C[D_800BB8A4 + 1] =
                        (D_800BBA4C[D_800BB8A4 + 1] & 0xF0) +
                        (((D_800BBA4C[D_800BB8A4 + 1] & 0xF) + 0xF) & 0xF);
                }
            } else {
                D_800BB8B4 = 0;
            }
        }
        return 0;

    case 1:
        FntPrint(&D_800B87C8);
        FntPrint(&D_800B87FC);
        FntPrint(&D_800B8840,
                 D_800BB8A4 == -1 ? &D_800B8358 : &D_800B8360, D_800BBA4C[0]);
        {
            u8 *base;
            base = &D_800BBA4C[1];
            for (s3 = 0; s3 < 2; s3++) {
                FntPrint(s3 != 0 ? &D_800B885C : &D_800B8868);
                {
                    u8 *p;
                    s1 = 0;
                    s2 = s3 << 4;
                    p = base + s2;
                    while (s1 < 0x10) {
                        sprintf(buf, &D_800B86C4, *p);
                        if (s1 + s2 == D_800BB8A4) {
                            FntPrint(&D_800B8330, buf);
                            p++;
                        } else {
                            FntPrint(buf);
                            p++;
                        }
                        s1++;
                    }
                }
                FntPrint(&D_800B7EE8);
            }
            FntPrint(&D_800B7E40);
            return 0;
        }

    case 2:
        {
            for (s1 = 0; s1 < 0x80; s1++) {
                D_800BBA4C[0x21 + s1] = 0;
            }
        }
        return McxReadDev(0, D_800BBA4C[0], &D_800BBA4C[1], &D_800BBA4C[0x21]);

    case 3:
        {
            for (s3 = 0; s3 < 8; s3++) {
                FntPrint(s3 != 0 ? &D_800B885C : &D_800B8878);
                s2 = s3 << 4;
                {
                    int s1;
                    for (s1 = 0; s1 < 0x10; s1++) {
                        sprintf(buf, &D_800B8328,
                                D_800BBA4C[s2 + 0x21 + s1]);
                        FntPrint(&D_800B8370, buf);
                    }
                }
                FntPrint(&D_800B7EE8);
            }
            return 0;
        }

    default:
        return 0;
    }
}
```
