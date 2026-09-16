#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800DDC64", ovl_11_func_800DDC64);


/* PARKED by /auto_decompilation_loop on 2026-09-16T02:46:47.424Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800DDC64.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad[0x28];
    /* 0x28 */ u16 unk28;
    /* 0x2A */ u8 pad2[6];
} Ovl11FuncDDC64Entry;

extern Ovl11FuncDDC64Entry D_80128E08[];
extern u32 D_801291A8[2];

void ovl_11_func_800DDC64(void) {
    Ovl11FuncDDC64Entry *p;
    u32 *ptr;
    s32 i;
    u16 f;

    i = 0;
    p = &D_80128E08[0];
    ptr = &D_801291A8[0];
    D_801291A8[0] = 0;
    ptr[1] = 0;
    if (p->unk28 & 0x10) {
        D_801291A8[p->unk28 & 1] = (u32)p;
        if (p->unk28 & 1) {
            goto end;
        }
    }
    while (1) {
        i++;
        if (i >= 0xF) {
            break;
        }
        p++;
        f = p->unk28;
        if (!(f & 0x10)) {
            continue;
        }
        ptr[f & 1] = (u32)p;
        if (!(f & 1)) {
            continue;
        }
        break;
    }
end:
    ((Ovl11FuncDDC64Entry *)D_801291A8[0])->unk28 &= 0xEFFF;
    ((Ovl11FuncDDC64Entry *)D_801291A8[1])->unk28 |= 0x1000;
}
#endif
