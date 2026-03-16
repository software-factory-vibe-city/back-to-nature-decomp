/* Shared type definitions for the game */
#ifndef GAME_TYPES_H
#define GAME_TYPES_H

#include "common.h"

/* Shared struct for functions that access void* with offset 0x14 and 0x18 */
typedef struct {
    /* 0x00 */ s32 field_0x0;
    /* 0x04 */ s32 field_0x4;
    /* 0x08 */ s32 field_0x8;
    /* 0x0C */ s32 field_0xC;
    /* 0x10 */ s32 field_0x10;
    /* 0x14 */ s32 field_0x14;
    /* 0x18 */ s32 field_0x18;
    /* 0x1C */ s32 field_0x1C;
} SomeStruct;

/* Simple 3-element vector (used for position, rotation, etc.) */
typedef struct {
    s32 x;
    s32 y;
    s32 z;
} Vec3;

#endif /* GAME_TYPES_H */
