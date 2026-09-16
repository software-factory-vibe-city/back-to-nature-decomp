#include "common.h"

extern s32 D_80071A6C;
extern u16 D_80071A36;

typedef struct {
    char pad_0[0x5234];
    s32 field_5234;
} Flag32View;

typedef struct {
    char pad_0[0x51FE];
    u16 field_51FE;
} Flag16View;

s32 ovl_11_func_800E953C(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    if (arg3 == 0) {
        if (arg0 != 0) {
            return (D_80071A6C & arg2) != 0;
        }
        if (arg1 != 0) {
            Flag32View *view = (Flag32View *)&D_8006C838;
            view->field_5234 |= arg2;
        } else {
            Flag32View *view = (Flag32View *)&D_8006C838;
            view->field_5234 &= ~arg2;
        }
    } else {
        if (arg0 != 0) {
            return (D_80071A36 & arg2) != 0;
        }
        if (arg1 != 0) {
            Flag16View *view = (Flag16View *)&D_8006C838;
            view->field_51FE |= arg2;
        } else {
            Flag16View *view = (Flag16View *)&D_8006C838;
            view->field_51FE &= ~arg2;
        }
    }
    return 1;
}
