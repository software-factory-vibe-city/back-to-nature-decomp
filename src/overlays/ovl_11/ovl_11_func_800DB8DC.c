#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"

void GsSetProjection(long h);

void SetGeomScreen(long h);

void ovl_11_func_800DB8DC(void) {
    GsSetProjection(0x3E8);
    SetGeomScreen(0x3E8);
}
