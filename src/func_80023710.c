#include "common.h"
#include "game_types.h"

s16 D_8005E338;

u16 D_8005E33A;

s16 D_8005E33C;

struct struct_8005E340_target *D_8005E340;

void func_80022738(void);

void func_80023710(void) {
    ((Recon_func_80023710_Pointee0View *)D_8005E340)->unk4 = D_8005E33A;
    D_8005E33A = 0;
    D_8005E33C = 0;
    D_8005E338 = 3;
    func_80022738();
}
