#include "common.h"

typedef struct { char pad[0x18]; s32 field_18; s32 field_1C; } Struct_13AA4;
  extern Struct_13AA4 *D_8005E3A8[3];
  extern Struct_13AA4 *D_8005E3AC[3];

  void func_80013AA4(s32 arg0, s32 arg1) {
      Struct_13AA4 *v0 = D_8005E3AC[0];
      Struct_13AA4 *v1 = D_8005E3A8[0];
      v0->field_18 = arg0;
      v1->field_18 = arg0;
      v0->field_1C = arg1;
      v1->field_1C = arg1;
  }