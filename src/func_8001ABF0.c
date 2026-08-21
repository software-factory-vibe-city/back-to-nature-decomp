#include "common.h"

void func_8001ABF0(u16 *dst, u16 *src) {
    u16 ch;

    do {
        ch = *src++;
        *dst++ = ch;
    } while (ch != 0xFFFF);
}
