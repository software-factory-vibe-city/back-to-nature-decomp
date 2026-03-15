#include "common.h"

__asm__(
"\n.set\tnoreorder\n"
".globl\tfunc_80021D64\n"
".ent\tfunc_80021D64\n"
"func_80021D64:\n"
"\taddiu\t$sp,$sp,-16\n"
"\tjr\t$ra\n"
"\taddiu\t$sp,$sp,16\n"
".end\tfunc_80021D64\n"
".set\treorder"
);
