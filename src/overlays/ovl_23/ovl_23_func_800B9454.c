#include "common.h"
#include "game_types.h"

extern Ovl23D87CView D_800BF87C;

void ovl_23_func_800B9454(s32 arg0, s16 arg1, s16 arg2) {
    if (D_800BF87C.unk5C8 >= 0x36) {
        D_800BF87C.unk5C8 = 0;
    }
    D_800BF87C.unk418[D_800BF87C.unk5C8].unk0 = arg0;
    D_800BF87C.unk418[D_800BF87C.unk5C8].unk4 = arg1;
    D_800BF87C.unk418[D_800BF87C.unk5C8].unk6 = arg2;
    D_800BF87C.unk5C8++;
}
