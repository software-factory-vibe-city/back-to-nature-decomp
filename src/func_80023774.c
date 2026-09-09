#include "common.h"

/* GP-relative globals owned by this TU. */
s16 D_8005E338;
s16 D_8005E33A;
struct struct_8005E340_target *D_8005E340;

s32 func_80023774(void) {
    D_8005E338 = 1;
    D_8005E33A = D_8005E340->unk2;
    return (s32)D_8005E340;
}
