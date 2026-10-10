#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libmcrd.h"
#include "psyq/libmcx.h"

s32 ovl_31_func_800B8490(void) {
    s32 sp10;
    s32 sp14;
    s32 ret;

    MemCardSync(0, &sp10, &sp14);
    MemCardAccept(0);
    ret = MemCardSync(0, &sp10, &sp14);

    switch (sp14) {
    case 2:
        ret = -2;
        break;
    case 4:
        McxCardType(0);
        ret = McxSync(0, &sp10, &sp14);
        switch (sp14) {
        case 0:
            ret = -3;
            break;
        case 1:
            ret = -4;
            break;
        case 3:
            ret = -5;
            break;
        case 2:
            ret = -6;
            break;
        }
        break;
    case 0:
        McxCardType(0);
        ret = McxSync(0, &sp10, &sp14);
        switch (sp14) {
        case 0:
            ret = -7;
            break;
        case 1:
            ret = -4;
            break;
        case 3:
            ret = -5;
            break;
        case 2:
            ret = -8;
            break;
        }
        break;
    case 3:
        ret = -5;
        break;
    case 1:
        ret = -4;
        break;
    }
    return (s16)ret;
}
