#include "common.h"
#include "game_types.h"

/* Scans up to nine words of the by-value record x, walking the selector
 * forward or backward depending on the mode word at 0x60, and returns the
 * first position whose word is non-zero. Falls back to the raw selector
 * when all nine probes miss.
 * User-authorized policy exception: the mode binding reproduces allocation;
 * it is a reconstruction workaround, not evidence of original pinned source. */
s16 ovl_11_func_8011D890(Ovl11Func8011D890Arg x) {
    s16 j;
    s32 i;
    register s32 mode asm("$11");

    i = 1;
    mode = x.mode;
    for (; i < 10; i++) {
        if (mode == 1) {
            j = x.index + i;
        } else {
            j = x.index - i;
        }
        j = (j >= 10) ? j - 10 : j;
        j = (j < 0) ? j + 10 : j;
        if (*(s32 *)((char *)&x + ((s32)j << 2)) != 0) {
            return j;
        }
    }
    return x.index;
}