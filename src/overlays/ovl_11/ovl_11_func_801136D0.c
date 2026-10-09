#include "common.h"

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
} Ovl11_801136D0_Arg0Copy;

/* D_8007AFF0 is the base of a large main-RAM work area; this function reads a
 * pointer out of the table at +0x23608, indexed by (row * 0x2D + column). */
typedef struct {
    char pad_0[0x23608];
    s32 *table[1];
} Ovl11_801136D0_Table;

s32 ovl_11_func_801136D0(s32 *arg0, u16 *arg1, u16 *arg2, void *arg3) {
    Ovl11_801136D0_Arg0Copy tmp;
    s16 temp_a1;
    s16 temp_a3;
    s16 temp_a0;
    s16 temp_v1;
    s32 *ptr;

    tmp = *(Ovl11_801136D0_Arg0Copy *)arg0;
    *arg1 = *(u16 *)arg0 + 0x7D0;
    *arg2 = 0x7D0 - *(u16 *)((u8 *)arg0 + 8);
    temp_a0 = (s16)*arg2;
    temp_a1 = (s16)*arg1;
    *arg1 = (s16)*arg1 / 400;
    *arg2 = (s16)*arg2 / 400;
    if (temp_a1 < 0) {
        *arg1 -= 1;
        return 2;
    }
    temp_a3 = (s16)*arg1;
    if (temp_a3 < 0xA) {
        if (temp_a0 < 0) {
            *arg2 -= 1;
            return 2;
        }
        temp_v1 = (s16)*arg2;
        if (temp_v1 < 0xA) {
            ptr = ((Ovl11_801136D0_Table *)&D_8007AFF0)->table[temp_v1 * 0x2D + temp_a3];
            return (*ptr & 8) < 1;
        }
        return 3;
    }
    return 3;
}
