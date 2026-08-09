#include "common.h"
#include "game_types.h"

u16 func_80015AAC(SpriteSourceData *arg0, u32 arg1, u32 arg2) {
    u16 val;
    s32 ptr;
    s32 ptr_1;
    s32 ptr_2;
    s32 ptr_3;
    s32 ptr_4;

    arg1 = arg1 & 0xFF;
    ptr = arg0->field_28 + (arg1 * 4);
    val = *(u16 *)(ptr + 2);
    arg2 = arg2 & 0xFF;
    ptr_1 = arg0->field_2C + val + (arg2 * 10);
    if (*(u16 *)ptr_1 >= 0xFFFE) {
        return 0;
    }

    ptr_2 = *(u16 *)ptr_1 * 4;
    ptr_3 = arg0->field_20 + ptr_2;
    val = *(u16 *)(ptr_3 + 2);
    ptr_4 = arg0->field_24 + val;
    return *(u16 *)(ptr_4 + 2);
}
