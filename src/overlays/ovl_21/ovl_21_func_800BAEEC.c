#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);
void ovl_21_func_800BAFFC();

void ovl_21_func_800BAEEC(s16 arg0) {
    u8 *base;
    s16 vec[3];
    u16 temp_a3;

    base = (u8 *) D_800C0448;
    if (base[0x688] != 0xE) {
        func_80015840((ObjectState *) (base + 0x684), 0xE);
    }
    temp_a3 = D_800BCC48[arg0].unk0;
    vec[1] = -0x1F4;
    vec[0] = temp_a3;
    vec[2] = D_800BCC48[arg0].unk2;
    ovl_21_func_800BAFFC((SpriteSourceData *) (base + 0x684), (u16 *) vec);
}
