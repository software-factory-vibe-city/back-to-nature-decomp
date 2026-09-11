#include "common.h"
extern s32 D_8012D52C;

extern s32 D_8012D794;

extern s32 D_8012D798;

s32 ovl_11_func_8011760C(void);

s32 ovl_11_func_80118B84(s32 arg0, s32 arg1, s32 arg2);

s32 ovl_11_func_80117370(void) {
    s32 callRet2;
    D_8012D794 = 1;
    callRet2 = ovl_11_func_8011760C();
    D_8012D798 = callRet2;
    D_8012D52C = 0;
    ovl_11_func_80118B84(0, -1, 0);
    return 1;
}
