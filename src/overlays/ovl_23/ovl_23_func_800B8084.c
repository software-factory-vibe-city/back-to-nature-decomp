#include "common.h"

extern s32 D_800BB9F8[];
extern s16 D_800BF87C;

void ovl_23_func_800B8084(void) {
    s32 *base;

    func_800225C4();
    base = D_800BB9F8;
    ((void (*)(s32 *))base[D_800BF87C])(base);
}
