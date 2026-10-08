#include "common.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
void func_8001719C(u8 *arg0);
void *memcpy(void *dest, const void *src, u32 n);
int DrawSync(int mode);

extern s32 D_8009CBF8;

void ovl_11_func_800BDA70(void) {
    s32 s0;

    DrawSync(0);
    if ((s32)D_8005E3C0 == (s32)&D_8005E5E8) {
        s0 = *(s32 *)((u8 *)&D_8005E5E8 + 0x258);
    } else {
        s0 = *(s32 *)((u8 *)&D_8005E5E8 + 0x124);
    }
    func_80014BCC(0, 0x7F000, 0x4800, 0, s0);
    memcpy(&D_8009CBF8, (void *)s0, 0x770);
    func_8001719C((u8 *)s0 + 0x770);
}
