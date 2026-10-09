#include "common.h"
#include "game_types.h"

/* The 0x18-byte work record this routine walks. Only the witnessed fields
 * are named; unk0 is compared against a far s16, unk4 is the selection flag
 * word, unk2 is handed to the callback, and unk8/unkC/unk10 are the box. */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ u16 pad6;
    /* 0x08 */ u16 unk8;
    /* 0x0A */ u16 padA;
    /* 0x0C */ u16 unkC;
    /* 0x0E */ u16 padE;
    /* 0x10 */ u16 unk10;
    /* 0x12 */ u8 pad12[0x18 - 0x12];
} Ovl11Func5BC0Entry;

s32 ovl_11_func_800F581C(void);
s32 ovl_11_func_800F5888(u16 *arg0, s32 *arg1);
void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800F5BC0(s32 arg0, Ovl11Func5BC0Entry *arg1, s32 (*arg2)(u16, u8 *, s32 *)) {
    u16 sp18[3];
    s32 sp20[3];
    u8 sp30;
    s32 sp34;
    s32 temp_s2;
    s32 var_s1;
    char *far_base;
    s32 (*cb)(u16, u8 *, s32 *);

    temp_s2 = (ovl_11_func_800F581C() | 1) & 0xFFFF;
    if ((arg2 != 0) && (arg0 > 0)) {
        cb = arg2;
        far_base = (char *) D_8009AFF0;
        var_s1 = arg0;
        do {
            if (((arg1->unk4 & temp_s2) == temp_s2) && (arg1->unk0 == (*(s16 *) (far_base + 0x5476)))) {
                sp18[0] = arg1->unk8 + 0x96;
                sp18[1] = arg1->unkC - 0x64;
                sp18[2] = arg1->unk10 - 0x96;
                if (ovl_11_func_800F5888(sp18, sp20) != 0) {
                    if (cb(arg1->unk2, &sp30, &sp34) != 0) {
                        func_80015EE8(D_8005E3C0->field_120 + ((sp20[2] >> 2) * 4), (s32) (&D_80070400 + sp34), (s32) sp30, 0, (s16) sp20[0], (s16) sp20[1]);
                    }
                }
            }
            var_s1 -= 1;
            arg1 += 1;
        } while (var_s1 != 0);
    }
}
