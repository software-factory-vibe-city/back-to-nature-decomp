#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libgs.h"

void func_800120C8(void);

void func_80012298(s32 arg0) {
    InitFunc fp;

    do {
    } while (DrawSync(1));
    SetGeomOffset(0, 0);
    SetGeomScreen(0x3E8);
    GsSetOffset(0, 0);
    GsSetDrawBuffOffset();
    fp = D_80010000[arg0];
    fp();
    func_800120C8();
    func_800120C8();
}
