#include "common.h"

/*
 * Convert a display-list texture token into its paired texture page by
 * reversing it within the 0xE38..0xFEF range: the lowest token maps to the
 * highest page and vice versa. The display-list interpreter func_80018B98
 * performs the same reversal inline for the 0xE25..0xE2F range
 * (0xE2F - token), storing it to D_8005E470. The result here is tracked in
 * D_8005E454 and consumed as the tpage bits of a GPU draw-mode (0xE1)
 * command by func_80019E80, which treats -1 as "no texture".
 */
s16 GetPairedTpage(s32 tpage) {
    u32 masked;
    s16 result;

    masked = tpage & 0xFFFF;
    result = (s16) (0xFEF - masked);
    return result;
}
