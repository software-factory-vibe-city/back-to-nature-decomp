#include "common.h"

typedef struct {
    char pad_00[0x24];
    s16 unk24;
    char pad_26[0x30 - 0x26];
    s16 unk30;
    char pad_32[0x7A - 0x32];
    u16 unk7A;
} Ovl11D04D4Obj;

typedef struct {
    s16 unk0;
    s16 unk2;
    s16 unk4;
} Ovl11D04D4Entry;

s32 ovl_11_func_800D04D4(Ovl11D04D4Obj *arg0, u8 *arg1, s16 *arg2, s32 arg3, u16 *arg4) {
    Ovl11D04D4Entry *entry;
    char *far_base;
    s16 var_t0;
    s32 var_t1;
    s32 temp_a3;

    entry = (Ovl11D04D4Entry *)(arg1 + (*arg2 << 2) + ((s16)arg3 << 2));
    far_base = (char *)&D_8007AFF0;
    var_t0 = entry->unk0;
    arg0->unk24 = var_t0;
    temp_a3 = *arg4 + 1;
    *arg4 = temp_a3;
    var_t1 = 0;
    if (arg0->unk30 == *(s16 *)(far_base + 0x25476)) {
        if ((arg0->unk7A & 0x300) && (entry->unk2 <= (s16)temp_a3)) {
            *arg2 = *arg2 + 1;
            *arg4 = 0;
            var_t0 = entry->unk4;
            var_t1 = (var_t0 == -1);
        }
    } else if (entry->unk2 <= (s16)temp_a3) {
        *arg2 = *arg2 + 1;
        *arg4 = 0;
        var_t0 = entry->unk4;
        if (var_t0 == -1) {
            var_t1 = 1;
        }
    }
    if (var_t1 == 0) {
        arg0->unk24 = var_t0;
    }
    return var_t1;
}
