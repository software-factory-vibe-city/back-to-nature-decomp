#include "common.h"
#include "game_types.h"
/* Family transfer: ovl_21_func_800BA670 → ovl_11_func_800F4114.
 * Same flexible signature over the original words.
 * CROSS-CONTAINER: donor built in a different link; verify the flag column.
 * callee: ovl_21_func_800BAEEC → ovl_11_func_800F5210 (1× at 0x800ba680)
 * symbol-lo: D_800C0474 → D_80070CF2 (1× at 0x800ba674)
 * edit: symbol ovl_21_func_800BAEEC → ovl_11_func_800F5210
 * edit: symbol D_800C0474 → D_80070CF2
 * Verified only by the relocated-byte oracle; similarity proves nothing.
 */

void ovl_11_func_800F5210(s32 arg0);

void ovl_11_func_800F4114(void) {
    ovl_11_func_800F5210(D_80070CF2);
}
