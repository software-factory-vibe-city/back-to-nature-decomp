#include "common.h"
#include "game_types.h"

/* View of arg0: the only field read here is the s16 at 0x2E. */
typedef struct {
    /* 0x00 */ u8 pad0[0x2E];
    /* 0x2E */ s16 unk2E;
} Ovl11C3F6CArg0;

s32 func_8001AF44(u32 arg0);
s32 func_8002261C(s32 arg0, s32 arg1);
s32 ovl_11_func_800F3D88(void);

void ovl_11_func_800C3F6C(Ovl11C3F6CArg0 *arg0, u16 *arg1) {
    s32 temp_s1;
    u8 *base;

    if (((*(s16 *) ((u8 *) arg1 + 2)) == 0) && (func_8001AF44(0xA0U) != 1) && (base = (u8 *) D_8006C838, temp_s1 = *(s32 *) (base + 0x49C0), ovl_11_func_800F3D88(), ((*(s16 *) (base + 0x52C6)) == arg0->unk2E))) {
        if (temp_s1 == 0) {
            func_8002261C(1, 0x72B);
            return;
        }
        if (temp_s1 < 0x2710) {
            func_8002261C(1, 0x72C);
            return;
        }
        func_8002261C(1, 0x72D);
    }
}
