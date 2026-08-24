#include "common.h"

typedef struct {
    /* 0x00 */ char pad[0x22];
    /* 0x22 */ u16 unk22;
    /* 0x24 */ char pad2[0x30 - 0x24];
    /* 0x30 */ u16 unk30;
    /* 0x32 */ char pad3[0x38 - 0x32];
    /* 0x38 */ s32 unk38;
    /* 0x3C */ s32 unk3C;
    /* 0x40 */ s32 unk40;
    /* 0x44 */ char pad4[0xAC - 0x44];
    /* 0xAC */ u16 unkAC;
} Unk80110E34;

typedef struct {
    /* 0x00 */ s32 field_0;
    /* 0x04 */ s32 field_4;
    /* 0x08 */ s32 field_8;
    /* 0x0C */ u16 field_C;
} Ovl11EE0Entry;

extern Ovl11EE0Entry D_80127EE0[];

void ovl_11_func_80110E34(Unk80110E34 *arg0) {
    s32 t;
    u16 c;
    t = D_80127EE0[arg0->unkAC].field_0;
    arg0->unk38 = t;
    t = D_80127EE0[arg0->unkAC].field_4;
    arg0->unk3C = t;
    t = D_80127EE0[arg0->unkAC].field_8;
    arg0->unk40 = t;
    c = *(u16 *)((char *)&D_80127EE0[arg0->unkAC] + 0xC);
    arg0->unk30 = 0x28;
    arg0->unk22 = c;
}
