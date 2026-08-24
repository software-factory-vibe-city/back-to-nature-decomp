#include "common.h"

typedef struct __attribute__((packed)) {
    s32 unk0;
} Ovl11UnalignedWord;

void ovl_11_func_800CCC5C(void) {
    char *dst = (char *)&D_80071A00;
    char *far_base = (char *)&D_8007AFF0;
    Ovl11UnalignedWord *src = *(Ovl11UnalignedWord **)(far_base + 0x25388);

    *(Ovl11UnalignedWord *)(dst + 0xFC) = *src;
    if ((u32)(*(s16 *)(dst + 0x8A) - 0x106) < 2) {
        *(Ovl11UnalignedWord *)(dst + 0x4012) = *(Ovl11UnalignedWord *)(dst + 0xFC);
    }
}
