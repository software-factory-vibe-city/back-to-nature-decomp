#include "common.h"

s32 func_8001AF44(u32 arg0) {
    /* register __asm__ required: compiler assigns v1 to index and v0 to ptr, target uses v0 for index and v1 for ptr */
    register u32 temp_v0 __asm__("v0");
    register u32 *temp_v1 __asm__("v1");

    arg0 = arg0 & 0xFFFF;
    temp_v0 = arg0 >> 5;
    temp_v1 = (u32 *)&D_8006C838;
    temp_v0 <<= 2;
    __asm__("addu %0, %0, %1" : "+r"(temp_v1) : "r"(temp_v0));
    return (*(u32 *)((char *)temp_v1 + 0x38) >> (arg0 & 0x1F)) & 1;
}
