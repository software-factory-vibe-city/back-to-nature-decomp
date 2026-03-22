#include "common.h"

s32 func_80021820(s32 arg0, s32 arg1) {
    register s32 var_t5 __asm__("$13");  /* t5 */
    register s32 var_t3 __asm__("$11");  /* t3 */
    register s32 var_t7 __asm__("$15");  /* t7: constant -1 sentinel */
    register s32 *var_t6 __asm__("$14"); /* t6 = &D_8006C0C8 */
    register s32 *var_v1 __asm__("$3");  /* v1 = &D_8006C128 */
    register s32 var_t4 __asm__("$12");  /* t4 = arg0 << 2 */
    register s32 var_a3 __asm__("$7");   /* a3 */
    register s32 *var_t1 __asm__("$9");  /* t1 */
    register s32 *var_t0 __asm__("$8");  /* t0 */
    register s32 temp_a2 __asm__("$6");  /* a2 */
    register s32 var_t2 __asm__("$10");  /* t2 */

    var_t5 = -1;
    var_t3 = 0;
    __asm__ volatile("addiu $15, $zero, -1" : "=r"(var_t7));
    /* Force the exact address-load sequence the target expects */
    __asm__ volatile(
        "lui $2, %%hi(D_8006C0C8)\n\t"
        "addiu $14, $2, %%lo(D_8006C0C8)\n\t"
        "lui $3, %%hi(D_8006C128)\n\t"
        "addiu $3, $3, %%lo(D_8006C128)"
        : "=r"(var_t6), "=r"(var_v1)
        :
        : "$2"
    );
    var_t4 = arg0 << 2;
    __asm__ volatile("" : "=r"(var_t4) : "0"(var_t4));
    var_a3 = arg0;
    __asm__ volatile("_80021844:");
loop_1:
    var_t2 = 0x01000000;
    if (arg1 >= var_a3) {
        var_t1 = (s32 *)((char *)var_t4 + (s32)var_v1);
        var_t0 = (s32 *)((char *)var_t4 + (s32)var_t6);
        do {
            if (*var_t0 == var_t3) {
                temp_a2 = *var_t1;
                if (temp_a2 < var_t2) {
                    var_t5 = var_a3;
                    var_t2 = temp_a2;
                }
            }
            var_t1 = (s32 *)((char *)var_t1 + 4);
            var_a3 += 1;
            var_t0 = (s32 *)((char *)var_t0 + 4);
        } while (arg1 >= var_a3);
    }
    var_t3 += 1;
    if (var_t5 == var_t7) {
        __asm__ volatile("_800218A8:");
        var_a3 = arg0;
        if (var_t3 < 4) {
            goto loop_1;
        }
        return -1;
    }
    return var_t5;
}
