#include "common.h"
#include "game_types.h"

void ovl_11_func_800BD238(s32 arg0);
void func_80015704();
void func_80015868(Struct_800154CC *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);

void ovl_11_func_8010B67C(void) {
    char *base;
    char *far0;
    char *far1;
    char *state;
    s32 var_a0;

    base = (char *)&D_80075AD4;
    *(s32 *)(base + 0x34) |= 0x8000000;
    far0 = (char *)&D_8007AFF0;
    if ((*(s16 *)(far0 + 0x25476) != 3) && (*(s16 *)(far0 + 0x25476) != 1)) {
        *(s32 *)(base + 0x8C) = 0;
        return;
    }
    switch (*(u16 *)(base + 0)) {
    case 0x15E:
        var_a0 = 1;
        goto block_8;
    case 0x15F:
        var_a0 = 0;
block_8:
        ovl_11_func_800BD238(var_a0);
        func_80015704((SpriteSourceData *)(base + 0x78), (SpriteDataHeader *)&D_8007AFF8);
        far1 = (char *)&D_8007AFF8;
        state = far1 + 0x1FFF8;
        if (*(s16 *)(state + 0x5476) == 3) {
            func_80015868((Struct_800154CC *)(base + 0x78), -0x100, 0, 0, 0);
        }
        return;
    default:
        *(s32 *)(base + 0x34) &= 0xF7FFFFFF;
        *(s32 *)(base + 0x8C) = 0;
        break;
    }
}
