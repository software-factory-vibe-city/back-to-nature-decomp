#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D0408(s16 arg0, Recon800D0408A1View *arg1, s32 arg2) {
    arg1->unk0 = 0;
    arg1->unk4 = 0;
    arg1->unk8 = 0;

    switch (arg0) {
        case 0:
            arg1->unk8 = -arg2;
            return -arg2;
        case 1:
            arg1->unk0 = -arg2;
            return -arg2;
        case 2:
            arg1->unk8 = arg2;
            break;
        case 3:
            arg1->unk0 = arg2;
            break;
        case 4:
            arg1->unk0 = 0;
            arg1->unk4 = 0;
            arg1->unk8 = 0;
            break;
        case -1:
            arg1->unk4 = -arg2;
            return -arg2;
        case -2:
            arg1->unk4 = arg2;
            break;
    }
}
