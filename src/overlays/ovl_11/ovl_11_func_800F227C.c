#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F227C", ovl_11_func_800F227C);


/* PARKED by /auto_decompilation_loop on 2026-09-16T12:27:56.663Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F227C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void ovl_11_func_800F227C(s16 arg0) {
    struct_80076220 *rec;
    struct_80076220_entry *en;
    u8 *b1;
    u16 *b2;
    u16 *b3;
    s16 temp;
    s32 i;
    s32 j;

    if (arg0 != 0x168) {
        rec = &D_80076220;
        for (j = 0; j < 37; j++) {
            en = rec->unkE4;
            for (i = 0; i < 30; i++) {
                temp = en[i].unk0;
                if (temp < arg0) {
                    continue;
                }
                if (arg0 < temp) {
                    rec->unk22 = (i < 0) ? 0 : i;
                } else {
                    rec->unk22 = i;
                }
                rec->unkC = 0;
                b1 = (u8 *)rec + 0xE6;
                rec->unkE = b1[(u32)rec->unk22 * 8];
                b2 = (u16 *)((u8 *)rec + 0xE8);
                rec->unk2C = b2[(u32)rec->unk22 * 4];
                b3 = (u16 *)((u8 *)rec + 0xEA);
                rec->unk2E = b3[(u32)rec->unk22 * 4];
                break;
            }
            rec++;
        }
    }
}
#endif
