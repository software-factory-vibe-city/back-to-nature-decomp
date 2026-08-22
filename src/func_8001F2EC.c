#include "common.h"

void func_8001F2EC(s32 cur, s32 span, s32 to, s32 from, s32 *out) {
    s32 remaining;

    if (span < cur) {
        cur = span;
    }
    remaining = span - cur;
    *out = (to - from) * remaining / span + from;
}
