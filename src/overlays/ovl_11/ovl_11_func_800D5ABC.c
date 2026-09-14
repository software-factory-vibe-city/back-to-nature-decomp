#include "common.h"
#include "game_types.h"
/* Family transfer: ovl_11_func_800D5B3C → ovl_11_func_800D5ABC.
 * Same flexible signature over the original words.
 * displacement: 0xac → 0xaa (1× at 0x800d5ba8)
 * edit: name derived from the donor's address
 * edit: displacement 0xAC → 0xAA
 * Verified only by the relocated-byte oracle; similarity proves nothing.
 */

s32 ovl_11_func_800D5ABC(void *arg0) {
    Recon_ovl_11_func_800D5ABC_D8006C838Lookup_800D5ABC *v = (Recon_ovl_11_func_800D5ABC_D8006C838Lookup_800D5ABC *)&D_8006C838;
    u16 *ptr;
    s16 temp_a0;
    s32 t0, t1, t2;

    temp_a0 = *(s16 *)((char *)v->field_20 + (*(s16 *)arg0 * 0x28) + 0x0E);
    if (temp_a0 == -1) {
        return -1U;
    }
    t0 = (s16)(temp_a0 * 5);
    t1 = t0 + (u16)*(u16 *)((char *)arg0 + 2);
    t2 = (s16)t1;
    ptr = (u16 *)((char *)v->field_24 + t2 * 0xB0 + 0xAA);
    return *ptr;
}
