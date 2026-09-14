#include "common.h"
#include "game_types.h"
/* Family transfer: ovl_11_func_800BBC34 → ovl_27_func_800B7EEC.
 * Same flexible signature over the original words.
 * CROSS-CONTAINER: donor built in a different link; verify the flag column.
 * symbol-lo: D_80121780 → D_800C49F8 (1× at 0x800bbc44)
 * edit: symbol D_80121780 → D_800C49F8
 * Verified only by the relocated-byte oracle; similarity proves nothing.
 */

void ovl_27_func_800B7EEC(void) {
    s32 *base = D_800C49F8;

    ((void (*)(s32 *))base[D_80070CC0])(base);
}
