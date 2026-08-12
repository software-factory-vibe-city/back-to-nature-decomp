#include "common.h"

/* GsGetWorkBase/GsSetWorkBase from libgs.h (forward declarations) */
unsigned char *GsGetWorkBase(void);
void GsSetWorkBase(unsigned char *);
void SystemError(char, s32);

/* TU-owned global (GP-relative in the target) */
struct_8005E3C0 *D_8005E3C0;

s32 func_80011F5C(s32 arg0) {
    s32 temp_s0;
    s32 temp_v0;

    temp_s0 = D_8005E3C0->field_12C + D_8005E3C0->field_128;
    temp_v0 = GsGetWorkBase();
    if ((u32)temp_s0 < (u32)(temp_v0 + arg0)) {
        do {
        } while (func_800129E8() != 0);
        SystemError(0x50, 0);
    }
    GsSetWorkBase((unsigned char *)(temp_v0 + arg0));
    return temp_v0;
}
