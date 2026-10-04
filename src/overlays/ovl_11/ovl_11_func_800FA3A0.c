#include "common.h"

typedef struct {
    char pad_00[0x5488];
    s16 field_5488;              /* 0x5488 */
    s16 field_548A;              /* 0x548A */
    s16 field_548C;              /* 0x548C */
    char pad_548E[4];
    s16 field_5492;              /* 0x5492 */
} D8006C838ViewFA3A0;

void ovl_11_func_800FA5C8(s32 arg0, s16 arg1, s16 arg2);

void ovl_11_func_800FA3A0(s32 arg0, s16 arg1, s16 arg2, s16 arg3) {
    D8006C838ViewFA3A0 *base = (D8006C838ViewFA3A0 *)&D_8006C838;

    if (base->field_5492 != -1) {
        if (base->field_5488 == arg1 && base->field_548A == arg2) {
            ovl_11_func_800FA5C8(arg0, base->field_548C, arg3);
        }
    }
}
