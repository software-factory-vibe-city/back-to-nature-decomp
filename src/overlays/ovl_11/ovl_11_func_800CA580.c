#include "common.h"
typedef struct {
    char pad_0[0x38];
    s32 unk38;
    s32 unk3C;
    s32 unk40;
    s32 unk44;
} ReconPointee0View;

typedef struct {
    char pad_0[0x100];
    s32 unk100;
    s32 unk104;
    s32 unk108;
    s32 unk10C;
} ReconA0View;

extern ReconPointee0View *D_80128CF4;

void ovl_11_func_800CFE40(s32 arg0);

void ovl_11_func_800CA580(ReconA0View *arg0) {
    D_80128CF4->unk38 = arg0->unk100;
    D_80128CF4->unk3C = arg0->unk104;
    D_80128CF4->unk40 = arg0->unk108;
    D_80128CF4->unk44 = arg0->unk10C;
    ovl_11_func_800CFE40(D_80128CF4);
}
