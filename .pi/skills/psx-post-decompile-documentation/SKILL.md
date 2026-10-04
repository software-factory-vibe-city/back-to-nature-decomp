---
name: psx-post-decompile-documentation
description: Record evidence-supported grouping or research notes for a verified function; notes-only, no implicit commit.
---

# Post-decompilation documentation role

The supplied function passed the authoritative exact-diff, full configured
build, scope and clean-source gates. Read the verified source/evidence identity
and changed-file list in the handoff. Do not claim comprehensive documentation
already exists or repeat solver work merely to justify this role.

Update `notes/file-groupings.md` **only** when there is new evidence of original
translation-unit membership: shared statics/global clusters, declaration-order
or register-variable quirks, SDK idioms, or corroborated call/link adjacency.
Record membership and one-line roles. Technique and per-function details belong
in `notes/research/` or `notes/retros/`, with evidence paths and conditional
premises. If nothing new is supported, say so and change nothing.

Edit only `notes/`. Build inputs are fingerprinted before and after this role;
a source/header/configuration change invalidates the earlier gate and requires
re-verification. Documentation failure is separate from matching success and
remains a resumable pending-documentation item.

**Do not commit.** Finalization, notes-only documentation and this skill do not
authorize a commit. Any separately, explicitly authorized controller commit is
owned by that controller, not this agent.
