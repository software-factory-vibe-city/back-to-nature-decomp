#include "common.h"

INCLUDE_ASM("build/ovl_10/asm/nonmatchings/ovl_10_func_800B95F0", ovl_10_func_800B95F0);


/* PARKED 2026-08-22, reason: one preheader placement.
 * Reached 301/301 words, residual [0, 0, 1, 0] at block 49 — one transposition,
 * nothing else. The same transposition as ovl_10_func_800BA394's block 93, with
 * the same mechanism: notes/human-needed-approvals/ovl_10_func_800B95F0.md.
 *
 * The best measured attempt is preserved verbatim below, disabled.
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
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
#endif
