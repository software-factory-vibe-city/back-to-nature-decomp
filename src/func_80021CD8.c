#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"

/* Tentative definitions for GP-relative globals (target uses %gp_rel). */
s16 D_8005E324;
u16 D_8005E580;
s32 D_8005E584;
s32 D_8005E588;
s32 D_8005E58C;
s32 D_8005E594;

s32 func_80021CD8(s32 arg0) {
    CdlLOC sp10;
    s32 offset;
    u16 temp_a2;

    arg0 &= 0xFF;
    offset = D_8005E594 * 6;
    temp_a2 = *(u16 *)((u8 *)D_80049A80 + offset);
    D_8005E324 = 1;
    D_8005E580 = temp_a2;
    CdIntToPos(D_8005E584, &sp10);
    if (CdControl(arg0, (u_char *)&sp10, 0) != 1) {
        return -1;
    }
    D_8005E58C = D_8005E584;
    D_8005E588 += 1;
    return 0;
}