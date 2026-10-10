#include "common.h"
#include "game_types.h"

s32 func_80012A34(s32 arg0);
extern u8 D_800BF87C[];
extern u8 D_800BBA9C[];

s32 ovl_23_func_800BA494(s16 arg0, s16 arg1) {
    s32 sel;
    s16 sum;
    s16 limit;
    s32 i;
    s32 val;
    u8 *base;
    s32 a;
    s32 b;
    s32 diff;
    s32 sh_a;
    s32 off;
    u8 *base0;

    sum = 0;
    limit = (s16)func_80012A34(0x64);
    if (arg1 == 0) {
        base0 = D_800BF87C;
        sel = (u16)(((Ovl23D87CView50 *)base0)->unk0[arg0].unk28 - 1) < 2;
    } else {
        base = D_800BF87C;
        a = ((Ovl23D87CView210 *)base)->unk210[arg0].unk0;
        if (a < 0) {
            a += 0xFFF;
        }
        sh_a = a >> 12;
        off = arg0 * 0x50;
        b = ((Ovl23D87CView50 *)base)->unk0[arg0].unk38;
        if (b < 0) {
            b += 0xFFF;
        }
        diff = sh_a - (b >> 12);
        off = *(s16 *)((u8 *)base + off + 0x2E);
        if (diff < 0) {
            diff = -diff;
        }
        sel = (diff - off) < 0x65;
    }
    for (i = 0; i < 3; i++) {
        val = *(u16 *)((u8 *)D_800BBA9C + sel * 6 + arg1 * 12 + i * 2);
        sum = (s16)(sum + val);
        if (limit < sum) {
            break;
        }
    }
    if (i == 0) {
        return 3;
    }
    if (i == 1) {
        return 2;
    }
    if (i == 2) {
        return 1;
    }
    return -1;
}
