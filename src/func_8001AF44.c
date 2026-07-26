#include "common.h"

s32 func_8001AF44(u32 arg0) {
    struct struct_8006C838_flags *flags;
    u32 index;

    arg0 = arg0 & 0xFFFF;
    index = arg0 >> 5;
    flags = (struct struct_8006C838_flags *)&D_8006C838;
    return (flags->flags[index] >> (arg0 & 0x1F)) & 1;
}
