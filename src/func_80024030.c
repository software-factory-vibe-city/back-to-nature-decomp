#include "common.h"
#include "game_types.h"
#include "globals_override.h"

void func_80024108(s32 arg0, s32 arg1); /* extern */

u16 D_8005E344;
u16 D_8005E354;

void func_80024030(void) {
    s32 temp_v1;
    SomeStruct *gfx;

    func_80024108(0x3A6, D_8005E354);
    if (func_800226B0() != 0) {
        gfx = (SomeStruct *)D_8005E3A8;
        temp_v1 = gfx->field_0x8;
        if (temp_v1 == 0x40) {
            if (D_8005E354 == 0) {
                func_80022738();
                func_8001FABC(0);
                D_8005E344 = 4;
                return;
            }
            goto block_5;
        }
        if (temp_v1 == 0x20) {
block_5:
            func_80022738();
            func_8001FABC(1);
            D_8005E344 = 1;
            return;
        }
        if (gfx->field_0x0 & 0x5000) {
            func_8001FABC(5);
            D_8005E354 = (D_8005E354 + 1) & 1;
        }
    }
}
