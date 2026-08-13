#include "common.h"
#include "psyq/libsnd.h"

s32 func_80021668(void) {
    s32 temp_t1;

    if ((u32)D_8006C7B8.unk10 <= (u32)D_8006C7B8.unkC) {
        switch (D_8006C7B8.unk1C) {
        case 0:
            func_80014988(9, D_8006C7B8.unk14, D_8006C7B8.unk8, D_8006C7B8.unk4, 1);
            D_8006C7B8.unk1C = 1;
            break;
        case 1:
            if (func_80014988(9, D_8006C7B8.unk14, D_8006C7B8.unk8, D_8006C7B8.unk4, 0) == 1) {
                SsVabTransBodyPartly((u8 *)D_8006C7B8.unk4, D_8006C7B8.unk8, D_8006C7B8.unk18);
                temp_t1 = D_8006C7B8.unk1C;
                D_8006C7B8.unk1C = 0;
                D_8005E850.unk0 = D_8006C7B8.unk0;
                D_8005E850.unk4 = D_8006C7B8.unk4;
                D_8005E850.unk8 = D_8006C7B8.unk8;
                D_8005E850.unkC = D_8006C7B8.unkC;
                D_8005E850.unk10 = D_8006C7B8.unk10;
                D_8005E850.unk14 = D_8006C7B8.unk14;
                D_8005E850.unk18 = D_8006C7B8.unk18;
                D_8005E850.unk1C = temp_t1;
                while (!SsVabTransCompleted(1)) {
                }
                D_8006C7B8.unk14 = D_8006C7B8.unk14 + D_8006C7B8.unk8;
                D_8006C7B8.unk10 = D_8006C7B8.unk10 + 1;
            }
            break;
        }
        return 0;
    }
    return 1;
}
