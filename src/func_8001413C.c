#include "common.h"

s32 func_8001413C(s32 arg0) {
    s32 type;
    s32 digital_state;
    s32 analog_check;

    digital_state = D_8005E9C8[arg0][2];
    type = D_8005E9C8[arg0][1] >> 4;

    if (type == 4) {
        return digital_state;
    }

    if (type != 7) {
        return digital_state;
    }

    if ((digital_state & 0xF0) != 0xF0) {
        return digital_state;
    }

    analog_check = func_80014388(D_8005E9C8[arg0][6], D_8005E9C8[arg0][7]);

    if (analog_check == -1) {
        digital_state = D_8005E9C8[arg0][2];
    } else if ((u16)(analog_check - 0x2D) >= 0x10F) {
        digital_state = D_8005E9C8[arg0][2] & 0xEF;
    } else if ((u16)(analog_check - 0x2E) < 0x59) {
        digital_state = D_8005E9C8[arg0][2] & 0xDF;
    } else if ((u16)(analog_check - 0x88) < 0x59) {
        digital_state = D_8005E9C8[arg0][2] & 0xBF;
    } else if (analog_check >= 226) {
        digital_state = D_8005E9C8[arg0][2] & 0x7F;
    }

    return digital_state;
}