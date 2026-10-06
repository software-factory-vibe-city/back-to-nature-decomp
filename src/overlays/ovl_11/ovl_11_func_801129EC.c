#include "common.h"

s32 func_8001AF44(u32 arg0);

/* Preserve the original caller's pointer arguments with period-style
 * declarations. D12C28 and D12B60 do not consume arguments; their original
 * parameter lists cannot be determined from their bodies alone. */
void ovl_11_func_80112C28();
void ovl_11_func_80112AB4();
void ovl_11_func_80112C98();
void ovl_11_func_80112B60();

/* User-authorized matching workaround: bind the base, index and scaled
 * offset. This is not evidence of register bindings in the original source. */
void ovl_11_func_801129EC(void) {
    register unsigned char *base asm("$3");
    register s32 idx asm("$4");
    register s32 scaled asm("$2");
    struct_80076220 *temp_s0;

    if (func_8001AF44(0x41) != 0) {
        base = (unsigned char *)&D_8006C838;
        idx = *(s16 *)(base + 0xE778);
        base = (unsigned char *)&D_80076220;
        scaled = idx * 0x1D4;
        temp_s0 = (struct_80076220 *)(scaled + (s32)base);

        ovl_11_func_80112C28(temp_s0);
        ovl_11_func_80112AB4(temp_s0);
        ovl_11_func_80112C98(temp_s0);
        if (func_8001AF44(0x4F) != 0) {
            ovl_11_func_80112B60(&D_8007A3F0);
        }
    }
}
