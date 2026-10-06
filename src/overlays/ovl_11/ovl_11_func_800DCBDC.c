#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad[8];
    /* 0x08 */ u16 unk8;
    /* 0x0A */ u16 unkA;
    /* 0x0C */ u16 unkC;
    /* 0x0E */ u8 pad2[0x22];
} Ovl11FuncCBDCEntry;


void ovl_11_func_800DCBDC(s16 arg0, void *arg1) {
    Ovl11FuncCBDCEntry *base;
    Ovl11FuncCBDCEntry *e;
    u16 *src;

    base = (Ovl11FuncCBDCEntry *)D_80128E08;
    src = (u16 *)arg1;
    e = &base[arg0];
    e->unk8 = src[0];
    e->unkA = src[1];
    e->unkC = src[2];
}
