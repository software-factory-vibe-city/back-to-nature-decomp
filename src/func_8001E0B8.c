#include "common.h"

/* func_8001E158 is declared void in functions.h but the target passes 0x80
   in $a0 (delay slot of jal). The callee is a stub that ignores it, but the
   caller must match the target argument setup. */
void func_8001E158(s32 arg0);

s32 func_8001E0B8(s32 arg0, s32 arg1) {
    struct_8005E3C0 *p_struct;
    s32 *p_base;
    s32 *p_entry;
    s32 clamp;

    p_struct = D_8005E3C0;
    func_8001E158(0x80);
    clamp = p_struct->field_110;
    if (arg0 >= clamp) {
        arg0 = clamp - 1;
    }
    p_base = (s32 *)p_struct->field_118;
    p_entry = (s32 *)((s32)p_struct->field_120 + (arg0 << 2));
    *p_base = (*p_base & 0xFF000000) | (*p_entry & 0xFFFFFF);
    *p_entry = (s32)p_base & 0xFFFFFF;
    p_struct->field_118 = p_struct->field_118 + arg1;
    return (s32)p_base;
}
