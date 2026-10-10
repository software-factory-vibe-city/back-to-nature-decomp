#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"

typedef struct {
    char pad0[2];
    s16 unk2;
    u16 unk4;
} ReconA0View;

typedef struct {
    s16 unk0;
    char pad2[2];
    u16 unk4;
} F413CArg1;

typedef struct {
    char pad0[2];
    s16 unk2;
    u16 unk4;
} F413CArg0;

typedef struct {
    char pad0[2];
    s16 unk2;
    u16 unk4;
} CEEF8Arg0;

typedef struct {
    char pad0[0x50];
    Recon_ovl_11_func_800D85F8_A0View *unk50;
    s32 unk54;
} Func800C7878Arg0;

s16 ovl_11_func_800F4240(ReconA0View *arg0);
s32 ovl_11_func_800D589C(s16 arg0);
s32 ovl_11_func_800F413C(F413CArg0 *arg0, F413CArg1 *arg1);
s32 func_8001FABC(s16 arg0);
s32 ovl_11_func_800CEEF8(CEEF8Arg0 *arg0);
u16 ovl_11_func_800D85F8(Recon_ovl_11_func_800D85F8_A0View *arg0);

extern Recon_ovl_11_func_800D85F8_A0View *D_80128C4C;
extern s32 D_80128C54;

s32 ovl_11_func_800C7878(Func800C7878Arg0 *arg0, F413CArg1 *arg1) {
    s32 temp_v0;
    u32 temp_v1;

    arg0->unk50 = D_80128C4C;
    arg0->unk54 = D_80128C54;
    temp_v1 = D_80128C54 & 0x8928;
    switch (temp_v1) {                              /* irregular */
    case 0x8000:
        temp_v0 = ovl_11_func_800D589C(ovl_11_func_800F4240((ReconA0View *) D_80128C4C));
        if ((temp_v0 == 1) && (ovl_11_func_800F413C((F413CArg0 *) D_80128C4C, arg1) == temp_v0)) {
            func_8001FABC(7);
        }
        break;
    case 0x100:
        func_8001FABC(7);
        if (ovl_11_func_800CEEF8((CEEF8Arg0 *) arg0->unk50) != 2) {
            arg1->unk0 = arg0->unk50->u0.unk0;
        } else {
            arg1->unk0 = 0x65;
        }
        (*(s16 *) ((u8 *) arg1 + 2)) = 0;
        arg1->unk4 = 1;
        break;
    case 0x800:
    case 0x8:
        func_8001FABC(7);
        arg1->unk0 = arg0->unk50->u0.unk0;
        (*(s16 *) ((u8 *) arg1 + 2)) = 0;
        arg1->unk4 = 1;
        ovl_11_func_800CEEF8((CEEF8Arg0 *) arg0->unk50);
        break;
    case 0x20:
        func_8001FABC(7);
        arg1->unk0 = ovl_11_func_800D85F8(arg0->unk50);
        (*(s16 *) ((u8 *) arg1 + 2)) = 0;
        arg1->unk4 = 1;
        break;
    }
    D_80128C54 = 0;
    D_80128C4C = NULL;
    return 0;
}
