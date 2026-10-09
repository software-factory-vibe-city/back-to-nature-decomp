#include "common.h"

/* D_800719FE is the s16 state field reached through the D_8006C838 view at
 * +0x51C6; the two names denote the same address. It is also read directly
 * (lh/lhu) by this function's arg0 dispatch. */
extern s16 D_800719FE;

void ovl_11_func_80111F10(void);

/* D_8006C838 view for ovl_11_func_80112160: the selector halfword at +0x51C6,
 * the two mode halfwords at +0x44D0/+0x44D2, and the status word at +0x44F8.
 * Reached as struct members so cc1 keeps lui %hi(D_8006C838) followed by
 * immediate field offsets rather than folding them. */
typedef struct {
    /* 0x0000 */ char pad_000[0x44D0];
    /* 0x44D0 */ s16 field_44D0;
    /* 0x44D2 */ s16 field_44D2;
    /* 0x44D4 */ char pad_44D4[0x44F8 - 0x44D4];
    /* 0x44F8 */ s32 field_44F8;
    /* 0x44FC */ char pad_44FC[0x51C6 - 0x44FC];
    /* 0x51C6 */ s16 field_51C6;
} Ov11_80112160View;

#define VIEW ((Ov11_80112160View *)D_8006C838)

u16 ovl_11_func_80112160(s32 arg0) {
    u16 var_s0;
    s16 val;

    var_s0 = 0;
    switch (arg0) {
    case 0:
        return D_800719FE != 0;
    case 1:
        var_s0 = (u16) D_800719FE;
        break;
    case 2:
        val = VIEW->field_51C6;
        var_s0 = *(u16 *)&VIEW->field_51C6;
        switch (val) {
        case 0x13F:
            var_s0 = 0;
            VIEW->field_44D2 = arg0;
            VIEW->field_44F8 = VIEW->field_44F8 | 0x100000;
            goto tail;
        case 0x140:
            var_s0 = 0;
            VIEW->field_44D0 = arg0;
            VIEW->field_44F8 = VIEW->field_44F8 | 0x100;
tail:
            ovl_11_func_80111F10();
            goto done;
        case 0x141:
            var_s0 = 0;
            VIEW->field_44D0 = 3;
            VIEW->field_44F8 = VIEW->field_44F8 | 0x200;
            ovl_11_func_80111F10();
done:
            VIEW->field_51C6 = 0;
            break;
        default:
            VIEW->field_51C6 = 0;
            return var_s0;
        }
        break;
    }
    return var_s0;
}
