#include "common.h"
#include "game_types.h"

typedef struct {
    s16 unk0;
    s16 unk2;
} UnkStruct80107DE0;

s32 func_8001FABC(s16 arg0);
s32 ovl_11_func_800D0408(u16 arg0, Recon800D0408A1View *arg1, s32 arg2);
void ovl_11_func_800D05D0(Ovl11SetFieldsView *arg0, Ovl11PaddedVec3 v);
void ovl_11_func_80107DE0(UnkStruct80107DE0 *arg0, s16 arg1, s16 arg2);

s32 ovl_11_func_800E2D3C(Ovl11SetFieldsView *arg0) {
    Ovl11PaddedVec3 sp18;
    u16 temp_v1;
    s32 temp_v0;
    s32 var_v1;
    char *far_base;
    u8 *base;

    temp_v1 = *(u16 *) ((u8 *) arg0 + 0);
    if (temp_v1 == 0) {
        return -1;
    }
    if (temp_v1 != 0x109) {
        return -1;
    }
    far_base = (char *) &D_8007AFF0;
    if ((*(s16 *) (far_base + 0x25476)) == (*(s16 *) ((u8 *) arg0 + 0x30))) {
        func_8001FABC(0x18);
    }
    temp_v0 = (*(u16 *) ((u8 *) arg0 + 0x16)) - 0xA;
    (*(u16 *) ((u8 *) arg0 + 0x16)) = temp_v0;
    if ((s16) temp_v0 < 0) {
        var_v1 = 0;
    } else {
        var_v1 = temp_v0;
    }
    (*(u16 *) ((u8 *) arg0 + 0x16)) = var_v1;
    base = (u8 *) D_8006C838;
    ovl_11_func_800D0408(*(u16 *) (base + 0x5200), (Recon800D0408A1View *) &sp18, 0x7D0);
    sp18.field_0 = sp18.field_0 + (*(s32 *) ((u8 *) arg0 + 0x38));
    sp18.field_4 = sp18.field_4 + (*(s32 *) ((u8 *) arg0 + 0x3C));
    sp18.field_8 = sp18.field_8 + (*(s32 *) ((u8 *) arg0 + 0x40));
    ovl_11_func_800D05D0(arg0, sp18);
    (*(u16 *) ((u8 *) arg0 + 0x22)) = (*(u16 *) (base + 0x5200));
    ovl_11_func_80107DE0((UnkStruct80107DE0 *) ((u8 *) arg0 + 0xA8), 0x24, 0x2D);
    return 0;
}
