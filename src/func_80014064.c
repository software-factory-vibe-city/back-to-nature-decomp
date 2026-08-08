#include "common.h"
#include "psyq/libpad.h"

s32 D_8005E3EC;

void func_80014064(void) {
    PadInitDirect((unsigned char *)&D_8005E9C8, (unsigned char *)&D_8005E9C8 + 0x22);
    PadSetAct(0, (unsigned char *)&D_8005EA18, 8);
    PadSetAct(0x10, (unsigned char *)&D_8005EA18 + 8, 8);
    PadStartCom();
    D_8005E3EC = 1;
}
