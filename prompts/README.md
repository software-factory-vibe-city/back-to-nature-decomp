# Prompt resources

The active Pi workflows live under `.pi/skills/`, and the always-applicable
rules are in `AGENTS.md`.

`reference/` holds one mechanism sheet per compiler pass, served by
`psx_reference`. The pipeline reversal names the sheet for the pass that owns a
residual, and triage findings link the sheet for their symptom.

The sheets replaced a single 67 KB mandatory read. An agent was spending a large
share of its context on doctrine for passes that did not own its residual,
before it had measured anything. The short style guide left over from that
split was retired on 2026-10-09. Its natural-C rule moved into the decompile
skill, and the rest already lived in `AGENTS.md`, the sheets or the tools.
Concrete target and toolchain facts stay in `configs/project-profile.md` and are
not restated here.

`legacy/` contains templates from the retired standalone prompt-injection
workflow. They are retained only for the manual `tools/agent/getPrompt.ts` CLI
and historical reproducibility. The Pi commands and autonomous workers do not
load them.
