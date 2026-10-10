#include "common.h"
#include "game_types.h"

/* Item-state update for one action record: when either flag guard in the
 * ovl_11_func_800D5868/800D589C pair is set, revalidate the record's byte at
 * +4 against the ovl_11_func_800D5C3C lookup for the s16 index at +0 and
 * either reset the record (copy the +2 next id back to +0) or refresh the
 * ovl_11_func_800D5C90 result into +4 and set bit 15 of +6. The returned
 * halfword is the resulting index, remapped by the D_80070CF2 mode. */
s32 ovl_11_func_800D589C(s16 arg0);
s32 ovl_11_func_800D5868(s16 arg0);
s32 ovl_11_func_800D5C3C(s16 arg0);
s32 ovl_11_func_800D5CE4(s16 arg0);
s32 ovl_11_func_800D5C90(s16 arg0);

u16 ovl_11_func_800D85F8(Recon_ovl_11_func_800D85F8_A0View *arg0) {
    s16 temp_s0;
    s16 idx;
    u16 temp_s3;
    u16 ret;
    s16 temp_v0;
    u8 temp_s0_2;

    temp_s0 = arg0->u0.unk0_s;
    temp_s3 = arg0->u0.unk0;
    if (ovl_11_func_800D589C(temp_s0) == 0 && ovl_11_func_800D5868(temp_s0) == 0) {
        return 0;
    }

    idx = (s16)temp_s3;
    if (ovl_11_func_800D5868(idx) == 1) {
        temp_s0_2 = arg0->unk4;
        if (temp_s0_2 != ovl_11_func_800D5C3C(idx)) {
            return 0;
        }
        if (arg0->u0.unk0 == 0x36) {
            return 0;
        }
        ret = ovl_11_func_800D5CE4(idx);
        temp_v0 = ovl_11_func_800D5C90(idx);
        if (temp_v0 == -1) {
            arg0->unk4 = 0;
            arg0->unk5 = 0;
            arg0->unk6 = 0;
            arg0->u0.unk0 = arg0->unk2;
        } else {
            arg0->unk4 = temp_v0;
            arg0->unk6 |= 0x8000;
        }
        arg0->unk5 = 0;
    } else {
        ret = temp_s3;
        arg0->unk4 = 0;
        arg0->unk5 = 0;
        arg0->unk6 = 0;
        arg0->u0.unk0 = arg0->unk2;
    }

    if (D_80070CF2 == 2) {
        if (ret == 0x40) {
            ret = 0x13A;
        }
    } else if (D_80070CF2 == 3) {
        if (ret == 0x3A) {
            ret = 0x13B;
        } else if (ret == 0x3E) {
            ret = 0x13C;
        } else if (ret == 0x3F) {
            ret = 0x13D;
        }
    }
    return ret;
}
