#include "common.h"

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
    s8 unk10;
    s8 unk11;
} Ovl11PackedSrc8010C6A0;

typedef struct __attribute__((packed)) {
    s32 unk0;
} Ovl11PackedWord8010C6A0;

typedef struct {
    /* 0x00 */ char pad0[0x4];
    /* 0x04 */ Ovl11PackedSrc8010C6A0 src;
    /* 0x16 */ char pad1[0xAC - 0x16];
    /* 0xAC */ u16 unkAC;
    /* 0xAE */ char pad2[0xC4 - 0xAE];
    /* 0xC4 */ Ovl11PackedWord8010C6A0 word;
    /* 0xC8 */ char pad3[0xF8 - 0xC8];
} Ovl11Rec8010C6A0;

s32 ovl_11_func_8010D04C(s32 arg0);
void ovl_11_func_80110E34(void *arg0);

void ovl_11_func_8010C6A0(void) {
    Ovl11Rec8010C6A0 *rec;
    s16 *val;
    u8 *base;
    u8 *farm;
    char *src;
    s32 i;
    s32 v;
    s32 off;
    s32 p5175c;

    base = (u8 *)D_8007A638;
    memset(base, 0, 0x6C8);
    rec = (Ovl11Rec8010C6A0 *)base;
    for (i = 0; i < 7; i++, rec++) {
        ovl_11_func_8010D04C((s32)rec);
        off = D_80054BBC[1];
        p5175c = (s32)D_8005175C;
        src = (char *)(off + D_80127CD0[i]) + p5175c;
        rec->src = *(Ovl11PackedSrc8010C6A0 *)src;
        rec->unkAC = i;
        ovl_11_func_80110E34(rec);
        rec->word = *(Ovl11PackedWord8010C6A0 *)&D_80127CB4[i];
    }
    i = 4;
    farm = (u8 *)D_8006C838;
    val = (s16 *)(farm + 0x99E2);
    v = 0x24;
    for (; i >= 0; i -= 1) {
        *val = v;
        val -= 1;
        v -= 6;
    }
}
