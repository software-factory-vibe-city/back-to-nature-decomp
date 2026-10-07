#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F82FC", ovl_11_func_800F82FC);


/* PARKED by /auto_decompilation_loop on 2026-10-07T22:50:48.171Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F82FC.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"
#include "psyq/libgpu.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} M2C_8573ba8bfae4_CopyStruct_84D4;

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} M2C_3f22cd297a83_CopyStruct_8480;

int DrawSync (int mode);
int LoadImage (RECT *rect, u_long *p);
int MoveImage2 (RECT *rect, int x, int y);
int StoreImage (RECT *rect, u_long *p);
void *memset ();
s32 ovl_11_func_800F8404 (s32 arg0);
s32 func_800212A8 (s32 soundId, s32 lo, s32 hi);
void SetVal8005E2BC (s32 arg0);
void SetVal8005E334 (s32 arg0);
s32 ovl_11_func_800D5750 (s16 arg0);
s32 func_800226B0 (void);
void func_80022738 (void);
s32 func_8001FABC (s16 arg0);
void ovl_11_func_800F8224 (s16 *arg0, s16 arg1);
s32 ovl_11_func_800F8188 ();
s32 ovl_11_func_800D5810 (s16 arg0);
s32 ovl_11_func_800D57A4 (s16 arg0);
s8 ovl_11_func_800D583C (s16 arg0);
void ovl_11_func_800F84D4 (M2C_8573ba8bfae4_CopyStruct_84D4 *arg0, M2C_8573ba8bfae4_CopyStruct_84D4 *arg1);
void ovl_11_func_800D5740 (s16 *arg0);
void ovl_11_func_800F8480 (M2C_3f22cd297a83_CopyStruct_8480 *arg0, M2C_3f22cd297a83_CopyStruct_8480 *arg1);
void ovl_11_func_800F8428 (u16 *arg0, u16 *arg1);
s32 ovl_11_func_800D60D4 (s16 *arg0);
s32 func_8002261C (s32 arg0, s32 arg1);
s32 GetVal8005E5B4 (void);
void ovl_11_func_800D666C (s16 arg0);
s32 ovl_11_func_800D6730 (s16 value, s16 row);
s32 ovl_11_func_800D678C (s16 arg0);
s32 ovl_11_func_800D67F4 (s16 arg0);

extern s32 D_80070D42;
extern s32 D_80071042;
extern s32 D_80071A8A;

s32 *ovl_11_func_800F82FC(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 *var_s2;
    s32 *var_v0;
    s32 *var_v0_2;
    s32 *var_v0_3;
    s32 temp_a;
    s32 temp_s0;
    s32 temp_v0;
    s32 var_v1;
    s32 var_v1_2;

    temp_a = (arg1 * 8) - 9;
    temp_s0 = temp_a + arg0;
    if (D_80126E40 == 0) {
        var_s2 = &D_80071A84;
        var_v1 = (arg0 << 1) + arg0;
        var_v1 <<= 1;
        var_v0_2 = (s32 *) ((u8 *) &D_80071A84 + 6);
    } else {
        var_s2 = &D_80071A8A;
        var_v1 = (arg0 << 1) + arg0;
        var_v1 <<= 1;
        var_v0_2 = &D_80071A8A + 0xC;
    }
    var_v0 = (s32 *) ((u8 *) var_v0_2 + var_v1);
    temp_v0 = ovl_11_func_800F8404(arg0);
    switch (temp_v0) {
    case 0:
        return var_s2;
    case 1:
        return var_v0;
    default:
            if (D_80126E40 == 0) {
                var_v1_2 = temp_s0 * 6;
                var_v0_3 = &D_80070EC2;
            } else if (D_80126E40 != 2) {
                var_v1_2 = temp_s0 * 6;
                var_v0_3 = &D_80071042;
            } else {
                var_v1_2 = temp_s0 * 6;
                var_v0_3 = &D_80070D42;
            }
        return (s32 *) ((u8 *) var_v0_3 + var_v1_2);
    }
}
#endif
