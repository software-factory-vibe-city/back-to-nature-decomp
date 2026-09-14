#include "common.h"
#include "game_types.h"
/* Family transfer: ovl_11_func_800BBC34 → ovl_17_func_800B7E38.
 * Same flexible signature over the original words.
 * CROSS-CONTAINER: donor built in a different link; verify the flag column.
 * symbol-lo: D_80070CC0 → D_80070CC4 (1× at 0x800bbc40)
 * symbol-lo: D_80121780 → D_800BB4E4 (1× at 0x800bbc44)
 * edit: symbol D_80070CC0 → D_80070CC4
 * edit: symbol D_80121780 → D_800BB4E4
 * Verified only by the relocated-byte oracle; similarity proves nothing.
 */

void ovl_17_func_800B7E38(void) {
    s32 *base = D_800BB4E4;

    ((void (*)(s32 *))base[D_80070CC4])(base);
}
