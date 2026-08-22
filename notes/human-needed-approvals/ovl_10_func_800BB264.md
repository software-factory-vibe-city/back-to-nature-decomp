# ovl_10_func_800BB264 — human decision needed

- **Parked:** 2026-08-22T13:04:07.021Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_10/ovl_10_func_800BB264.c` (INCLUDE_ASM restored)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Last oracle report

```
Oracle: ovl_10_func_800BB264 verdict MISMATCH — 300/305 words (98.4%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 2, allocation 1.
Next block: 41 (0x800BB564) — population 0, schedule 2, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 13 distinct measurements since the residual last improved on [0, 0, 2, 1]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 13 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

int FntPrint();
int McxWriteDev(int, int, unsigned char *, unsigned char *);
void ovl_10_func_800B92AC(void);
int ovl_10_func_800BB728(int);
int sprintf(char *, const char *, ...);

int ovl_10_func_800BB264(int arg0, int arg1) {
    char buf[16];
    int s1;
    int s2;
    int s3;
    u8 *p;

    switch (arg0) {
    case 0:
        if (D_800BBA44 == 0) {
            if (arg1 & 0x2000) {
                if (D_800BB8B8 < 0x9F) {
                    D_800BB8B8 += 1;
                }
            } else if ((arg1 & 0x8000) && (D_800BB8B8 >= 0)) {
                D_800BB8B8 -= 1;
            }
            if (arg1 & 0x1000) {
                D_800BB8B8 -= 0x10;
                if (D_800BB8B8 < 0) {
                    D_800BB8B8 = -1;
                }
            } else if (arg1 & 0x4000) {
                if (D_800BB8B8 < 0) {
                    D_800BB8B8 = 0;
                } else if (D_800BB8B8 + 0x10 < 0xA0) {
                    D_800BB8B8 += 0x10;
                }
            }
        }
        D_800BBA44 = arg1 & 0xF000;

        if (arg1 & 0x10) {
            D_800BB8BC += 1;
            if (ovl_10_func_800BB728(D_800BB8BC) != 0) {
                D_800BBA4C[D_800BB8B8 + 1] += 0x10;
            }
        } else {
            D_800BB8BC = 0;
            if (arg1 & 0x80) {
                D_800BB8C0 += 1;
                if (ovl_10_func_800BB728(D_800BB8C0) != 0) {
                    D_800BBA4C[D_800BB8B8 + 1] += 0xF0;
                }
            } else {
                D_800BB8C0 = 0;
            }
        }

        if (arg1 & 0x20) {
            D_800BB8C4 += 1;
            if (ovl_10_func_800BB728(D_800BB8C4) != 0) {
                D_800BBA4C[D_800BB8B8 + 1] =
                    (D_800BBA4C[D_800BB8B8 + 1] & 0xF0) +
                    (((D_800BBA4C[D_800BB8B8 + 1] & 0xF) + 1) & 0xF);
            }
        } else {
            D_800BB8C4 = 0;
            if (arg1 & 0x40) {
                D_800BB8C8 += 1;
                if (ovl_10_func_800BB728(D_800BB8C8) != 0) {
                    D_800BBA4C[D_800BB8B8 + 1] =
                        (D_800BBA4C[D_800BB8B8 + 1] & 0xF0) +
                        (((D_800BBA4C[D_800BB8B8 + 1] & 0xF) + 0xF) & 0xF);
                }
            } else {
                D_800BB8C8 = 0;
            }
        }
        return 0;

    case 1: {
        u8 *fp;
        FntPrint(&D_800B87C8);
        FntPrint(&D_800B87FC);
        FntPrint(&D_800B8840, D_800BB8B8 == -1 ? &D_800B8358 : &D_800B8360,
                 D_800BBA4C[0]);
        fp = &D_800BBA4C[1];
        for (s3 = 0; s3 < 2; s3++) {
            FntPrint(s3 != 0 ? &D_800B885C : &D_800B8868);
            s1 = 0;
            s2 = s3 << 4;
            p = s2 + fp;
            while (s1 < 0x10) {
                sprintf(buf, &D_800B86C4, *p);
                if (s1 + s2 == D_800BB8B8) {
                    FntPrint(&D_800B8330, buf);
                    p++;
                } else {
                    FntPrint(buf);
                    p++;
                }
                s1++;
            }
            FntPrint(&D_800B7EE8);
        }
        for (s3 = 0; s3 < 8; s3++) {
            FntPrint(s3 != 0 ? &D_800B885C : &D_800B8884);
            s1 = 0;
            s2 = s3 << 4;
            while (s1 < 0x10) {
                sprintf(buf, &D_800B86C4, D_800BBA4C[s2 + s1 + 0x21]);
                if (s2 + s1 == D_800BB8B8 - 0x20) {
                    FntPrint(&D_800B8330, buf);
                } else {
                    FntPrint(buf);
                }
                s1++;
            }
            FntPrint(&D_800B7EE8);
        }
        FntPrint(&D_800B7E40);
        return 0;
    }

    case 2:
        return McxWriteDev(0, D_800BBA4C[0], &D_800BBA4C[1], &D_800BBA4C[0x21]);

    case 3:
        ovl_10_func_800B92AC();
        return 0;

    default:
        return 0;
    }
}
```
