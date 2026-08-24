#include "common.h"

typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ s16 field_2;
} Ov11Timer;

s32 ovl_11_func_80107DEC(Ov11Timer *arg0) {
    if (!(D_8006C844 & 0x08000000) && (arg0->field_2 != 0)) {
        arg0->field_2 = (s16) ((u16) arg0->field_2 - 1);
        return 0;
    }
    return 1;
}
