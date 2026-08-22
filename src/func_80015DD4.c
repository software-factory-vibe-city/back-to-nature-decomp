#include "common.h"
#include "globals_override.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

POLY_FT4 *func_80016C08(s32 *ot, POLY_FT4 *poly, SpriteSourceData *src,
                        s16 ox, s16 oy, u16 flags, s32 total, s32 texBase,
                        s16 subst, s16 substFrom, s16 substTo);

s32 func_80015DD4(s32 *arg0, SpriteSourceData *arg1, s32 arg2, s32 arg3,
                  s32 arg4, s32 arg5, s32 arg6, s32 arg7, s32 arg8) {
    func_80016C08(arg0, (POLY_FT4 *) D_8005E3C0->field_118, arg1, (s16) arg2,
                  (s16) arg3, 0x40, arg7, arg8, -1, -1, -1);
    return 0;
}
