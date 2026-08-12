#include "common.h"

/* GsSetWorkBase from libgs.h (forward declaration to avoid header deps) */
void GsSetWorkBase(unsigned char *);

/* TU-owned global (GP-relative in the target) */
struct_8005E3C0 *D_8005E3C0;

void func_80011FD8(s32 arg0) {
    if ((u32)(D_8005E3C0->field_12C + D_8005E3C0->field_128) < (u32)arg0) {
        do {
        } while (func_800129E8() != 0);
    }
    GsSetWorkBase((unsigned char *)arg0);
}
