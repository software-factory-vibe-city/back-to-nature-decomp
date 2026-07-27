# Mechanism-aware variant laboratory

Use variants to test a named compiler mechanism, never to permute source
randomly. Complete source inputs belong under `build/`; every run copies them
into a deterministic artifact directory.

## Hypothesis manifest

```json
{
  "schemaVersion": 1,
  "function": "func_800154CC",
  "variants": [
    {
      "id": "baseline",
      "sourcePath": "build/candidate-before.c",
      "mechanism": "custom",
      "expectedPass": "rtl",
      "expectedEffect": "reference separate pseudo webs",
      "invariants": ["control flow is unchanged"],
      "baseline": true
    },
    {
      "id": "tag-reuse",
      "sourcePath": "build/candidate-tag-reuse.c",
      "mechanism": "single-vs-multi-set",
      "expectedPass": "rtl",
      "expectedEffect": "reuse the x-sum pseudo for the later tag OR",
      "invariants": ["control flow is unchanged"]
    }
  ]
}
```

If no entry has `baseline: true`, `src/<function>.c` is compiled as the
reference. Supported mechanisms are defined by `VARIANT_MECHANISMS` in
`types.ts`.

```bash
npx tsx tools/agent/fuzzVariants.ts func_800154CC \
  --manifest build/hypotheses.json --trace-passes
```

For variants sharing one hypothesis, equivalent CLI metadata is accepted:

```bash
npx tsx tools/agent/fuzzVariants.ts func_800154CC build/a.c build/b.c \
  --mechanism constant-birth-site \
  --expected-pass rtl \
  --expected-effect "move the mask pseudo birth" \
  --invariant "tag-result web is unchanged" \
  --trace-passes
```

## Preserved artifacts

Each run writes `build/fuzz/<function>/<run-id>/` containing:

- deterministic `manifest.json`, `summary.json`, and `summary.txt`;
- the target wrapper/object;
- `variants/<id>/source.c`, preprocessed source, cc1 assembly, and full-mode
  object;
- GCC `-da` dumps when `--trace-passes` is enabled;
- normalized `comparison.json` for target and candidate instructions.

The run ID hashes source contents, hypotheses, mode, flags, and toolchain
identity. Repeating the same run replaces the same reproducible directory.

## Curated transformations

`--transform-spec` applies explicit exact edits to one complete base source and
emits complete C89 files under `build/`. The template name records the intended
mechanism; edits must have exact occurrence counts and are policy-checked
before compilation.

```json
{
  "schemaVersion": 1,
  "function": "func_800154CC",
  "template": "constant-around-join",
  "baseSourcePath": "build/candidate.c",
  "expectedPass": "rtl",
  "outputs": [
    {
      "id": "mask-at-join",
      "expectedEffect": "birth the mask immediately after the branch join",
      "invariants": ["the branch diamond is unchanged"],
      "edits": [
        { "find": "/* exact old text */", "replace": "/* exact new text */" }
      ]
    }
  ]
}
```

Available templates are listed in `TRANSFORMATION_TEMPLATES` in `types.ts`.
They do not infer edits or generate permutations.

## Verdicts and promotion

Results are ranked `confirmed`, `partially-confirmed`, `rejected`, then
`inconclusive`, before exact-match count. Confirmation means the predicted pass
changed; the free-text expected effect still requires inspection of preserved
evidence. An exact cc1-only result is never promotion-eligible. Copy a selected
full-mode candidate to `src/` and finish with the exact function diff and full
binary check.
