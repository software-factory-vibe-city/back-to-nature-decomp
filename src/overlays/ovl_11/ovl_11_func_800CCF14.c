#include "common.h"

typedef struct {
    /* 0x00 */ u8 unk0[4];
    /* 0x04 */ s16 unk4;
} UnkStruct800D72E8;

s32 ovl_11_func_800D72E8(UnkStruct800D72E8 *arg0, s16 arg1);
void ovl_11_func_800D666C(s16 arg0);
void ovl_11_func_800D7328(s16 *arg0);

void ovl_11_func_800CCF14(UnkStruct800D72E8 *arg0) {
    if (ovl_11_func_800D72E8(arg0, -1) != 0) {
        ovl_11_func_800D666C(*(s16 *) ((u8 *) arg0 + 0));
        ovl_11_func_800D7328((s16 *) arg0);
    }
}
