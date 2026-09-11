#include "common.h"
typedef struct {
    char pad_0[0x2];
    s16 unk2;
} ReconA0View;

s32 ovl_25_func_800B9758(ReconA0View *arg0) {
    if (arg0->unk2 != 7) {
        if (arg0->unk2 != 4) {
            return 1;
        }
    }
    return 0;
}
