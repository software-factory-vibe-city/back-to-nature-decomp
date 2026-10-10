# func_8001BBD8 — human decision needed

- **Parked:** 2026-10-10T15:39:21.638Z
- **Reason:** asm-needs-human-approval
- **Escalation reached:** deepseek-v4-1-flash
- **Source:** `src/func_8001BBD8.c` (INCLUDE_ASM restored)
- **Preserved attempt:** preserved the best measured program (EXACT at 99/99 words, measured 2026-10-10T15:35:57, first scored from build/preparation/func_8001BBD8/c6d01d3f1fc3b272a415f9ec0806157ee00fc6be19f303cf7f15e641d8ee484c/cand5.c) rather than the source left on disk, which measured EXACT at 99/99 words, measured 2026-10-10T15:37:02

## What the loop needs

The top escalation tier proposed a source construct the clean-source policy forbids,
and there is no higher agent to adjudicate it. Decide whether the construct is the
correct answer for this function. If it is, add the allowlist entry to
`.pi/autoloop.json` under `sourcePolicy.allowlist` and re-run the loop on this
target. If it is not, the function needs a different structural hypothesis.

## Policy findings

- `src/func_8001BBD8.c:14` — **embedded-asm** — Embedded assembly is forbidden for an ordinary compiled function
  `__asm__ volatile("nop; nop; rtir12")`
- `src/func_8001BBD8.c:17` — **embedded-asm** — Embedded assembly is forbidden for an ordinary compiled function
  `__asm__ volatile("nop; nop; rtv0tr")`

## Oracle report for the preserved attempt

```
Oracle: func_8001BBD8 verdict MATCH — 99/99 words (100%).
```

## Preserved attempt

```c
#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/inline_c.h"

#undef gte_rtir
#define gte_rtir() __asm__ volatile("nop; nop; rtir12")

#undef gte_rtv0tr
#define gte_rtv0tr() __asm__ volatile("nop; nop; rtv0tr")

extern MATRIX mtx_alias __asm__("D_80061E88");

void func_8001BBD8(MATRIX *arg0) {
    gte_SetRotMatrix(&mtx_alias);
    gte_ldclmv(&arg0->m[0][0]);
    gte_rtir();
    gte_stclmv(&mtx_alias.m[0][0]);
    gte_ldclmv(&arg0->m[0][1]);
    gte_rtir();
    gte_stclmv(&mtx_alias.m[0][1]);
    gte_ldclmv(&arg0->m[0][2]);
    gte_rtir();
    gte_stclmv(&mtx_alias.m[0][2]);
    gte_SetTransMatrix(&mtx_alias);
    gte_ldlv0(&arg0->t[0]);
    gte_rtv0tr();
    gte_stlvl(&mtx_alias.t[0]);
    gte_SetRotMatrix(&mtx_alias);
    gte_SetTransMatrix(&mtx_alias);
}
```
