#include "common.h"

typedef struct {
    u16 unk0;
    u16 unk2;
    u16 unk4;
    u16 unk6;
    u16 unk8;
    u16 unkA;
    u16 unkC;
    u16 unkE;
    u16 unk10;
} M2C_3f138653e0bb_M2C_b93e11a2_Arg0;

void ovl_25_func_800BB874(M2C_3f138653e0bb_M2C_b93e11a2_Arg0 *arg0);

void ovl_25_func_800BB510(s32 arg0) {
    M2C_3f138653e0bb_M2C_b93e11a2_Arg0 *var_s0;
    M2C_3f138653e0bb_M2C_b93e11a2_Arg0 *var_s1;
    u32 var_s2;
    u32 var_s3;

    var_s2 = 0;
    var_s3 = 0xFFFF;
    var_s0 = arg0 + 0x8A8;
    var_s1 = var_s0;
    do {
        if (var_s0->unk0 != var_s3) {
            ovl_25_func_800BB874(var_s1);
        }
        var_s1 += 1;
        var_s2 += 1;
        var_s0 += 1;
    } while (var_s2 < 8U);
}
