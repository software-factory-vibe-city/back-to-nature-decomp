#include "common.h"
#include "game_types.h"

extern u8 D_8007AFDA[];

void ovl_11_func_80108A24(void) {
    char *base;
    char *work;
    u8 *p;
    u16 temp;
    s32 i;
    s32 found;

    p = &D_8007AFDA[0];
    base = (char *) &D_8006C838;
    temp = (*(u16 *) (base + 0x44BC) + (*(s16 *) (base + 0x44B8) * 0x78 + *(s16 *) (base + 0x44BA) * 0x1E)) & 0xFFFF;
    work = base + 0x8000;
    if (temp != (*(u16 *) (work + 0x67A0))) {
        (*(u16 *) (work + 0x67A0)) = temp;
        found = -1;
        for (i = 0; i < 9; i++) {
            switch (p[i]) {
            case 1:
            case 2:
                found = i;
                p[i] = 0;
                break;
            case 3:
                found = i;
                p[i] = 0xFF;
                break;
            }
            if (found != -1) {
                break;
            }
        }
        if (found == -1) {
            found = 0;
        } else {
            found = (found + 1) % 9;
        }
        for (i = found; i < 9; i++) {
            if (p[i] == 0) {
                p[i] = 1;
                return;
            }
        }
        for (i = 0; i <= found; i++) {
            if (p[i] == 0) {
                p[i] = 1;
                return;
            }
        }
    }
}
