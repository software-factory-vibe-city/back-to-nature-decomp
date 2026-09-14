#include "common.h"
#include "game_types.h"

s32 D_8005E3D4;

s32 D_8005E3D8;

s32 D_8005E3DC;

s32 D_8005E3E0;

s32 func_80013450(s32 arg0) {
    D_8005E3DC = 2;
    D_8005E3D8 = arg0;
    D_8005E3D4 = 0xFF / arg0;
    D_8005E3E0 = 1;
    return 1;
}
