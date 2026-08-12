#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"

/* CD-ROM filenames embedded in .rodata (see globals_override.h) */
extern char D_80010078[];
extern char D_80010088[];

/* GP-relative globals owned by this TU (CD loading state) */
s32 D_8005E428;
s32 D_8005E430;

/* Extern data accessed absolutely */
extern CDLocTableEntry D_80048B1C[];
extern struct struct_8006C838 D_8006C838[];

/* External functions */
s32 func_80014554(s32 arg0, s32 arg1);

s32 func_800147BC(void) {
    CdlFILE sp10;
    s32 *p_src;
    s32 *p_dst;
    s32 i;
    s32 temp_v0_2;
    char *filename;

    filename = D_80010088;
    func_80014554((s32)&D_80010078, (s32)&D_8006C838);

    p_dst = (s32 *)&D_80048B1C;
    p_dst = (s32 *)((unsigned char *)p_dst + 0x24);
    p_src = (s32 *)&D_8006C838;
    for (i = 0; i < 0x21; i++) {
        *p_dst = *p_src;
        p_src++;
        p_dst += 0x28 / 4;
    }

    do {
        p_src = (s32 *)CdSearchFile(&sp10, filename);
    } while (p_src == 0);

    temp_v0_2 = CdPosToInt(&sp10);
    D_8005E428 = temp_v0_2;
    D_8005E430 = temp_v0_2;

    return 0;
}
