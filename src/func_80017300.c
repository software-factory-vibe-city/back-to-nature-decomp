#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

void func_80017300(u8 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5) {
    RECT rect;
    u16 count;
    u32 entry_data;
    u32 header;
    u32 size;
    u32 bytes;
    u8 *src;
    u8 *dst;
    u32 entry_idx;
    s8 count_rle;
    u8 repeat;
    u8 repeat_val = 0;
    s32 row_width;
    u16 height;
    s32 row;
    s32 next_row;
    u16 channel;
    u16 pixel;
    u32 flags2;

    if (*arg0 != 0xD) {
        return;
    }

    count = *(u16 *)(arg0 + 2);
    arg0 += 4;

    for (entry_idx = 0; entry_idx < count; entry_idx = (entry_idx + 1) & 0xFFFF) {
        header = *(u32 *)arg0;
        size = header & 0xFFFFFF;
        entry_data = header >> 24;
        src = arg0 + 12;
        rect.x = *(u16 *)(arg0 + 4);
        rect.y = *(u16 *)(arg0 + 6);
        rect.w = *(u16 *)(arg0 + 8);
        rect.h = *(u16 *)(arg0 + 10);

        if ((entry_data & 3) != 2) {
            rect.x += arg1;
            rect.y += arg2;
        } else if (((s16)rect.w < 0x100) || (arg5 != (entry_data & 3))) {
            rect.x += arg3;
            rect.y += arg4;
        }

        count_rle = 0;
        repeat = 0;
        row_width = (rect.w * 2) & 0xFFFF;
        height = (u16)rect.h;

        if (!(entry_data & 0xC)) {
            rect.h = 1;
            row = 0;
            if (height != 0) {
                do {
                    dst = D_8005EE28;
                    next_row = row + 1;
                    row = 0;
                    while (row < row_width) {
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
                            *dst = *src++;
                            dst++;
                        } else {
                            *dst = repeat_val;
                            dst++;
                        }
                        row++;
                        count_rle--;
                    }

                    flags2 = entry_data & 2;
                    if (flags2 && (arg5 == 1)) {
                        pixel = 1;
                        while (pixel < rect.w) {
                            ((u16 *)D_8005EE28)[pixel] |= 0x8000;
                            pixel++;
                        }
                    }

                    LoadImage(&rect, (u_long *)D_8005EE28);
                    row = next_row;
                    rect.y++;
                } while (row < height);
            }
        } else if (entry_data & 8) {
            rect.w = 1;
            row = 0;
            if (row_width != 0) {
                do {
                    channel = 0;
                    next_row = row + 2;
                    do {
                        dst = D_8005EE28 + (channel != 0);
                        if (height != 0) {
                            row = height;
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
                                    *dst = *src++;
                                } else {
                                    *dst = repeat_val;
                                }
                                dst += 2;
                                row--;
                                count_rle--;
                            } while (row != 0);
                        }
                        channel++;
                    } while (channel < 2);

                    flags2 = entry_data & 2;
                    if (flags2 && (arg5 == 1)) {
                        pixel = 1;
                        while (pixel < rect.w) {
                            ((u16 *)D_8005EE28)[pixel] |= 0x8000;
                            pixel++;
                        }
                    }

                    LoadImage(&rect, (u_long *)D_8005EE28);
                    row = next_row;
                    rect.x++;
                } while (row < row_width);
            }
        } else {
            rect.h = 1;
            row = 0;
            if (height != 0) {
                do {
                    dst = D_8005EE28;
                    next_row = row + 1;
                    for (row = 0; row < row_width; row++) {
                        *dst = *src++;
                        dst++;
                    }

                    flags2 = entry_data & 2;
                    if (flags2 && (arg5 == 1)) {
                        pixel = 1;
                        while (pixel < rect.w) {
                            ((u16 *)D_8005EE28)[pixel] |= 0x8000;
                            pixel++;
                        }
                    }

                    LoadImage(&rect, (u_long *)D_8005EE28);
                    row = next_row;
                    rect.y++;
                } while (row < height);
            }
        }

        do {
        } while (DrawSync(1) != 0);

        bytes = ((size + 3) >> 2) << 2;
        arg0 += bytes + 12;
    }
}
