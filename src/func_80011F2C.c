#include "common.h"

extern u8 D_8005E274;

/* Setter for D_8005E274 - see func_80011F38 for getter */
void func_80011F2C(u8 arg0) {
    D_8005E274 = arg0;
}
