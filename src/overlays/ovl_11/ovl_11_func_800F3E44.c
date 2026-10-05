#include "common.h"

/* View of the absolute-addressed D_800712C0 record reached by this function:
 * a u16 counter at 0x00, a table of u16 entries starting at 0x02, and an s32
 * accumulator at 0x34. */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2[0x19];
    /* 0x34 */ s32 unk34;
} Unk800712C0;

s32 ovl_11_func_800D603C(s32 arg0);
s32 ovl_11_func_800F3C9C(u16 arg0);

s32 ovl_11_func_800F3E44(s16 arg0) {
    Unk800712C0 *s;
    s32 temp;
    s32 idx;

    s = (Unk800712C0 *)&D_800712C0;
    if (s->unk0 < 0x1E) {
        temp = arg0 & 0xFFFF;
        s->unk34 += ovl_11_func_800D603C(temp);
        s->unk0 += 1;
        idx = ovl_11_func_800F3C9C((u16)temp);
        if (idx == -1) {
            return 0;
        }
        s->unk2[idx] += 1;
        return 0;
    }
    return 1;
}
