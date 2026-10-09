#include "common.h"
#include "game_types.h"

/* Callee prototypes as this caller TU saw them. */
s32 func_800231E8(void);
void func_80023170(u16 *arg0);

s32 ovl_11_func_800F0474(s16 arg0) {
    Ovl11Status801295D0 *dst;
    s32 result;
    s32 temp;

    if (arg0 < 0) {
        dst = &D_801295D0;
    } else if (arg0 < 2) {
        dst = (Ovl11Status801295D0 *)((u8 *)&D_800749F8
            + ((Ovl11Status99C8View *)D_8006C838)->field_99C8[arg0 * 2] * 0xB8);
    } else if (arg0 < 4) {
        dst = (Ovl11Status801295D0 *)((u8 *)D_8006C838 + 0x7AB8
            + ((Ovl11Status99C8View *)D_8006C838)->field_99C8[arg0 * 2] * 0xB4);
    } else {
        dst = &D_801295D0;
    }

    result = 0;
    temp = func_800231E8();
    if (temp != 0) {
        if (temp > 0) {
            if (temp == 1) {
                *dst = D_801295D0;
                result = 1;
            }
        }
    } else {
        func_80023170((u16 *)&D_801295D0);
    }
    return result;
}
