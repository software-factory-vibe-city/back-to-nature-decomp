#include "common.h"

extern s32 D_80051808;

void ovl_11_func_8011CEE0(u16 *dst) {
    func_8001ABF0(dst, (u16 *)(D_80054BC0[0] + (s32)&D_80051808));
}
