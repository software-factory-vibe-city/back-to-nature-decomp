# ovl_10_func_800B95F0 — human decision needed

- **Parked:** 2026-08-22 (re-parked; first parked 2026-08-22T11:37:54.128Z)
- **Reason:** one preheader placement
- **Source:** `src/overlays/ovl_10/ovl_10_func_800B95F0.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the best measured program — **301/301 words**, residual
  `[0, 0, 1, 0]` at block 49

## What changed since the first park

The first park reported `[0, 2, 1, 2]` at 295/302 and a `STALLED` line that had
fired from the fourth measurement, because the ledger's best row was a
`[0,0,0,0]` measurement of the INCLUDE_ASM stub against itself. One edit closes
the population and allocation terms:

```c
/* parked attempt */                     /* 301/301, [0,0,1,0] */
if (D_800BB810[4] >= 0x81U) {            if (D_800BB810[4] >= 0x81U) {
    if (D_800BB810[4] == 0x90) {             if (D_800BB810[4] == 0x90) {
        D_800BB810[4] = 0;                       D_800BB810[4] = 0;
    } else {                                 } else if (D_800BB810[4] == 0xF0) {
        s32 t = D_800BB810[4] & 0x7F;            D_800BB810[4] = 0x80;
        if (D_800BB810[4] == 0xF0) {         } else {
            t = 0x80;                            D_800BB810[4] &= 0x7F;
        }                                    }
        D_800BB810[4] = t;               }
    }
}
```

A pre-computed temp with a conditional override is not the same program as a
chain of `else if`s: the temp forces the masked value to be materialised on both
arms. `ovl_10_func_800BA394` writes the same wrap as a chain, and it is the
cluster's spelling.

## What is left

One transposition in the case-3 row loop's preheader:

```
target                                preserved attempt
  move  s6,zero        ; row = 0        move  s6,zero
  lui   s5,%hi(D_800BB810)             move  s2,zero        ; off = 0
  lui   fp,%hi(D_800B7EE8)             lui   s5,%hi(D_800BB810)
  addiu s3,s5,%lo(D_800BB810)          lui   s8,%hi(D_800B7EE8)
  move  s2,zero        ; off = 0       addiu s3,s5,%lo(D_800BB810)
  lui   v0,%hi(D_800BB90C)             lui   v0,%hi(D_800BB90C)
  addiu s7,v0,%lo(D_800BB90C)          addiu s7,v0,%lo(D_800BB90C)
```

**This is the same residual as `ovl_10_func_800BA394` block 93**, in the same
cluster, with the same shape: a row counter, a header address, the row offset,
and a payload address, where the target puts the offset's initialisation between
two hoisted addresses and every clean-C spelling tried puts it before both.
Whatever closes one closes the other — see that function's note for the
mechanism read out of `loop.c` and `toplev.c`, and for what has been ruled out.

### Ruled out here

| direction | verdict |
|---|---|
| deriving the offset from the row counter (`off = row * 0x10` at the top of the body) | **closed** — the schedule term goes to zero because the accumulator *disappears*: GCC keeps a `sll` in the loop instead of strength-reducing it, so `population` rises by 5 and `allocation` by 10. A zero term for a missing instruction is not progress |
| a source-level base pointer for `D_800BB810` between the two counters | **closed** — leaves the transposition and adds 3 allocation differences |
| a source-level base pointer for the payload `D_800BB90C` | **closed** — 6 population, 2 schedule |

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Match: 301/301 words
Residual: control-flow 0, population 0, schedule 1, allocation 0.
Next block: 49 (0x800B99C0) — population 0, schedule 1, allocation 0.
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
            } else if (D_800BB810[4] == 0xF0) {
                D_800BB810[4] = 0x80;
            } else {
                D_800BB810[4] &= 0x7F;
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
