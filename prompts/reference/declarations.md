# Declarations, globals, and C89

Declaration shape is not cosmetic: an override's width and signedness
decide load width and address form, and small-data membership decides
whether an access is gp-relative at all. These are facts the bytes record.

Loaded on demand by `psx_reference`. Read the sheet for the pass the
pipeline reversal named, and only that one.

---

## 7. Declarations, globals, and C89

### Generated globals

`common.h` includes `globals.h`, which declares generated `D_XXXXXXXX`
symbols. Do not restate a declaration in a `.c` file. If a global needs a
struct or aggregate type, put the override in `include/globals_override.h`.
Defining a global the translation unit owns is a different thing and is
required — see "Small-data addressing" below.

`globals.h` is a generated output and carries a do-not-edit banner. Editing it
compiles, which is exactly why the mistake survives review: the next
regeneration erases the change and the build breaks somewhere unrelated. The
generator skips every symbol the override header already declares, so the
override is not a workaround for not being able to edit the generated file —
it is the input that decides what the generated file says. The same holds for
every generated header; the profile's header table lists which ones they are.

Use `&D_XXXXXXXX` to obtain a generated global's address. Never use the
underscore-prefixed implementation symbol `_D_XXXXXXXX`.

Some linker or hand-named symbols may genuinely be absent from `globals.h`.
Check generated headers before adding an extern. If one is needed, make its
type and aggregate size agree with the target access and addressing mode.

### Small-data addressing

Whether a global is reached through `$gp` or through an absolute `lui`/`%lo`
pair is a fact about the **original translation unit**, not about the type.
The assembler emits a GP-relative access only for a symbol the file itself
declares, and an absolute one for everything else. State that in C:

- the file whose target code reaches a global through `$gp` **defines** it —
  a tentative definition (no `extern`, no initialiser) at file scope, with the
  same type the header declares;
- every other file leaves it `extern` and gets absolute addressing.

Derive which globals a function owns from the target rather than guessing:
`tools/build/deriveTuOwnedGlobals.ts <function>` lists them, and `--check`
reports any file that reaches a global through `$gp` but addresses it
absolutely. A hand-written `__asm__` block declares its own symbols the same
way, with `.comm SYM,n` rather than `.extern`.

The declared size still has to be at or below the `-G` threshold in
`configs/project-profile.md` for a GP-relative access to be possible at all —
but size is a necessary condition, never the decision. **Do not enlarge a
declaration to force absolute addressing.** If the candidate emits `%gp_rel`
where the target is absolute, the file is defining a global it does not own;
remove the definition. If it emits `lui`/`%lo` where the target is
GP-relative, the definition is missing.

Size does decide a different question, and conflating the two has cost a
session. The two decisions are independent. Access width alone does not prove
object size: a target may touch only one `u16` at offset zero while its split
address formation proves the declaration in scope was an aggregate above the
configured threshold. Use load/store width for the member type and address
formation for the containing declaration's size class.

| Question | Decided by |
|---|---|
| GP-relative or absolute? | whether **this TU defines** the symbol — size is irrelevant |
| unsplit macro load (self-clobber pair) or split two-register pair? | the **declared size** against `-G` |

So an over-wide declaration buys nothing on the first question and loses the
second: cc1 splits the address, and the target's single-register
`lui $r,%hi(sym)` / `lw $r,%lo(sym)($r)` becomes unreachable. Before accepting
any "this address form is unreachable from C" result — including the one in
ADR-0001 §4 — check what the symbol is declared as. That result is conditioned
on the declaration in scope. A same-file counter-witness settles it in one
grep: `func_8001205C` reads one scalar as the self-clobber pair and one genuine
12-byte global as a genuine split, three lines apart. See
`notes/research/func_8001205C-declaration-shape-vs-address-form.md`.

### Parameter residence is a declaration fact the bytes record

Whether a parameter lives in a register or in its incoming stack slot is
decided by `assign_parms` at the function's opening brace, from the
declaration alone — before any statement is parsed. The bytes record the
outcome, and triage's `param-residence` detector reads it:

- an incoming stack slot re-read at each use (instead of one entry copy)
  and a register argument stored to its own home slot and reloaded are
  compiler-emitted patterns with two possible originals: a reload spill
  under register pressure, or a parameter that was memory-resident by
  declaration;
- a small under-aligned aggregate parameter — a 4-byte char-array struct —
  is BLKmode on strict-alignment MIPS, and `assign_parms` then leaves a
  stack parameter in its slot with **no entry-copy insn** and emits the
  home store for a register parameter itself. Taking a parameter's address
  in the body is parsed too late to change this (the C front end expands
  statements as it parses), and for register parameters it allocates a new
  frame slot instead.

The two originals emit the same words but different pass-time geometry:
entry copies and parameter loads occupy RTL stream slots whose positions
and dependences feed every scheduler release and allocno statistic in the
entry block. A reconstruction with the wrong residence can therefore have
exact count, inventory, and web parity while its entry weave and home-store
slot are unreachable by any statement-level edit — the anti-dependences
radiate from insns the original never had. When entry-block scheduling or
allocation will not settle around a `param-residence` finding, test the
BLK-struct declaration before scheduler forensics; a callee whose
declaration changes this way is called ABI-identically, and TU-internal
recursion can pass the reinterpreted words through a cast function pointer.
The step-by-step recipe, the measured dead ends, and the census of stub
functions carrying the fingerprint are in
`notes/research/param-residence-playbook.md`.

### Shared types

- parameter/local structs shared across files: `include/game_types.h`
- global struct/aggregate overrides: `include/globals_override.h`
- one-file local types: the source file, if project policy permits

Use padding fields for unknown gaps and fields only where access widths prove
them. Do not cast a `void *` at every access when the parameter's struct type
is known.

### C89 form

Declare locals at the top of each block and use `/* */` comments. C89 permits
initializers on those declarations, and an initializer is a compiler-visible
birth site; do not mechanically extract it into a later assignment while
matching allocation or scheduling.

```c
void func(void) {
    s32 i = 0;
    s32 *ptr;

    ptr = &D_SCALAR_BASE;
    for (i = 0; i < 10; i++) {
        /* ... */
    }
}
```

