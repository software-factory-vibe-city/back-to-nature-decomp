#include "common.h"

typedef struct {
    u16 vx;
    u16 vy;
    u16 vz;
    u16 pad;
} DCFECVec;

typedef struct {
    u8 pad0[0xC];
    s32 unkC;
    s32 unk10;
} DCFECRef;

typedef struct {
    DCFECRef *unk0;
    u8 pad4[4];
    DCFECRef *unk8;
    u8 padC[4];
    DCFECRef *unk10;
    u8 pad14[0xC];
    DCFECVec *unk20;
    DCFECVec *unk24;
    DCFECVec *unk28;
} DCFECArg;

void ovl_11_func_800DD060(s32 arg0, DCFECArg *arg1);

void ovl_11_func_800DCFEC(DCFECArg *arg0) {
    DCFECRef *r;

    r = arg0->unk0;
    arg0->unk20 = (DCFECVec *)((u8 *)r + (r->unkC + 0xC));
    r = arg0->unk8;
    arg0->unk24 = (DCFECVec *)((u8 *)r + (r->unkC + 0xC));
    r = arg0->unk10;
    arg0->unk28 = (DCFECVec *)((u8 *)r + (r->unkC + 0xC));
    ovl_11_func_800DD060(r->unk10, arg0);
}
