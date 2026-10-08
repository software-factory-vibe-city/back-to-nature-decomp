#include "common.h"

void ovl_27_func_800BA914(s32 arg0) {
    Ovl11D124Entry *var_a1;
    s32 i;
    s32 j;
    s32 k;
    u16 *var_a3;
    s16 fill;
    u8 *base;
    D8006C838Pools *temp_t1;

    switch (arg0) {
    case 1:
        var_a3 = &D_800BB52C;
        break;
    case 2:
        var_a3 = &D_800BBDF8;
        break;
    case 3:
        var_a3 = &D_800BC6C4;
        break;
    case 0:
        var_a3 = &D_800BAC60;
        break;
    default:
        var_a3 = &D_800BAC60;
        break;
    }
    i = 0;
    fill = 0x167;
    base = (u8 *) D_80071DFC;
    temp_t1 = (D8006C838Pools *) (base - 0x55C4);
    do {
        k = i + 1;
        var_a1 = (Ovl11D124Entry *) (base + i * 0x168);
        for (j = 0x2C; j >= 0; j--) {
            u32 temp_v0;

            var_a1->unk0 = fill;
            var_a1->unk2 = fill;
            var_a1->unk4 = 0;
            var_a1->unk5 = 0;
            var_a1->unk6 = 0;
            temp_v0 = *var_a3;
            var_a1->unk0 = (s16) temp_v0;
            temp_v0 = temp_v0 - 0x22;
            temp_v0 = temp_v0 & 0xFFFF;
            if (temp_v0 < 0xFU) {
                var_a1->unk4 = temp_t1->unk2C[temp_t1->unk20[(u16) var_a1->unk0].unk3].unk2;
                var_a1->unk2 = 0x168;
            }
            var_a1 += 1;
            var_a3 += 1;
        }
        i = k;
    } while (i < 0x19);
}
