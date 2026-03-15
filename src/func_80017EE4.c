#include "common.h"

__asm__(
"\n.set\tnoreorder\n"
".globl\tfunc_80017EE4\n"
".ent\tfunc_80017EE4\n"
"func_80017EE4:\n"
"\tj\tfunc_80017EF0\n"
"\tori\t$a3,$zero,0xFFFF\n"
".end\tfunc_80017EE4\n"
".set\treorder"
);
