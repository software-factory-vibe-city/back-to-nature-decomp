# ovl_11_func_800DB9A4 — human decision needed

- **Parked:** 2026-10-08T01:10:32.751Z
- **Reason:** escalation-exhausted
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/overlays/ovl_11/ovl_11_func_800DB9A4.c` (INCLUDE_ASM restored)
- **Preserved attempt:** the source on disk is the best measured program ([0, 0, 1, 0] at 66/66 words, measured 2026-10-08T00:54:57)

## What the loop needs

Every tier on the escalation ladder returned without a byte-exact match. The function
needs either a new structural hypothesis or a policy decision that the ladder cannot
make on its own. The preserved attempt and the oracle report below are the starting
point.

## Policy findings

- none recorded

## Oracle report for the preserved attempt

```
Oracle: ovl_11_func_800DB9A4 verdict MISMATCH — 66/67 words (98.5%).
Residual (steer by this, not the word count): control-flow 0, population 0, schedule 1, allocation 0.
Next block: 0 (0x800DB9A4) — population 0, schedule 1, allocation 0. smallest open residual

This block's residual shape `lui <reg>,0x8007@-3` is not new.
It was closed in ovl_11_func_800EF870, which carried it at [0, 4, 1, 7] (4/14 words). The edit that closed it:

  #include "common.h"
+ #include "game_types.h"
  
- /* Experiment: three pointer locals, each independently recomputed from the
-  * base (not forwarded copies). q and r are separate pseudos -> CSE must
-  * decide whether to merge them into p. */
  void ovl_11_func_800EF870(s16 arg0) {
-     char *p;
-     char *q;
-     char *r;
+     Ovl11RecordE4D8View *v;
  
-     p = (char *)&D_8006C838 + 0x8000 + arg0 * 0xC;
-     q = (char *)&D_8006C838 + 0x8000 + arg0 * 0xC;
-     r = (char *)&D_8006C838 + 0x8000 + arg0 * 0xC;
-     *(s16 *)(p + 0x64D8) = -1;
-     *(s16 *)(q + 0x64DA) = 0;
-     *(s16 *)(p + 0x64DC) = 0;
-     *(s16 *)(q + 0x64E0) = -1;
-     *(s16 *)(r + 0x64E2) = -1;
+     v = (Ovl11RecordE4D8View *)&D_8006C838;
+     v->recs[arg0][0] = -1;
+     v->recs[arg0][1] = 0;
+     v->recs[arg0][2] = 0;
+     v->recs[arg0][4] = -1;
+     v->recs[arg0][5] = -1;
  }
  

That is a proven answer for this shape in this codebase. Try it before modelling the compiler.
Also closed in ovl_11_func_800F13D8, ovl_11_func_8010C3F8.
`psx_reverse_pipeline` gives the decisions, their source levers and the mechanism sheet to load; `psx_residual_objective` with a source ranks candidate edits and records them.
```

## Preserved attempt

```c
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/memory.h"

void ovl_11_func_800DB9A4(void) {
    s32 i;
    u8 *s0;
    u8 *b1;
    u8 *p1;
    u8 *b;
    u8 *b2;
    u8 *b3;
    u8 *b4;
    s16 nv;
    u8 v1;
    u8 v2;

    memset(&D_800742AC, 0, 0x40);
    nv = -1;
    i = 4;
    s0 = (u8 *) &D_800742AC + 0x34;
    do {
        *(s16 *) s0 = nv;
        s0 -= 0xC;
        i -= 1;
    } while (i >= 0);

    b1 = (u8 *) &D_8006C838;
    (*(s32 *) (b1 + 0x30)) = 0;
    v1 = 0xFF;
    i = 0x7F;
    b1 += 0xE6BF;
    do {
        *b1 = v1;
        b1 -= 1;
        i -= 1;
    } while (i >= 0);

    v2 = 0xFF;
    for (i = 7; i >= 0; i--) {
        b2 = (u8 *) &D_8006C838;
        b2[0xE6C0 + i] = v2;
    }
    for (i = 0x7F; i >= 0; i--) {
        b3 = (u8 *) &D_8006C838;
        b3[0xE6C8 + i] = 0;
    }

    b4 = (u8 *) &D_8006C838;
    p1 = b4 + 0x8000;
    (*(s8 *) (p1 + 0x6641)) = 1;
    (*(s8 *) (p1 + 0x6646)) = 0x1E;
    (*(s8 *) (p1 + 0x664C)) = 0x1F;
    (*(s8 *) (p1 + 0x6650)) = 0;
    (*(s8 *) (p1 + 0x6655)) = 0x1C;
    (*(s8 *) (p1 + 0x6656)) = 0;
    (*(s8 *) (p1 + 0x6658)) = 0x76;
    (*(s8 *) (p1 + 0x6659)) = 0x1C;
    (*(s8 *) (p1 + 0x666C)) = 0;
}
```
