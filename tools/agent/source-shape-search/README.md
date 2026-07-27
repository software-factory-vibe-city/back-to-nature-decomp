# Finite source-shape search specification

`searchSourceShapes.ts` accepts schema version 1. Every dimension and
alternative is explicit; the tool never invents syntax or mutates `src/`.

```json
{
  "schemaVersion": 1,
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
    "incompatibleAlternatives": [
      { "choices": ["value-web:named-result", "other:incompatible"] }
    ],
    "requiredAlternatives": []
  },
  "traceAllPreprocessed": false,
  "assembleUniqueDbr": false
}
```

An alternative must contain exactly one generation action: `useBase: true` or
a non-empty `edits` array. Exact-edit occurrence checks happen before
compilation. Unknown fields, compiler flags, empty actions, unsafe IDs, and
newer schema versions are rejected.

The Cartesian product uses declaration order, with the last dimension varying
fastest. `maxVariants` bounds one invocation; `--resume` verifies the spec and
toolchain hashes before visiting the next deterministic suffix.
