#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"
#include "psyq/libsnd.h"

s32 func_8001AF44(u32 arg0);
void func_80021B20(void);

/* Tentative definitions (merged via -fcommon) so GCC reaches these GP-relatively,
 * matching the target's %gp_rel accesses. Owned by the CD-music state family. */
s16 D_8005E324;
u16 D_8005E580;
s32 D_8005E584;
s32 D_8005E588;
s32 D_8005E58C;
s32 D_8005E590;
s32 D_8005E594;
s32 D_8005E598;
s32 D_8005E59C;

/* CD-audio track play: mute serial, flush the CD subsystem, and seek the CD
 * drive to the logical position of the 6-byte D_80049A80[arg0] track entry
 * (u16 control + s16 track + s16 location, see func_80021CD8). The entry is
 * read through a typed half-word base pointer `w = D_80049A80 + arg0*3`
 * (byte stride arg0*6 = 2*3) — the array-index/deref birth form that lets the
 * scheduler place the offset-0 load at the target's slot (the offset-4 and
 * offset-2 loads hoist to the top of the store block, the u16 load does not).
 */
void func_80021B90(s32 arg0) {
    struct struct_8006C838_view *view;
    CdlLOC sp10;
    u8 sp18[2];
    s32 t;

    view = (struct struct_8006C838_view *)&D_8006C838;
    if ((view->field_CC == 0) &&
        ((func_8001AF44(2) != 1) || (*(s32 *)((u8 *)view + 0x7A74) == 1))) {
        u16 *w = (u16 *)D_80049A80 + arg0 * 3;
        CdFlush();
        func_80021B20();
        SsSetSerialVol(0, 0, 0);
        D_8005E59C = ((s16 *)w)[2];
        D_8005E598 = ((s16 *)w)[1];
        D_8005E580 = w[0];
        D_8005E324 = 1;
        D_8005E590 = 0;
        D_8005E594 = arg0;
        sp18[0] = 1;
        sp18[1] = (u8)D_8005E59C;

        do { } while (CdControlB(0xD, sp18, 0) != 1);
        t = CdPosToInt((CdlLOC *)((u8 *)&D_8006C7D8 + D_8005E598 * 24));
        D_8005E584 = t;
        D_8005E58C = t;
        D_8005E588 = 0;
        sp10.minute = 0xC8;
        do { } while (CdControlB(0xE, (u_char *)&sp10, 0) != 1);
    }
}
