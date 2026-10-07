#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s32 ovl_11_func_800FEB14 (void);
s32 ovl_11_func_800FEB68 (void);
s32 ovl_11_func_800FEBB0 (void);

void ovl_11_func_800FE928(void) {
    D_8012720E = D_8012720E + 1;
    if (((s16) D_8012720E == 2) && (ovl_11_func_800FEB14() == 0)) {
        D_8012720E = D_8012720E + 1;
    }
    if ((s16) D_8012720E == 3) {
        if (ovl_11_func_800FEB68() == 0) {
            D_8012720E = D_8012720E + 1;
        }
    }
    if (((s16) D_8012720E == 4) && (ovl_11_func_800FEBB0() == 0)) {
        D_8012720E = D_8012720E + 1;
    }
    if ((s16) D_8012720E >= 8) {
        D_8012720E = 0;
    }
}
