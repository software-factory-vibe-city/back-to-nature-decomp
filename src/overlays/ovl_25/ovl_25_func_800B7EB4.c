#include "common.h"

extern s32 D_800BCBD8;

void ovl_25_func_800B7EB4(void) {
    s32 *base;
    s32 *table;
    u32 temp_s0;

    temp_s0 = func_80017A64();
    func_80017A48(3U);
    table = (s32 *) &D_800BCBD8;
    base = (s32 *) &D_8006C838;
    ((void (*)(s32 *)) table[base[0x448C >> 2]])(table);
    func_80017A48(temp_s0);
    if (base[0xC >> 2] & 0x08000000) {
        base[0xC >> 2] &= 0xF7FFFFFF;
    }
}
