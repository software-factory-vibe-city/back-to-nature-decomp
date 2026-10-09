#include "common.h"

struct_80076220 *ovl_11_func_800BF1D0(s16 *arg0, void *arg1, void *arg2) {
    struct_80076220 *entry;
    s32 *bp;
    s32 box[6];
    s32 *q;
    u32 i;
    u16 mask;
    u8 *p;

    bp = box;
    entry = &D_80076220;
    i = 0;
    box[0] = arg0[0] - 0x96;
    box[1] = arg0[0] + 0x96;
    box[2] = arg0[2] - 0x96;
    box[3] = arg0[2] + 0x96;
    box[4] = arg0[1] - 0x14;
    box[5] = arg0[1] + 0x14;
    for (; i < 0x25; i++, entry++) {
        if (entry->unk1E & 0x1000) {
            mask = 0x800;
            p = &entry->unk30[0x30];
        } else {
            mask = 0x100;
            p = entry->unk30;
        }
        q = (s32 *) p;
        if ((entry->unk1E & mask) &&
            bp[0] < q[0] && q[0] < bp[1] &&
            bp[2] < q[2] && q[2] < bp[3] &&
            bp[4] < q[1] && q[1] < bp[5]) {
            return entry;
        }
    }
    return 0;
}
