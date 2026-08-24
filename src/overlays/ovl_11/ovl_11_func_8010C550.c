#include "common.h"

/* 4-byte cells; field_0 is the sprite index, field_2 carries a per-id value */
typedef struct {
    u16 field_0;
    u16 field_2;
} Cell4;

void ovl_11_func_8010C550(Cell4 *arg0, s32 arg1) {
    switch (arg1) {
    case 0xA3:
        arg0->field_2 = 0;
        break;
    case 0xA2:
        arg0->field_2 = 0xA;
        break;
    case 0xA1:
        arg0->field_2 = 0x14;
        break;
    }
}
