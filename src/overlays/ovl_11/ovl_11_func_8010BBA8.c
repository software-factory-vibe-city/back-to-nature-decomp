#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x30 - 0x02];
    /* 0x30 */ s16 unk30;
} Struct_8010BBA8;

s32 func_8002261C(s32 arg0, s32 arg1);
void ovl_11_func_800D12A0(s16 arg0);

s32 ovl_11_func_8010BBA8(Struct_8010BBA8 *arg0) {
    char *far_base;

    if (arg0->unk0 == 0) {
        return -1;
    }
    if (D_80075AEA < 9) {
        func_8002261C(2, 0x258);
    } else if (D_80075AEA >= 0xC9) {
        func_8002261C(2, 0x259);
    } else {
        func_8002261C(2, 0x258);
    }
    far_base = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base + 0x25476) == arg0->unk30) {
        ovl_11_func_800D12A0(0xD);
    }
    return -1;
}
