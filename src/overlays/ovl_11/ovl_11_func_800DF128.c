#include "common.h"
#include "game_types.h"

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk1;
} Ovl11UnalignedPair800DF128;

s32 ovl_11_func_800DF4F0(UnkStruct800DF4F0 *arg0);
s16 ovl_11_func_800DF228(Recon_ovl_11_func_800DEEE0_A0View *arg0);
void ovl_11_func_80107DD0(s16 *arg0);

s32 ovl_11_func_800DF128(char *arg0, s32 arg1) {
    char *base;
    char *far_base;
    char *dst;
    s16 temp;

    if (ovl_11_func_800DF4F0((UnkStruct800DF4F0 *)arg0) != 0) {
        return -1;
    }
    {
        memset(arg0, 0, 0xB8);
        dst = arg0;
        switch (arg1) {
        case 0x161:
            *(s16 *)(arg0 + 0xB0) = 0xE;
            break;
        case 0x162:
            *(s16 *)(arg0 + 0xB0) = 0x1C;
            break;
        }
        *(u16 *)arg0 = arg1;
        *(s16 *)(arg0 + 0x16) = 0xA;
        base = (char *)&D_8006C838;
        *(Ovl11UnalignedPair800DF128 *)(dst + 0x1A) = *(Ovl11UnalignedPair800DF128 *)(base + 0x44B8);
        *(u16 *)(arg0 + 4) = 0xFFFF;
        *(s16 *)(arg0 + 0x1A) = 0;
        far_base = (char *)&D_8007AFF0;
        temp = *(s16 *)(far_base + 0x25476);
        if (temp == 1 || temp == 5) {
            ovl_11_func_800DF228((Recon_ovl_11_func_800DEEE0_A0View *)arg0);
        } else {
            *(s32 *)(arg0 + 0x8C) = 0;
        }
        ovl_11_func_80107DD0((s16 *)(arg0 + 0xA8));
    }
    return 0;
}
