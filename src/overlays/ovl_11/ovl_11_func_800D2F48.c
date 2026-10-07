#include "common.h"
#include "game_types.h"

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk1;
} Ovl11UnalignedPair800D2F48;

extern UnkStruct80075BC4 D_80075BC4[6];

s32 ovl_11_func_800D3104(u16 *arg0, s32 arg1);
s32 ovl_11_func_800D3390(Recon_ovl_11_func_800D3390_A0View *arg0, s32 arg1);

Recon_ovl_11_func_800D3390_A0View *ovl_11_func_800D2F48(s32 arg0) {
    UnkStruct80075BC4 *var_s0;
    UnkStruct80075BC4 *var_a0;
    UnkStruct80075BC4 *var_v1;
    s32 var_a2;
    char *base;
    char *far_base;
    u16 var_30;

    var_a2 = 0;
    var_s0 = D_80075BC4;
    if (D_80075BC4[0].unk0 != 0) {
        var_a0 = D_80075BC4;
        var_v1 = D_80075BC4;
loop_2:
        var_a0 += 1;
        var_a2 += 1;
        var_v1 += 1;
        if (var_a2 < 6) {
            var_s0 = var_v1;
            if (var_a0->unk0 != 0) {
                goto loop_2;
            }
        }
    }
    if (var_a2 == 6) {
        return 0;
    }
    ovl_11_func_800D3390((Recon_ovl_11_func_800D3390_A0View *)var_s0, (s16) arg0);
    base = (char *)&D_8006C838;
    *(Ovl11UnalignedPair800D2F48 *)((u8 *)var_s0 + 0x1A) = *(Ovl11UnalignedPair800D2F48 *)(base + 0x44B8);
    far_base = (char *)&D_8007AFF0;
    var_30 = *(u16 *)(far_base + 0x25476);
    *(s16 *)((u8 *)var_s0 + 0xAC) = 0xFF;
    *(u16 *)((u8 *)var_s0 + 0x30) = var_30;
    if (var_s0->unk0 == 0x157) {
        ovl_11_func_800D3104((u16 *)var_s0, 4);
    }
    if (var_s0->unk0 == 0x15B) {
        ovl_11_func_800D3104((u16 *)var_s0, 0x12);
    }
    return (Recon_ovl_11_func_800D3390_A0View *)var_s0;
}
