#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

s32 func_8001AF44(u32 arg0);

typedef struct {
    u16 unk0;
    s16 unk2;
    s16 unk4;
    s16 unk6;
    u16 unk8;
    u16 unkA;
    u16 unkC;
    u16 unkE;
    u16 unk10;
    u16 unk12;
    u16 unk14;
} Ovl11DB354Arg0;

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
} Ovl11DB354Entry;

typedef struct {
    /* 0x000 */ u8 pad0[0x4];
    /* 0x004 */ s32 unk4;
    /* 0x008 */ u8 pad8[0x8A8 - 0x8];
    /* 0x8A8 */ Ovl11DB354Entry entries[1];
} Ovl11DB354Table;

void ovl_11_func_800DB354(Ovl11DB354Arg0 *arg0) {
    RECT rect;
    Ovl11DB354Table *p;
    char *base;
    char *base2;

    base = (char *)&D_8007AFF0;
    p = *(Ovl11DB354Table **)(base + 0x25388);
    if ((p->unk4 != 0x5B) || (func_8001AF44(0x45U) != 0)) {
        rect.x = arg0->unkE;
        rect.y = arg0->unk10;
        rect.w = arg0->unk12;
        rect.h = arg0->unk14;
        MoveImage(&rect, arg0->unk4, arg0->unk6);
        if ((*(s16 *)(base + 0x25476) == 0x2C) && (arg0->unk0 & 1)) {
            MoveImage(&rect, arg0->unk4 + 8, arg0->unk6);
            MoveImage(&rect, arg0->unk4 + 0x10, arg0->unk6);
        }
        arg0->unkA = arg0->unkA + 1;
        if (arg0->unkA >= arg0->unk2) {
            Ovl11DB354Entry *e;

            base2 = (char *)&D_8007AFF0;
            e = &(*(Ovl11DB354Table **)(base2 + 0x25388))->entries[arg0->unk8];
            arg0->unk2 = e->unk2;
            arg0->unk8 = e->unk4;
            arg0->unk4 = e->unk6;
            arg0->unk6 = e->unk8;
            arg0->unkE = e->unkA;
            arg0->unk10 = e->unkC;
            arg0->unk12 = e->unkE;
            arg0->unk14 = e->unk10;
            arg0->unkA = 0;
        }
    }
}
