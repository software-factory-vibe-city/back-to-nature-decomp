# func_8001BFEC — human decision needed

- **Parked:** 2026-08-22T08:04:22.637Z
- **Reason:** asm-needs-human-approval
- **Escalation reached:** deepseek-v4-flash
- **Source:** `src/func_8001BFEC.c` (INCLUDE_ASM restored)

## What the loop needs

The top escalation tier proposed a source construct the clean-source policy forbids,
and there is no higher agent to adjudicate it. Decide whether the construct is the
correct answer for this function. If it is, add the allowlist entry to
`.pi/autodecomp.json` under `sourcePolicy.allowlist` and re-run the loop on this
target. If it is not, the function needs a different structural hypothesis.

## Policy findings

- `src/func_8001BFEC.c:7` — **embedded-asm** — Embedded assembly is forbidden for an ordinary compiled function
  `__asm__ volatile(                                                    \`
- `src/func_8001BFEC.c:15` — **embedded-asm** — Embedded assembly is forbidden for an ordinary compiled function
  `__asm__ volatile(                                                    \`
- `src/func_8001BFEC.c:20` — **register-asm** — Hard-register pinning is forbidden
  `register s32 i asm("$16");`
- `src/func_8001BFEC.c:21` — **register-asm** — Hard-register pinning is forbidden
  `register s32 r_off asm("$18");`
- `src/func_8001BFEC.c:22` — **register-asm** — Hard-register pinning is forbidden
  `register unsigned int *slot asm("$17");`
- `src/func_8001BFEC.c:7` — **embedded-asm** — Embedded assembly is forbidden for an ordinary compiled function
  `__asm__ volatile(                                                    \`
- `src/func_8001BFEC.c:15` — **embedded-asm** — Embedded assembly is forbidden for an ordinary compiled function
  `__asm__ volatile(                                                    \`
- `src/func_8001BFEC.c:20` — **register-asm** — Hard-register pinning is forbidden
  `register s32 i asm("$16");`
- `src/func_8001BFEC.c:21` — **register-asm** — Hard-register pinning is forbidden
  `register s32 r_off asm("$18");`
- `src/func_8001BFEC.c:22` — **register-asm** — Hard-register pinning is forbidden
  `register unsigned int *slot asm("$17");`

## Last oracle report

```
top tier proposed a forbidden construct with no higher tier to adjudicate it
```

## Preserved attempt

```c
#include "common.h"

s32 D_8005E2D4;
void *D_8005E4D8;

#define PUSH_SCRATCH(slot)                                               \
    __asm__ volatile(                                                    \
        "addu $8,%0,$0" "\n\t"                                           \
        "sw $sp,0($8)" "\n\t"                                            \
        "addiu $8,$8,-4" "\n\t"                                          \
        "addu $sp,$8,$0"                                                 \
        : : "r"(slot) : "$8", "$sp")

#define POP_SCRATCH()                                                    \
    __asm__ volatile(                                                    \
        "addiu $sp,$sp,4" "\n\t"                                         \
        "lw $sp,0($sp)" : : : "$sp")

void func_8001BFEC(void **arg0) {
    register s32 i asm("$16");
    register s32 r_off asm("$18");
    register unsigned int *slot asm("$17");
    unsigned int *slot0;

    D_8005E4D8 = *arg0;
    PushMatrix();
    if (D_8005E2D4 != 0) {
        slot0 = (unsigned int *)0x1F8003FC;
        PUSH_SCRATCH(slot0);
        func_8001D6B8();
        POP_SCRATCH();
    }
    if (*(s32 *)((char *)D_8005E4D8 + 8) > 0) {
        i = 0;
        slot = (unsigned int *)0x1F8003FC;
        r_off = 0xC;
        do {
            PUSH_SCRATCH(slot);
            func_8001C37C((char *)D_8005E4D8 + 0xC, (char *)D_8005E4D8 + r_off);
            POP_SCRATCH();
            r_off += 0x1C;
        } while (++i < *(s32 *)((char *)D_8005E4D8 + 8));
    }
    PopMatrix();
}
```
