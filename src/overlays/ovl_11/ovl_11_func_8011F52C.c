#include "common.h"

typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ s32 unk8;
} Ovl11F52C44;

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
} Ovl11F52C50;

extern s16 D_80128540;
extern Ovl11F52C44 D_80128544;
extern Ovl11F52C50 D_80128550;
extern s16 D_80128556;
extern s16 D_8012855A;

void ovl_11_func_8011F52C(void) {
    D_80128540 = 0;
    D_80128544.unk0 = 0;
    D_80128544.unk4 = 0;
    D_80128544.unk8 = 0;
    D_80128550.unk0 = -1;
    D_80128550.unk2 = -1;
    D_80128550.unk4 = -1;
    D_80128556 = -1;
    D_8012855A = 0;
}
