#ifndef COMMON_H
#define COMMON_H

#include "include_asm.h"

typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;

typedef signed char s8;
typedef signed short s16;
typedef signed int s32;

typedef volatile unsigned char vu8;
typedef volatile unsigned short vu16;
typedef volatile unsigned int vu32;

typedef volatile signed char vs8;
typedef volatile signed short vs16;
typedef volatile signed int vs32;

/* MIPS break instruction — code n encoded as n*1024 for maspsx compatibility */
#define BREAK(n) __asm__ volatile("break %0" :: "n"((n) * 1024))
#define M2C_BREAK(n) BREAK(n)

/* Declares `name` as a variable bound to hard register $v0, capturing the
 * return value of the most recent function call at the point of first use.
 * POLICY EXCEPTION (user-approved 2026-07-31): reproduces a register-capture
 * idiom present in the original source; the captured value is dead in all
 * known retail uses (compiled-out instrumentation). Only use where the
 * target's bytes prove hard-$v0 entry liveness (a caller-saved register read
 * before its first definition); see
 * notes/research/func_8001E878-dead-spill-allocation.md §9.
 * Use this SAME macro at either scope; placement selects the recipe:
 * block top -> dead spill (func_8001E878); file scope before the function
 * -> save/forward (func_8001E9F8), whose stores survive and whose $v0 stays
 * reserved for the rest of the TU. The original static-chain sites are GNU
 * nested-function codegen; these declarations emulate their separate-file
 * layout, not the historical spelling. Other proven post-call captures
 * still use the block-scope form. The byte-only census and prep injector
 * are tools/diagnostics/nestedFunctionScan.ts and
 * tools/agent/staticChainInjection.ts; use no sub-form without its proof. */
#define CAPTURE_PREV_RET(name) register s32 name asm("$2")

#include "globals.h"

#endif
