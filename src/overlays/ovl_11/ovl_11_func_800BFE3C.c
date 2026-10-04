#include "common.h"

extern s32 *D_80128A80;

s32 ovl_11_func_800C0834(s16 arg0);

/* Result discarded by this caller, and the target emits no $v0 write for the
 * call: the original TU declared the callee void. Its own definition leaves
 * the last quotient in $v0 regardless, so the callee's code is unaffected. */
void ovl_11_func_800C0010(s32 arg0, s32 arg1);

void ovl_11_func_800BFE3C(void) {
    char *base;
    s32 s1;

    base = (char *)&D_8006C838;
    s1 = ovl_11_func_800C0834(*(s16 *)(base + 0x44C0));
    ovl_11_func_800C0010(1, (s32)&D_80128A80[s1 * 3]);
    base += 0x8000;
    *(s32 *)(base + 0x6768) = s1;
}
