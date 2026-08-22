# ovl_10_func_800BA394 — human decision needed

- **Parked:** 2026-08-22T13:45:52.085Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_10/ovl_10_func_800BA394.c` (INCLUDE_ASM restored)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Last oracle report

```
Oracle: ovl_10_func_800BA394 verdict MISMATCH — 476/479 words (99.4%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 1, allocation 1.
Next block: 93 (0x800BA98C) — population 0, schedule 1, allocation 1. smallest open residual
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 8 distinct measurements since the residual last improved on [0, 0, 1, 1]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain. 8 distinct programs is past the point where more variation is informative. Exhausting a spelling family is a positive result: the answer is not a spelling. Switch to the author's frame, which the compiler-side tools cannot reach. The vendored SDK headers give the real signature and the real operation for anything the SDK provides — read the header rather than your reconstruction of what the disassembly implies it must say. The already-matched functions in this target's file group are the only record of how this author wrote code: which locals they kept live, how they walked an array, what they hoisted, whether they took a base pointer once or re-indexed each time. A byte-exact neighbour is a proven idiom. notes/file-groupings.md names the group; read three of its members before reading another pass. A residual that survives every rewrite of your own idiom is usually somebody else's idiom.
```

## Preserved attempt

```c
#include "common.h"

int FntPrint();
int McxSetMem(int, unsigned char *, unsigned, unsigned);
int sprintf(char *, const char *, ...);
void ovl_10_func_800B92AC(void);
s32 ovl_10_func_800BB728(s32);

extern char D_800B7E40[];
extern char D_800B7EE8[];
extern char D_800B830C[];
extern char D_800B8328[];
extern char D_800B8330[];
extern char D_800B8340[];
extern char D_800B8358[];
extern char D_800B8360[];
extern char D_800B8368[];
extern char D_800B86BC[];
extern char D_800B86C4[];
extern char D_800B861C[];
extern char D_800B8644[];
extern char D_800B866C[];
extern char D_800B8694[];
extern unsigned char D_800BB9BC[];
extern s32 D_800BB868;
extern s32 D_800BB86C[];
extern s32 D_800BB880;
extern s32 D_800BB884;
extern s32 D_800BB888;
extern s32 D_800BB88C;
extern s32 D_800BBA3C;

s32 ovl_10_func_800BA394(s32 arg0, s32 arg1) {
    char buf[16];
    s32 s3;
    int s2;
    int s7;
    int off;
    int s0;
    unsigned char *s1;

    switch (arg0) {
    case 0:
        if (D_800BBA3C == 0) {
            if (arg1 & 0x2000) {
                if (D_800BB868 < D_800BB86C[4] - 1) {
                    D_800BB868 += 1;
                }
            } else if ((arg1 & 0x8000) && (D_800BB868 >= -4)) {
                D_800BB868 -= 1;
            }
            if (arg1 & 0x1000) {
                if ((u32)D_800BB868 < 6U) {
                    D_800BB868 = -5;
                } else if (D_800BB868 == 6) {
                    D_800BB868 = -4;
                } else if ((u32)(D_800BB868 - 7) < 2U) {
                    D_800BB868 = -2;
                } else if ((u32)(D_800BB868 - 9) < 7U) {
                    D_800BB868 = -1;
                } else if (D_800BB868 < 0x10) {
                    /* leave the selection on a header entry */
                } else {
                    D_800BB868 -= 0x10;
                }
            } else if (arg1 & 0x4000) {
                switch (D_800BB868) {
                case -5:
                    if ((u32)D_800BB86C[4] >= 6U) {
                        D_800BB868 = 5;
                    }
                    break;
                case -4:
                case -3:
                    if ((u32)D_800BB86C[4] >= 7U) {
                        D_800BB868 = 6;
                    }
                    break;
                case -2:
                    if ((u32)D_800BB86C[4] >= 8U) {
                        D_800BB868 = 7;
                    }
                    break;
                case -1:
                    if ((u32)D_800BB86C[4] >= 0xBU) {
                        D_800BB868 = 0xA;
                    }
                    break;
                default:
                    if (D_800BB868 + 0x10 < D_800BB86C[4]) {
                        D_800BB868 += 0x10;
                    }
                    break;
                }
                if (D_800BB86C[4] != 0 && D_800BB868 < 0) {
                    D_800BB868 = D_800BB86C[4] - 1;
                }
            }
        }
        s3 = -1;
        D_800BBA3C = arg1 & 0xF000;
        if (D_800BB868 < 0) {
            s3 = D_800BB868 + 5;
        }

        if (arg1 & 0x10) {
            s32 v = D_800BB880 + 1;
            D_800BB880 = v;
            if (ovl_10_func_800BB728(v) != 0) {
                if (D_800BB868 < 0) {
                    D_800BB86C[s3] = (D_800BB86C[s3] + 0x10) & 0xFF;
                } else {
                    D_800BB9BC[D_800BB868] = D_800BB9BC[D_800BB868] + 0x10;
                }
            }
        } else {
            D_800BB880 = 0;
            if (arg1 & 0x80) {
                s32 v = D_800BB884 + 1;
                D_800BB884 = v;
                if (ovl_10_func_800BB728(v) != 0) {
                    if (D_800BB868 < 0) {
                        D_800BB86C[s3] = (D_800BB86C[s3] + 0xF0) & 0xFF;
                    } else {
                        D_800BB9BC[D_800BB868] = D_800BB9BC[D_800BB868] + 0xF0;
                    }
                }
            } else {
                D_800BB884 = 0;
            }
        }

        if (s3 >= 0) {
            if ((u32)D_800BB86C[4] >= 0x81U) {
                if (D_800BB86C[4] == 0x90) {
                    D_800BB86C[4] = 0;
                } else if (D_800BB86C[4] == 0xF0) {
                    D_800BB86C[4] = 0x80;
                } else {
                    D_800BB86C[4] &= 0x7F;
                }
            }
        }

        if (arg1 & 0x20) {
            s32 v = D_800BB888 + 1;
            D_800BB888 = v;
            if (ovl_10_func_800BB728(v) != 0) {
                if (D_800BB868 < 0) {
                    D_800BB86C[s3] = (D_800BB86C[s3] & 0xF0) +
                                     (((D_800BB86C[s3] & 0xF) + 1) & 0xF);
                } else {
                    D_800BB9BC[D_800BB868] = (D_800BB9BC[D_800BB868] & 0xF0) +
                                             (((D_800BB9BC[D_800BB868] & 0xF) + 1) &
                                              0xF);
                }
            }
        } else {
            D_800BB888 = 0;
            if (arg1 & 0x40) {
                s32 v = D_800BB88C + 1;
                D_800BB88C = v;
                if (ovl_10_func_800BB728(v) != 0) {
                    if (D_800BB868 < 0) {
                        D_800BB86C[s3] = (D_800BB86C[s3] & 0xF0) +
                                         (((D_800BB86C[s3] & 0xF) + 0xF) & 0xF);
                    } else {
                        D_800BB9BC[D_800BB868] =
                            (D_800BB9BC[D_800BB868] & 0xF0) +
                            (((D_800BB9BC[D_800BB868] & 0xF) + 0xF) & 0xF);
                    }
                }
            } else {
                D_800BB88C = 0;
            }
        }

        if ((u32)D_800BB86C[4] >= 0x81U) {
            D_800BB86C[4] -= 0x10;
        }
        break;

    case 1:
        s3 = D_800BB868 + 5;
        if (D_800BB868 >= 0) {
            s3 = -1;
        }
        FntPrint(D_800B861C);
        FntPrint(D_800B8644);
        FntPrint(D_800B866C);
        FntPrint(D_800B8694);
        FntPrint(D_800B830C);
        for (s2 = 0; s2 < 4; s2++) {
            sprintf(buf, D_800B8328, D_800BB86C[s2]);
            if (s2 == s3) {
                FntPrint(D_800B8330, buf);
            } else {
                FntPrint(buf);
            }
        }
        sprintf(buf, D_800B8328, D_800BB86C[4]);
        FntPrint(D_800B8340, s3 == 4 ? D_800B8358 : D_800B8360, buf);
        FntPrint(D_800B86BC);

        s7 = 0;
        off = 0;
        do {
            FntPrint(D_800B8368);
            s2 = 0;
            if (off < (u32)D_800BB86C[4]) {
                s1 = &D_800BB9BC[off];
                s0 = off;
                do {
                    sprintf(buf, D_800B86C4, (s32)*s1);
                    if (s0 == D_800BB868) {
                        FntPrint(D_800B8330, buf);
                    } else {
                        FntPrint(buf);
                    }
                    s1++;
                    s0++;
                    s2++;
                } while (s2 < 0x10 && s0 < (u32)D_800BB86C[4]);
            }
            FntPrint(D_800B7EE8);
            if ((u32)D_800BB86C[4] < (u32)(off + s2)) {
                break;
            }
            off += 0x10;
            s7++;
        } while (s7 < 8);
        break;

    case 2:
        return McxSetMem(0, D_800BB9BC,
                         (D_800BB86C[0] << 24) | (D_800BB86C[1] << 16) |
                             (D_800BB86C[2] << 8) | D_800BB86C[3],
                         D_800BB86C[4]);

    case 3:
        ovl_10_func_800B92AC();
        break;
    }
    FntPrint(D_800B7E40);
    return 0;
}
```
