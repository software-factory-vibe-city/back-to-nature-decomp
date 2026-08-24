#include "common.h"

typedef struct {
    /* 0x00 */ char pad00[0x16];
    /* 0x16 */ s16 unk16;
} UnkStruct800CD4E4;

s32 ovl_11_func_800CD4E4(UnkStruct800CD4E4 *arg0) {
    s16 temp_v1;
    s32 var_v0;

    temp_v1 = arg0->unk16;
    if (temp_v1 < 0x32) {
        return 0;
    }
    if (temp_v1 < 0x46) {
        return 0x78;
    }
    if (temp_v1 < 0x50) {
        return 0xF0;
    }
    if (temp_v1 < 0x64) {
        return 0x168;
    }
    var_v0 = 0;
    return var_v0;
}
