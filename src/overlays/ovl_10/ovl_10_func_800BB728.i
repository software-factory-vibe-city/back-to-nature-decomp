# 0 "src/overlays/ovl_10/ovl_10_func_800BB728.c"
# 0 "<built-in>"
# 0 "<command-line>"
# 1 "/usr/mips-linux-gnu/include/stdc-predef.h" 1 3
# 0 "<command-line>" 2
# 1 "src/overlays/ovl_10/ovl_10_func_800BB728.c"
# 1 "include/common.h" 1



# 1 "include/include_asm.h" 1
# 29 "include/include_asm.h"
__asm__(".include \"include/labels.inc\"\n");
# 5 "include/common.h" 2

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
# 43 "include/common.h"
# 1 "include/globals.h" 1





# 1 "include/globals_override.h" 1
# 22 "include/globals_override.h"
typedef struct {
    short left;
    short right;
} SpuVolumeO;
typedef struct {
    SpuVolumeO volume;
    long reverb;
    long mix;
} SpuExtAttrO;
typedef struct {
    unsigned long mask;
    SpuVolumeO mvol;
    SpuVolumeO mvolmode;
    SpuVolumeO mvolx;
    SpuExtAttrO cd;
    SpuExtAttrO ext;
} SpuCommonAttrO;


struct GfxObj;



typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
    s32 unk10;
    s32 unk14;
    s32 unk18;
    s32 unk1C;
    s32 unk20;
    s32 unk24;
    s32 unk28;
} struct_8006C7B8;
extern struct_8006C7B8 _D_8006C7B8[1] __asm__("D_8006C7B8");



struct struct_80061DE8 {
    s32 field_00;
    s32 field_04;
    s32 field_08;
    s32 field_0C;
    s32 field_10;
    s32 field_14;
    s32 field_18;
    s32 field_1C;
};




extern struct GfxObj *D_8005E3A8;
extern struct GfxObj *D_8005E3AC;




struct struct_8006C838 {
    char data[0x3C];
};
extern struct struct_8006C838 D_8006C838[];




struct struct_8006C838_flags {
    char pad_000[0x38];
    u32 flags[0x800];
};



struct struct_8006C838_view {
    char pad_000[0x0C];
    s32 field_0C;
    char pad_010[0xBC];
    u8 field_CC;
};




extern s16 D_8005F0A8[10];



extern s16 D_80055988[5];



extern u16 D_80049044[6];




typedef struct {
    char name[0x24];
    u32 loc;
} CDLocTableEntry;

extern CDLocTableEntry D_80048B1C[];





extern s32 D_80048B40[4];



extern u16 D_80049050[5];


extern s32 D_8005E43C;
# 177 "include/globals_override.h"
typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
} BoundsStruct_8001E878;
extern s32 D_8005E500;
extern s32 D_8005E504;
extern s32 D_8005E508;
extern s32 D_8005E50C;
extern s32 D_8005E510;
extern s32 D_8005E514;
extern BoundsStruct_8001E878 *D_8005E518;
extern s32 D_8005E51C;
extern s32 D_8005E528;



extern s32 D_8005E540;
extern s32 D_8005E54C;
extern s32 D_8005E550;
extern s32 D_8005E554;
extern s32 D_8005E560;


extern s16 D_8005E44C;


extern s16 D_8005E47A;


extern u16 D_8005E444;






extern s8 D_8005E2ED;


extern u16 *D_8005E4A8;



extern u8 D_8005E025[9];



extern s32 D_8005F0C8[4096];





extern s32 D_80055994[3];
extern s32 D_800559BC[3];
extern s32 D_800559C4[3];




typedef struct {
    char pad[0x36];
    u8 field_36;
    u8 field_37;
} struct_8005E870;
extern struct_8005E870 _D_8005E870[1] __asm__("D_8005E870");




typedef struct {
    char pad[4];
    s32 field_04;
    s32 field_08;
    s32 field_0C;
    s32 field_10;
    s32 field_14;
} struct_80061F08;
extern struct_80061F08 _D_80061F08[1] __asm__("D_80061F08");



extern s32 _D_8004B1A4[3] __asm__("D_8004B1A4");

extern s32 _D_80049B1C[3] __asm__("D_80049B1C");

extern s32 _D_8004AFBC[3] __asm__("D_8004AFBC");

extern s32 _D_8004B044[3] __asm__("D_8004B044");

extern s32 _D_80054BC8[3] __asm__("D_80054BC8");

extern char D_8004ED04[0x124C];





extern s32 _D_8006C088[6][1] __asm__("D_8006C088");

extern s32 _D_8006C0A8[6][1] __asm__("D_8006C0A8");




typedef struct {
                char pad_0[0x2];
                u16 field_2;
                char pad_4[0xD8 - 0x4];
                s32 field_D8;
                s32 field_DC;
                s32 field_E0;
                s32 field_E4;
                char pad_E8[0x4];
                s32 field_EC;
                s32 field_F0;
                s32 field_F4;
                s32 field_F8;
                char pad_FC[0x14];
                s32 field_110;
                char pad_114[0x4];
                s32 field_118;
                char pad_11C[0x4];
                s32 field_120;
                s32 field_124;
                s32 field_128;
                s32 field_12C;
} struct_8005E3C0;
extern struct_8005E3C0 *D_8005E3C0;
# 316 "include/globals_override.h"
extern u16 _D_800A0708[0x10] __asm__("D_800A0708");




extern s32 *D_8005E3B4;


extern u16 D_8005E438;


extern s32 D_8005E5B4;
extern s32 D_8005E5CC;
# 338 "include/globals_override.h"
extern s32 D_80010098;
extern s32 D_8001009C;
extern s32 D_8005E328;





extern char D_80010078[];
extern char D_80010088[];




extern s32 _D_800100A0[3] __asm__("D_800100A0");







extern u8 _D_8005E9C8[2][0x22] __asm__("D_8005E9C8");






extern u8 D_8005EA18[2][8];



typedef struct PadPortPair {
    s8 port0;
    s8 port1;
} PadPortPair;
extern PadPortPair D_8005E2AC[];


extern u8 D_80048B14[];



extern s32 D_80049370[3];




extern s16 D_800495CC[78 * 7];




extern s32 D_80049A70[4];



extern s32 D_8005E2A4[2];



extern s16 D_8005E3E8[2];
# 410 "include/globals_override.h"
typedef struct {
    char pad_0[0x17];
               u8 unk17;
               u8 unk18;
    char pad_19[0x130 - 0x19];
    void *field_130;
} env_struct_0x134;

extern env_struct_0x134 D_8005E5E8[2];






extern env_struct_0x134 D_8005E644[];
extern s32 D_8005E3A4;






typedef struct {
    char pad[0x18];
} packet_0x18;
typedef struct {
    char pad[0x0C];
} packet_0x0C;
extern packet_0x18 D_8005E8E0[];
extern packet_0x0C D_8005E910[];





extern packet_0x18 D_8005E930[];
extern packet_0x0C D_8005E960[];



extern s32 _D_8005E5D8[3] __asm__("D_8005E5D8");





extern u16 _D_80049A80[6] __asm__("D_80049A80");



extern s32 D_8005E330;



extern s16 D_80055974[5];


extern s16 D_8005E324;


extern s16 D_8005E580;


extern s32 D_8005E584;


extern s32 D_8005E588;


extern s32 D_8005E58C;


extern s32 D_8005E594;


extern s32 D_8005E538;


extern s32 D_8005E53C;


extern s32 D_8005E558;


extern s32 D_8005E55C;



extern SpuCommonAttrO _D_8006C368[1] __asm__("D_8006C368");







extern u8 D_8005EE28[0x200];
# 517 "include/globals_override.h"
extern u16 D_8005F0F8[6];



typedef s32 (*FuncPtr_80049078)(s32);
extern FuncPtr_80049078 _D_80049078[3] __asm__("D_80049078");
# 532 "include/globals_override.h"
extern u16 D_80049084[5];



extern s32 _D_80061EC8[3] __asm__("D_80061EC8");





extern s16 _D_80061EA8[12] __asm__("D_80061EA8");




typedef void (*InitFunc)(void);
extern InitFunc D_80010000[3];
# 557 "include/globals_override.h"
extern u32 D_8005F2E8[0x40];
# 566 "include/globals_override.h"
extern u32 D_8005F2B8[0xC];



extern u32 D_800605F0[0x10];




extern s32 _D_80049268[3] __asm__("D_80049268");

extern s32 _D_80049274[3] __asm__("D_80049274");

extern s32 _D_80049280[3] __asm__("D_80049280");





typedef struct {
    s16 f0;
    s16 f2;
    s16 f4;
} Coord3;
extern Coord3 *_D_80061EF8[3] __asm__("D_80061EF8");






extern struct_8006C7B8 _D_8005E850[1] __asm__("D_8005E850");






extern s32 D_80054BC0[3];






extern s32 D_80054BBC[4];







extern s32 D_8005175C[4];
extern s32 D_80051768;






typedef struct {
               u16 field_0;
               u16 field_2;
               u16 field_4;
               u16 field_6;
               u16 field_8;
               u16 field_A;
               u16 field_C;
               u16 field_E;
               u16 field_10;
               u16 field_12;
               u16 field_14;
               u16 field_16;
               u16 field_18;
               u16 field_1A;
               u16 field_1C;
               u16 field_1E;
} struct_80061E28;
extern struct_80061E28 D_80061E28;







extern u16 D_80049068[];
extern u16 D_80049070[];




extern u16 D_800558A4[80];




extern u16 D_80055944[24];





extern s32 D_800B8500;






typedef struct {
               s32 field_0;
               s32 field_4;
} struct_800B8508;
extern struct_800B8508 D_800B8508[];
# 7 "include/globals.h" 2




extern u16 D_8005E2BA;
extern u8 D_8005E2DD;
extern u8 D_8005E2DE;
extern u8 D_8005E2E1;
extern u8 D_8005E2E2;
extern s8 D_8005E2EE;
extern s16 D_8005E33A;
extern u16 D_8005E34E;
extern u16 D_8005E356;
extern s16 D_8005E3CE;
extern u16 D_8005E446;
extern u16 D_8005E44E;
extern s16 D_8005E47E;
extern u16 D_8005E482;
extern u16 D_8005E49A;
extern s16 D_8005E49E;
extern s16 D_8005E4A2;
extern s16 D_8005E566;
extern s16 D_8005E56A;
extern s16 D_8005E56E;
extern s16 D_8005E572;
extern u8 D_8005E5D1;
extern s32 D_8005E980;
extern s32 D_8005E9B0;
extern s32 D_8005EA28;
extern s32 D_80061E0E;
extern s32 D_80061E14;
extern s32 D_80061E48;
extern s32 D_80061E68;
extern s32 D_80061E88;
extern s32 D_80061F28;




extern s32 _D_7FFFFFE8[3] __asm__("D_7FFFFFE8");

extern s32 _D_80000004[3] __asm__("D_80000004");

extern s32 _D_80011324[3] __asm__("D_80011324");

extern s32 _D_80011334[3] __asm__("D_80011334");

extern s32 _D_80049296[3] __asm__("D_80049296");

extern s32 _D_800537B2[3] __asm__("D_800537B2");

extern s32 _D_8005392E[3] __asm__("D_8005392E");

extern s32 _D_8005393A[3] __asm__("D_8005393A");

extern s32 _D_80053946[3] __asm__("D_80053946");

extern s32 _D_80061E04[3] __asm__("D_80061E04");

extern u16 _D_80061E08[5] __asm__("D_80061E08");

extern s32 _D_80061ED8[3] __asm__("D_80061ED8");

extern s32 _D_80061F0C[3] __asm__("D_80061F0C");

extern s32 _D_80061F1C[3] __asm__("D_80061F1C");

extern s32 _D_8006BF28[3] __asm__("D_8006BF28");

extern s32 _D_8006BF48[3] __asm__("D_8006BF48");

extern s32 _D_8006BF68[3] __asm__("D_8006BF68");

extern s32 _D_8006BF88[3] __asm__("D_8006BF88");

extern s32 _D_8006BFA8[3] __asm__("D_8006BFA8");

extern s32 _D_8006BFC8[3] __asm__("D_8006BFC8");

extern s32 _D_8006BFE8[3] __asm__("D_8006BFE8");

extern s32 _D_8006C008[3] __asm__("D_8006C008");

extern s32 _D_8006C028[3] __asm__("D_8006C028");

extern s32 _D_8006C048[3] __asm__("D_8006C048");

extern s32 _D_8006C068[3] __asm__("D_8006C068");

extern s32 _D_8006C0C8[3] __asm__("D_8006C0C8");

extern s32 _D_8006C128[3] __asm__("D_8006C128");

extern s32 _D_8006C188[3] __asm__("D_8006C188");

extern s32 _D_8006C398[3] __asm__("D_8006C398");

extern s32 _D_8006C7D8[3] __asm__("D_8006C7D8");

extern s32 _D_8006C844[3] __asm__("D_8006C844");

extern s32 _D_8006C84C[3] __asm__("D_8006C84C");

extern s8 _D_8006C904[9] __asm__("D_8006C904");

extern s8 _D_8006C905[9] __asm__("D_8006C905");

extern s32 _D_8006C910[3] __asm__("D_8006C910");

extern s32 _D_80070CC0[3] __asm__("D_80070CC0");

extern s32 _D_80070CC4[3] __asm__("D_80070CC4");

extern s32 _D_80070D18[3] __asm__("D_80070D18");

extern u16 _D_80070D38[5] __asm__("D_80070D38");

extern u16 _D_80070D3A[5] __asm__("D_80070D3A");

extern u16 _D_80070D3E[5] __asm__("D_80070D3E");

extern u16 _D_80070D40[5] __asm__("D_80070D40");

extern s32 _D_80070EC2[3] __asm__("D_80070EC2");

extern u16 _D_800712C0[5] __asm__("D_800712C0");

extern s32 _D_80071A00[3] __asm__("D_80071A00");

extern s32 _D_80071A84[3] __asm__("D_80071A84");

extern s32 _D_80071A90[3] __asm__("D_80071A90");

extern s32 _D_800742EC[3] __asm__("D_800742EC");

extern s32 _D_800749F4[3] __asm__("D_800749F4");

extern s32 _D_800749F8[3] __asm__("D_800749F8");

extern s32 _D_800759E8[3] __asm__("D_800759E8");

extern s32 _D_80075AD8[3] __asm__("D_80075AD8");

extern s16 _D_8007AD4C[5] __asm__("D_8007AD4C");

extern s32 _D_8007AD4E[3] __asm__("D_8007AD4E");

extern s32 _D_8007AD50[3] __asm__("D_8007AD50");

extern s32 _D_8007AD52[3] __asm__("D_8007AD52");

extern s32 _D_8007AD54[3] __asm__("D_8007AD54");

extern s32 _D_8007AD56[3] __asm__("D_8007AD56");

extern s32 _D_8007AD58[3] __asm__("D_8007AD58");

extern s32 _D_8007AFBC[3] __asm__("D_8007AFBC");

extern s32 _D_8007AFF0[3] __asm__("D_8007AFF0");

extern s32 _D_8007AFF4[3] __asm__("D_8007AFF4");

extern s32 _D_800977F8[3] __asm__("D_800977F8");

extern s32 _D_800A06D8[3] __asm__("D_800A06D8");

extern s32 _D_800A0728[3] __asm__("D_800A0728");

extern s16 _D_800A3FB0[5] __asm__("D_800A3FB0");

extern s16 _D_800A3FB4[5] __asm__("D_800A3FB4");

extern s32 _D_800B7E20[3] __asm__("D_800B7E20");

extern s32 _D_800B7E24[3] __asm__("D_800B7E24");

extern s32 _D_800B7E38[3] __asm__("D_800B7E38");

extern s32 _D_800B7E3C[3] __asm__("D_800B7E3C");

extern s32 _D_800B7EA4[3] __asm__("D_800B7EA4");

extern s32 _D_800B7EB4[3] __asm__("D_800B7EB4");

extern s32 _D_800B7ED8[3] __asm__("D_800B7ED8");

extern s32 _D_800B7EEC[3] __asm__("D_800B7EEC");

extern s32 _D_800B7FCC[3] __asm__("D_800B7FCC");

extern s32 _D_800B8014[3] __asm__("D_800B8014");

extern s32 _D_800B889C[3] __asm__("D_800B889C");

extern s32 _D_800BBC34[3] __asm__("D_800BBC34");

extern s32 _D_8012E2CC[3] __asm__("D_8012E2CC");

extern s32 _D_8012E520[3] __asm__("D_8012E520");

extern s32 _D_8012E7C8[3] __asm__("D_8012E7C8");

extern s32 _D_8012F084[3] __asm__("D_8012F084");
# 44 "include/common.h" 2
# 2 "src/overlays/ovl_10/ovl_10_func_800BB728.c" 2

s32 ovl_10_func_800BB728(s32 arg0) {
    s32 var_v0 = 0;
    s32 q;

    if (arg0 < 0x51) {
        if (((arg0 / 40) * 0x28) != (arg0 - 1)) {
            var_v0 = 0;
            goto ret;
        }
        goto block_4;
    }
    arg0 -= 0x50;
    var_v0 = 0;
    q = arg0 / 15;
    arg0 -= 1;
    if ((q * 0xF) == arg0) {
block_4:
        var_v0 = 1;
    }
ret:
    return var_v0;
}
