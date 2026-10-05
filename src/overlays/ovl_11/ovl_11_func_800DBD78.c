#include "common.h"
#include "psyq/stddef.h"

s32 ovl_11_func_800DBB94(s32 arg0);

/* Find the first free record in the D_8006C838+0x7A78 halfword table
 * (five 12-byte records, first halfword -1 = free). arg1 == 1 and
 * ovl_11_func_800DBB94(arg0) == arg1 -> NULL early. arg2 == 1 scans all
 * five records, otherwise one. On success the record's tag is cleared and
 * its five payload halfwords zeroed; returns the record's address. */
s16 *ovl_11_func_800DBD78(s32 arg0, s32 arg1, s32 arg2) {
    s16 *var_a0;
    s16 *var_v0;
    s32 var_a2;
    s32 var_v1;
    void *var_a1;

    if ((arg1 != 1) || (ovl_11_func_800DBB94(arg0) != arg1)) {
        var_a2 = 1;
        if (arg2 == 1) {
            var_a2 = 5;
        }
        var_v1 = 0;
        if (var_a2 != 0) {
            s16 var_a3 = -1;
            s16 *p = (s16 *)D_8006C838;
            var_a1 = (void *) (p + 0x3D3D);
            var_a0 = (s16 *) (p + 0x3D3C);
loop_6:
            var_v1 += 1;
            if (*var_a0 == var_a3) {
                *var_a0 = 0;
                var_v1 = 4;
                var_v0 = (s16 *) ((u8 *) var_a1 + 8);
                do {
                    *var_v0 = 0;
                    var_v1 -= 1;
                    var_v0 -= 1;
                } while (var_v1 >= 0);
                return var_a0;
            }
            var_a1 = (void *) ((u8 *) var_a1 + 0xC);
            var_a0 += 6;
            if (var_v1 >= var_a2) {
                goto block_11;
            }
            goto loop_6;
        }
block_11:
        return NULL;
    }
    return NULL;
}
