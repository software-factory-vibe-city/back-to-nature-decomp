#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

void func_80013668(void) {
    DISPENV disp_env;
    DRAWENV draw_env;

    SetDefDispEnv(&disp_env, 0, 0, 0x280, 0x1E0);
    SetDefDrawEnv(&draw_env, 0, 0, 0x280, 0x1E0);
    PutDispEnv(&disp_env);
    PutDrawEnv(&draw_env);
}
