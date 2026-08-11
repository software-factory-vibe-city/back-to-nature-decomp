#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

s32 func_8001782C(u8 *arg0, u8 *arg1, u16 arg2, s16 arg3, s16 arg4) {
    u8 header;
    u16 count;
    u32 tile_idx;
    u32 entry_data;
    u32 size;
    u8 mode;
    u8 *src;
    u32 row_width;
    u8 *dst;
    s8 count_rle;
    u8 repeat;
    u8 repeat_val;
    s32 row;
    s32 next_row;
    s32 hh;
    u16 height;
    RECT rect;

    header = *arg0;
    if (header != 0xD) {
        return 0;
    }

    count = *(u16 *)(arg0 + 2);
    arg0 += 4;

    for (tile_idx = 0; tile_idx < count; tile_idx = (tile_idx + 1) & 0xFFFF) {
        entry_data = *(u32 *)arg0;
        size = entry_data & 0xFFFFFF;
        if (tile_idx != arg2) {
            arg0 = (u8 *)arg0 + ((((size + 3) >> 2) << 2) + 12);
            continue;
        }
        mode = entry_data >> 24;
        if (arg3 == -1) {
            rect.x = *(u16 *)(arg0 + 4);
            row = *(u16 *)(arg0 + 6);
            rect.y = row;
        } else {
            rect.x = arg3;
            rect.y = arg4;
        }
        src = (u8 *)arg0 + 12;
        rect.w = *(u16 *)(arg0 + 8);
        rect.h = *(u16 *)(arg0 + 10);
        if (!(mode & 0xC)) {
            count_rle = 0;
            repeat = 0;
            repeat_val = 0;
            dst = arg1;
            row = 0;
            row_width = (rect.w * 2) & 0xFFFE;
            height = (u16)rect.h;
            if (height != 0) {
                do {
                    next_row = row + 1;
                    if (row_width != 0) {
                        row = row_width;
                        do {
                            if (count_rle <= 0) {
                                count_rle = *(s8 *)src++;
                                if (count_rle < 0) {
                                    repeat = 0;
                                    count_rle = (s8)(-count_rle);
                                } else {
                                    repeat = 1;
                                    repeat_val = *src++;
                                }
                            }
                            if (!repeat) {
                                *dst++ = *src++;
                            } else {
                                *dst++ = repeat_val;
                            }
                            row--;
                            count_rle--;
                        } while (row != 0);
                    }
                    row = next_row;
                } while (row < height);
            }
            LoadImage(&rect, (u_long *)arg1);
        } else {
            LoadImage(&rect, (u_long *)src);
        }
        break;
    }

    hh = rect.h * 2;
    return rect.w * hh;
}