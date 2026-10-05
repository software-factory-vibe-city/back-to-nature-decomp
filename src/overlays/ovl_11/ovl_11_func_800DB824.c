#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libgs.h"

void ovl_11_func_800DB824(void) {
    D_80128DB8[0].vx = 0x64;
    D_80128DB8[0].vy = 0x64;
    D_80128DB8[0].vz = 0x64;
    D_80128DB8[0].r = 0xD0;
    D_80128DB8[0].g = 0xD0;
    D_80128DB8[0].b = 0xD0;
    GsSetFlatLight(0, (GsF_LIGHT *)&D_80128DB8[0]);
    D_80128DB8[1].vx = 0x64;
    D_80128DB8[1].vy = 0x64;
    D_80128DB8[1].vz = 0x64;
    D_80128DB8[1].r = 0;
    D_80128DB8[1].g = 0;
    D_80128DB8[1].b = 0;
    GsSetFlatLight(1, (GsF_LIGHT *)&D_80128DB8[1]);
    D_80128DB8[2].vx = 0x64;
    D_80128DB8[2].vy = 0x64;
    D_80128DB8[2].vz = 0x64;
    D_80128DB8[2].r = 0;
    D_80128DB8[2].g = 0;
    D_80128DB8[2].b = 0;
    GsSetFlatLight(2, (GsF_LIGHT *)&D_80128DB8[2]);
    GsSetAmbient(0x800, 0x800, 0x800);
    GsSetLightMode(0);
}
