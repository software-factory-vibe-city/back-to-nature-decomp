#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"
#include "psyq/libsnd.h"

extern s16 D_8005E324;

void func_80021B20(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    if (D_8005E324 != 0) {
        SsSetSerialVol(0, 0, 0);
        CdStandby();
        D_8005E324 = 0;
    }
}
