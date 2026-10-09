#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x14];
    /* 0x16 */ s16 unk16;
    /* 0x18 */ char pad_18[0x18];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x2];
    /* 0x34 */ s32 unk34;
} Struct_80109A70;

typedef struct {
    /* 0x0000 */ char pad_000[0x44BA];
    /* 0x44BA */ s16 field_44BA;
    /* 0x44BC */ s16 field_44BC;
} D8006C838ButtonView;

typedef struct {
    /* 0x0000 */ char pad_000[0x52C8];
    /* 0x52C8 */ s32 field_52C8;
    /* 0x52CC */ s32 field_52CC;
    /* 0x52D0 */ s32 field_52D0;
    /* 0x52D4 */ s32 field_52D4;
} D8006C838_52C8View;

s32 func_80012A34(s32 arg0);
void func_8001FABC(s16 arg0);
s32 ovl_11_func_800C1224(s16 arg0, s16 arg1);
void ovl_11_func_800D05D0(Ovl11SetFieldsView *arg0, Ovl11PaddedVec3 v);
s32 ovl_11_func_80109188(Struct_80109A70 *arg0, s32 arg1);

/* Per-frame state handler for the current stage mode. Rejects the object when
 * its id is unset, when the mode halfword at D_8007AFF0 + 0x25476 differs from
 * the object's mode, when a 0x400-flagged object is in the button state
 * returned by ovl_11_func_800C1224, or when the frame counter plus its 0x32
 * window has already passed. In the accepted path it optionally fires the
 * 0x19 button sound, copies the four D_8006C838 + 0x52C8 words into the
 * object's vector fields, marks the object with bit 1 of unk34, and dispatches
 * state 0x11. Returns 0 on success and -1 otherwise. */
s32 ovl_11_func_80109A70(Struct_80109A70 *arg0) {
    char *far_base;
    char *far_base2;
    D8006C838_52C8View *base52;

    if (arg0->unk0 == 0) {
        return -1;
    }
    far_base = (char *) &D_8007AFF0;
    if (*(s16 *) (far_base + 0x25476) != arg0->unk30) {
        return -1;
    }
    if (arg0->unk34 & 0x400) {
        if (ovl_11_func_800C1224(((D8006C838ButtonView *) D_8006C838)->field_44BA,
                                 ((D8006C838ButtonView *) D_8006C838)->field_44BC) == 8) {
            return -1;
        }
    }
    if (func_80012A34(0xC8) < arg0->unk16 + 0x32) {
        far_base2 = (char *) &D_8007AFF0;
        if (*(s16 *) (far_base2 + 0x25476) == arg0->unk30) {
            func_8001FABC(0x19);
        }
        base52 = (D8006C838_52C8View *) D_8006C838;
        ovl_11_func_800D05D0((Ovl11SetFieldsView *) arg0, *(Ovl11PaddedVec3 *) &base52->field_52C8);
        arg0->unk34 |= 0x2;
        ovl_11_func_80109188(arg0, 0x11);
        return 0;
    }
    return -1;
}
