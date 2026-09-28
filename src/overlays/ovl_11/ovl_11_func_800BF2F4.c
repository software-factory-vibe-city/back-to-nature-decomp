#include "common.h"
#include "game_types.h"

u16 ovl_11_func_800BF2F4(s16 *arg0, s16 *arg1) {
    char *base;
    PoolRecord18 *rec;
    s32 *bp;
    s32 box[4];
    u32 i;

    bp = box;
    i = 0;

    /* Two-stage base formation keeps +0x8000 as runtime ori/addu (matched idiom) */
    base = (char *)&D_8006C838;
    base += 0x8000;
    rec = *(PoolRecord18 **)(base + 0x5D8C);

    box[0] = arg0[0] - 0x96;
    box[1] = arg0[0] + 0x96;
    box[2] = arg0[2] - 0x96;
    box[3] = arg0[2] + 0x96;

    for (; i < 0xC5; i++) {
        if (arg1[1] == rec->unk0) {
            if (bp[0] < rec->unk8 && rec->unk8 < bp[1] &&
                bp[2] < rec->unk10 && rec->unk10 < bp[3]) {
                return rec->unk2;
            }
        }
        rec++;
    }
    return 0;
}
