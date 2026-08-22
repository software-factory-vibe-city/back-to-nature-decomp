# ovl_10_func_800B95F0 — human decision needed

- **Parked:** 2026-08-22T11:37:54.128Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/overlays/ovl_10/ovl_10_func_800B95F0.c` (INCLUDE_ASM restored)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Last oracle report

```
Oracle: ovl_10_func_800B95F0 verdict MISMATCH — 295/302 words (97.7%).
Residual (steer by this, not the word count): control-flow 0, population 2, schedule 1, allocation 2.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 27 (0x800B97A8) — population 1, schedule 0, allocation 0. the instruction populations differ here; nothing below can be read until they agree
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.

STALLED: 3 distinct measurements since the residual last improved on [0, 2, 1, 2]. The axis is exhausted, not the function — stop re-spelling it and bring heavier evidence. Audit the premises first, because everything else is conditioned on them and cannot see them: psx_callee_truth confronts every callee declaration in scope with the vendored SDK headers and the callees' own code, psx_sdk_idioms does the same for operation boundaries. A wrong declaration adds call setup no rewrite of this body can remove, and every measurement taken under it scored a different program. Then: enumerate the source space (psx_search_residual_source_space, psx_search_source_shapes), solve for the compiler state instead of modelling it (psx_solve_local_allocation, psx_search_scheduler_state, psx_allocator_counterfactual), or read the deciding pass directly (psx_compiler_source). A solver result is a specification for a source shape, and an UNSAT is a real finding that closes a direction. Record what each one closed. When a search reports no exact candidate, that is not the end of its output: read the per-class residual axes and the runs each class moved, and take the next experiment from the axis that moved rather than from the match count. Before trusting any search verdict, check its caveats for constructs the grammar refused, its axis-effect block for axes that are counted but inert, and its coverage — a --derive-only run sampled, and a sample supports no statement about the domain.
```

## Preserved attempt

```c
#include "common.h"

int FntPrint();
int McxGetMem(int, unsigned char *, unsigned, unsigned);
int sprintf(char *, const char *, ...);
s32 ovl_10_func_800BB728(s32);

int ovl_10_func_800B95F0(int arg0, int arg1)
{
    int i;
    int row;
    int off;
    s32 *p32;
    u8 *p8;
    char buf[16];

    switch (arg0) {
    case 0:
        if (D_800BB990 == 0) {
            if (arg1 & 0x2000) {
                if (D_800BB98C < 4) {
                    D_800BB98C += 1;
                }
            } else if ((arg1 & 0x8000) != 0 && D_800BB98C > 0) {
                D_800BB98C -= 1;
            }
        }
        D_800BB990 = arg1 & 0xA000;
        if (arg1 & 0x10) {
            D_800BB824 += 1;
            if (ovl_10_func_800BB728(D_800BB824) != 0) {
                D_800BB810[D_800BB98C] = (D_800BB810[D_800BB98C] + 0x10) & 0xFF;
            }
        } else {
            D_800BB824 = 0;
            if (arg1 & 0x80) {
                D_800BB828 += 1;
                if (ovl_10_func_800BB728(D_800BB828) != 0) {
                    D_800BB810[D_800BB98C] = (D_800BB810[D_800BB98C] + 0xF0) & 0xFF;
                }
            } else {
                D_800BB828 = 0;
            }
        }
        if (D_800BB810[4] >= 0x81U) {
            if (D_800BB810[4] == 0x90) {
                D_800BB810[4] = 0;
            } else {
                s32 t = D_800BB810[4] & 0x7F;
                if (D_800BB810[4] == 0xF0) {
                    t = 0x80;
                }
                D_800BB810[4] = t;
            }
        }
        if (arg1 & 0x20) {
            D_800BB82C += 1;
            if (ovl_10_func_800BB728(D_800BB82C) != 0) {
                D_800BB810[D_800BB98C] = (D_800BB810[D_800BB98C] & 0xF0) +
                                         (((D_800BB810[D_800BB98C] & 0xF) + 1) & 0xF);
            }
        } else {
            D_800BB82C = 0;
            if (arg1 & 0x40) {
                D_800BB830 += 1;
                if (ovl_10_func_800BB728(D_800BB830) != 0) {
                    D_800BB810[D_800BB98C] = (D_800BB810[D_800BB98C] & 0xF0) +
                                             (((D_800BB810[D_800BB98C] & 0xF) + 0xF) & 0xF);
                }
            } else {
                D_800BB830 = 0;
            }
        }
        if (D_800BB810[4] >= 0x81U) {
            D_800BB810[4] -= 0x10;
        }
        return 0;
    case 1:
        FntPrint(&D_800B8280);
        FntPrint(&D_800B82AC);
        FntPrint(&D_800B82DC);
        FntPrint(&D_800B830C);
        for (i = 0; i < 4; i++) {
            sprintf(buf, &D_800B8328, D_800BB810[i]);
            if (i == D_800BB98C) {
                FntPrint(&D_800B8330, buf);
            } else {
                FntPrint(buf);
            }
        }
        sprintf(buf, &D_800B8328, D_800BB810[4]);
        FntPrint(&D_800B8340, (D_800BB98C == 4) ? &D_800B8358 : &D_800B8360, buf);
        return 0;
    case 2:
        return McxGetMem(0, D_800BB90C,
                         (D_800BB810[0] << 24) | (D_800BB810[1] << 16) |
                         (D_800BB810[2] << 8) | D_800BB810[3],
                         D_800BB810[4]);
    case 3:
        row = 0;
        off = 0;
        while (1) {
            FntPrint(&D_800B8368);
            for (i = 0; i < 0x10 && (unsigned)(off + i) < D_800BB810[4]; i++) {
                sprintf(buf, &D_800B8328, D_800BB90C[off + i]);
                FntPrint(&D_800B8370, buf);
            }
            FntPrint(&D_800B7EE8);
            if (D_800BB810[4] < (unsigned)(off + i)) {
                break;
            }
            row++;
            off += 0x10;
            if (row < 8) {
                continue;
            }
            break;
        }
        return 0;
    default:
        return 0;
    }
}
```
