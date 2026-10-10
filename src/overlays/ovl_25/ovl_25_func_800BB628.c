#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
    /* 0x08 */ u16 unk8;
    /* 0x0A */ u16 unkA;
    /* 0x0C */ u16 unkC;
    /* 0x0E */ u16 unkE;
    /* 0x10 */ u16 unk10;
    /* 0x12 */ u16 unk12;
    /* 0x14 */ u16 unk14;
} SpriteDesc;

typedef struct {
    u16 unk0;
    u16 unk2;
    u16 unk4;
    u16 unk6;
    u16 unk8;
    u16 unkA;
    u16 unkC;
    u16 unkE;
    u16 unk10;
} SpriteSrc;

void ovl_25_func_800BB628(SpriteDesc *arg0) {
    RECT sp10;
    s32 base;
    s32 offset;
    SpriteSrc *temp_a0;
    char *far_base;
    char *far_base2;

    sp10.x = arg0->unkE;
    sp10.y = arg0->unk10;
    sp10.w = arg0->unk12;
    sp10.h = arg0->unk14;
    MoveImage(&sp10, arg0->unk4, arg0->unk6);
    far_base = (char *)&D_8007AFF0;
    if ((*(s16 *)(far_base + 0x25476) == 0x2C) && (arg0->unk0 & 1)) {
        MoveImage(&sp10, arg0->unk4 + 8, arg0->unk6);
        MoveImage(&sp10, arg0->unk4 + 0x10, arg0->unk6);
    }
    arg0->unkA += 1;
    if (arg0->unkA >= arg0->unk2) {
        far_base2 = (char *)&D_8007AFF0;
        base = *(s32 *)(far_base2 + 0x25388);
        offset = arg0->unk8 * 0x12 + 0x8A8;
        temp_a0 = (SpriteSrc *)(base + offset);
        arg0->unk2 = temp_a0->unk2;
        arg0->unk8 = temp_a0->unk4;
        arg0->unk4 = temp_a0->unk6;
        arg0->unk6 = temp_a0->unk8;
        arg0->unkE = temp_a0->unkA;
        arg0->unk10 = temp_a0->unkC;
        arg0->unk12 = temp_a0->unkE;
        arg0->unk14 = temp_a0->unk10;
        arg0->unkA = 0;
    }
}
