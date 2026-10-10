#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800F5888(u16 *arg0, s32 *arg1);
void ovl_11_func_800E559C(void *arg0, s16 arg1, s16 arg2);

void ovl_11_func_800E4608(void) {
    struct struct_8006C838_800E4608 *p = (struct struct_8006C838_800E4608 *) D_8006C838;
    s32 sp10[4];
    u16 sp20[3];

    if (!(p->field_0C & 0x800000) && (p->field_4476 == 0)) {
        sp20[0] = p->field_4478 + 0x96;
        sp20[1] = p->field_447C - 0x64;
        sp20[2] = p->field_4480 - 0x96;
        if (ovl_11_func_800F5888(sp20, sp10) != 0) {
            ovl_11_func_800E559C(D_8005E3C0->field_120 + ((sp10[2] >> 2) * 4), (s16) sp10[0], (s16) sp10[1]);
        }
    }
}
