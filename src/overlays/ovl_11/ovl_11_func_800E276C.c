#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x24];
    /* 0x26 */ s16 unk26;
    /* 0x28 */ char pad_28[0xC];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ char pad_38[0x76];
    /* 0xAE */ u16 unkAE;
} Struct_800E2AF0;

s32 ovl_11_func_800E2A30(s16 *arg0);
s32 ovl_11_func_800E2AF0(Struct_800E2AF0 *arg0);

s32 ovl_11_func_800E276C(s16 *arg0) {
    s32 temp_v0;

    if (*(u16 *)arg0 == 0) {
        return -1;
    }
    if (*(s32 *)((u8 *)arg0 + 0x8C) == 0) {
        ovl_11_func_800E2A30(arg0);
    }
    temp_v0 = D_800B970C[*(u16 *)((u8 *)arg0 + 0x26)];
    if (temp_v0 != 0) {
        ((s32 (*)(s16 *))temp_v0)(arg0);
    }
    if (!(*(s32 *)((u8 *)arg0 + 0x34) & 0x800) &&
        (*(s16 *)((u8 *)arg0 + 0x2C) >= 0x12C)) {
        ovl_11_func_800E2AF0((Struct_800E2AF0 *)arg0);
        *(s16 *)((u8 *)arg0 + 0x2C) = 0;
    }
    *(s16 *)((u8 *)arg0 + 0x2C) = *(u16 *)((u8 *)arg0 + 0x2C) + 1;
    return 0;
}
