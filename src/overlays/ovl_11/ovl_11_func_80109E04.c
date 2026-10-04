#include "common.h"

extern s32 *D_8012D080;

/* Callee prototype as the original caller TU saw it: the trailing words are
 * plain words in the outgoing area (functions.h holds the callee-side
 * aggregate type). */
void ovl_11_func_800D05D0(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);

s32 ovl_11_func_80109E04(u16 *arg0) {
    if (*arg0 == 0) {
        return -1;
    }
    if (D_8012D080 != 0) {
        ovl_11_func_800D05D0((s32)arg0, D_8012D080[14], D_8012D080[15], D_8012D080[16], D_8012D080[17]);
        return 0;
    }
    return -1;
}
