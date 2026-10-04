#include "common.h"
#include "psyq/libapi.h"

typedef struct {
    char pad_0[0x2];
    s16 unk2;
} ReconPointee0View;

extern ReconPointee0View *D_8006C868;

s32 ovl_11_func_800E4C84(s32 arg0) {
    s32 i;
    s16 v;

    for (i = 2; i < 0x1A; i++) {
        v = *(s16 *)(arg0 + i * 2);
        if ((v & 0x4000) != 0) {
            break;
        }
    }
    if (i == 0x1A) {
        SystemError(0x4E, D_8006C868->unk2);
    }
    return i - 2;
}
