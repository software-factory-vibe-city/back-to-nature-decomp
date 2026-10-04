---
name: psx-document-resources
description: Document one verified asset in notes/asset-identification.md through the in-TUI extraction loop's scoped commit gate, including source hashes and reproducible extraction instructions. Generated assets stay under build/assets/.
---

# Identify and document an asset

You are the documentation role in the same TUI session. The user authorized
commits per successful extraction iteration. No forked worker or separate agent
is needed. Treat earlier prose as unverified; the byte/provenance oracle is the
authority. Do not edit files or run shell/build commands yourself.

1. Inspect the selected run/node with `psx_resource_document`, action `bundle`.
   Use the node ID for focused facts. The handoff is verified and records the
   parser, source extents, stages, output hashes, assumptions and limitations.
2. Describe only supported findings. Structural compatibility is not a game
   asset name or consumer association. Distinguish preservation, decoding and
   export. Cite existing evidence IDs for any additional observations.
3. Finish with `psx_resource_iteration`, action `asset`, optionally passing
   `claims: [{ text, evidence: [IDs] }]`. It extracts/replays the selected node,
   appends its verified facts and extraction procedure to
   `notes/asset-identification.md`, and commits only that file. Extra prose is
   explicitly qualified as candidate interpretation.
4. Stop on `asset-committed`. The controller then continues finding assets or
   invokes the parser-builder skill. An assistant's final prose alone does not
   finish an iteration.

Assets and full evidence remain in `build/assets/`, never Git. PPM is lossy with
respect to transparency/STP: reference raw/RGBA/STP representations as well.
Do not invent total asset counts, palette names, model hierarchies, playback
semantics or historical file boundaries. A failed documentation/commit gate
must not erase already verified generated artifacts. Reusable broader notes
can be proposed later, but this role commits only the asset-identification ledger.
