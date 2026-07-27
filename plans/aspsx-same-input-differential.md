# Plan: same-input ASPSX versus maspsx differential

## Purpose

Build a deterministic diagnostic that assembles one identical cc1 `.s` file
through real ASPSX and through maspsx/GNU as, extracts comparable section
bytes and relocations, and identifies the first assembler-boundary divergence.

This tool is a proof mechanism. It must prevent both false maspsx accusations
and wasted C-source searching after an assembler gap has actually been proven.

## Motivating case

The remaining `func_800154CC` mismatch was pure instruction order, so an ASPSX
reordering difference was plausible. The boundary was settled manually:

1. preserve the exact GCC 2.95.2 assembly;
2. convert it to CRLF for ASPSX;
3. run real ASPSX 2.77 from PsyQ 4.3 under a 32-bit Wine prefix;
4. parse the PsyQ LNK object and extract `.text`;
5. compare it with maspsx output and the archived target.

Real ASPSX preserved the candidate's wrong order exactly. The problem therefore
belonged to the source/compiler web, not maspsx. This manual procedure should
be a single supported command.

## Scope

Add a TypeScript diagnostic under `tools/agent/`, with a bounded Pi wrapper if
it proves stable:

```bash
npx tsx tools/agent/assemblerDifferential.ts <func>
npx tsx tools/agent/assemblerDifferential.ts --assembly path/to/input.s
```

The function mode should compile once with the configured cc1 and feed the
same resulting text to both assemblers. It must not compile separate C inputs
for the two paths.

## Inputs and configuration

Derive project facts from active configuration and the generated profile:

- ASPSX version;
- maspsx flags and GNU assembler path;
- include directories and assembler flags;
- expected target object/assembly;
- optional Wine prefix and real ASPSX executable.

Do not hardcode SDK versions or local home-directory paths. Add optional
machine-local configuration outside generated project facts, for example an
environment variable or ignored config file naming the real assembler and Wine
prefix. Absence of real ASPSX should produce `unavailable`, not a false pass.

## PsyQ object parsing

Implement a small read-only TypeScript parser for the required LNK records:

- signature/version;
- section declarations and switches;
- section bytes;
- relocations and symbols needed for normalized comparison.

The first version may compare raw `.text` for relocation-free windows, but the
acceptance version must preserve relocation records rather than silently
zeroing unresolved branch/symbol fields.

Keep this parser under `tools/agent/assembler-differential/`; do not check in a
Python helper.

## Comparison layers

Report each boundary separately:

1. exact input assembly hash;
2. real ASPSX section bytes and relocations;
3. maspsx/GNU-as section bytes and relocations;
4. archived target bytes;
5. normalized instruction comparison where relocations differ only in
   representation.

Classify outcomes:

```text
same-output-target-match
same-output-target-mismatch
real-aspsx-target-match-maspsx-mismatch
maspsx-target-match-real-aspsx-mismatch
assembler-outputs-differ-neither-matches
unavailable-or-inconclusive
```

Only `real-aspsx-target-match-maspsx-mismatch`, with identical input text and a
classified assembler operation, proves a maspsx emulation gap.

## Artifacts

Write reproducible diagnostics under:

```text
build/assemblerDifferential/<func>/
├── input.s
├── manifest.json
├── aspsx.obj
├── aspsx.sections.json
├── maspsx.o
├── maspsx.sections.json
├── target.sections.json
└── diff.txt
```

The manifest should record hashes and versions without copying proprietary
assembler binaries into the repository.

## Tests

### Unit tests

- parse minimal LNK section and bytes records;
- parse relocations used by branch and symbol references;
- reject malformed/truncated LNK files;
- compare objects with identical bytes;
- distinguish raw-byte relocation noise from instruction differences;
- classify each outcome above.

### Integration tests

When real ASPSX is configured:

1. assemble a tiny relocation-free fixture through both paths;
2. assemble a branch/delay-slot fixture;
3. assemble `li` forms around the ASPSX version boundary;
4. reproduce one documented maspsx issue fixture;
5. preserve `func_800154CC` as a same-output-target-mismatch regression: both
   assemblers must retain the same wrong pre-solution order.

Tests requiring proprietary local tools should skip clearly in CI rather than
failing or downloading binaries implicitly.

## Acceptance criteria

- One command reproduces the manual `func_800154CC` boundary proof.
- The exact same assembly bytes are fed to both assembler paths.
- Relocations are compared explicitly.
- Output states what is proven and what remains inconclusive.
- No proprietary SDK executable or generated object is committed.
- The diagnostic never recommends changing C when a same-input assembler gap
  has been proven, and never labels a source-search failure as an assembler bug.
