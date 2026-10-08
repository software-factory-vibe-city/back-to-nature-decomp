#include "common.h"
#include "game_types.h"

/* ovl_19 overlay-local state counter; absolute-addressed (lui + %lo) from this
 * TU. Incremented once per call and reset when the handler runs. */
extern s32 D_800BD074;

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
s32 func_8001FABC(s16 arg0);
void ovl_19_func_800BAC40(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_19_func_800BAC50(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2);

/* State handler on the shared ovl_19 D_800BF4C0 s16 state array. The compiler
 * materialises the D_800BF560 label (D_800BF4C0 + 0xA0) and folds the +0xA0/
 * +0xE0 command records and the -0x90/-0x48 records as displacements from it. */
void ovl_19_func_800B8F38(void) {
    s32 n;

    n = D_800BD074 + 1;
    D_800BD074 = n;
    if (n % 30 == 0) {
        D_800BF4C0[0x101] = func_8001FABC(0x3A);
    }
    func_8002261C(4, 0xA);
    if (func_800226A4() == 2) {
        ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x50], 2, 0x1E);
        ovl_19_func_800BAC50((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x70], 1, 0);
        ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4C0[8], 4, 0, 0x1E);
        ovl_19_func_800BAC40((Ovl19Func800BAC40Arg *)&D_800BF4C0[0x2C], 7, 0, 0x5A);
        D_800BF4C0[0x101] = func_8001FABC(0x3B);
        D_800BF4C0[0x101] = func_8001FABC(0x3C);
        D_800BF4C0[0x101] = func_8001FABC(0x44);
        D_800BD074 = 0;
        D_800BF4C0[7] = 0;
        D_800BF4C0[3] = 3;
    }
}
