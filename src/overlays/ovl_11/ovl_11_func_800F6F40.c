#include "common.h"
#include "game_types.h"
void func_800248B0(s32 arg0, s16 arg1, s16 arg2);
/* Family transfer: func_80019E14 → ovl_11_func_800F6F40.
 * Same flexible signature over the original words.
 * CROSS-CONTAINER: donor built in a different link; verify the flag column.
 * immediate-hi: 0x60000 → 0x180000 (1× at 0x80019e28)
 * immediate-hi: 0x80000 → 0xc0000 (1× at 0x80019e20)
 * edit: immediate-hi 6 → 24
 * edit: immediate-hi 8 → 12
 * Verified only by the relocated-byte oracle; similarity proves nothing.
 */

void ovl_11_func_800F6F40(s32 arg0, s16 arg1, s16 arg2) {
    func_800248B0(arg0, (s16)(arg1 + 12), (s16)(arg2 + 24));
}
