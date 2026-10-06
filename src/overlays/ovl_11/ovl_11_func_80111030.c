#include "common.h"

#include "game_types.h"

s32 ovl_11_func_80111030(s32 arg0) {

    switch (*(s16 *)(arg0 + 38)) {
    case 8:
        arg0 = *(u16 *)(arg0 + 0xAE);
        break;
    case 9:
        arg0 = *(u16 *)(arg0 + 0xB0);
        break;
    case 10:
        arg0 = *(u16 *)(arg0 + 0xB2);
        break;
    default:
        return 24;
    }

    return ((Ovl11Value99DAView *)D_8006C838)->values[arg0 / 52] * 2;
}