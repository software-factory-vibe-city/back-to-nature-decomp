#include "common.h"
#include "game_types.h"

/* Game callee (signature from include/functions.h; declared locally per
 * project convention — common.h does not pull functions.h). */
void func_8001B4D0(s32 arg0, s32 arg1);

extern Struct80049170 D_80049170[];

s16 D_8005E4C4;
s32 D_8005E4C8;
s16 D_8005E4D0;

void func_8001B2CC(s32 arg0, s32 arg1) {
    if ((D_8006C844 & 0x10000) || GetVal8005E3EC() == 0) {
        return;
    }
    {
        s32 off = arg0 * 2;
        s16 *mark = (s16 *)((char *)&D_8005E4C4 + off);
        if (*mark == 0 ||
            ((s32)*(s16 *)((char *)&D_8005E4D0 + off) <=
                 (s32)D_80049170[arg1].field_0 &&
             *(s32 *)((char *)&D_8005E4C8 + arg0 * 4) !=
                 D_80049170[arg1].field_4)) {
            func_8001B4D0(arg0, D_80049170[arg1].field_4);
            *mark = 1;
            *(s16 *)((char *)&D_8005E4D0 + off) =
                (s16)D_80049170[arg1].field_0;
        }
    }
}
