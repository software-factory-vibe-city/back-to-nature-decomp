#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ s16 id;
    /* 0x02 */ u16 tick;
    /* 0x04 */ u16 x;
    /* 0x06 */ char pad_06[0x08 - 0x06];
    /* 0x08 */ u16 y;
    /* 0x0A */ char pad_0A[0x0C - 0x0A];
    /* 0x0C */ u16 z;
    /* 0x0E */ char pad_0E[0x14 - 0x0E];
    /* 0x14 */ SpriteSourceData *sprite;
} Struct_801213D8;

extern s32 D_8006C848;
extern Struct_801213D8 D_8012DB90;

void ovl_11_func_801213D8(Struct_801213D8 *arg0);

void ovl_11_func_801212C4(void) {
    Struct_801213D8 *var_s1;
    s32 var_s0;

    if (!(D_8006C848 & 0x400)) {
        var_s1 = &D_8012DB90;
        var_s0 = 0x18;
        do {
            ovl_11_func_801213D8(var_s1);
            var_s0 -= 1;
            var_s1 += 1;
        } while (var_s0 >= 0);
    }
}
