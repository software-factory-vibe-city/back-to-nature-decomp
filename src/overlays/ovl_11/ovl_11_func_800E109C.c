#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
} UnkStruct800E109C;

s32 ovl_11_func_800E109C(UnkStruct800E109C *arg0) {
    if (arg0->unk0 == 0) {
        return 0;
    }
    return (*(s32 *)((char *)arg0 + 0x34) & 0x10000) > 0;
}
