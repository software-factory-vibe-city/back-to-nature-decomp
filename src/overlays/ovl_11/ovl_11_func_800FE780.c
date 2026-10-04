#include "common.h"
#include "game_types.h"

void ovl_11_func_800FE780(void) {
    s32 v = (((s16)D_80127212) / 30) & 0xFF;

    func_80015EE8(D_8005E3C0->field_D8 + 0x68, ((s32)(&D_8012CE88)), 3, v, 0x120,
                  0xC8);
}
