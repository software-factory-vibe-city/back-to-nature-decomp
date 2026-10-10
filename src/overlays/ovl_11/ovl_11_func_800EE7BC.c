#include "common.h"

s32 ovl_11_func_800F002C(void);
s32 ovl_11_func_800F02C8(void);
s16 ovl_11_func_800EFF9C(void);
s32 ovl_11_func_800F00AC(void);
s32 ovl_11_func_800F00E4(void);

s32 ovl_11_func_800EE7BC(s16 arg0, s16 arg1) {
    s32 temp_s0;
    s32 temp_v0;
    u16 var_v0;

    if (arg0 == 0) {
        temp_v0 = ovl_11_func_800F002C();
        if (temp_v0 >= 0) {
            ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0 = (u16) temp_v0;
        } else {
            temp_s0 = ovl_11_func_800F02C8();
            if ((u8) ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_44CD >= 0xAU) {
                ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0 = 0xAU;
            } else if (ovl_11_func_800EFF9C() < 0x32) {
                ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0 = 0xCU;
            } else if (ovl_11_func_800F00AC() < 0xB) {
                ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0 = 0xDU;
            } else if (ovl_11_func_800F00E4() < 6) {
                ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0 = 0xEU;
            } else if (temp_s0 == -1) {
                ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0 = 0xFU;
            } else if (((struct struct_8006C838_800EE7BC *) D_8006C838)->field_91C2 < 6) {
                ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0 = 0x10U;
            } else {
                if (temp_s0 >= 5) {
                    temp_s0 = 0;
                }
                var_v0 = temp_s0 + 5;
                ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0 = var_v0;
            }
        }
    } else {
        D_80129560[arg1] = (s32) ((struct struct_8006C838_800EE7BC *) D_8006C838)->field_E7A0;
    }
    return 1;
}
