#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D1CFC", ovl_11_func_800D1CFC);

/* PARKED at the user's request on 2026-10-08.
 * Compiling C draft; remaining address-low-half ordering mismatch.
 * Analysis and next steps: notes/human-needed-approvals/ovl_11_func_800D1CFC.md
 */
#if 0
#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D1CFC(Recon_ovl_11_func_800D2594_A0View *arg0, Recon800D0408A1View *arg1) {
    DECLARE_NESTED_FUNCTION(s32, ovl_11_func_800D1CD0, (s32, s32));
    s32 temp_a2;
    s32 temp_a2_2;
    s32 temp_s2;
    s32 temp_s3;
    s32 temp_s5;
    s32 temp_v1;
    s32 temp_v1_2;
    s32 var_a0_2;
    s32 var_s1;
    u16 var_a0;
    s32 var_t;

    temp_s2 = *(s32 *) ((u8 *) arg0 + 0x40);
    temp_s3 = *(s32 *) ((u8 *) arg0 + 0x60);
    temp_v1 = *(s32 *) ((u8 *) arg0 + 0x38);
    temp_a2 = *(s32 *) ((u8 *) arg0 + 0x58);
    var_s1 = __builtin_abs(temp_a2 - temp_v1);
    temp_a2_2 = __builtin_abs(temp_s3 - temp_s2);
    temp_s5 = nested_ovl_11_func_800D1CD0(temp_v1, temp_a2);
    var_a0_2 = 0;
    if ((temp_a2_2 * 3) >= var_s1) {
        var_a0_2 = nested_ovl_11_func_800D1CD0(temp_s2, temp_s3);
    }
    if ((var_s1 < D_80123754) && (temp_a2_2 < D_80123754)) {
        if ((var_s1 < 0x32) || (temp_a2_2 < 0x32)) {
            var_a0 = 0;
            arg0->unk34 &= ~0x2000;
        } else {
            goto block_12;
        }
    } else {
block_12:
        var_a0 = ((u16 (*)[3])D_80123A18)[temp_s5][var_a0_2];
    }
    return (s32) var_a0;
}
#endif
