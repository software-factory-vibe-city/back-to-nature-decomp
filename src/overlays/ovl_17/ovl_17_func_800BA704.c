#include "common.h"

INCLUDE_ASM("build/ovl_17/asm/nonmatchings/ovl_17_func_800BA704", ovl_17_func_800BA704);


/* PARKED by /auto_decompilation_loop on 2026-10-07T21:35:15.857Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_17_func_800BA704.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void ovl_17_func_800BA704(void) {
    s32 temp_v1;
    s32 var_t2;
    u16 *var_t1;
    u16 temp_a0;
    u16 temp_a1;
    u16 temp_v0;
    u16 temp_v1_2;
    u16 var_a1;
    u8 *var_a2;
    u8 *var_t0;
    u8 *var_t3;
    u8 *var_a3;
    u8 *base;
    u8 *work;
    u8 *out;
    u8 *prow;
    u8 *base2;
    s16 cff;
    s32 cneg;

    var_a1 = 2;
    base = (u8 *) &D_8006C838;
    work = base + 0x8000;
    if ((*(s16 *) (work + 0x6514)) != 3) {
        var_a1 = (u16) (*(s16 *) (work + 0x6514));
    }
    var_t3 = D_800BD758;
    temp_v1 = var_a1 * 0x54;
    prow = base + 0xE51E;
    var_t1 = (u16 *) (prow + temp_v1);
    var_a2 = D_800BD848;
    cff = 0xFF;
    cneg = 0xFFFE0000;
    var_t2 = 5;
    var_t0 = D_800BD848 + 0x38;
    var_a3 = work + (temp_v1 + 0x651C);
    do {
        temp_a1 = *var_t1;
        var_t1 += 7;
        temp_v0 = *(u16 *) (var_a3 - 4);
        temp_v1_2 = *(u16 *) (var_a3 - 2);
        temp_a0 = *(u16 *) var_a3;
        var_a3 += 0xE;
        var_t2 -= 1;
        (*(s8 *) ((u8 *) var_a2 + 0x28)) = 0;
        (*(s16 *) ((u8 *) var_a2 + 0x2A)) = cff;
        (*(s16 *) ((u8 *) var_a2 + 0x2C)) = 0;
        (*(s16 *) ((u8 *) var_a2 + 0x2E)) = 0;
        (*(s32 *) ((u8 *) var_t0 + -8)) = 0;
        (*(u16 *) ((u8 *) var_a2 + 0x34)) = temp_v0;
        (*(u16 *) ((u8 *) var_a2 + 0x36)) = temp_v1_2;
        (*(u16 *) ((u8 *) var_a2 + 0x42)) = temp_a0;
        (*(u16 *) ((u8 *) var_a2 + 0x44)) = temp_a1;
        (*(s32 *) ((u8 *) var_t0 + 0)) = cneg;
        (*(u8 **) ((u8 *) var_a2 + 0x3C)) = var_t3;
        var_t3 += 6;
        var_a2 += 0x50;
        var_t0 += 0x50;
    } while (var_t2 >= 0);
    base2 = (u8 *) &D_8006C838;
    if ((*(s16 *) (base2 + 0x8000 + 0x6514)) == 3) {
        out = D_800BD848;
        (*(s8 *) (out + 0xC8)) = 1;
        (*(u16 *) (out + 0xD4)) = (u16) (*(u16 *) (base2 + 0x8000 + 0x1348));
        (*(u16 *) (out + 0xD6)) = (u16) (*(u16 *) (base2 + 0x8000 + 0x12B2));
    }
}
#endif
