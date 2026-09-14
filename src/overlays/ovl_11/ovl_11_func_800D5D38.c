#include "common.h"
#include "game_types.h"
/* Family transfer: ovl_11_func_800D5D9C → ovl_11_func_800D5D38.
 * Same flexible signature over the original words.
 * immediate: 0x2000 → 0x8000 (1× at 0x800d5dec)
 * edit: immediate 0x2000 → 0x8000
 * Verified only by the relocated-byte oracle; similarity proves nothing.
 */

s32 ovl_11_func_800D5D38(u16 a, u16 b) {
    Recon_ovl_11_func_800D5D38_D8006C838Lookup *v = (Recon_ovl_11_func_800D5D38_D8006C838Lookup *)&D_8006C838;
    Recon_ovl_11_func_800D5D38_D8006C838Row *rows = (Recon_ovl_11_func_800D5D38_D8006C838Row *)v->field_20;
    s16 t;
    u32 z = 0;

    t = rows[a].arr[b];
    if (t == -1) {
        return 0;
    }
    return (*(u16 *)((u8 *)v->field_28 + t * 8 + 6) & 0x8000) > z;
}
