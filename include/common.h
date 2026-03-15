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

/* MIPS break instruction — code goes in upper 10 bits of the 20-bit field */
#define BREAK(n) __asm__ volatile("break " #n ", 0")
#define M2C_BREAK(n) BREAK(n)

#include "globals.h"

#endif
