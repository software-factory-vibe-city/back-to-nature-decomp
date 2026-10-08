#include "common.h"

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ u16 field_2;
    /* 0x04 */ u16 field_4;
} Coord800C79F8;

typedef struct {
    /* 0x00 */ s32 field_00;
    /* 0x04 */ s32 field_04;
    /* 0x08 */ s32 field_08;
} BoundsArgs4994;

extern s32 D_80128CF0;

extern void *ovl_11_func_800BDE84(u8 *arg0, s16 *arg1);

s32 ovl_11_func_800C79F8(BoundsArgs4994 *arg0) {
    Coord800C79F8 coord;
    char *far_base;
    void *p;
    u16 t;

    far_base = (char *) &D_8007AFF0;
    coord.field_0 = *(u16 *) ((u8 *) arg0 + 0);
    coord.field_2 = *(u16 *) ((u8 *) arg0 + 4);
    coord.field_4 = *(u16 *) ((u8 *) arg0 + 8);
    D_80128CF0 = 0;
    p = ovl_11_func_800BDE84(*(u8 **) (far_base + 0x25388), (s16 *) &coord);
    D_80128CF0 = (s32) p;
    if (p != 0) {
        t = *(u16 *) ((u8 *) p + 2);
        switch (t) {
        case 0x26:
            return 0x26;
        case 0x2B:
            return 0x2B;
        case 0x2A:
            return 0x2A;
        case 0x2C:
            return 0x2C;
        default:
            return 0;
        }
    }
    return 0;
}
