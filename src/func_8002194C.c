#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"
#include "psyq/libsnd.h"

s32 func_80021CD8(s32 arg0);
void func_80021B20(void);

/* Tentative definitions (merged via -fcommon) so GCC reaches these GP-relatively,
 * matching the target's %gp_rel accesses. CD-music state family. */
s16 D_8005E324;
s16 D_8005E580;
s32 D_8005E584;
s32 D_8005E58C;
s32 D_8005E590;

void func_8002194C(void) {
    u8 buf[8];
    s32 flag;
    s32 st;
    s32 t;
    s32 cd;
    s32 pos;

    if (D_8005E324 != 0) {
        flag = GetFlag8005E274();
        switch (flag) {
        case 0:
        case 1:
            st = 1;
            break;
        case 2:
            st = 2;
            break;
        case 3:
            st = 3;
            break;
        default:
            st = 1;
            break;
        }
        switch (D_8005E590) {
        case 0:
        case 1:
        case 2:
            if (D_8005E590 >= 0) {
                D_8005E590++;
            }
            break;
        case 3:
            if ((CdSync(1, buf) == 2) && (func_80021CD8(0x1B) == 0)) {
                D_8005E590++;
            }
            break;
        case 4:
            cd = CdSync(1, buf);
            if (cd == 5) {
                func_80021CD8(0x1B);
                break;
            }
            if (cd == 2) {
                if (D_8005E580 <= 0) {
                    func_80021B20();
                } else if (D_8005E58C < (D_8005E584 - 0x12C)) {
                    func_80021CD8(0x1B);
                } else {
                    if (CdLastCom() == 0x11) {
                        pos = CdPosToInt((CdlLOC *)&buf[5]);
                        if (pos > 0) {
                            D_8005E58C = pos;
                        }
                    }
                    D_8005E324 = 2;
                    CdControlF(0x11, 0);
                    t = D_8005E580 - st;
                    if (t < 0) {
                        t = 0;
                    }
                    D_8005E580 = t;
                    if (D_8005E580 < 0x21) {
                        SsSetSerialVol(0, D_8005E580 * 4, D_8005E580 * 4);
                    } else {
                        SsSetSerialVol(0, 0x2D, 0x2D);
                    }
                }
            }
            break;
        }
    }
}
