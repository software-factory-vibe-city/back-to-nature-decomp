#include "common.h"
#include "game_types.h"

s32 ovl_21_func_800B98CC(Ovl21Func800B98CCArg *arg0) {
    s32 result;

    if (arg0->unk2 >= 3) {
        result = (u32)arg0->unk1C < 3U;
        arg0->unk18 = result;
        return result;
    } else {
        result = (u32)(arg0->unk1C - 3) < 3U;
        arg0->unk18 = result;
        return result;
    }
}
