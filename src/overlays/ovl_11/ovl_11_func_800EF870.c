#include "common.h"
#include "game_types.h"

void ovl_11_func_800EF870(s16 arg0) {
    Ovl11RecordE4D8View *v;

    v = (Ovl11RecordE4D8View *)&D_8006C838;
    v->recs[arg0][0] = -1;
    v->recs[arg0][1] = 0;
    v->recs[arg0][2] = 0;
    v->recs[arg0][4] = -1;
    v->recs[arg0][5] = -1;
}
