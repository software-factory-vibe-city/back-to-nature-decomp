#include "common.h"

void ovl_28_func_800B895C(void);
void ovl_28_func_800B8478(void);

s32 ovl_28_func_800B8414(void) {
    ovl_28_func_800B895C();
    D_800B9614 = ovl_28_func_800B8478;
    D_800B93AE = 0;
    D_800B93B0 = 0;
    D_800B93B2 = 0;
    D_800B93B8 = 1;
    D_800B93B4 = 0x800;
    D_800B93BC = 0;
    return 0x800;
}
