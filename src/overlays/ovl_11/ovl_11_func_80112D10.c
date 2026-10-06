/* User-authorized matching workaround: retain a real HI16 web across the
 * scans, form its full address before them and again for the final word
 * store. The final halfword uses signed low 0xD110 of the fixed-layout
 * D_8012D110 object. All three loops and memory effects remain C; this
 * does not identify original register declarations or handwritten assembly. */
#include "common.h"

void ovl_11_func_80112D10(void) {
    u8 *b;
    register u32 high asm("$9");
    register u8 *tail asm("$2");
    u8 *p;
    s32 idx;
    u32 i;
    u32 j;
    u32 k;

    i = 0;
    asm volatile("lui %0,%%hi(D_8012D110)" : "=r"(high));
    asm volatile("addiu %0,%1,%%lo(D_8012D110)" : "=r"(b) : "r"(high));
    p = b + 0xC;
    while (i < 10) {
        *(u8 *)(i + (u32)p) = 0;
        for (j = 0; j < 10; j++) {
            idx = 0x16 + i * 100;
            for (k = 0; k < 10; k++) {
                b[idx + j * 10 + k] = 0;
            }
        }
        i++;
    }
    asm volatile("addiu %0,%1,%%lo(D_8012D110)" : "=r"(tail) : "r"(high));
    *(u32 *)(tail + 0x400) = 0;
    *(u16 *)(high + (s16)0xD110) = 0;
}
