#include "common.h"
#include "game_types.h"

void func_8001FABC(s16 arg0);

void ovl_11_func_8011E574(void);

void ovl_11_func_8011EE98(s32 arg0);

void ovl_11_func_8011EC84(void) {
    func_8001FABC(3);
    ovl_11_func_8011E574();
    D_80128420 = 6;
    ovl_11_func_8011EE98(D_80070CF2);
}
