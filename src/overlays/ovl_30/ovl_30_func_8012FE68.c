#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x10];
    /* 0x10 */ u32 field_10;
} D8006C838ViewFE68;

s32 ovl_30_func_8012FE68(s32 arg0, s32 arg1) {
    ((D8006C838ViewFE68 *)&D_8006C838)->field_10 = (((D8006C838ViewFE68 *)&D_8006C838)->field_10 & ~(1 << arg0)) | (arg1 << arg0);
    return ~(1 << arg0);
}
