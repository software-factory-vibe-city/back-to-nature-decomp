# Prompt resources

The active Pi workflows live under `.pi/skills/`.

`c-style-guide.md` holds the always-applicable rules: the clean-source policy,
natural-C shape, C89 form and the final checklist. Everything that belongs to a
single compiler pass lives in `reference/`, one sheet per owning pass, served by
`psx_reference` when the pipeline reversal names that pass.

The split replaced a single 67 KB mandatory read. An agent was spending a large
share of its context on doctrine for passes that did not own its residual,
before it had measured anything. Concrete target and toolchain facts stay in
`configs/project-profile.md` and are not restated in either place.

`legacy/` contains templates from the retired standalone prompt-injection
workflow. They are retained only for the manual `tools/agent/getPrompt.ts` CLI
and historical reproducibility. The Pi commands and autonomous workers do not
load them.
