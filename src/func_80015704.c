#include "common.h"
#include "debughook.h"
#include "game_types.h"

/* Validate a sprite-data header and initialize a SpriteSourceData object.
 *
 * Checks that the header pointer is 4-byte aligned and that the header tag
 * equals 0xE (the sprite-data format magic value). On failure, prints
 * "INIT ERROR\n" and loops on the debug breakpoint (func_800129E8).
 *
 * On success: zeroes the SpriteSourceData, sets field_8 to 0x1000 (capacity
 * or size hint), computes five table pointers from header offsets 0x10–0x20,
 * and calls func_80015880 to store the header pointer at field_14 and clear
 * field_18.
 *
 * The initialized object is consumed by func_800158E4 (animation advance),
 * the dispatcher chain func_80015BF0–func_80015D6C, and the renderer
 * wrappers (func_80016C08, func_800165D8, func_80016280).
 *
 * Called by func_8001B074, func_800223D4, func_800229F4, and func_80024A4C
 * (which caches the result by comparing field_14 against the requested
 * header to skip redundant initialization). */
void func_80015704(SpriteSourceData *out, SpriteDataHeader *header,
                   s32 arg2, s32 arg3) {
    s32 sp10;

    CAPTURE_RA(&sp10);

    /* Verify header is 4-byte aligned */
    if ((s32)header != (((u32)header >> 2) << 2)) {
        FntPrint(D_800100A0);
        do {
        } while (func_800129E8() != 0);
    }

    /* Verify header tag (expected magic value 0xE for sprite-data format) */
    if (header->tag != 0xE) {
        FntPrint(D_800100A0);
        do {
        } while (func_800129E8() != 0);
    }

    /* Zero-initialize the SpriteSourceData and set field_8 to 0x1000 */
    out->field_6 = 0;
    out->field_0 = 0;
    out->field_2 = 0;
    out->field_4 = 0;
    out->field_5 = 0;
    out->field_8 = 0x1000;
    out->field_C = 0;
    out->field_E = 0;
    out->field_10 = 0;
    out->field_12 = 0;
    out->field_14 = 0;
    out->field_18 = 0;

    /* Compute table pointers from header offsets */
    out->field_1C = (s32)((char *)header + header->offset_tex);
    out->field_20 = (s32)((char *)header + header->offset_ref);
    out->field_24 = (s32)((char *)header + header->offset_18);
    out->field_28 = (s32)((char *)header + header->offset_anim);
    out->field_2C = (s32)((char *)header + header->offset_frame);

    /* Store header pointer at field_14 and clear field_18 */
    func_80015880(out, header, 0);
}
