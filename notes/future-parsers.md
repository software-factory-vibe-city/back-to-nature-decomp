# Future resource parsers

## Priority: VAB sample banks and SEQ music

The existing extractor exports XA audio streams, not all of the game's audio.
A second substantial audio source is packed inside `extracted/iso/a_file.bin`.
These resources are not separate files in the extracted ISO directory.

### Located sound region

- Archive entry: **9**, using the boundaries in `extracted/iso/a_file.hdt`.
- Start: **`0x06E1E000`**.
- End, exclusive: **`0x073D8800`**.
- Length: **6,006,784 bytes**.
- Coordinates are byte offsets within the consumed archive, not disc LBAs.

| Observation | Count |
|---|---:|
| VAB sample-bank occurrences | 39 |
| Sample entries across those banks | 299 |
| Distinct compressed sample payloads | 226 |
| SEQ music-sequence headers | 36 |

These counts do not establish 299 unique sound effects or 36 uniquely identified
songs. Samples can be shared, and playback depends on bank/tone configuration.
Specific sound names, song names and gameplay associations remain unresolved.

### Evidence and layout caveats

- All 39 bank headers carry the little-endian `pBAV` signature and version 7.
  Header program/tone counts agree with the program tables.
- Sample-length tables, using eight-byte size units, account for each bank's
  declared size. Header and sample-body extents fit their loader-table boundaries.
- All **336,612** checked 16-byte SPU ADPCM frames have legal predictor, shift and
  flag fields. This is structural validation, not an independent PCM decode.
- The 36 `pQES` headers have version 1, resolution 480, and plausible tempo/time
  signature fields. Their starts also occur in the original loader table;
  complete event-stream parsing and playback have not yet been implemented.
- The executable's table at **`0x80049370`–`0x800495CC`**, end exclusive, contains
  151 32-bit words. Archive-relative offsets link the bank headers, sample bodies
  and sequence starts to entry 9. Its final boundary is `0x005BA800`, matching
  the sound region's length.
- **VH headers and VB sample bodies are separately padded in the archive.** Do
  not assume the body immediately follows the compact header, or use the VAB
  declared size as the complete physical stored extent. Use the witnessed loader
  boundaries when locating sample bytes; include this interpretation in provenance.
- Original instructions in `func_80020E58` call `SsVabOpenHead`;
  `func_80021668` calls `SsVabTransBodyPartly`; `func_80020818` calls `SsSeqOpen`.
  Other sound routines call `SsUtKeyOn` / `SsUtKeyOnV`. Original disassembly is
  available under `build/functions/`; `include/psyq/libsnd.h` supplies the SDK
  bank/program/tone structures and API declarations.

### Suggested implementation order

1. **VAB bank extraction and SPU ADPCM decoding.** Recover the header/body
   relationship, sample boundaries, program/tone references, tuning, envelopes
   and loop/end flags. Preserve native bank/sample bytes and export usable WAV
   derivatives with playback-rate/pitch assumptions explicitly documented.
   Standalone `VAGp` headers are not required for samples embedded in a bank.
2. **SEQ parsing and export.** Validate the complete event stream, timing,
   termination/loop behavior and associated bank references. A sequence contains
   notes and timing, not a recorded waveform; a MIDI export alone is not a
   reconstruction of the game's sound.
3. **SEQ plus bank synthesis.** Render music using the associated samples and
   witnessed playback parameters. Verify complete results against an independent
   implementation before claiming faithful audio reproduction.

Implement these as tested capabilities in the existing parser/view framework,
not a separate extraction loop. Preserve all source occurrences while
content-deduplicating exports into the existing flat `sounds/` folder. Do not
promote signature hits or invent semantic names, missing dependencies or playback
parameters merely to produce output.

### Original input fingerprints

| Input | SHA-256 |
|---|---|
| `extracted/iso/a_file.bin` | `612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4` |
| `extracted/iso/a_file.hdt` | `0cae44d6bdb29e078a182d7cd9a780c21e35dc54f55eb94c2d9ea8deb20c82dd` |
| `extracted/iso/slus_011.15` | `34e3b35dcd3fb1cd9a7d4813b8a9ef987915826e3d436f1908ecbe2d4fdf1444` |
