#include "common.h"
#include "game_types.h"

void ovl_11_func_800E48CC(void *arg0, SpriteSourceData *arg1);
void ovl_11_func_800E4608(void);

/* Walk the ten 0x30-byte D_80129230 sprite records. For each record, reach
 * the corresponding work-area entity through the pointer stored at
 * D_80074838 + 0x5DD0 (0x18-byte stride) and box-test it when bit 0 of the
 * entity's u16 at +4 is set. */
void ovl_11_func_800E4568(void) {
    u8 *work;
    u8 *entity;
    SpriteSourceData *src;
    s32 offset;
    s32 i;

    if (!(D_8006C844 & 0x800000)) {
        work = D_80074838;
        src = (SpriteSourceData *) D_80129230;
        offset = 0;
        i = 9;
        do {
            entity = (u8 *) (*(s32 *) (work + 0x5DD0) + offset);
            if (*(u16 *) (entity + 4) & 1) {
                ovl_11_func_800E48CC(entity, src);
            }
            src += 1;
            i -= 1;
            offset += 0x18;
        } while (i >= 0);
        ovl_11_func_800E4608();
    }
}
