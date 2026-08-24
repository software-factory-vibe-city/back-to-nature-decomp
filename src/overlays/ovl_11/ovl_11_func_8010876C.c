#include "common.h"

extern struct {
    char unk0[8];
    s16 unk8;
    u16 unkA;
} D_8012D050;

s32 ovl_11_func_8010876C(void) {
    switch ((s16) (D_8012D050.unkA - 2)) {
        case 0:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        default:
            return 0x39D;
        case 1:
            return 0x399;
        case 7:
            return 0x39E;
        case 8:
            if (D_8012D050.unk8 >= 0x267) {
                return 0x3A0;
            }
            return 0x3A1;
        case 9:
            return 0x39C;
        case 10:
            return 0x39A;
        case 11:
            return 0x39B;
        case 12:
            return 0x39F;
        case 13:
            return 0x398;
        case 14:
            return 0x26B;
        case 15:
            return 0x26A;
    }
}
