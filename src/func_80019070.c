#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

typedef struct {
    SPRT sprite;
    DR_TPAGE draw_mode;
} SpritePacket;

/* Builds a sprite followed by its drawing-mode primitive. */
void *func_80019070(s32 *ordering_table, SpritePacket *packet, u32 glyph,
                    s32 x, s16 y, u8 red, u8 green, u8 blue,
                    u32 palette, s32 semitransparent) {
    u32 texture_u;
    s16 sprite_x;
    u32 palette_index;
    u8 code;

    glyph = (u16)glyph;
    texture_u = glyph & 0xF;
    glyph &= 0xF0;
    palette_index = palette;

    setSprt((&packet->sprite));
    sprite_x = (s16)x;
    __asm__ volatile("" ::: "memory");
    glyph >>= 4;

    if (palette_index >= 6) {
        palette_index = 0;
    }

    setClut((&packet->sprite), 0x380, D_80049044[palette_index]);
    setRGB0((&packet->sprite), red, green, blue);
    /* Keep the RGB stores ahead of the CLUT/code scheduling window. */
    __asm__ volatile("" ::: "memory");

    code = 0x64;
    if (semitransparent != 0) {
        code = 0x66;
    }

    setcode((&packet->sprite), code);
    /* Keep mask and UV setup out of the semitransparency branch window. */
    __asm__ volatile("" ::: "memory");
    setXY0((&packet->sprite), sprite_x, y);
    setUV0((&packet->sprite), texture_u * 8, (glyph * 3) << 2);
    setWH((&packet->sprite), 8, 12);
    addPrim(ordering_table, (&packet->sprite));

    packet = (SpritePacket *)((char *)packet + sizeof(SPRT));
    setDrawTPage((DR_TPAGE *)packet, 1, 1, 0xE);
    addPrim(ordering_table, packet);

    return (void *)((char *)packet + 8);
}
