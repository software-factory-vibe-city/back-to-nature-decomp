# func_80014CBC — clean-C result carrier and remaining reload-CSE residual

Status: best current clean C compiles to the exact 117-instruction count with
an empty inventory and 103/117 equal words (12 differing words). No compiler
flag override is present or justified.

## Reconstructed structure

- Six arguments; frame map proves stack args 4 and 5 at caller offsets 0x10
  and 0x14.
- Returns a pointer into `arg3`, or NULL. Caller evidence confirms the return
  value is consumed.
- Reads `D_80048B1C[arg0].loc + arg1`, rounds the end position to sectors,
  and retains the start offset modulo 0x800.
- On a new read, performs the libcd setup/read sequence and returns NULL.
- On completed sync, optionally moves the unaligned result to `arg3`.
- On `CdReadSync == -1`, clears the busy state and recursively retries.
- `func_80021B20` receives only `pos`; its implementation reads none of its
  incoming arguments. The one-argument declaration prevents an incorrect dead
  `$v0` call result and avoids fabricated `$a1`-`$a3` setup.

## Mechanisms that unlocked the target shape

1. **Shared zero tail.** Routing retry and nonzero-sync outcomes through one
   `result = NULL; D_8005E2B4 = 1` tail preserves the function-wide result
   variable. It allocates to `$fp`, giving the target entry `move fp,zero`,
   retry/no-result resets, and all `move v0,fp` returns under baseline flags.
2. **Sequential reuse of `one`.** On the main-read path, assigning
   `one = arg5` before the state/flag writes invalidates the entry constant.
   GCC then emits the target's fresh block-local `li v1,1`, uses it for
   `D_8005E410 = 1` and the `arg5 != 1` branch, and stores `arg5` on the true
   arm. This is semantically equivalent because that path no longer needs the
   old value of `one`.
3. **Unsigned 16-bit normalization at the second address use.** Writing the
   memmove address as `arg3 + (u16)pos_mod` is valid because `pos_mod` is masked
   to 0x7ff. The cast is eliminated by combine, but its pass-time web shape
   restores part of the target global allocation: result=`$fp`, arg0=`$s5`,
   arg2=`$s6`, arg3=`$s1`, arg5=`$s4`.

   [CORRECTED 2026-08-13] The original version of this note also claimed
   sector start=`$s0`, offset=`$s2`, one=`$s3`, and sector count=`$s7` for
   this source. That was wrong: re-measuring the exact source described here
   gives start=`$s2`, offset=`$s3`, one=`$s7`, and the count merged into the
   `sector_end` web at `$s0` (measured `.greg`: merged web 6 refs/33 len,
   priority 3636, picked first). The (u16) cast is also ref- and
   length-neutral at `.greg` time (flow counts post-combine); its real effect
   was keeping the two address expressions distinct through gcse. See
   `func_80014CBC-allocno-priority-web-partition.md` for the follow-up that
   measured all of this.

Together these replace the prior flag hypothesis. `psx_flag_probe` found no
target fingerprint and was inconclusive; the temporary
`-fno-cse-skip-blocks -fno-gcse` override failed policy and was removed.

## Current residual

The remaining machine mismatch has exact count, exact inventory, and target
allocation. It consists of:

- an order-only prologue/precomputation window (the same values and opcodes are
  emitted, but `sw a1`, rounded-sector arithmetic, start-sector arithmetic,
  offset mask, and the branch delay occupant are ordered differently); and
- one web-parity mismatch at the memmove source:
  target `addu a1,s1,s2`, candidate `move a1,fp`.

Trace evidence explains the latter exactly. Before reload, pseudo 116 is a
fresh `arg3 + (u16)pos_mod` expression, assigned to `$a1`. Reload CSE then sees
that `$fp` already contains the identical `arg3 + pos_mod` value and rewrites
the add to `move a1,fp`. `reload_cse_regs_1` clears values only at real
`CODE_LABEL`s; ordinary equivalent C spellings, inner locals, explicit gotos,
switch forms, casts, masks, and dead result assignments either normalize to the
same RTL or lose their labels before reload.

## Exhausted bounded searches and tested families

- residual-source grammar schema 5: 15,360/15,360 coordinates, no exact;
- shared return/goto/structured-if families;
- fresh and reused address/result variables;
- pointer, cast, indexing, mask, signed/unsigned-16, negated-subtraction, and
  reassociated address forms;
- switch, explicit-label, duplicated-cleanup, and single-pass-loop CFG forms;
- argument-reuse and memmove-return forms.

The best source remains in `src/func_80014CBC.c`. Do not restore the stub and
do not revive the unsupported flag override. The next clean-C experiment must
move the reload-visible value/label state while retaining the current 117-word
shape and exact register map; repeating phrase-level address spellings is the
same experiment.
