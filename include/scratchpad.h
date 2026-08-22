#ifndef SCRATCHPAD_H
#define SCRATCHPAD_H

/*
 * Scratchpad stack switch — reconstruction of a studio macro left in the
 * retail binary.
 *
 * The R3000A's data cache is not wired up as a cache on this console. It is
 * 1 KB of single-cycle memory at 0x1F800000, the scratchpad, and main RAM has
 * no data cache at all — so every access to a stack frame is a bus cycle
 * contended with the GPU and DMA. Pointing $sp at the scratchpad moves a whole
 * call subtree's frames, spill slots, saved registers and stack arguments into
 * fast memory without changing a line of any callee.
 *
 * Confirmed retail sites (see notes/research/scratchpad-stack-switch.md):
 *   func_8001C0D4 — the whole body, around func_8001C1C0
 *   func_8001BFEC — around func_8001D6B8, and per element around func_8001C37C
 *
 * The caller's $sp is parked in the top word of the scratchpad and the new
 * stack starts immediately below it:
 *
 *     0x1F8003FC  saved $sp
 *     0x1F8003F8  new $sp, growing down to 0x1F800000 — 1016 bytes
 *
 * Non-reentrant by construction: the save slot is a fixed address, so a nested
 * switch would overwrite the outer save. The retail sites never nest, and the
 * deepest frame that runs on it is 0x40 bytes.
 *
 * The asm owns only what C cannot express. No C construct writes $sp, and
 * PSY-Q offers no call, builtin or flag that does — which is why this is
 * classified by sourcePolicy.allowStackPointerSwitch rather than allowlisted
 * per function. The SLOT ADDRESS is deliberately a parameter rather than a
 * literal inside the template: the compiler materialises it (lui/ori) at the
 * call site and hoists it out of a loop when it can, which is what the retail
 * code shows — func_8001BFEC carries it in $s1 across its element loop while
 * func_8001C0D4 forms it in $v0 once. A literal in the template could not be
 * hoisted and the loop would re-form it every iteration.
 *
 * Keep the instructions in separate asm statements. GCC represents each
 * statement as one RTL instruction even when a template holds several machine
 * instructions, so combining them changes local-allocation lifetime
 * boundaries; the same rule applies here as to CAPTURE_RA.
 *
 * Usage contract for byte-matching:
 * - pass the slot as an expression the compiler materialises, e.g. a local
 *   assigned SCRATCHPAD_SP_SLOT, so its lui/ori lands where the target's does;
 * - every SP_TO_SCRATCH must be balanced by an SP_FROM_SCRATCH on every path
 *   out, including early returns;
 * - do not nest, and do not call anything between the switch and the restore
 *   that switches on its own.
 */

#define SCRATCHPAD_SP_SLOT ((unsigned int *)0x1F8003FC)

#define SP_TO_SCRATCH(slot) \
    __asm__ volatile("addu $8,%0,$0" : : "r"(slot) : "$8"); \
    __asm__ volatile("sw $sp,0($8)"); \
    __asm__ volatile("addiu $8,$8,-4"); \
    __asm__ volatile("addu $sp,$8,$0")

#define SP_FROM_SCRATCH() \
    __asm__ volatile("addiu $sp,$sp,4"); \
    __asm__ volatile("lw $sp,0($sp)")

#endif
