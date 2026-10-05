#include "common.h"
#include "game_types.h"

/* ovl_19 bss state base, referenced with absolute addressing (lui + %lo).
 * The two command records live at +0x10 and +0x58 (s16 index 8 and 0x2C);
 * the state halfword at +0x6 (index 3) and the display halfword at +0x202
 * (index 0x101) are written by this handler. */
extern s16 D_800BF4C0[];

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
void func_8001FABC(s16 arg0);
void ovl_19_func_800BAC40(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_19_func_800BAC50(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2);

/* POLICY EXCEPTION (user-approved 2026-07-31, see common.h): the target reads
 * hard $v0 between the func_8001FABC call and the following command call, so
 * the value stored at D_800BF4C0[0x101] is the most recent call's $v0 return.
 * CAPTURE_PREV_RET is the construct that reproduces that entry-liveness. */
void ovl_19_func_800B8E88(void) {
    s32 temp_s0;
    CAPTURE_PREV_RET(phantom);

    func_8002261C(4, 9);
    temp_s0 = func_800226A4();
    if (temp_s0 == 2) {
        ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x50], 1, 0);
        ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x70], 1, 0);
        func_8001FABC(0x3A);
        D_800BF4C0[0x101] = phantom;
        ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4C0[8], 2, 0, 0);
        ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x2C], 1, 3, 0);
        D_800BF4C0[3] = temp_s0;
    }
}
