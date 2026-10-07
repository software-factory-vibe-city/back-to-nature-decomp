#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ char pad_00[0x26];
    /* 0x26 */ s16 unk26;
    /* 0x28 */ s16 unk28;
    /* 0x2A */ s16 unk2A;
    /* 0x2C */ s16 unk2C;
    /* 0x2E */ char pad_2E[0x34 - 0x2E];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ char pad_38[0xB6 - 0x38];
    /* 0xB6 */ s16 unkB6;
} Struct_800DF010;

s32 ovl_11_func_800D0408(s16 arg0, Recon800D0408A1View *arg1, s32 arg2);

extern s32 (*D_800B957C[])(void *);
extern s32 (*D_800B95CC[])(void *);

s32 ovl_11_func_800DF010(Struct_800DF010 *arg0, s32 arg1) {
    s32 var_s2;

    var_s2 = 0;
    if (D_800B957C[arg1] != 0) {
        if (arg0->unk26 == arg1 && (arg0->unk34 & 0x800)) {
            var_s2 = -1;
        } else {
            var_s2 = D_800B957C[arg1](arg0);
        }
    }
    if (D_800B95CC[arg1] != 0 && var_s2 != -1) {
        arg0->unk26 = arg1;
        arg0->unk28 = 0;
        arg0->unk2A = 0;
        arg0->unk2C = 0;
        ovl_11_func_800D0408(4, (Recon800D0408A1View *)((u8 *)arg0 + 0x48), 0);
    }
    arg0->unkB6 = -1;
    return var_s2;
}
