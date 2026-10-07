#include "common.h"
#include "game_types.h"

/* Legacy overlay import of matched Rand at 0x80012A34. */
u32 func_80012A34(s32 arg0);

s16 ovl_21_func_800BA868(s16 arg0) {
    s16 buf[4];
    s16 count;
    s32 a;
    s32 i;

    a = arg0;
    count = 0;
    for (i = (a % 2) * 3; i < (a % 2) * 3 + 3; i++) {
        buf[count] = 0;
        if ((arg0 != 2 || i != 0) && ((UnkStruct800C0448 *)D_800C0448)[i].unk14 == 1) {
            buf[count] = i;
            count++;
        }
    }
    if (count == 0) {
        return -1;
    }
    return buf[func_80012A34((u16)count)];
}
