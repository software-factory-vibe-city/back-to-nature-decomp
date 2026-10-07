#include "common.h"

extern u8 D_800C0B5C[];
extern u8 D_800C0B8C[];
extern u8 D_800C0BBC[];
extern u8 D_800C0BEC[];
extern u8 D_800C0C1C[];
extern u8 D_800C0C4C[];
extern u8 D_800C0C7C[];
extern u8 D_800C0CAC[];
extern u8 D_800C0CDC[];
extern u8 D_800C0D0C[];
extern u8 D_800C0D3C[];
extern u8 D_800C0D6C[];
extern u8 D_800C0D9C[];

u8 *ovl_21_func_800BAD18(s16 arg0) {
    if (arg0 == 5) {
        return D_800C0D9C;
    }
    if (arg0 == 6) {
        return D_800C0BEC;
    }
    if (arg0 == 7) {
        return D_800C0BBC;
    }
    if (arg0 == 9) {
        return D_800C0CAC;
    }
    if (arg0 == 11) {
        return D_800C0D6C;
    }
    if (arg0 == 16) {
        return D_800C0D3C;
    }
    if (arg0 == 19) {
        return D_800C0B8C;
    }
    if (arg0 == 20) {
        return D_800C0CDC;
    }
    if (arg0 == 21) {
        return D_800C0C1C;
    }
    if (arg0 == 22) {
        return D_800C0C4C;
    }
    if (arg0 == 25) {
        return D_800C0D0C;
    }
    if (arg0 == 34) {
        return D_800C0C7C;
    }
    return D_800C0B5C;
}
