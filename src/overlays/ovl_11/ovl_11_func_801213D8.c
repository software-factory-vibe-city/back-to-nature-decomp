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

u16 func_80015A18(SpriteSourceData *arg0, s32 arg1);
s32 ovl_11_func_800F5888(u16 *arg0, s32 *arg1);
void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void ovl_11_func_801214F8(Struct_801213D8 *arg0);

/* Advances and draws one sprite effect from the 0x18-byte records at
 * D_8012DB90. While the effect has a sprite, its frame is tick / 3; the tick
 * advances unless flag 0x08000000 of D_8006C844 is set. While that frame is
 * below the animation length func_80015A18 reports, the effect position,
 * offset by (+0x96, -0x64, -0x96), is projected by ovl_11_func_800F5888 and
 * the frame is drawn into the ordering-table slot for its depth. Once the
 * animation ends, ovl_11_func_801214F8 clears the effect.
 *
 * ovl_11_func_800F5888 takes two arguments. Passing a third sets $a2 a
 * second time in this function, and the $a2 copy before func_80015EE8 then
 * loses sched1 birthing priority, so the lbu moves ahead of the stack-argument
 * stores. The jal to func_80015A18 keeps a nop delay slot: cc1 leaves it
 * unfilled, and ASPSX does not move the following li into it.
 */
void ovl_11_func_801213D8(Struct_801213D8 *arg0) {
    u16 pos[3];
    s32 screen[3];
    s16 frames;
    s16 frame;
    s32 playing;
    u16 tick;

    if (arg0->sprite != 0) {
        frames = func_80015A18(arg0->sprite, arg0->id);
        tick = arg0->tick;
        frame = (s16) tick / 3;
        if (D_8006C844 & 0x08000000) {
            playing = frame < frames;
        } else {
            arg0->tick = tick + 1;
            playing = frame < frames;
        }
        if (playing != 0) {
            pos[0] = arg0->x + 0x96;
            pos[1] = arg0->y - 0x64;
            pos[2] = arg0->z - 0x96;
            if (ovl_11_func_800F5888(pos, screen) != 0) {
                func_80015EE8(D_8005E3C0->field_120 + ((screen[2] >> 2) * 4), (s32) arg0->sprite,
                              (u8) arg0->id, frame & 0xFF, screen[0], screen[1]);
            }
        } else {
            ovl_11_func_801214F8(arg0);
        }
    }
}
