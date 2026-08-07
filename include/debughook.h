#ifndef DEBUGHOOK_H
#define DEBUGHOOK_H

/*
 * Caller-capture debug hook — reconstruction of a studio diagnostic
 * macro left in the retail binary.
 *
 * Stores the live return address ($31) through dst. Confirmed retail
 * sites (see notes/research/caller-capture-debug-hook.md):
 *   func_80016054 — dst = &D_8006C84C (global caller log, s32[3])
 *   func_80015704 — dst = stack local (FntPrint diagnostics)
 *
 * The asm owns only what C cannot express: the store of live $ra plus
 * the hardcoded $8 scratch copy (the author's GCC-manual hygiene of not
 * writing through an input). The ADDRESS is deliberately left to the
 * compiler: dst's materialization (lui/addiu for globals, addiu $sp for
 * locals) is a multi-set web that GCC 2.95.2's scheduler priority boost
 * skips, so it lands naturally among the boosted argument loads. Moving
 * those instructions into the asm pins them early and breaks matching.
 *
 * Keep the copy and store in separate asm statements. GCC represents each
 * statement as one RTL instruction even when a template contains multiple
 * machine instructions; combining them changes local-allocation lifetime
 * boundaries at the stack-local capture site.
 *
 * Usage contract for byte-matching:
 * - invoke before the first function call (jal clobbers $31);
 * - pass the destination expression directly, e.g.
 *   CAPTURE_RA(&D_8006C84C) — the address materialization follows the
 *   invocation's source position (insn LUIDs), so keep the invocation
 *   near the top of the function, after any statement whose
 *   instruction precedes the hook cluster in the target (e.g. an
 *   in-place parameter mask). Argument loads hoist above the asm on
 *   their own; no staging locals are needed;
 * - functions using this macro need an "embedded-asm" entry in the
 *   .pi/autodecomp.json sourcePolicy allowlist.
 */
#define CAPTURE_RA(dst) \
    __asm__ volatile("addu $8,%0,$0" : : "r"(dst) : "$8"); \
    __asm__ volatile("sw $31,0($8)")

#endif
