#include "common.h"

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ char pad_02[0x34 - 0x02];
    /* 0x34 */ s32 field_34;
} Ov11Flag8010B830;

s32 ovl_11_func_8010B830(Ov11Flag8010B830 *arg0) {
    switch (arg0->field_0) {
    case 0x15E:
        arg0->field_34 &= 0xFFFF7FFF;
        arg0->field_34 &= 0xFF7FFFFF;
        break;
    case 0x15F:
        arg0->field_34 |= 0x808000;
        break;
    }
    return 0;
}
