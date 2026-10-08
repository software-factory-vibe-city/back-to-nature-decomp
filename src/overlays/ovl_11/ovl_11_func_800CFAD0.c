#include "common.h"

/* ovl_11_func_800CFAD0 is a GCC nested function of ovl_11_func_800CFB20 and
 * is defined inside that function in ovl_11_func_800CFB20.c, which emits it
 * immediately before its parent. This file deliberately defines nothing: a
 * second definition would emit the function twice and shift every later
 * function in the overlay. The nested definition produces the entry
 * `sw $v0,0($sp)` (the static-chain spill) without any capture construct.
 */
