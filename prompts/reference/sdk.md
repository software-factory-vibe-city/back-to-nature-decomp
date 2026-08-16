# SDK operation boundaries

A recognised SDK packet is a source-semantics finding, not a style
suggestion. Restore the operation boundary before reading allocation or
scheduling at all — hand-rolled bitfield arithmetic where the SDK has a
macro changes the RTL the later passes see.

Loaded on demand by `psx_reference`. Read the sheet for the pass the
pipeline reversal named, and only that one.

---

### Recover SDK operation boundaries before compiler-state tuning

A recognized SDK packet is a source-semantics finding, not a style
suggestion. When the configured SDK provides a type and macros for what the
target builds, hand-written field stores and hand-rolled tag arithmetic put
the operation boundaries in the wrong place, and every allocation, scheduling,
or flag reading taken on top of them is a reading of a different program —
one the compiler was never asked to emit.

Order of work:

1. run triage and the SDK detector before authoring or perturbing source;
2. reconstruct every named type and macro operation the detector reports;
3. re-run triage, the inventory, the exact diff, and the classifier;
4. only then trace allocation or scheduling;
5. if the residual is order-only among adjacent independent SDK calls, run the
   bounded SDK-call statement-order search — never permute the stores inside
   one macro expansion.

Two recognition facts an agent will otherwise miss:

- The code byte in the target is the **composed** byte. `setSemiTrans` and
  `setShadeTex` set documented low bits of `code` on top of an initializer's
  base value, so a target byte that appears in no primitive table is normally
  a base code with attribute bits already applied. Strip only bits the
  configured header defines as attributes; an unexplained bit means it is not
  that primitive.
- A "mask constant plus a store" is not a link. The link macro is two
  complete 24-bit merges — preserve one word's top byte, take the other's low
  24 bits, both directions — and anything less is compatible with a link
  rather than proof of one.

Detection is compatibility, not provenance: a matching packet shape means
"test this SDK representation", never "the historical names are proved". The
representation still has to be confirmed by the byte oracle.

The worked case, including the composed code byte, the command-packet
inversion, the tag-merge dataflow, and the flag hypothesis that was measured
and rejected, is `notes/retros/2026-08-13-func_800134C4-retro.md`. The earlier
operation-boundary case with a block move instead of a packet is
`notes/retros/2026-08-07-func_800140C8-retro.md`.

### Struct fields

Prefer:

```c
obj->field_0C = 1;
```

rather than offset casts:

```c
*(s32 *)((char *)obj + 0x0C) = 1;
```

Pointer-cast chains can change expression birth, operand order, and address
canonicalization. A natural array or struct-field MEM expression also creates
a fresh address-result web, which can be essential for matching.

### Address-expression clues

| Target shape | Source family to try |
|---|---|
| `sll`, `addu`, `lw/sw` | array indexing |
| `addiu` from `$gp` | GP-relative scalar or small aggregate |
| `lui` plus `%lo` load/store | absolute global above the small-data threshold |
| base load plus field offset | struct field |
| scaled index before base | array/index expression |
| base before scaled index | separately materialized base or pointer expression |

