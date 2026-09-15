#include "common.h"

typedef struct {
    /* 0x000 */ char pad_000[0x0C];
    /* 0x00C */ s32 field_0C;
    /* 0x010 */ char pad_010[0x4428];
    /* 0x4438 */ s16 field_4438;
    /* 0x443A */ char pad_43A[0x94];
    /* 0x44CE */ s16 field_44CE;
    /* 0x44D0 */ s16 field_44D0;
    /* 0x44D2 */ s16 field_44D2;
    /* 0x44D4 */ s16 field_44D4;
    /* 0x44D6 */ char pad_44D6[0x2A];
    /* 0x4500 */ s16 field_4500;
    /* 0x4502 */ s16 field_4502;
    /* 0x4504 */ char pad_4504[0x4];
    /* 0x4508 */ s16 field_4508;
    /* 0x450A */ char pad_450A[0x9FC8];
    /* 0xE4D2 */ s16 field_E4D2;
    /* 0xE4D4 */ char pad_E4D4[0x4];
    /* 0xE4D8 */ s16 recs[5][6];
} Func801047FCView;

void ovl_11_func_801047FC(void) {
    Func801047FCView *v;
    char *far_base;
    u32 i;

    v = (Func801047FCView *)&D_8006C838;
    v->field_E4D2 = 1;
    v->field_44CE = 0;
    v->field_44D0 = 0;
    v->field_44D2 = 0;
    if (v->field_0C & 0x8000) {
        v->field_44CE = 0;
        v->field_44D0 = 0;
        v->field_44D2 = 0;
    }
    v->field_44D4 = 0;
    v->field_4500 = 0;
    v->field_4502 = 0;
    v->field_4508 = 0;
    far_base = (char *)&D_8007AFF0;
    *(s32 *)(far_base + 0x2549C) = -1;
    v->field_4438 = -1;
    for (i = 0; i < 5; i++) {
        v->recs[i][0] = -1;
        v->recs[i][4] = -1;
        v->recs[i][5] = -1;
    }
}
