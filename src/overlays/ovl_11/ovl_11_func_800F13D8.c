#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800F13D8(u16 arg0) {
    s32 found;
    s32 i;

    found = 0;
    for (i = 0; i < 5; i++) {
        if (((D8006C838RecordTableView *)D_8006C838)->records[i][0] == 0) {
            if (((D8006C838RecordTableView *)D_8006C838)->records[i][1] == arg0) {
                found = 1;
                break;
            }
        }
    }
    return found;
}
