# ovl_11_func_800F8B4C — resolved

Resolved with the user's explicit matching-policy exceptions: four inline
address/call-setup instructions and five local bindings (four distinct
registers) give 52/52 byte-exact words. SDK/game calls and signed division
remain in C; baseline flags and independently corroborated prototypes are
unchanged. Full finalization passed. These are matching workarounds, not
original-source evidence. Historical report follows.

- **Parked:** 2026-10-06T16:12:16.145Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800F8B4C.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program ([0, 1, 2, 5] at 40/49 words, measured 2026-10-06T15:51:02, first scored from build/experiments/ovl_11_func_800F8B4C/cand2.c) rather than the source left on disk, which was never measured

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800F8B4C verdict MISMATCH — 40/52 words (76.9%).
Residual (steer by this, not the word count): control-flow 0, population 1, schedule 2, allocation 5.
The two programs do not contain the same instructions, so no allocation or scheduling reading applies yet — fix the semantics first.
Next block: 0 (0x800F8B4C) — population 1, schedule 2, allocation 4. the instruction populations differ here; nothing below can be read until they agree

This block's residual shape `move <reg>,<reg>@0|sw <reg>,20(<reg>)@-3` is not new.
It was closed in ovl_11_func_800DBD78, which carried it at [0, 8, 2, 8] (23/36 words). The edit that closed it:

  ...
  
  s16 *ovl_11_func_800DBD78(s32 arg0, s32 arg1, s32 arg2) {
-     s16 *p = (s16 *)D_8006C838;
      s16 *var_a0;
      s16 *var_v0;
      s32 var_a2;
      s32 var_v1;
-     s32 var_v1_2;
      void *var_a1;
  
  ...
          var_v1 = 0;
          if (var_a2 != 0) {
+             s16 var_a3 = -1;
+             s16 *p = (s16 *)D_8006C838;
              var_a1 = (void *) (p + 0x3D3D);
              var_a0 = (s16 *) (p + 0x3D3C);
  loop_6:
              var_v1 += 1;
-             if (*var_a0 == -1) {
+             if (*var_a0 == var_a3) {
                  *var_a0 = 0;
-                 var_v1_2 = 4;
+                 var_v1 = 4;
                  var_v0 = (s16 *) ((u8 *) var_a1 + 8);
                  do {
                      *var_v0 = 0;
-                     var_v1_2 -= 1;
+                     var_v1 -= 1;
                      var_v0 -= 1;
-                 } while (var_v1_2 >= 0);
+                 } while (var_v1 >= 0);
                  return var_a0;
              }

That is a proven answer for this shape in this codebase. Try it before modelling the compiler.
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.
```

## Preserved attempt

```c
#include "common.h"

extern s16 D_80126E4A;
extern s16 D_80129FD8[12];
extern u8 D_80051BF0[];

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_11_func_800F8B4C(s32 arg0, s32 arg1) {
    s32 var_a0;

    *(u16 *)func_8001A970(D_80126E4A + 1, &D_80129FD8[0], 1) = 0xFFFF;
    func_80017B3C(arg0, (s32) &D_80129FD8[0], 0x28, 0x6E);
    func_80017B3C(arg0, (s32) ((u8 *) D_80051BF0 + D_80054BBC[0]), 0x35, 0x6E);
    var_a0 = arg1 >> 3;
    if (arg1 < 0) {
        arg1 += 7;
        var_a0 = arg1 >> 3;
    }
    *(u16 *)func_8001A970(var_a0, &D_80129FD8[0], 1) = 0xFFFF;
    func_80017B3C(arg0, (s32) &D_80129FD8[0], 0x42, 0x6E);
}
```
