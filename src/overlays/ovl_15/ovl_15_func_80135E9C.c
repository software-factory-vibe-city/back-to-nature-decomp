#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libmcrd.h"
#include "psyq/memory.h"
#include "psyq/strings.h"
#include "psyq/libmcx.h"


int McxCardType (int);
int McxSync (int, long *, long *);
long MemCardAccept (long chan);
long MemCardExist (long chan);
long MemCardFormat (long chan);
long MemCardGetDirentry (long chan, char *name, struct DIRENTRY *dir, long *files, long ofs, long max);
long MemCardReadFile (long chan, char *file, unsigned long *adrs, long ofs, long bytes);
long MemCardSync (long mode, long *cmds, long *rslt);
long MemCardWriteFile (long chan, char *file, unsigned long *adrs, long ofs, long bytes);
int bcmp (const unsigned char *, const unsigned char *, int);
void *memmove (unsigned char *, const unsigned char *, int);
void *memset ();
char *strcat (char *, const char *);
char *strcpy ();
s32 func_80011F5C (s32 arg0);
void func_80011FD8 (s32 arg0);
u32 func_80017A64 (void);
void func_80017A48 (u32 arg0);
void func_80022580 (u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
s32 func_800212A8 (s32 soundId, s32 lo, s32 hi);
void func_800136D4 (u32 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
void func_80024A4C (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4);
void ovl_15_func_8013468C (void);
void ovl_15_func_8012EE84 (void);
s32 ovl_15_func_8012F078 (void);
s32 ovl_15_func_8012F0E8 (void);
s32 ovl_15_func_8012F86C (void);
void ovl_15_func_8012F8DC (void);
s32 ovl_15_func_8012F990 (void);
s32 ovl_15_func_8012FA00 (void);
s32 ovl_15_func_8012FA70 (void);
s32 ovl_15_func_8012FFD8 (void);
void func_8001AC10 (u32 *arg0, s32 arg1, s32 arg2);
s32 ovl_15_func_80137228 (s16 arg0, s16 arg1);
void func_800248B0 (s32 arg0, s16 arg1, s16 arg2);
s32 func_8001FABC (s16 arg0);
s32 ovl_15_func_80136558 (s16 arg0, s16 arg1);
void ovl_15_func_801359FC (void);
void ovl_15_func_80135AE0 (void);
void ovl_15_func_80137544 (char *arg0, s32 arg1);
s8 *ovl_15_func_80134770 (s16 arg0);
void ovl_15_func_801305D4 (void);
s32 ovl_15_func_801307D8 (void);
s32 ovl_15_func_80130848 (void);
s32 ovl_15_func_80130A94 (void);
s32 ovl_15_func_80130BBC (void);
void ovl_15_func_80130C2C (void);
void ovl_15_func_80130D3C (void);
s32 ovl_15_func_80130DDC (void);
s32 ovl_15_func_80130E4C (void);
s32 ovl_15_func_80130EBC (void);
s32 ovl_15_func_80135B68 (void);
void ovl_15_func_80135A78 (void);
void ovl_15_func_801315B0 (void);
s32 ovl_15_func_80131778 (void);
s32 ovl_15_func_801317E8 (void);
s32 ovl_15_func_80131A34 (void);
s32 ovl_15_func_80131B5C (void);
void ovl_15_func_80131BCC (void);
void ovl_15_func_80131CDC (void);
s32 ovl_15_func_80131D88 (void);
s32 ovl_15_func_80131DF8 (void);
s32 ovl_15_func_80131E68 (void);
void ovl_15_func_80131ED8 (void);
s32 ovl_15_func_80131F5C (void);
void ovl_15_func_8013237C (void);
void ovl_15_func_80132408 (void);
void ovl_15_func_80132494 (void);
void ovl_15_func_80132520 (void);
void ovl_15_func_801325AC (void);
s32 ovl_15_func_801328C4 (void);
void ovl_15_func_80134724 (void);
s8 *ovl_15_func_80134890 (s16 arg0, s8 *arg1, s16 arg2);
void ovl_15_func_801349C8 (s16 arg0, char *arg1);
u32 Rand (s32 arg0);
void func_80017A08 (s32 arg0, s32 arg1);
void ovl_15_func_8013703C (s16 arg0, s16 *arg1, s32 arg2);
u16 *func_8001AA7C (s32 arg0, u16 *arg1);
s16 *func_8001A970 (s32 arg0, s16 *arg1, s32 arg2);
void func_8001ABF0 (u16 *dst, u16 *src);
void func_800249C0 (s32 arg0, s16 arg1, s16 arg2);

extern u16 D_80137598;

s32 ovl_15_func_80135E9C(s16 arg0) {
    s32 sp10;
    s32 sp14;
    s32 temp_v0;
    s32 var_s3;
    s32 var_v0;

    var_s3 = 0;
    if (arg0 != 0) {
        var_s3 = 0x10;
        if (arg0 != 1) {
            return 0xC;
        }
    }
    D_80137598 += 1;
    temp_v0 = MemCardSync(1, &sp10, &sp14);
    if (temp_v0 == 0) {
        return 3;
    }
    if (temp_v0 == -1) {
        D_80137598 = 0;
        goto block_19;
    }
    if (sp10 == 1) {
        var_v0 = 5;
        switch (sp14) {
        case 0:
            return 0;
        case 1:
        case 2:
            break;
        case 3:
            return var_v0;
        default:
            break;
        }
block_12:
        if ((s16) D_80137598 >= 0x1F) {
            switch (sp14) {
            case 1:
                return 4;
            case 2:
                return 8;
            }
        }
        MemCardSync(0, &sp10, &sp14);
block_19:
        if (MemCardExist(var_s3) != 1) {
            return 0xC;
        }
        return 3;
    } else {
        return 3;
    }
}
