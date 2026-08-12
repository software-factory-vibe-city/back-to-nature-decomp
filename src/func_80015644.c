#include "common.h"
#include "game_types.h"

void *func_800154CC(Struct_800154CC *arg0, s32 *arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s16 arg7);

void *func_80015644(Struct_800154CC *arg0, s32 *arg1, s32 arg2, s32 arg3, s16 arg4,
                    s16 arg5, s32 arg6, s16 arg7, u8 arg8) {
    Struct_800154CC *result;
    s32 mask;
    s32 temp_v1;

    result = func_800154CC(arg0, arg1, (s16)arg2, (s16)arg3, arg4, arg5, arg6, arg7);
    __asm__ volatile("" : "+r"(result)); /* Ensure result is materialized before constants */
    result->field_3 = 1;
    ((s32 *)result)[1] = ((arg8 & 3) << 5) | 0xE1000200;

    mask = 0xFFFFFF;
    temp_v1 = (*(s32 *)result & 0xFF000000) | (*arg1 & mask);
    *(s32 *)result = temp_v1;
    *arg1 = (*arg1 & 0xFF000000) | ((s32)result & mask);

    return (void *)((char *)result + 8);
}
