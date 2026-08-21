---
name: psx-post-decompile-documentation
description: Perform the documentation of the function that was just decompiled
---

The function that was just decompiled is byte exact.

Before it is committed: update `notes/file-groupings.md` if — and only if — this function,
produced new evidence about which original translation unit it belongs to. Same-file,
evidence is things like a shared static or global cluster, a register-variable quirk,
shared with a neighbour, a declaration-order effect, an SDK idiom cluster, or an,
adjacency the call graph and the link order agree on.,

Record membership and one-line roles only. Technique and per-function detail belong in,
`notes/research/` or `notes/retros/`, not in the ledger.,

If this function produced no new grouping evidence, say so and change nothing — an,
unfounded ledger entry is worse than no entry.,

Edit nothing outside `notes/` in this turn. The source has already been verified and any,
other edit will be reverted.,

Finally, commit only the changes related to this function as:

```
 match func_80011C24
    
 Byte-exact and finalized.
```