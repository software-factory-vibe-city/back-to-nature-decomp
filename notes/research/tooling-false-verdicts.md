# When the tool's verdict is the defect

**Compiled 2026-08-09 from cases measured during the raw-`__asm__` debt
paydown.** Two of this project's tools produced authoritative-sounding wrong
answers, in the direction that ends an investigation. Both are recorded with
their recognition symptom, because the general lesson is cheap and the specific
symptoms are not obvious.

**The rule: a negative result is a claim about the tool's domain, not about the
world. Before believing one, spot-check its best candidate against the byte
oracle, and check that the artifact it read was the one you think it read.**

---

## 1. A stale linker script that reads as 984 decompilation errors

**Status: not fixed.** The guard described below is still not implemented as of
2026-08-09.

`Makefile:106` lists `$(LD_SCRIPT)` as a link prerequisite, but **nothing has a
rule to build it.** Only `make split` produces it, and the symbol `INCLUDE`
lines are appended by shell *after* splat runs:

```make
@printf 'INCLUDE "build/undefined_funcs_auto.txt"\nINCLUDE "build/undefined_syms_auto.txt"\n' >> $(LD_SCRIPT)
```

So a bare `splat split`, or a `make split` interrupted in its last few lines,
leaves a linker script missing 146 undefined-symbol definitions plus the lib
bss set. Every `.bss` symbol at or above `0x8005E850` then goes undefined —
**984 errors that name `func_80011370`** and read as a defect in whatever
function was last touched, hours after the actual event. This happened on
2026-08-08 and cost a full investigation.

**Symptom to recognize:** mass `undefined reference to D_…` for bss addresses,
*while* `build/undefined_syms_auto.txt` still contains them.

**Check:** `tail -4 build/slus_011.ld` for the `INCLUDE` lines. If they are
absent, re-run `make split`.

**Two candidate fixes, neither applied:** a fast guard in `make check` that
fails with "run make split" when the includes are absent, or a real Make rule
for `$(LD_SCRIPT)` so an incomplete script cannot survive.

The general form of this one: **a generated artifact whose producer is not
wired as its Make rule can be stale in a way that presents as a source bug in
an unrelated file.** Errors naming a function are not evidence about that
function until the build inputs are known good.

---

## 2. A search that reported "no exact match exists" while holding one

**Status: fixed 2026-08-08** in `tools/agent/variant-lab/compile.ts`
(`normalizeAlias`, applied to both the cc1 and disassembly paths, with a
regression test). The same domain now reports `exact-candidate-found`.

The residual search clusters candidates by canonicalized assembly **text**. cc1
spells negation as the base instruction (`subu $t0,$zero,$a1`); the
disassembler prints the identical machine word as `negu t0,a1`. Nothing
collapsed the two, so a **byte-exact candidate scored 18/19** and the run
terminated `exhausted-no-exact` — an authoritative negative result with the
answer inside it.

**Constraint on the fix:** only aliases with exactly one encoding may be
collapsed this way. `negu`/`neg` qualify. **`move` does not**, since it
assembles as either `addu` or `or`; collapsing it would hide a real difference.

**The rule:** when a search says the domain is empty, spot-check its best class
against `diffFunc --bytes` before believing it. A text-canonicalizing tool can
only be as correct as its alias table, and its failure mode is silent.

---

## 3. `diffFunc`'s headline score undercounts a near-match

**Status: not fixed as of 2026-08-12.** Measured during the func_80017300
rework, where it hid a third of the residual for two sessions.

`compareWords` in `tools/lib/functionOracle.ts` aligns the two instruction
streams with an LCS (`lcsPairs`) before comparing. Words the alignment pairs go
through `settle`, which increments `same` or pushes to `differing`; words the
alignment leaves unpaired become `target-only` / `candidate-only` rows and set
`structural = true` — **contributing to neither counter.**

The consequence is systematic and one-directional: a **transposed pair** costs
one structural row and **zero** `differing` rows, and the LCS still counts one
of the two words as `same`. So each transposition inflates the headline score
by one and hides two wrong words.

On the func_80017300 attempt the tool reported

```
Match: 320/331 words (96.7%)
VERDICT: MISMATCH — 7 word(s) differ.
```

for an object whose true index-by-index count is **318/331 with 13 wrong
words**. Four transpositions were invisible: `320 = 318 + (4 structural pairs
counted once)`, and `7 = 13 - (4 pairs x 2 wrong words) + ...`. The verdict
(`MISMATCH`) was correct throughout — only the *magnitude* was wrong, which is
what a session uses to decide whether a residual is worth another day.

**Symptom to recognize:** the rendered diff shows a `-addr: insn` / context /
`+addr: insn` triple where both instructions exist on both sides at swapped
addresses, and the `differing words:` list does not name either address.

**Check:** compare `targetWords[i].raw` against `candidateWords[i].raw` by
index, with no realignment. Roughly fifteen lines against the existing
`compareFunction` API:

```ts
const r = compareFunction(fn, { objectPath });
let same = 0;
for (let i = 0; i < r.targetWords.length; i++) {
  const t = r.targetWords[i], c = r.candidateWords[i];
  if (t && c && t.raw === c.raw && !c.undetermined) same++;
}
```

**Fix not applied, and why.** `functionOracle.ts` is the project's verdict
authority; changing what it prints is a pipeline-critical edit and is filed
here for the owner rather than made unilaterally. The LCS alignment is right
for the *rendering* — it is what makes a transposition legible as a
transposition instead of two unrelated diffs. The defect is only that the
summary line is computed from the alignment. Two candidate fixes: report both
numbers (`320/331 aligned, 318/331 by index`), or count structural rows into
`differing`.

**Until then: quote the strict count.** When a function is close enough that
the last words are transpositions, the aligned number is the one that will be
wrong, in the flattering direction.

---

## 4. The standing caveat this belongs with

`diffFunc` is not the verdict. It compares **pre-link encodings** and can both
false-pass (a masked transposition reported as a match) and false-fail
(byte-identical code reported as differing). `make check` is the verdict, and
acceptance requires it.

---

## Related

- `notes/retros/2026-08-09-asm-body-debt-paydown-retro.md` §5.
- `prompts/c-style-guide.md` §4 — how to read tool verdicts (SAT / UNSAT /
  INCONCLUSIVE literalism, and this negative-result spot-check).
- `notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md`
  §5 — the link-map methodology for the neighbouring failure mode, where a
  short in-progress function shifts every later object.
- `notes/research/func_80017300-pre-placement-and-movable-order.md` — the case
  that surfaced §3, and the worked example of what the hidden words were.
