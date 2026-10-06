#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad[0x20];
    /* 0x20 */ u16 unk20;
    /* 0x22 */ u16 unk22;
    /* 0x24 */ u16 unk24;
    /* 0x26 */ u8 pad2[0xA];
} Ovl11FuncDCC1CEntry;


void ovl_11_func_800DCC1C(s16 arg0, void *arg1) {
    Ovl11FuncDCC1CEntry *base;
    Ovl11FuncDCC1CEntry *e;
    u16 *src;

    base = (Ovl11FuncDCC1CEntry *)D_80128E08;
    src = (u16 *)arg1;
    e = &base[arg0];
    e->unk20 = src[0];
    e->unk22 = src[1];
    e->unk24 = src[2];
}
