#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
} Cell5A0;

void ovl_11_func_8010C5A0(Cell5A0 *arg0) {
    if (arg0->field_2 < 10) {
        arg0->field_0 = 0xA3;
    } else if (arg0->field_2 < 20) {
        arg0->field_0 = 0xA2;
    } else {
        arg0->field_0 = 0xA1;
    }
}
