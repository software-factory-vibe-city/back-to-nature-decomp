#include "common.h"

void func_80015828(u16 *arg0, u16 arg1) {
    *arg0 &= ~(arg1 & 0xFFFF);
}
