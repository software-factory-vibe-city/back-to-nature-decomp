#include "common.h"

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ char pad_02[0x34 - 0x02];
    /* 0x34 */ s32 field_34;
} Ovl11FuncCFAD0Flag;

s32 ovl_11_func_800CFAD0(Ovl11FuncCFAD0Flag *arg0, s32 arg1) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);
    s32 x;
    s32 b;

    tmp[0] = phantom;
    x = arg0->field_34;
    b = x & 0x80000;
    if ((x & 0x100) != 0) {
        if ((arg1 & 1) != 0) {
            if (b == 1) {
                return 1;
            }
        }
        if ((arg1 & 2) != 0) {
            if (b == 0) {
                return 1;
            }
        }
    }
    return 0;
}
