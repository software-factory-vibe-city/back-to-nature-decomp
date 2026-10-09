#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F0E00", ovl_11_func_800F0E00);


/* PARKED by /auto_decompilation_loop on 2026-10-09T12:00:55.060Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F0E00.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

extern u16 D_8006F5F0;
extern s32 D_80129618;
extern s32 D_8012961C;

void *memcpy(void *dest, const void *src, u32 n);
void *memset(void *s, int c, u32 n);

void ovl_11_func_800F0E00(void *arg0) {
    u16 *list;
    u16 term;
    s32 count;

    D_80129618 = 0;
    if (arg0 == 0) {
        D_80129618 = 0;
    } else {
        list = &D_8006F5F0;
        memset(list, 0, 0xE10);
        memcpy(list, arg0, 0xE10);
        term = 0xFFFF;
        count = 0;
        if (*list == term) {
            D_80129618 = 0;
        } else {
            do {
                count += 1;
            } while (*((u16 *)((u8 *)list + count * 0x24)) != term);
            D_80129618 = count;
        }
    }
    D_8012961C = 0;
}
#endif
