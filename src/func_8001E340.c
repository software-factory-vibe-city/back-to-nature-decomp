#include "common.h"

typedef struct {
    u8 filler[0x18];
    s32 flag;
} Cell8001E340;

typedef struct {
    s32 field_0;
    s32 field_4;
    s32 count;             /* 0x8 */
    Cell8001E340 cells[1]; /* 0xC */
} Grid8001E340;

void func_8001E340(Grid8001E340 **arg0) {
    Grid8001E340 *g = *arg0;
    s32 i;
    s32 off;
    s32 k;

    if (g->count > 0) {
        i = 0;
        k = 1;
        off = 0xC;
        do {
            *(s32 *)((u8 *)g + off + 0x18) = k;
            __asm__("" : : "g"(i));
            off += 0x1C;
            g = *arg0;
        } while (++i < g->count);
    }
}
