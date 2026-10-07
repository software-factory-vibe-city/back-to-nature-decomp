#include "common.h"
#include "game_types.h"

void ovl_21_func_800BAE20(s32 *arg0);
void func_80015840(ObjectState *obj, s8 arg1);
void ovl_21_func_800BAFFC(SpriteSourceData *arg0, u16 *arg1);

void ovl_21_func_800BA510(void) {
    u16 sp10[3];
    u8 *base;
    UnkStruct800C0448 *rec;
    s32 i;
    s32 *obj;
    SpriteSourceData *spr;

    base = D_800C0458;
    spr = (SpriteSourceData *)(base + 0x6D4);
    rec = (UnkStruct800C0448 *)(base - 0x10);
    obj = (s32 *)base;
    i = 5;
    do {
        ovl_21_func_800BAE20(obj);
        if (rec->unk18 == 2 && (((SpriteSourceData *)rec->unk30)->field_2 & 0x100)) {
            sp10[0] = rec->unk1A;
            sp10[1] = rec->unk1C - 0x15E;
            sp10[2] = rec->unk1E;
            func_80015840((ObjectState *)spr, 0);
            ovl_21_func_800BAFFC(spr, sp10);
        }
        rec = (UnkStruct800C0448 *)((u8 *)rec + 0x108);
        i -= 1;
        obj = (s32 *)((u8 *)obj + 0x108);
    } while (i >= 0);
}
