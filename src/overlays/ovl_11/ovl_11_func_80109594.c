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
} Ovl11HandlerObj;

extern u16 D_80070CF8;

s32 func_80012A34(s32 arg0);
s32 ovl_11_func_801098B0(Ovl11HandlerObj *arg0);
s32 ovl_11_func_80109188(Ovl11HandlerObj *arg0, s32 arg1);

s32 ovl_11_func_80109594(Ovl11HandlerObj *arg0) {
    s32 var_a1;
    s32 var_a0;
    s32 temp_v0;
    s32 var_s1;

    if (ovl_11_func_801098B0(arg0) == 1) {
        var_a1 = 6;
    } else if ((u32)(D_80070CF8 - 6) >= 0xF) {
        var_a1 = 2;
    } else {
        if (arg0->unk26 == 0xF) {
            var_a1 = 1;
        } else {
            if (arg0->unk34 & 0x2000) {
                if (arg0->unk34 & 0x8000) {
                    var_a0 = 0xA;
                } else {
                    var_a0 = 0xD;
                }
                var_s1 = 0x11;
            } else {
                if (arg0->unk34 & 0x8000) {
                    var_a0 = 6;
                } else {
                    var_a0 = 8;
                }
                var_s1 = 0x12;
            }
            temp_v0 = func_80012A34(var_a0);
            switch (temp_v0) {
            case 0:
                var_a1 = var_s1;
                break;
            case 1:
                var_a1 = 8;
                break;
            case 2:
                var_a1 = 0xA;
                break;
            case 3:
                var_a1 = 0xC;
                break;
            case 4:
                var_a1 = 0xD;
                break;
            case 5:
                if (!(arg0->unk34 & 0x8000)) {
                    var_a1 = 0xE;
                } else {
                    var_a1 = 0xB;
                }
                break;
            case 6:
                if (!(arg0->unk34 & 0x8000)) {
                    var_a1 = 0xF;
                    break;
                } else {
                    var_a1 = var_s1;
                }
            case 7:
                if (!(arg0->unk34 & 0x8000)) {
                    var_a1 = 0x10;
                    break;
                }
            default:
                var_a1 = var_s1;
                break;
            }
        }
    }
    if (var_a1 != arg0->unk26) {
        ovl_11_func_80109188(arg0, var_a1);
    }
    return 0;
}
