#include "common.h"
#include "game_types.h"

/* ovl_19 bss state base, referenced with absolute addressing (lui + %lo).
 * The two command records live at +0x10 and +0x58 (s16 index 8 and 0x2C);
 * the +0xA0/+0xE0 records at s16 index 0x50/0x70; the state halfword at +0x6
 * (index 3) and the display halfword at +0xE (index 7) are written here. */
extern s16 D_800BF4C0[];

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
void ovl_19_func_800BAC40(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_19_func_800BAC50(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2);

void ovl_19_func_800B9050(void) {
    func_8002261C(4, 0xB);
    if (D_800BF4C0[9] == 4) {
        if (D_800BF4C0[0xB] < 2) {
            ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4C0[8], 6, 0, 0x3C);
        }
    }
    if (func_800226A4() == 2) {
        ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x50], 1, 0);
        ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x70], 1, 0);
        ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4C0[8], 3, 3, 0x1E);
        ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x2C], 1, 3, 0x1E);
        D_800BF4C0[7] = 0;
        D_800BF4C0[3] = 4;
    }
}
