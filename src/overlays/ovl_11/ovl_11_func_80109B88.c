#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x16 - 0x02];
    /* 0x16 */ u16 unk16;
    /* 0x18 */ char pad_18[0x30 - 0x18];
    /* 0x30 */ s16 unk30;
} Struct_80109B88;

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct80107DE0;

void func_8001FABC(s16 arg0);
void ovl_11_func_80107DE0(UnkStruct80107DE0 *arg0, s16 arg1, s16 arg2);

s32 ovl_11_func_80109B88(Struct_80109B88 *arg0) {
    s32 temp;
    s32 out;
    char *far_base;

    if (arg0->unk0 == 0) {
        return -1;
    }
    far_base = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base + 0x25476) == arg0->unk30) {
        func_8001FABC(0x1A);
    }
    temp = arg0->unk16 - 10;
    arg0->unk16 = temp;
    if ((s16)temp < 0) {
        out = 0;
    } else {
        out = temp;
    }
    arg0->unk16 = out;
    ovl_11_func_80107DE0((UnkStruct80107DE0 *)((s32)arg0 + 0xA8), 0x1F, 0x1E);
    return 0;
}
