#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, u8 arg1);
void func_8001585C(ObjectState *obj, u8 arg1);

/* D_8006C838 view for this function: the s32 flag word at +0x5234 (bit
 * 0x100000), the pointer at +0x5214 and the u16 at +0x51FE. Reached as
 * struct members so cc1 keeps lui %hi(D_8006C838) as the base and adds the
 * field offset as a displacement. */
typedef struct {
    /* 0x0000 */ char pad_0000[0x51FE];
    /* 0x51FE */ u16 field_51FE;
    /* 0x5200 */ char pad_5200[0x14];
    /* 0x5214 */ void *field_5214;
    /* 0x5218 */ char pad_5218[0x1C];
    /* 0x5234 */ s32 field_5234;
} Ov11View800E9104;

/* D_801248BC dispatch record view for this function: s16 fields at +6, +8,
 * +A and +C. */
typedef struct {
    /* 0x0 */ char pad0[0x6];
    /* 0x6 */ s16 unk6;
    /* 0x8 */ s16 unk8;
    /* 0xA */ s16 unkA;
    /* 0xC */ s16 unkC;
} Ov11Dispatch800E9104;

s32 ovl_11_func_800E9104(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s16 var_s1;
    s32 tmp = arg3;
    ObjectState *obj = (ObjectState *) D_80071C90;

    if (arg2 == -1) {
        var_s1 = *(s16 *) ((u8 *) obj - 0x258);
    } else {
        var_s1 = arg2;
    }
    if (arg0 == -1) {
        obj->field_4 = 0;
        ((Ov11View800E9104 *) &D_8006C838)->field_5234 &= ~0x100000;
        goto ret1;
    }
    if (arg0 == 1) {
        ((Ov11View800E9104 *) &D_8006C838)->field_5234 |= 0x100000;
        if (tmp == 0) {
            if ((u8) obj->field_4 != arg1) {
                func_80015840(obj, arg1 & 0xFF);
                return 0;
            }
            if ((obj->field_2 & 0x300) != 0) {
                ((Ov11View800E9104 *) &D_8006C838)->field_5234 &= ~0x100000;
                obj->field_4 = 0;
                return 1;
            }
            return 0;
        }
        if ((u8) obj->field_4 != arg1) {
            func_80015840(obj, arg1 & 0xFF);
        }
        func_8001585C(obj, var_s1 & 0xFF);
        return 1;
    }
    ((Ov11View800E9104 *) &D_8006C838)->field_5214 = D_801248BC;
    ((Ov11Dispatch800E9104 *) D_801248BC)->unk6 = arg1;
    ((Ov11Dispatch800E9104 *) D_801248BC)->unk8 = var_s1;
    ((Ov11Dispatch800E9104 *) D_801248BC)->unkA = (s16) (tmp - 0xA);
    ((Ov11Dispatch800E9104 *) D_801248BC)->unkC = 0x270F;
    ((Ov11View800E9104 *) &D_8006C838)->field_5234 &= ~0x100000;
    ((Ov11View800E9104 *) &D_8006C838)->field_51FE |= 0x10;
    return 0;
ret1:
    return 1;
}
