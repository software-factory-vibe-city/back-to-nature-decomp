#include "common.h"

typedef struct {
    char pad_00[0x24];
    s16 unk24;
    s16 unk26;
    s16 unk28;
    s16 unk2A;
    s16 unk2C;
    char pad_2E[0x06];
    s32 unk34;
} Ovl11D04D4Obj;

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} Recon800D0408A1View;

typedef struct {
    char pad_000[0x44BA];
    s16 field_44BA;
    s16 field_44BC;
} D8006C838ButtonView;

s32 ovl_11_func_800C1224(s16 arg0, s16 arg1);
s32 ovl_11_func_800D0408(s16 arg0, Recon800D0408A1View *arg1, s32 arg2);

extern s32 (*D_800BA848[])(Ovl11D04D4Obj *);
extern s32 D_800BA894[];

s32 ovl_11_func_80109188(Ovl11D04D4Obj *arg0, s32 arg1) {
    s32 var_s1;
    s32 var_s3;
    u16 temp_a2;

    var_s1 = arg1;
    var_s3 = 0;
    if (arg0->unk34 & 0x400) {
        if (ovl_11_func_800C1224(
                ((D8006C838ButtonView *) D_8006C838)->field_44BA,
                ((D8006C838ButtonView *) D_8006C838)->field_44BC) == 8) {
            return -1;
        }
    }
    temp_a2 = *(u16 *) &arg0->unk26;
    if (arg0->unk26 == 7 && var_s1 == 4) {
        return 0;
    }
    if (arg0->unk34 & 0x01000000) {
        var_s1 = 0x11;
    }
    if (D_800BA848[var_s1] != 0) {
        if ((s16) temp_a2 == 7) {
            var_s3 = -1;
        } else if ((s16) temp_a2 == 5 && var_s1 == (s16) temp_a2) {
            var_s3 = -1;
        } else {
            var_s3 = D_800BA848[var_s1](arg0);
        }
    }
    if (D_800BA894[var_s1] != 0) {
        if (var_s3 != -1) {
            arg0->unk26 = var_s1;
            arg0->unk28 = 0;
            arg0->unk2A = 0;
            arg0->unk2C = 0;
            ovl_11_func_800D0408(4, (Recon800D0408A1View *) ((u8 *) arg0 + 0x48), 0);
        }
    }
    return var_s3;
}
