#include "common.h"

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} Struct8001F338;

void func_8001F338(Struct8001F338 *arg0, Struct8001F338 *arg1) {
    register s32 temp_v1 __asm__("v1");
    register s32 temp_v0 __asm__("v0");
    
    temp_v1 = arg1->unk0;
    arg0->unk0 = temp_v1;
    temp_v0 = arg1->unk4;
    arg0->unk4 = temp_v0;
    temp_v1 = arg1->unk8;
    arg0->unk8 = temp_v1;
}
