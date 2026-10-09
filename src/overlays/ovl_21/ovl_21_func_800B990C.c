#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"

s32 *ovl_21_func_800BA698(u16 *arg0, s16 arg1, s16 arg2);
s32 func_8001FABC(s16 arg0);
void func_8001B2CC(s32 arg0, s32 arg1);

/* Walks the six D_800C0448 records, skipping record 0 when the flag at +0x646
 * is set. For each record whose word is 1, asks ovl_21_func_800BA698 for a
 * sub-entry within the radius at +0x65C of the record's position, searching
 * the first or second half of the table (i < 3). A hit whose state is not 6
 * is cleared and the record moved to state 7, a sound started and its handle
 * kept at +0x984; record 0 also calls func_8001B2CC(0, 1), installs
 * D_800BCAD8 at +0xC and sets +0x988 to 1.
 *
 * The flag test and the record work read the block through separate
 * pointers, and the position pointer is taken from record 0 just before the
 * call: the target forms block + 0x1A ahead of the scaled index, which no
 * field access through the s32-aligned record type produces. */
void ovl_21_func_800B990C(void) {
    s32 i;
    s32 val;
    s32 *ret;
    u8 *pos;
    Ovl21C0448View *chk;
    Ovl21C0448View *blk;

    for (i = 0; i < 6; i++) {
        chk = (Ovl21C0448View *)D_800C0448;
        if (chk->unk646 != 0 && i == 0) {
            i = 1;
        }
        blk = (Ovl21C0448View *)D_800C0448;
        val = blk->recs[i].unk0;
        if (val == 1) {
            pos = (u8 *)blk->recs[0].unk6;
            ret = ovl_21_func_800BA698((u16 *)(pos + i * sizeof(Ovl21C0448Record)), blk->unk65C, i < 3);
            if (ret != NULL && blk->recs[i].unk4 != 6) {
                *ret = 0;
                blk->recs[i].unk0 = 0;
                blk->recs[i].unk4 = 7;
                blk->recs[i].unk1A = 0;
                blk->unk984 = func_8001FABC(0x3F);
                if (i == 0) {
                    func_8001B2CC(0, 1);
                    blk->unkC = D_800BCAD8;
                    blk->unk988 = 1;
                }
            }
        }
    }
}
