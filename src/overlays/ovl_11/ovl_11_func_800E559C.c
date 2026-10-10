#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libgs.h"
#include "psyq/libapi.h"

s32 func_80011F5C(s32 arg0);

void ovl_11_func_800E559C(void *arg0, s16 arg1, s16 arg2) {
    SPRT *sprt;
    DR_TPAGE *tpage;
    u16 tpage_bits;
    u16 tpage_x;

    sprt = (SPRT *)func_80011F5C(0x14);
    tpage = (DR_TPAGE *)func_80011F5C(0xC);
    setSprt(sprt);
    sprt->clut = GetClut(D_80070C92.unk18, D_80070C92.unk1A);
    setRGB0(sprt, 0x80, 0x80, 0x80);
    setXY0(sprt, arg1, arg2);
    setSemiTrans(sprt, 0);
    setWH(sprt, D_80070C92.unk8, D_80070C92.unkA);
    setUV0(sprt, (D_80070C92.unk0 % 0x40) * 4, D_80070C92.unk2);
    AddPrim(arg0, sprt);
    tpage_x = D_80070C92.unk18;
    tpage_bits = (u16)D_80070C92.unk1A & 0xFF00;
    setDrawTPage(tpage, 1, 1,
                 ((tpage_bits & 0x100) >> 4)
                     | ((tpage_x & 0x3C0) >> 6)
                     | ((tpage_bits & 0x200) << 2));
    AddPrim(arg0, tpage);
}
