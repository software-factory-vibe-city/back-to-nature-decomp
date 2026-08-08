# Plan: a trustworthy per-function oracle and pipeline integrity

**Status: proposed.** Written 2026-08-08 from gaps found while matching
`func_80011370`. Read `notes/adr-0001-symbol-addressing-at-the-assembler-boundary.md`
first — it records the decisions this plan follows up on.

## Purpose

Two related problems.

**The per-function diff is inaccurate.** `diffFunc` is what you read to decide
what to change next. On `func_80011370` it rendered six words as differences
that are byte-identical after linking — a wrong jump target and a wrong
immediate. The wrong verdict (551/557 on finished code) is the smaller half of
the problem; the wrong *diff* is what sends you looking for a control-flow bug
that does not exist.

**The pipeline can silently disagree with itself.** Diagnostic tools compile
through paths that have drifted from the build, and object files do not depend
on the build configuration, so a flag experiment leaves a mixed-provenance
build that reads as a real defect.

Both are game-agnostic. Fixing them is part of the reusable pipeline, not part
of finishing this game.

---

## 1. Rebuild the per-function diff on original bytes (highest priority)

### What it reports today

```
-624: j    0 <func_80011370>          <- target
+624: j    8a4 <func_80011370+0x8a4>  <- ours
-6a0: lui  a0,0x8007
+6a0: lui  a0,0x0
```

That reads as "the jump goes to the wrong place" and "the `lui` has the wrong
immediate". Both are false — those words are byte-identical once linked. The
project's own doctrine calls `diffFunc` *the exact oracle*, so there is nothing
in the workflow that flags the output as suspect.

This is not a rare edge. Failure mode 1 below fires on **any** function with a
jump table or cross-jumped tails — the class of function most likely to need
the tool in the first place.

### The defect

`diffFunc` builds its reference by taking splat's disassembly
(`build/asm/nonmatchings/<func>/<func>.s`), assembling it, and comparing
objdump output against our object. **The reference is a re-assembled
reconstruction, not the original bytes**, and the comparison is between two
*pre-link* encodings that legitimately encode the same thing differently.

1. **Local labels become relocations.** splat names jump targets as symbols
   (`.L80011C14`), so assembling the reference emits `R_MIPS_26` /
   `R_MIPS_PC16` against those symbols with a **placeholder instruction
   field**. Our compiler output resolves local branches itself — no relocation
   on the `beqz`, `.text`+addend on the `j`. Identical after linking, different
   before it.

2. **splat can lose a `%hi` attribution.** Cross-jumping duplicated
   `lui $a0,%hi(D_80070CC0)` and put one copy in a branch delay slot far from
   its `%lo`. splat's pairing heuristic gave up and emitted a literal
   `lui $a0,0x8007` with no relocation. The reference is now missing
   information the original bytes contain.

`instrLines()` already normalises local branch targets to PC-relative deltas,
which is the right idea and handles the ordinary case. It cannot help here:
the normalisation assumes both sides carry a real encoded offset, and the
target side carries a placeholder (`0xffff` on that `beqz`) with the real
value in a relocation.

The escalation path does not rescue any of this. `diffFunc` escalates to a
linked-binary comparison only at masked 100%, and that requires the **whole**
binary to match — precisely what is not true mid-function. When the oracle is
most needed, it cannot run.

### The fix: one artifact, not two

An earlier draft of this plan proposed keeping the masked diff as "advisory"
and adding a separate byte verdict. That was wrong. If the verdict and the
diff come from different computations they can disagree, and then the reader
has to adjudicate between two tools. Build one thing and derive both from
it.

1. Relocate the candidate object's `.text` to the **original** symbol
   addresses (algorithm below).
2. Take the target side as **raw bytes from the original image** — not
   splat's `.s`, not a re-assembly.
3. Disassemble both byte streams with the same disassembler at the same base
   address.
4. Symbolise both identically from `configs/symbol_addrs.txt` (and
   `$gp + displacement` back to a name).
5. LCS-align and diff that. The verdict is "did the diff come out empty".

On the six words above the output becomes `j 0x80011C14` vs `j 0x80011C14` and
`lui a0,0x8007` vs `lui a0,0x8007` — they vanish, because they were never
differences.

### Two things this buys beyond removing the noise

**It closes the symbol-transposition blind spot.** The current masked diff
cannot distinguish `%gp_rel(A)` from `%gp_rel(B)`, which is why the skill
requires escalating a masked 100% to a linked-binary check. After relocation A
and B have different displacements, so a transposition appears in the diff
itself. The escalate-at-100% mechanism — and its dependency on the whole
binary matching — can be deleted.

**It makes the oracle independent of splat.** Today a splat heuristic failure
*is* an oracle failure and the project cannot tell the two apart; that is
exactly what happened with the lost `%hi`. Grounding the target side in the
original bytes means the oracle can only be wrong if the original binary is.

### Inputs

All already in the project:

| Input | Source |
|---|---|
| original image | `extracted/iso/slus_011.15` (path from `TARGET` in the Makefile) |
| load address, header size | PS-X EXE header (`0x80010000`, `0x800`); `psxExeInfo` already parses this |
| `$gp` | `gp_value` in `configs/splat.yaml` |
| symbol -> address | `configs/symbol_addrs.txt`, fallback to the address encoded in `D_xxxxxxxx` / `jtbl_xxxxxxxx` / `func_xxxxxxxx` names |
| function address and length | `symbol_addrs.txt`; length = distance to the next symbol |

### Relocation algorithm

Validated by hand this session — reproduce it, do not re-derive. Extract
`.text` and its relocations (`objdump -r --section=.text`), then for each
relocation resolve the symbol to its **original** address and patch the
instruction field. MIPS o32 is REL, so the addend lives in the field:

- `R_MIPS_26`: target = `base + ((field & 0x3FFFFFF) << 2)` when the symbol is
  a section (`.text`, `.rodata`), else `base`; write `(target >> 2) & 0x3FFFFFF`.
- `R_MIPS_HI16`: addend = `((field & 0xFFFF) << 16) + sign_extend16(matching LO16 field)`;
  write `((base + addend + 0x8000) >> 16) & 0xFFFF`.
- `R_MIPS_LO16`: write `(base + sign_extend16(field)) & 0xFFFF`.
- `R_MIPS_GPREL16`: write `(base + sign_extend16(field) - gp) & 0xFFFF`.

A jump table in the object's `.rodata` needs its original base; take it from
the `.rodata` subsegment splat assigns to the function in `configs/splat.yaml`
(e.g. `- [0x808, .rodata, func_80011370]` -> `0x80010008`).

### Output requirements

These are requirements, not polish. The output is acted on directly, so
anything it prints has to be true or explicitly marked unknown.

- **Never render a confident wrong operand.** If a symbol cannot be resolved,
  that word renders as explicitly undetermined **on its own diff line** — not
  silently patched with a guess, and not relegated to a footer. A verdict of
  *undetermined* is a third outcome, never collapsed into match or mismatch.
- **The verdict and the diff must be the same computation**, so they cannot
  disagree.
- **Say when local targets are expected to shift.** If the candidate is longer
  or shorter, every later local branch resolves to a different address and all
  of them light up. That is honest but noisy, and it is derived from a single
  structural difference. Keep targets function-relative and have the tool say
  so explicitly alongside the existing count-delta warning, which already
  tells the agent structural work comes first. Once counts match they realign
  on their own.

### Validation already done

`func_80011370` 557/557, `SetGfxClip` 9/9, `SetGfxOffset` 9/9 — and the
verdict agreed with `make check` once the whole binary matched. The throwaway
script that produced this is not in the repo; reimplement it as a tool.

### Acceptance criteria

- On `func_80011370` as it stands today, the diff is **empty** and the verdict
  is match. That is the regression test for this whole item.
- A verdict for a single function that is correct while other functions are
  mid-work and the binary does not link cleanly.
- Reports exact differing word offsets, with symbolised operands on both
  sides.
- Distinguishes **match**, **mismatch** and **undetermined**, per-instruction
  and in the verdict.
- Agrees with `make check` on a fully matching tree.
- A deliberately transposed pair of same-shaped global accesses is caught
  **without** escalation.

### What this does not change

The requirement is unchanged and gets stricter, not looser: a function is
accepted only on byte-level evidence.

What changes is the mechanism. Today that evidence is produced in two stages —
a relocation-masked instruction diff, which is explicitly provisional because
it cannot see symbol identity, followed by an auto-escalation to a
linked-binary comparison when it reaches 100%. The new oracle resolves
relocations up front, so symbol identity is visible in the diff itself and the
provisional stage disappears. Same standard of proof, reached directly instead
of in two hops.

`make check` remains the final authority and is **not** replaced. The
per-function oracle deliberately checks one thing: are these the right bytes
for this function. It does not check that the function is placed at the right
address in the real link, or that anything else in the binary is correct. Both
gates stay.

One dependency to be aware of: relocation resolution trusts
`configs/symbol_addrs.txt`. A wrong address there produces a wrong verdict —
almost always a false mismatch, since two distinct symbols land on distinct
addresses. `make check` is the backstop for that class of error, which is
another reason not to retire it.

### Follow-through

Two passages describe the two-stage mechanism and will no longer match the
tool once this lands. They are load-bearing — they are the instructions
followed at the end of every function — so update them in the same change:

- `.pi/skills/psx-decompile-function/SKILL.md`, "Finish": "An exact
  instruction diff is provisional... `diffFunc` auto-escalates a masked 100%
  to a linked-binary byte comparison — only its 'VERIFIED' verdict is a
  match".
- `prompts/c-style-guide.md`, final checklist item 5: "a masked 100% cannot
  see symbol identity... only 'VERIFIED' counts".

Rewrite both to state the requirement (byte-level match on the function, plus
`make check`) rather than the old two-stage route to it. Keep the symbol
transposition guidance — the failure is still real and the fix is still to
swap the order of the corresponding accesses in the source; only its detection
moves earlier.

---

## 2. Collapse the three cc1 invocation paths

`tools/agent/decompToolchain.ts`, `tools/agent/diffFunc.ts` and
`tools/agent/flagProbe.ts` each invoke cc1 themselves. The
`fixSmallDataExterns` pass was wired into the first two; **`flagProbe` was
not**, so it now assembles differently from the build and its flag matrix will
mis-score any function affected by the pass.

Commit `a4d6e78` ("derive every toolchain flag set from the Makefile") already
fought this battle for *flags*; the same argument applies to *pipeline stages*.
Route every tool through one `compileSource`-style entry point so a new stage
is added once.

**Acceptance:** adding a pipeline stage requires editing exactly one file;
`flagProbe` output is identical to what `make` produces for the same source.

---

## 3. Make objects depend on the build configuration

`$(BUILD_DIR)/src/%.c.o` depends only on `src/%.c`. Changing `ASFLAGS`,
`CC1FLAGS`, `configs/flag_overrides.mk` or `configs/tu_externs.txt` does not
invalidate a single object.

This caused a real misdiagnosis this session: a global `-G0` experiment was
reverted, but only objects whose `.c` had changed got rebuilt. Everything else
kept its `-G0` build, producing 580 bytes of drift that was initially — and
wrongly — reported as a pre-existing project defect.

**Fix:** add `Makefile`, `configs/flag_overrides.mk` and `configs/tu_externs.txt`
as order-only-safe prerequisites of every object rule (the `.s.o` rule too).

**Acceptance:** touching any of those files forces a full rebuild; a flag
experiment cannot leave a mixed-provenance tree.

---

## 4. Add triage detectors for these symptom classes

Per the project's push-not-search knowledge design, learnings surface through
`tools/agent/triage.ts` detectors. Three are missing, all cheap:

1. **Out-of-window small extern.** A `.extern SYM, n` with `n <= -G` whose
   address is outside the `$gp` window. Today this either mismatches silently
   or fails at link with `relocation truncated to fit: R_MIPS_GPREL16`. Cite
   ADR-0001 §2.1.
2. **Per-TU addressing conflict.** The function reads an in-window symbol that
   is addressed both `%hi` and `%gp_rel` somewhere in the corpus. Emit the
   suggested `configs/tu_externs.txt` line. Cite ADR-0001 §2.2.
3. **Delay-slot-straddling `lui`/`%lo`.** Falsifies any unsplit-macro or
   `-mno-split-addresses` hypothesis in one step. Should fire *before*
   `flag-fingerprint` recommends a flag probe. Cite ADR-0001 §3.1.

Detector 3 matters most: the existing `flag-fingerprint` detector pointed at a
real fingerprint and the wrong conclusion, and cost most of a session.

---

## 5. Auto-derive symbol ownership from the target

> **Superseded by `plans/toolchain-native-small-data-addressing.md` §4.** The
> derivation below is right; its *output* should be tentative definitions in
> the owning source file, not entries in `configs/tu_externs.txt`, because
> that file is slated for deletion. Keep this section for the scope numbers.

Ownership is currently hand-entered. It does not need to be: the archived
assembly already shows, per function, which addressing mode the original used.

Build a tool that scans the target assembly for every `(symbol, function)`
pair, records the observed mode, and emits a `tu_externs.txt` entry for any
function that addresses an **in-window** symbol absolutely. Symbols outside the
window need no entry — the address test in `fixSmallDataExterns.ts` covers them.

Scope, measured this session: six symbols are addressed both ways
(`D_8005E3A4`, `D_8005E3A8`, `D_8005E3AC`, `D_8005E3B0`, `D_8005E3B4`,
`D_8005E3C0`), with **40+ not-yet-decompiled functions** on the absolute side —
e.g. `func_80012D30`, `func_8001316C`, `func_800134C4`, `func_8001B118`,
`func_8001E160`, `func_80019CBC`, `func_800183E0`, and most of
`func_80022xxx`–`func_80024xxx`. Each will otherwise need a hand entry and will
present as a mysterious 4-bytes-short diff until someone remembers why.

The GP-relative side is entirely within `0x80011370`–`0x800128DC`, which is
strong evidence that range is one translation unit. That is also a useful
input to `notes/file-groupings.md`.

**Acceptance:** regenerating the file on a fully matched tree is a no-op;
generated entries carry the evidence (both observed forms) in a comment.

---

## 6. Smaller items

**maspsx blocks on stdin.** `tools/vendor/maspsx/maspsx.py` reads stdin before
falling back to its file argument, and hangs when stdin is a tty or an open
pipe (`MASPSX: Warning, no input from stdin, will try to read from a file`,
then no progress). It bit an interactive `make` twice this session. Either
redirect `< /dev/null` in the Makefile recipes or fix the fallback upstream.
Cheap, and it makes `make` reliable for a human.

**`tools/build/*` gitignore pattern is brittle.** `.gitignore` ignores
`tools/build/*` wholesale and negates individual files. Every new build tool
must remember a negation or it silently will not be committed — while the
Makefile depends on it. `fixSmallDataExterns.ts` needed one. Invert the
pattern: track `tools/build/*.ts` and ignore the generated artifacts by name.

**`build/lib` regeneration is undocumented.** `build/lib/**/*.o` are patched
copies of `lib/**/*.o` produced by `tools/build/patchLibBss.ts --write`, and
the linker script points at them. Nothing says so, and a blanket
`find build -name '*.o' -delete` destroys them (it did, this session; 361
objects, restored by re-running the tool). Note it in `README.md` or make the
Makefile able to rebuild them.

**Correct the superseded research note.**
`notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md`
still describes the `-mno-split-addresses` override as an owner-approved
tracked debt. It has been removed and both functions match under baseline
flags. Add a dated status line at the top pointing at ADR-0001, so the wrong
conclusion does not propagate into the next attempt. Sections 1–6 of that note
(the ASPSX GP-relative rule and the link-map methodology) remain correct and
are what ADR-0001 builds on.

---

## Ordering

1. §1 oracle — everything else is measured with it.
2. §3 object/config dependencies — prevents the class of error that produced a
   wrong diagnosis this session.
3. §2 single cc1 path — `flagProbe` is actively inconsistent right now.
4. §4 detectors — leverage once the base is sound.
5. §6 as convenient; the superseded-note correction should be done sooner
   rather than later because it actively misleads.

§5 is not scheduled here: it is superseded by
`plans/toolchain-native-small-data-addressing.md`, which removes the config it
was going to generate. Do that plan's §4 instead. §3's prerequisite list drops
`configs/tu_externs.txt` when that plan's §5 deletes the file.
