#include "common.h"

/* Overlay-local halfword table at 0x80127D04, indexed by the entity's
 * 0xAC field. The array is 8 halfwords (build/ovl_11/asm/data/69960.data.s). */
extern s16 D_80127D04[];

/* D_8006C838 view for this function: a u16 counter at +0x5200 and the
 * s32 flag word at +0x5234 (bit 0x400). */
typedef struct {
    /* 0x0000 */ char pad_0000[0x5200];
    /* 0x5200 */ u16 field_5200;
    /* 0x5202 */ char pad_5202[0x32];
    /* 0x5234 */ s32 field_5234;
} Ov11View8010DDC8;

s32 func_8002261C(s32 arg0, s32 arg1);

s32 ovl_11_func_8010DDC8(u8 *arg0) {
    s32 ret;
    u16 v;

    ret = -1;
    *(s32 *)(arg0 + 0x34) |= 2;
    v = ((Ov11View8010DDC8 *)&D_8006C838)->field_5200;
    if (v < 2U) {
        *(s16 *)(arg0 + 0x22) = v + 2;
    } else {
        *(s16 *)(arg0 + 0x22) = v - 2;
    }
    func_8002261C(0, D_80127D04[*(u16 *)(arg0 + 0xAC)]);
    if (ret == -1) {
        ((Ov11View8010DDC8 *)&D_8006C838)->field_5234 &= ~0x400;
    }
    return -1;
}
