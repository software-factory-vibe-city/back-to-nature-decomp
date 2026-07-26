# Prompt resources

The active Pi workflows live under `.pi/skills/`.

`c-style-guide.md` is the mandatory matching-decompilation field manual read by
the function decompilation skill. It is reusable doctrine and derives concrete
target/toolchain facts from `configs/project-profile.md`.

`legacy/` contains templates from the retired standalone prompt-injection
workflow. They are retained only for the manual `tools/agent/getPrompt.ts` CLI
and historical reproducibility. The Pi commands and autonomous workers do not
load them.
