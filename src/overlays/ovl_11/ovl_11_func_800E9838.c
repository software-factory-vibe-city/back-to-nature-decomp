#include "common.h"

s32 ovl_11_func_800E9838(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 index2;

    index2 = arg2;
    if (arg0 != 0) {
        if (arg1 == -1) {
            return 0;
        }
        index2 = arg1 + 1;
        arg3 = arg1 + 2;
    }
    if (arg1 != -1 && arg1 < 0x14) {
        s32 *tbl = D_80129560;
        s32 off = arg1 << 2;
        char *far_base = (char *)&D_8007AFF0;
        *(s32 *)((char *)tbl + off) = *(s16 *)(far_base + 0x253B6);
    }
    if (index2 != -1 && index2 < 0x14) {
        s32 *tbl = D_80129560;
        s32 off = index2 << 2;
        char *far_base = (char *)&D_8007AFF0;
        *(s32 *)((char *)tbl + off) = *(s16 *)(far_base + 0x253B4);
    }
    if (arg3 != -1 && arg3 < 0x14) {
        s32 *tbl = D_80129560;
        s32 off = arg3 << 2;
        char *far_base = (char *)&D_8007AFF0;
        *(s32 *)((char *)tbl + off) = *(s16 *)(far_base + 0x253B8);
    }
    return 1;
}
