#include "common.h"

/* ovl_11_func_800D1CD0 is a GCC nested function of ovl_11_func_800D1CFC and
 * is defined inside that function in ovl_11_func_800D1CFC.c. That translation
 * unit emits the comparator immediately before its parent, as the original
 * did, so this file deliberately defines nothing: a second definition would
 * emit the comparator twice and shift every later function in the overlay.
 *
 * The nested definition also produces the entry `sw $v0,0($sp)` naturally --
 * it is GCC storing the incoming static chain into the nested function's
 * frame -- so no register-capture construct is needed for it.
 */
