#include "common.h"
#include "game_types.h"

typedef struct {
    char pad_00[0x34];
    s32 field_34;
    char pad_38[0x58 - 0x38];
    s32 field_58;
    s32 field_5C;
    s32 field_60;
} Ov11SetFields;

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
} Ov11E1770Vec;

s32 ovl_11_func_800D0408(u16 arg0, Recon800D0408A1View *arg1, s32 arg2);
void ovl_11_func_800D05D0(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
s32 ovl_11_func_800DF4F0(UnkStruct800DF4F0 *arg0);

s32 ovl_11_func_800DFB98(Ov11SetFields *arg0) {
    Ov11E1770Vec sp18;
    u8 *base;

    if (ovl_11_func_800DF4F0((UnkStruct800DF4F0 *) arg0) == 0) {
        return -1;
    }
    base = (u8 *) D_8006C838;
    ovl_11_func_800D0408(*(u16 *) (base + 0x5200), (Recon800D0408A1View *) &sp18, 0x320);
    sp18.unk0 = sp18.unk0 + *(s32 *) ((u8 *) arg0 + 0x38);
    sp18.unk4 = sp18.unk4 + *(s32 *) ((u8 *) arg0 + 0x3C);
    sp18.unk8 = sp18.unk8 + *(s32 *) ((u8 *) arg0 + 0x40);
    ovl_11_func_800D05D0((s32) arg0, sp18.unk0, sp18.unk4, sp18.unk8, sp18.unkC);
    *(u16 *) ((u8 *) arg0 + 0x22) = *(u16 *) (base + 0x5200);
    return 0;
}
