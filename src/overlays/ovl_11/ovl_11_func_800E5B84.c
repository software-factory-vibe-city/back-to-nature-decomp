#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"

u8 *ovl_11_func_800EFF04(s32 arg0, s32 arg1, s32 *arg2);

/* D_8006C838 view for this function: the s32 flag word at +0x5234
 * (bit 0x100000). */
typedef struct {
    /* 0x0000 */ char pad_0000[0x5234];
    /* 0x5234 */ s32 field_5234;
} Ov11View800E5B84;

s32 ovl_11_func_800E5B84(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    u8 *ptr;

    ptr = ovl_11_func_800EFF04(0x24, arg0, NULL);
    if (arg3 == 0) {
        if (*(u8 *)(ptr + 4) != arg1) {
            func_80015840((ObjectState *)ptr, arg1 & 0xFF);
            return 0;
        }
        if ((*(u16 *)(ptr + 2) & 0x300) != 0) {
            ((Ov11View800E5B84 *)&D_8006C838)->field_5234 &= ~0x100000;
            return 1;
        }
        return 0;
    }
    if (*(u8 *)(ptr + 4) != arg1) {
        func_80015840((ObjectState *)ptr, arg1 & 0xFF);
    }
    func_8001585C((ObjectState *)ptr, arg2 & 0xFF);
    return 1;
}
