#include "common.h"

#undef D_80061DE8

struct Struct_80061DE8 {
    char pad_00[0x0C];
    s32 field_0C;  /* index 3 */
    s32 field_10;  /* index 4 */
    s32 field_14;  /* index 5 */
    char pad_18[0x04];
    s32 field_1C;  /* index 7 */
};

extern struct Struct_80061DE8 D_80061DE8;

void func_8001BA40(s32 arg0, s32 arg1, s32 arg2) {
    D_80061DE8.field_0C = arg0;
    D_80061DE8.field_10 = arg1;
    D_80061DE8.field_14 = arg2;
    D_80061DE8.field_1C = 0;
}
