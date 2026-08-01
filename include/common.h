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
 * Known users: func_8001E878 (matched, this block-scope form). The idiom
 * also has a stronger file-scope form — `register s32 name asm("$2");` as a
 * GLOBAL register variable (func_8001E9F8, matched): stores to it are never
 * deleted and $v0 stays reserved for the rest of the TU, which the
 * block-scope form does not provide. Pick by fingerprint: dead capture only
 * -> this macro; surviving $v0 re-installs / $v0 absent from scratch
 * allocation -> the file-scope form. */
#define CAPTURE_PREV_RET(name) register s32 name asm("$2")

#include "globals.h"

#endif
