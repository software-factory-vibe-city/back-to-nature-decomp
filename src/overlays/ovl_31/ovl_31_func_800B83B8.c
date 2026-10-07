#include "common.h"

INCLUDE_ASM("build/ovl_31/asm/nonmatchings/ovl_31_func_800B83B8", ovl_31_func_800B83B8);


/* PARKED by /auto_decompilation_loop on 2026-10-07T10:13:42.062Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_31_func_800B83B8.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libmcrd.h"
#include "psyq/stdio.h"


long MemCardGetDirentry (long chan, char *name, struct DIRENTRY *dir, long *files, long ofs, long max);
long MemCardSync (long mode, long *cmds, long *rslt);
int sprintf (char *buffer, const char *fmt, ...);

s32 ovl_31_func_800B83B8(void) {
    s32 sp18;
    s32 sp1C;
    s32 *var_a2;
    s32 temp_v0;
    s32 temp_v1;
    s32 var_a0;
    s32 var_a3;
    s32 var_v1;
    s32 temp_v2;

    MemCardSync(0, &sp18, &sp1C);
    MemCardGetDirentry(0, D_800B7EF0, &D_800B88B0, (s32 *) D_800B8868, 0, 0xF);
    var_a3 = 0;
    if ((*(s32 *) ((u8 *) D_800B8868 + 0)) > 0) {
        var_a2 = &D_800B88B0.size;
        var_a0 = *(s32 *) ((u8 *) D_800B8868 + 0);
        do {
            temp_v0 = *var_a2;
            var_v1 = temp_v0;
            if (temp_v0 < 0) {
                var_v1 = temp_v0 + 0x1FFF;
            }
            temp_v1 = var_v1 >> 0xD;
            if (temp_v0 & 0x1FFF) {
                temp_v2 = var_a3 + 1;
                var_a3 = temp_v2 + temp_v1;
            } else {
                var_a3 += temp_v1;
            }
            var_a0 -= 1;
            var_a2 += 0xA;
        } while (var_a0 != 0);
    }
    sprintf(D_800B8B10, D_800B7EF4, *(s32 *) ((u8 *) D_800B8868 + 0), var_a3);
    return 2;
}
#endif
