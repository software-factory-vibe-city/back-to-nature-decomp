#include "common.h"
#include "game_types.h"

extern u8 D_80071C60[];

/* Callee prototype as the original caller TU saw it: only the first two
 * arguments are materialized. */
void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);

void func_80015894(SomeStruct *arg0, s32 arg1);

void ovl_11_func_800BD168(void) {
    s32 *header;

    header = (s32 *)&D_8007AFF0;
    func_80015704((SpriteSourceData *)D_80071C60,
                  (SpriteDataHeader *)header[1]);
    func_80015894((SomeStruct *)D_80071C60, header[1] + 0xBE08);
}
