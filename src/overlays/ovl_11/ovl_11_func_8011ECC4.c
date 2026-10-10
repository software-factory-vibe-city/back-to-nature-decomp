#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80015BF0(s32 arg0, SpriteSourceData *arg1, s16 arg2, s16 arg3);
s32 ovl_11_func_8011EE40(s16 arg0);
void func_800248B0(s32 arg0, s16 arg1, s16 arg2);

void ovl_11_func_8011ECC4(void) {
    s32 idx;
    u8 *gs;

    func_80022580((u32 *)(D_8005E3C0->field_D8 + 0x68), 1, 0, 0, 0x140, 0xB0);
    func_80015BF0(D_8005E3C0->field_D8 + 0x64, (SpriteSourceData *)&D_8012DA80[0], (s16)(HWD0 / 2), (s16)(VWD0 / 2));
    gs = (u8 *)D_8006C838;
    idx = ovl_11_func_8011EE40(*(s16 *)(gs + 0x52C6));
    func_80015BF0(D_8005E3C0->field_D8 + 0x5C, (SpriteSourceData *)&D_8012DA80[1],
                  (s16)(*(u16 *)(D_801284AC + idx * 8) - 0x10),
                  *(s16 *)(D_801284AC + 2 + idx * 8));
    idx = ovl_11_func_8011EE40(*(s16 *)(gs + 0x91DC));
    func_80015BF0(D_8005E3C0->field_D8 + 0x5C, (SpriteSourceData *)&D_8012DA80[2],
                  (s16)(*(u16 *)(D_801284AC + idx * 8) + 0x10),
                  *(s16 *)(D_801284AC + 2 + idx * 8));
    func_800248B0(D_8005E3C0->field_D8 + 0x58,
                  *(s16 *)(D_801284AC + D_80128422 * 8),
                  *(s16 *)(D_801284AC + 2 + D_80128422 * 8));
}
