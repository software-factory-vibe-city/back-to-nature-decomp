#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct800BFADC;

void ovl_11_func_800BFADC(UnkStruct800BFADC *arg0) {
    if ((arg0->unk2 + 1) < 0x1E) {
        arg0->unk2 = (s16) ((u16) arg0->unk2 + 1);
        return;
    }
    arg0->unk2 = 0;
    if ((arg0->unk0 + 1) < 4) {
        arg0->unk0 = (s16) ((u16) arg0->unk0 + 1);
        return;
    }
    arg0->unk0 = 0;
}
