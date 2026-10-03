#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0xAC];
    /* 0xAE */ u16 unkAE;
} Struct_800E2E4C;

void ovl_11_func_800D049C(void *arg0);

s32 ovl_11_func_800E2E4C(Struct_800E2E4C *arg0) {
    if (arg0->unk0 == 0) {
        return -1;
    }
    if (arg0->unk0 != 0x109) {
        return -1;
    }
    if (arg0->unkAE == 0) {
        return -1;
    }
    arg0->unkAE = 0;
    ovl_11_func_800D049C(arg0);
    return 0;
}
