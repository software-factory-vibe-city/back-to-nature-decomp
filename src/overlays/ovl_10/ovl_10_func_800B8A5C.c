#include "common.h"
#include "game_types.h"

s32 ovl_10_func_800B9108(s32, s32);

extern s32 D_800BB7BC;
extern s32 D_800BB7C0;
extern s32 D_800BB7C4;
extern s32 D_800BB8CC;
extern s32 D_800BB8D0;

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
    s32 unk10;
    s32 unk14;
    s32 unk18;
} McData28;

extern McData28 D_800BBAFC;

void ovl_10_func_800B8A5C(void) {
    s32 temp_s0;
    s32 temp_v0;

    temp_s0 = ((GfxObj *)D_8005E3A8)->field_8;
    ovl_10_func_800B9108(0, temp_s0);
    if (D_800BB8CC == 0) {
        if (temp_s0 & 1) {
            D_800BB7BC = (D_800BB7BC + 0xE) % 15;
        } else if (temp_s0 & 4) {
            D_800BB7BC = (D_800BB7BC + 1) % 15;
        }
    }
    if ((D_800BB8D0 == 0) && (temp_s0 & 0x800)) {
        if (ovl_10_func_800B9108(2, 0) != 0) {
            D_800BB7C0 = D_800BB7BC;
        } else {
            D_800BB7C0 = -1;
            D_800BBAFC = *(McData28 *)&D_800B7E24;
        }
    }
    if (temp_s0 & 0x100) {
        D_800BB7C4 = 1;
    }
    temp_v0 = temp_s0 & 5;
    D_800BB8CC = temp_v0;
    D_800BB8D0 = temp_s0 & 0x800;
    if (temp_v0 != 0) {
        *(u8 *)&D_800BBAFC = 0;
    }
}
