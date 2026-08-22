#include "common.h"

/* SDK callees (libgte.h not included here: it needs PSY-Q type aliases this
 * TU does not pull in). Declared to match include/psyq/libgte.h. */
void SetGeomOffset(long ofx, long ofy);
void SetGeomScreen(long h);

void func_8001B530(void) {
    SetGeomOffset(0xA0, 0x78);
    SetGeomScreen(0x3E8);
    func_8001B9F8(0, 0, 0x1000, 0x800);
    func_8001BA40(0, 0, -0x1000);
    memset(&D_80061E48, 0, 0x20);
    memset(&D_80061E68, 0, 0x20);
    memset(&D_80061E28, 0, 0x20);
    D_80061E28.field_10 = 0x1000;
    D_80061E28.field_8 = 0x1000;
    D_80061E28.field_0 = 0x1000;
}
