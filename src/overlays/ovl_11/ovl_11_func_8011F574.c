/* User-authorized matching workaround under baseline compiler flags.
 * The fixed-layout flag at 0x80128540 is reached by high 0x80130000 plus
 * signed low 0x8540; its opaque high birth precedes the work-area address.
 * All stores and the call remain C. This does not identify original source
 * register declarations or justify the former scheduling flag override. */
#include "common.h"

void ovl_11_func_8011F52C(void);

char *ovl_11_func_8011F574(void) {
    char *base;
    register u32 v asm("$4");
    register u32 flag_high asm("$5");
    s16 *flag;

    ovl_11_func_8011F52C();
    asm volatile("lui %0,0x8013" : "=r"(flag_high));
    flag = (s16 *)(flag_high + (s16)0x8540);

    /* Two-stage base formation keeps the +0x8000 materialized at runtime
     * (lui/addiu/ori/addu) instead of folding it into the access offset;
     * same idiom as matched siblings ovl_11_func_800BFD04 /
     * ovl_11_func_800BF2F4. */
    base = (char *)&D_8006C838;
    base += 0x8000;

    v = *(u16 *)(base + 0x64D2);
    *flag = 1;
    *(u16 *)(base + 0x64D2) = 0;
    D_8012855A = v;
    return base;
}