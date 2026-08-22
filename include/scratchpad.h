#ifndef SCRATCHPAD_H
#define SCRATCHPAD_H

/* libetc.h uses u_long without declaring it — it expects the includer to have
   pulled in the SDK's type header first, which every translation unit that
   reaches it through an SDK header already has. Naming that dependency here
   keeps this header usable from a translation unit that includes nothing else. */
#include "psyq/stddef.h"
#include "psyq/libetc.h"

/*
 * Scratch-pad stack switch — reconstruction of a studio macro left in the
 * retail binary.
 *
 * The R3000A's 1 KB data cache is not wired up as a cache on this console. It
 * is exposed as directly addressed memory at 0x1F800000–0x1F8003FF — Sony's
 * headers call it the scratch pad and reach it with getScratchAddr() — and the
 * consequence is that main RAM has no data cache at all. Every access to a
 * stack frame in main RAM is a bus cycle contended with the GPU, the SPU and
 * CD DMA; the scratch pad is on-die, single-cycle, and contends with nothing.
 *
 * Pointing $sp at it moves a whole call subtree's frames, spill slots, saved
 * registers and stack arguments into that fast memory without changing a line
 * of any callee. That is the appeal: a whole-subtree optimisation applied from
 * the outside.
 *
 * Confirmed retail sites (see notes/research/scratchpad-stack-switch.md):
 *   func_8001C0D4 — the whole body, around func_8001C1C0
 *   func_8001BFEC — around func_8001D6B8, and per element around func_8001C37C
 *
 * The caller's $sp is parked in the last word of the pad and the new stack
 * starts immediately below it:
 *
 *     getScratchAddr(255) = 0x1F8003FC   saved $sp
 *                           0x1F8003F8   new $sp, growing down — 1016 bytes
 *
 * BEGIN/END rather than PUSH/POP, because push and pop would promise nesting
 * and this does not nest: the save slot is one fixed address, so an inner
 * switch overwrites the outer save. The retail sites never nest, and the
 * deepest frame that runs on the pad is 0x40 bytes against the 1016 available
 * — someone measured it.
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
 *   assigned SCRATCH_STACK_SLOT, so its lui/ori lands where the target's does;
 * - every SCRATCH_STACK_BEGIN must be balanced by a SCRATCH_STACK_END on every
 *   path out, including early returns;
 * - do not nest, and do not call anything between the two that switches on its
 *   own.
 */

/* The last word of the pad: 1 KB is 256 words, so index 255. */
#define SCRATCH_STACK_SLOT getScratchAddr(255)

#define SCRATCH_STACK_BEGIN(slot) \
    __asm__ volatile("addu $8,%0,$0" : : "r"(slot) : "$8"); \
    __asm__ volatile("sw $sp,0($8)"); \
    __asm__ volatile("addiu $8,$8,-4"); \
    __asm__ volatile("addu $sp,$8,$0")

#define SCRATCH_STACK_END() \
    __asm__ volatile("addiu $sp,$sp,4"); \
    __asm__ volatile("lw $sp,0($sp)")

#endif
