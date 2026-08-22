# ovl_10_func_800BA394 — human decision needed

- **Parked:** 2026-08-22 (re-parked; first parked 2026-08-22T13:45:52.085Z)
- **Reason:** one preheader placement
- **Source:** `src/overlays/ovl_10/ovl_10_func_800BA394.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the best measured program — 477/479 words, **no differing
  word**, residual `[0, 0, 1, 1]` at block 93

## What changed since the first park

The first park reported `escalation-exhausted` at 476/479 with the oracle unable
to resolve three words. That was not a verdict on the function. This container
had no rodata attribution, so `ovl_10_func_800BA394` — the only overlay function
the loop has ever attempted that owns a jump table — **could not be compiled as C
at all**: its table stayed in the container's generic asm rodata, which still
referenced the function's own internal labels, and the link failed on
`undefined reference to .L800BA530`. The oracle could not see that, because the
same missing attribution left the table's relocation undetermined, and those
undetermined words became phantom `population` terms that pointed the ranker at
two blocks that were already byte-identical.

`tools/build/deriveRodataSplits.ts` is per container now and every overlay's link
rule rederives and re-splits on drift, so the function links, and the residual it
reports is the real one. See `plans/loop-gradient-precision.md` §F1.

## What is left

The two programs contain the *same instructions with the same operands*. The
whole difference is the order of two of them, in the row loop's preheader:

```
target                          preserved attempt
  move  s7,zero                   move  s7,zero
  lui   v0,%hi(D_800BB86C)        lui   v0,%hi(D_800BB86C)
  addiu s4,v0,%lo(D_800BB86C)     addiu s4,v0,%lo(D_800BB86C)
  move  s3,zero                   lui   v1,%hi(D_800BB9BC)
  lui   v0,%hi(D_800BB9BC)        addiu s8,v1,%lo(D_800BB9BC)
  addiu fp,v0,%lo(D_800BB9BC)     move  s3,zero
```

The `v0`/`v1` difference follows from the order: with the two address pairs
adjacent their temporaries overlap and the allocator needs a second register; in
the target the `move` between them ends the first temporary's range.

### The mechanism, read from the compiler

`loop_optimize` runs **twice** at `-O2` (`flag_rerun_loop_opt`,
`tools/vendor/gcc/2.95.2/src/gcc/toplev.c:4865`) and scans loops inner-first
(`loop.c:575`). Both `move_movables` and `strength_reduce` emit with
`emit_insn_before(..., loop_start)`, movables first. So a preheader is laid out
as:

```
[ source statements ][ pass-1 movables ][ pass-1 giv inits ][ pass-2 movables ][ pass-2 giv inits ]
```

Only one assignment produces the target's order:

- `&D_800BB86C` is a **pass-1 movable** — used by the row test `D_800BB86C[4]`
  in the outer body;
- `off = 0` is a **pass-1 giv init** — so `off` is *not* a source variable; it is
  derived from the row counter, which is why the preserved attempt writes every
  use as `s7 * 0x10`;
- `&D_800BB9BC` is a **pass-2 movable** — it is not an invariant insn in the
  pass-1 outer body, and only becomes one after pass 1's own transformations.

The first two are reproduced. The third is the open question: every spelling
tried so far exposes `&D_800BB9BC` to pass 1, which hoists it into the movables
batch, two slots too early.

### What has been ruled out

Read the full record with `psx_record_closed ovl_10_func_800BA394`; the
summary:

| direction | verdict |
|---|---|
| the cluster's direct-indexing idiom, `D_800BB9BC[s0]` | **closed** — `[0,0,1,1]` becomes `[0,11,1,8]`; the target genuinely walks a pointer here |
| `off` as a source variable beside the row counter | **closed** — both moves then precede every hoist |
| the sched1 state at block 93 | **closed** — SAT, and the baseline selection is already exact; the difference is upstream of the scheduler |
| a source-level base pointer for `D_800BB86C` | **open** — reaches `[0,1,0,0]` (schedule *and* allocation clean) but costs one population word, because holding the address in a variable lets CSE reuse the earlier `%hi` across the `?:` diamond where the target re-materialises it |
| loop-shape rewrites (while + inversion, guard placement, split pointer arithmetic) | **closed** — all much worse |

The base-pointer row is the interesting one: it proves the *placement* is
reachable from clean C. What it costs is one extra CSE, so the remaining question
is a spelling that places the materialisation there without giving the address a
name that outlives the diamond.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Match: 477/479 words (99.6%)
VERDICT: MISMATCH — 0 word(s) differ.
Residual: control-flow 0, population 0, schedule 1, allocation 1.
Next block: 93 (0x800BA98C) — population 0, schedule 1, allocation 1.
```

## Preserved attempt

```c
#include "common.h"

int FntPrint();
int McxSetMem(int, unsigned char *, unsigned, unsigned);
int sprintf(char *, const char *, ...);
void ovl_10_func_800B92AC(void);
s32 ovl_10_func_800BB728(s32);


s32 ovl_10_func_800BA394(s32 arg0, s32 arg1) {
    char buf[16];
    s32 s3;
    int s2;
    int s7;
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
        do {
            FntPrint(D_800B8368);
            s2 = 0;
            if (s7 * 0x10 < (u32)D_800BB86C[4]) {
                s1 = &D_800BB9BC[s7 * 0x10];
                s0 = s7 * 0x10;
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
            if ((u32)D_800BB86C[4] < (u32)(s7 * 0x10 + s2)) {
                break;
            }
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
