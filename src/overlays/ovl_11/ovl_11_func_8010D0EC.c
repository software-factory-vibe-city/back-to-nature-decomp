#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ char pad_02[0x30 - 0x02];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x78 - 0x32];
    /* 0x78 */ SpriteSourceData sprite;
    /* 0xA8 */ char pad_A8[0xAC - 0xA8];
    /* 0xAC */ u16 unkAC;
} Struct_8010D0EC;

void func_80015704();
void func_80015868(Struct_800154CC *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);

extern s32 *D_80124FCC;
extern s32 D_8008F7F8;
extern s16 D_80127CA4[];

/* Refreshes the object sprite for the current stage mode (the s16 at
 * D_8007AFF0 + 0x25476). Mode 0x28 takes the header pointer stored at
 * D_8006C838 + 0xCBD8; modes 1 and 3-6 take entry 10 of the D_80124FCC
 * offset table, relative to the sprite bank D_8008F7F8; any other mode keeps
 * the current header. If the header changed and the object belongs to the
 * current mode, it re-initializes the sprite and restarts it with the
 * D_80127CA4[unkAC] parameter. Always sets field_0 to 0x176.
 *
 * The bank index is a variable, not the literal 10. CSE folds index << 2 to a
 * register holding 40 and reuses that register for the case-0x28 compare, so
 * the constant is born in the entry block (li $a3,0x28 in the first delay
 * slot). The second mode read uses its own base pointer: reusing far_base
 * makes it a two-set variable whose lo_sum sched1 no longer boosts, and the
 * %hi copy then misses $a0.
 */
s16 ovl_11_func_8010D0EC(Struct_8010D0EC *arg0) {
    SpriteDataHeader *header;
    s32 index;
    s32 offset;
    char *far_base;
    char *far_base2;
    char *base;

    index = 10;
    offset = D_80124FCC[index];
    far_base = (char *) &D_8007AFF0;
    switch (*(s16 *) (far_base + 0x25476)) {
    case 0x28:
        base = (char *) &D_8006C838;
        base += 0x8000;
        header = *(SpriteDataHeader **) (base + 0x4BD8);
        break;
    case 1:
    case 3:
    case 4:
    case 5:
    case 6:
        header = (SpriteDataHeader *) (offset + (s32) &D_8008F7F8);
        break;
    default:
        header = (SpriteDataHeader *) arg0->sprite.field_14;
        break;
    }
    if (header != (SpriteDataHeader *) arg0->sprite.field_14) {
        far_base2 = (char *) &D_8007AFF0;
        if (*(s16 *) (far_base2 + 0x25476) == arg0->unk30) {
            func_80015704(&arg0->sprite, header);
            func_80015868((Struct_800154CC *) &arg0->sprite, 0, 0, 0, D_80127CA4[arg0->unkAC]);
        }
    }
    arg0->field_0 = 0x176;
    return 0;
}
