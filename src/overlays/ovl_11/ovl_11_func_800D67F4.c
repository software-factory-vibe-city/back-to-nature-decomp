#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D67F4", ovl_11_func_800D67F4);


/* PARKED by /auto_decompilation_loop on 2026-09-15T16:46:51.533Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D67F4.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    s16 unk00;
    char unk[0x16];
    s16 unk18;
    char pad[4];
} Ovl11A04B8Entry;

extern Ovl11A04B8Entry D_800A04B8[1][9];

s32 ovl_11_func_800D67F4(s16 arg0) {
    Ovl11A04B8Entry *p;
    s32 result;
    s32 offset;
    u32 i;
    u32 j;
    u32 val;

    i = 0;
    offset = arg0 * 0x10E;
    p = (Ovl11A04B8Entry *)((char *)D_800A04B8 + offset);
    do {
        val = i * 8;
        result = 1;
        j = 0;
        do {
            if (val == p->unk00) {
                if (p->unk18 < 0x3F0) {
                    result = 0;
                }
            }
            j++;
            p++;
        } while (j < 9);
        if (result == 0) {
            i++;
            p = (Ovl11A04B8Entry *)((char *)D_800A04B8 + offset);
            continue;
        }
        return i;
    } while (i < 8);
    return 0;
}
#endif
