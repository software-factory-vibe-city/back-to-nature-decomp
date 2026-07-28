# Finite source-shape search specification

`searchSourceShapes.ts` emits schema version 2 and continues to migrate schema
version 1 as strict, schedule-comparison-disabled input. Every dimension and
alternative is explicit; the tool never invents syntax or mutates `src/`.

```json
{
  "schemaVersion": 2,
  "function": "func_XXXXXXXX",
  "baseSourcePath": "src/func_XXXXXXXX.c",
  "analysisPath": "build/targetSchedule/func_XXXXXXXX/analysis.json",
  "maxVariants": 5000,
  "dimensions": [
    {
      "id": "value-web",
      "mechanism": "fresh-vs-reused-web",
      "expectedPass": "greg",
      "invariants": ["the computed value is unchanged"],
      "alternatives": [
        {
          "id": "base",
          "useBase": true,
          "expectedEffect": "reference source shape",
          "invariants": []
        },
        {
          "id": "named-result",
          "expectedEffect": "give the result a fresh pseudo web",
          "invariants": ["the result expression is unchanged"],
          "edits": [
            { "find": "exact old text", "replace": "exact new text", "occurrences": 1 }
          ]
        }
      ]
    }
  ],
  "constraints": {
    "preserveTargetRanges": [[20, 35]],
    "preserveOpcodeStream": true,
    "forbidInstructionCountGrowth": true,
    "preserveExistingEmptyMemoryBarriers": false,
    "incompatibleAlternatives": [
      { "choices": ["value-web:named-result", "other:incompatible"] }
    ],
    "requiredAlternatives": []
  },
  "traceAllPreprocessed": true,
  "assembleUniqueDbr": false,
  "scheduleComparison": {
    "enabled": true,
    "analyze": "traced-classes",
    "maxInterventions": 8
  }
}
```

An alternative must contain exactly one generation action: `useBase: true` or
a non-empty `edits` array. Exact-edit occurrence checks happen before
compilation. Unknown fields, compiler flags, empty actions, unsafe IDs, and
newer schema versions are rejected.

`preserveExistingEmptyMemoryBarriers` is intended for a strong baseline that
already contains the project's narrowly approved zero-width memory barriers.
When enabled, those exact baseline barriers are accepted in generated variants,
but any edit containing asm text or any added, removed, reordered, or modified
barrier fails policy before compilation. The option never permits other
embedded assembly.

When `scheduleComparison.enabled` is true, `traceAllPreprocessed` must also be
true. Every distinct preprocessed compiler class retains GCC dumps, receives a
normalized trace-bundle fingerprint, and one representative per trace class is
analyzed against the target. Results preserve target-relative profile and delta
artifacts under each variant's `target-schedule/` directory. Machine-equivalent
variants are therefore not assumed causally equivalent. Hard-range preservation
and supported schedule deltas rank ahead of mechanism verdicts and match score;
untraced or confidence-reduced changes remain explicitly inconclusive.

The Cartesian product uses declaration order, with the last dimension varying
fastest. `maxVariants` bounds one invocation; `--resume` verifies the spec and
toolchain hashes before visiting the next deterministic suffix.
