#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libmcrd.h"
#include "psyq/memory.h"


long MemCardSync (long mode, long *cmds, long *rslt);
void *memset ();
void ovl_15_func_8012E15C (void);
void ovl_15_func_8013468C (void);

void ovl_15_func_80130FC8(void) {
    ovl_15_func_8012E15C();
    D_80137586 = -1;
}
