#include "common.h"
#include "game_types.h"

/* Returns an indexed s16 out of a 0x60-byte record passed by value. The
 * callee spills the register-borne first 16 bytes to sp+0..0xC and reads the
 * selector at 0x5C and the s16 table base at 0x28 straight off the stack. */
s16 ovl_11_func_8011D98C(StructD548 x) {
    return x.data[x.index];
}
