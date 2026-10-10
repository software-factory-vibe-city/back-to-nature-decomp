#include "common.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
void func_8001719C(u8 *arg0);
void func_8001BFA8(void *arg0, void *arg1);
void func_8001E340(void **arg0);
void func_8001E334(s32 arg0);
void *memcpy(void *dest, const void *src, u32 n);

/* dst is name-bound to D_800C0DD8 before the copy so the address is
 * materialised in the aligned/unaligned copy arms; the empty memory
 * barrier keeps the BFA8 argument loads after the copy, which is what
 * places the copy source in $a0. */
void ovl_21_func_800BB8B8(void) {
    s32 *p;
    u8 *dst;

    p = D_800BC894;
    func_80014BCC(0, p[0], p[1] - p[0], 0, D_8007AFF0);
    func_80014BCC(0, p[1], p[2] - p[1], 0, D_8005E3B0 + 0x4290);
    func_8001719C((u8 *)(D_8005E3B0 + 0x4290));
    memcpy(&D_8009F78C, (void *)D_8007AFF0, 0xBDC);
    dst = &D_800C0DD8;
    __asm__("" : : : "memory");
    func_8001BFA8(dst, (void *)(D_8007AFF0 + 0x2000));
    func_8001E340((void **)dst);
    func_8001E334(0xC8);
}
