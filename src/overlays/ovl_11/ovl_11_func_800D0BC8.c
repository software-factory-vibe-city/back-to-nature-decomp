#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D0BC8(s32 arg0) {
    if (arg0 == 1) {
        if (((Ovl11Status99C8View *)D_8006C838)->field_44D0 == 0) {
            return 2;
        }
    }
    if ((arg0 == 3) &&
        (((Ovl11Status99C8View *)D_8006C838)->field_44D2 == 0)) {
        return 2;
    }
    return ~((Ovl11Status99C8View *)D_8006C838)->field_99C8[arg0 * 2] != 0;
}
