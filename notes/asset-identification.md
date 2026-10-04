# Asset identification

The extraction loop adds an entry here only after source extents, output hashes
and supported decoding have been verified. Each successful asset iteration
commits its extraction instructions and qualified evidence to this ledger.

Generated resources and full reports remain under `build/assets/` and are not
committed. Browse the image files in `build/assets/images/<asset-id>/`:
`original.tim`, `bank-0.ppm`, RGBA/STP files and an `asset.json` provenance
sidecar. `build/assets/index.json` catalogs the named files across runs. The
backing paths in older entries below remain valid; current extraction also
publishes these readable copies. Other categories appear when supported assets
are extracted, not as empty placeholders.

A parser-compatible asset does not acquire a historical name or consumer meaning
without evidence. Total game asset count is unknown.

Accepted asset iterations are recorded below.

<!-- resource-asset:node-eae93fafa81ebc8cd46dfb5c -->
## node-eae93fafa81ebc8cd46dfb5c — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-517cdd138663c57f8e9ed629. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-eae93fafa81ebc8cd46dfb5c",
    "blob": "blobs/48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133056512
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133056512}}, SHA-256 48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6
- `build/assets/blobs/78ff86097195c3433da42d4cd65fbef4eda959a49b6648cbda02a01541be471f`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 78ff86097195c3433da42d4cd65fbef4eda959a49b6648cbda02a01541be471f
- `build/assets/blobs/b3d6095313cb6fc927f42845449eb51e3b5881aab6ae5c99ffe684d525bf505a`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 b3d6095313cb6fc927f42845449eb51e3b5881aab6ae5c99ffe684d525bf505a
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-084b4f9a8af61a520fd97dbd.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 99a61489af9bf72b8c4632453e948a7113ff66a448761456dda30c7bfa4d9e6b

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-286663126716897f8c7c2636 -->
## node-286663126716897f8c7c2636 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-0da147185199a16663cfa9a7. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-286663126716897f8c7c2636",
    "blob": "blobs/8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133056704
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133056704}}, SHA-256 8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f
- `build/assets/blobs/49f4877bd32c7b0b9f2afc517cbc91189d2c4d3617d0440263db053ec6c9021a`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 49f4877bd32c7b0b9f2afc517cbc91189d2c4d3617d0440263db053ec6c9021a
- `build/assets/blobs/9a77ee262e1d11b9fef638649474e5a7333398568cc4a5785caba7452ca3adb8`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 9a77ee262e1d11b9fef638649474e5a7333398568cc4a5785caba7452ca3adb8
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-7d1eef6a7834a7837fb80dca.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 cee2d89b0a9ac52b75c46c0e049f5542a67c3d8f17c35954fe14320051eeecc5

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-225f79cdf791823a677bf0e0 -->
## node-225f79cdf791823a677bf0e0 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-42cd88c83d4741f30674e000. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-225f79cdf791823a677bf0e0",
    "blob": "blobs/0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133056896
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133056896}}, SHA-256 0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363
- `build/assets/blobs/5abcfedda5e5e66a8a8efefeffc5a2b75f69d13a880b65cc1739db3f9a0dd4e1`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 5abcfedda5e5e66a8a8efefeffc5a2b75f69d13a880b65cc1739db3f9a0dd4e1
- `build/assets/blobs/4d0d09ec9d79ebf4750fc82e935eab11a9f89ba4f23126f55edb8379c3800a5b`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 4d0d09ec9d79ebf4750fc82e935eab11a9f89ba4f23126f55edb8379c3800a5b
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-4f38856ddf1c62cc1be4f96d.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 0ce93472a25b07d4e09e6c4cc7ba404e5dd8e13041cb01cb1e9c8ec76c27609e

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-c31b1dd26785a450f9f839c5 -->
## node-c31b1dd26785a450f9f839c5 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-5efa08330868db7cd715eadc. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-c31b1dd26785a450f9f839c5",
    "blob": "blobs/f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133057088
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133057088}}, SHA-256 f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f
- `build/assets/blobs/dd43ea4e4ce3dec4907b61d7a7dffe3afc25e1072c708da77a6ffa59576740ec`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 dd43ea4e4ce3dec4907b61d7a7dffe3afc25e1072c708da77a6ffa59576740ec
- `build/assets/blobs/ba3ce24328675fa2701253f7cb4da32e3e08164a709dcf925cf1e4e3e56dff6b`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 ba3ce24328675fa2701253f7cb4da32e3e08164a709dcf925cf1e4e3e56dff6b
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-1b4eb40e2a62fe576be1bbaa.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 7028ebb8f335137452e0c4917667afcc20b0d5b31a405435766d52da73b1ed29

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-6df0b51989facab29f1b5d1a -->
## node-6df0b51989facab29f1b5d1a — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-f6674c098e36421e6d9c5dbb. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-6df0b51989facab29f1b5d1a",
    "blob": "blobs/6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133057280
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133057280}}, SHA-256 6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb
- `build/assets/blobs/ef6a5b22da8897f8c882607d61f98c1d82c0b0047474b6a0a9b633bf29019a3e`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 ef6a5b22da8897f8c882607d61f98c1d82c0b0047474b6a0a9b633bf29019a3e
- `build/assets/blobs/54ed472ff9a1494b77528fb86775bf326ab96af1438d8b64ccea3c7db3ccf054`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 54ed472ff9a1494b77528fb86775bf326ab96af1438d8b64ccea3c7db3ccf054
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-b34a14b03e787ac37a66c46e.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 8fb3c5421a65ac1c02c71955093750002cdc7b57b71738d0d23f35e60a001bcc

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-fcb78af3915630e2ece6babe -->
## node-fcb78af3915630e2ece6babe — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-9e1763589205df72b46a33e9. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-fcb78af3915630e2ece6babe",
    "blob": "blobs/e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133057472
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133057472}}, SHA-256 e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58
- `build/assets/blobs/8b6ca7bc8f1a5dec636286c599d86ae4bfad5b76eea312524867d20aa34a5aec`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 8b6ca7bc8f1a5dec636286c599d86ae4bfad5b76eea312524867d20aa34a5aec
- `build/assets/blobs/ec4afcc02b88e514c5852cd2f7764c67e404ca0668428792336c9453e729ba73`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 ec4afcc02b88e514c5852cd2f7764c67e404ca0668428792336c9453e729ba73
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-eaa51ef81b3adc2104a6eebe.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 a897e4c353f46d3e2fd3a53eb4c4cb2d6d4c2855bfba75c0921a8845204ac3eb

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-20ed2f75ace4565907f4fdd5 -->
## node-20ed2f75ace4565907f4fdd5 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-edfed16ce5e7daddc9a23809. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-20ed2f75ace4565907f4fdd5",
    "blob": "blobs/fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133057664
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133057664}}, SHA-256 fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859
- `build/assets/blobs/6ffaabd294868cab256099c9caf9f4b49ee6227703559475f6bdf2857d7b0b43`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 6ffaabd294868cab256099c9caf9f4b49ee6227703559475f6bdf2857d7b0b43
- `build/assets/blobs/5c372e1d9614d90d280a8f9c5ebe03fa120e0fed55936d1d3f386dea350b76b2`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 5c372e1d9614d90d280a8f9c5ebe03fa120e0fed55936d1d3f386dea350b76b2
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-7aba0b4095fbf06baad13beb.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 88c4d47ee06a84deafe89a9d83b7ee767e1bf6abf5ee2a4313310f50c1bee1e9

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-1b1725e04cca679c1e14bb8a -->
## node-1b1725e04cca679c1e14bb8a — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-7e192d30cd5ff72f154a3764. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-1b1725e04cca679c1e14bb8a",
    "blob": "blobs/077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133057856
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133057856}}, SHA-256 077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42
- `build/assets/blobs/9d362badabfda3d0c73899e696d9bb5b7ed8df4cab5fed9c0bb8e2fd7226f4cd`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 9d362badabfda3d0c73899e696d9bb5b7ed8df4cab5fed9c0bb8e2fd7226f4cd
- `build/assets/blobs/0236a5659a4e4a464fd4f64621b4749aab205b103b55fc8b3bb798965b7b17a6`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 0236a5659a4e4a464fd4f64621b4749aab205b103b55fc8b3bb798965b7b17a6
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-e3549f8bf9a02979208d7c46.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 6a33699a6f89d92b469d3a3048e0ba549481ad2179a29ff56b1e3c934b6676fc

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-b482d48ffe4afcb480534af2 -->
## node-b482d48ffe4afcb480534af2 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-345023f861a410d28be878fc. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-b482d48ffe4afcb480534af2",
    "blob": "blobs/a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133058048
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133058048}}, SHA-256 a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d
- `build/assets/blobs/fcc5b49f1b921863aebcd2741ad4776477da5853b781289e9c47f88c6b9cceed`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 fcc5b49f1b921863aebcd2741ad4776477da5853b781289e9c47f88c6b9cceed
- `build/assets/blobs/1c1cbfe45c6e7fc5b7efce457cc5cff16882ec41bbb4d117a4b7daa0340dca83`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 1c1cbfe45c6e7fc5b7efce457cc5cff16882ec41bbb4d117a4b7daa0340dca83
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-a0334bf7a7125fb9d7420df9.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 6451bddafe68e8c1eb3dc30cf5e025aa37ab5de7bc138c093b22402634138eef

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-bc90c981368b7143d38d2788 -->
## node-bc90c981368b7143d38d2788 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-af112959b61452ce08ad5ea4. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-bc90c981368b7143d38d2788",
    "blob": "blobs/36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133058240
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133058240}}, SHA-256 36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02
- `build/assets/blobs/72a446fe1d48284b8f5416b72c191a139f2f9ecb117140eab3e4e5ad94cabcf2`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 72a446fe1d48284b8f5416b72c191a139f2f9ecb117140eab3e4e5ad94cabcf2
- `build/assets/blobs/f4bdb6604f837c2c49f1f71fceb6b2aa1a30435354750922c4f19ff042685ebb`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 f4bdb6604f837c2c49f1f71fceb6b2aa1a30435354750922c4f19ff042685ebb
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-e353f4ba1b89a1dff046c37f.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 684e3673708e80bc9f2b7a6c4438b82ec48250522adaeeb09be8bc8a4dcbaf4b

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-92555b2100f0c7fa123f4e0d -->
## node-92555b2100f0c7fa123f4e0d — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-c4505a0259c435dea40bcad5. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-92555b2100f0c7fa123f4e0d",
    "blob": "blobs/12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133058432
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133058432}}, SHA-256 12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc
- `build/assets/blobs/3a8d2de58dfac7041fd318c309205043d768d7e0538acc072b21412c9bd5a8b8`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 3a8d2de58dfac7041fd318c309205043d768d7e0538acc072b21412c9bd5a8b8
- `build/assets/blobs/6c4c138b0e9161724332ca7cedbfe8777218bdee0cadd8e166140724ec66072b`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 6c4c138b0e9161724332ca7cedbfe8777218bdee0cadd8e166140724ec66072b
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-3e0791dba321eb669d1e84db.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 e95fc3e3090b228c43b90154ad10b9eb4caa79bb77beb77ae5d1a9a9d49399e3

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-17b597c21d13d77c2264224b -->
## node-17b597c21d13d77c2264224b — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d; 192 bytes.
- Verified manifest: ac361a9cf5ab9b2d812f2a462a59cac1aa9fd8e7f687f3f1c221c8526dc2ef99.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-25a33978c25efcb945e04bbe. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-17b597c21d13d77c2264224b",
    "blob": "blobs/5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 133058624
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted/iso/a_file.bin' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Generated artifacts (not committed):
- `build/assets/blobs/5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-5fe7a25fe1c481a46175463f","offset":133058624}}, SHA-256 5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d
- `build/assets/blobs/42718f9d34a0dd2ee25afa356cdec75667ee20ae99a1957c62a5a86344385a86`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 42718f9d34a0dd2ee25afa356cdec75667ee20ae99a1957c62a5a86344385a86
- `build/assets/blobs/99ae514bd73ff00ff375e7a5a42cb65ba73e4ab1802bac9c65264ac5262261d3`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 99ae514bd73ff00ff375e7a5a42cb65ba73e4ab1802bac9c65264ac5262261d3
- `build/assets/runs/e752a32e1798386f-619f198c099e90d0/exports/artifact-accbedc2ab2bdfdeed363af3.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 48ead290f3557c53d43e2f3aa280ce467dc2324190e5e18e79b0fb76d257e241

### Qualified observations

Semantic name and consumer association remain unknown.

<!-- resource-asset:node-aeddcec0122cf9ba6e874f1b -->
## node-aeddcec0122cf9ba6e874f1b — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6; 192 bytes.
- Verified manifest: 84fc650d1f974debbd3d18ff537321d4073c05e620abaa88675d589658e9a18b.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-01fd2992250408e6e7ea1c33. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-aeddcec0122cf9ba6e874f1b",
    "blob": "blobs/48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 0
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-aeddcec0122cf9ba6e874f1b/original.tim`: extraction, SHA-256 48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6
- `build/assets/images/node-aeddcec0122cf9ba6e874f1b/bank-0.rgba`: decoding, SHA-256 78ff86097195c3433da42d4cd65fbef4eda959a49b6648cbda02a01541be471f
- `build/assets/images/node-aeddcec0122cf9ba6e874f1b/bank-0.stp`: decoding, SHA-256 b3d6095313cb6fc927f42845449eb51e3b5881aab6ae5c99ffe684d525bf505a
- `build/assets/images/node-aeddcec0122cf9ba6e874f1b/bank-0.ppm`: export, SHA-256 99a61489af9bf72b8c4632453e948a7113ff66a448761456dda30c7bfa4d9e6b

Backing artifacts (not committed):
- `build/assets/blobs/48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":0}}, SHA-256 48fc51ce1f6e2cbbf200d4f825a49b0d6b952ba82e3713eb0f522224a2582eb6
- `build/assets/blobs/78ff86097195c3433da42d4cd65fbef4eda959a49b6648cbda02a01541be471f`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 78ff86097195c3433da42d4cd65fbef4eda959a49b6648cbda02a01541be471f
- `build/assets/blobs/b3d6095313cb6fc927f42845449eb51e3b5881aab6ae5c99ffe684d525bf505a`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 b3d6095313cb6fc927f42845449eb51e3b5881aab6ae5c99ffe684d525bf505a
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-4393b1ad8f3369f8dd2769f6.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 99a61489af9bf72b8c4632453e948a7113ff66a448761456dda30c7bfa4d9e6b

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 0, length 192 bytes, with stages discovery and extraction validated. [evidence-01fd2992250408e6e7ea1c33]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20, positioned at (320, 1). [evidence-01fd2992250408e6e7ea1c33]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-01fd2992250408e6e7ea1c33]

<!-- resource-asset:node-1ec407b54e85b3a8bc982975 -->
## node-1ec407b54e85b3a8bc982975 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f; 192 bytes.
- Verified manifest: 0be13425eea34e7bac6eb535adbdd6b90b80d35a91812edf5a985e3760fa25ec.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-5aefab2a49bc5fa6eba21fe5. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-1ec407b54e85b3a8bc982975",
    "blob": "blobs/8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 192
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-1ec407b54e85b3a8bc982975/original.tim`: extraction, SHA-256 8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f
- `build/assets/images/node-1ec407b54e85b3a8bc982975/bank-0.rgba`: decoding, SHA-256 49f4877bd32c7b0b9f2afc517cbc91189d2c4d3617d0440263db053ec6c9021a
- `build/assets/images/node-1ec407b54e85b3a8bc982975/bank-0.stp`: decoding, SHA-256 9a77ee262e1d11b9fef638649474e5a7333398568cc4a5785caba7452ca3adb8
- `build/assets/images/node-1ec407b54e85b3a8bc982975/bank-0.ppm`: export, SHA-256 cee2d89b0a9ac52b75c46c0e049f5542a67c3d8f17c35954fe14320051eeecc5

Backing artifacts (not committed):
- `build/assets/blobs/8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":192}}, SHA-256 8077d636217ff20fe36ec64a3a6f0a93d8681f6528d185117f866fb0ec332a2f
- `build/assets/blobs/49f4877bd32c7b0b9f2afc517cbc91189d2c4d3617d0440263db053ec6c9021a`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 49f4877bd32c7b0b9f2afc517cbc91189d2c4d3617d0440263db053ec6c9021a
- `build/assets/blobs/9a77ee262e1d11b9fef638649474e5a7333398568cc4a5785caba7452ca3adb8`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 9a77ee262e1d11b9fef638649474e5a7333398568cc4a5785caba7452ca3adb8
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-6fe2b592b0fca318569df0a7.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 cee2d89b0a9ac52b75c46c0e049f5542a67c3d8f17c35954fe14320051eeecc5

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 192, length 192 bytes, with stages discovery and extraction validated. [evidence-5aefab2a49bc5fa6eba21fe5]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (324, 1). [evidence-5aefab2a49bc5fa6eba21fe5]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-5aefab2a49bc5fa6eba21fe5]

<!-- resource-asset:node-0b71b7e6dc8263037942caad -->
## node-0b71b7e6dc8263037942caad — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363; 192 bytes.
- Verified manifest: a74c83d32c72ac87e1f174627555fd2d5e2c5a957b56cf7788d58e0b746969cc.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-a39e48c3c7409526bf22b8e0. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-0b71b7e6dc8263037942caad",
    "blob": "blobs/0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 384
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-0b71b7e6dc8263037942caad/original.tim`: extraction, SHA-256 0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363
- `build/assets/images/node-0b71b7e6dc8263037942caad/bank-0.rgba`: decoding, SHA-256 5abcfedda5e5e66a8a8efefeffc5a2b75f69d13a880b65cc1739db3f9a0dd4e1
- `build/assets/images/node-0b71b7e6dc8263037942caad/bank-0.stp`: decoding, SHA-256 4d0d09ec9d79ebf4750fc82e935eab11a9f89ba4f23126f55edb8379c3800a5b
- `build/assets/images/node-0b71b7e6dc8263037942caad/bank-0.ppm`: export, SHA-256 0ce93472a25b07d4e09e6c4cc7ba404e5dd8e13041cb01cb1e9c8ec76c27609e

Backing artifacts (not committed):
- `build/assets/blobs/0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":384}}, SHA-256 0593f75f688f282b24ed7889f6534c8996b0f34b12439ce9235746e9a171d363
- `build/assets/blobs/5abcfedda5e5e66a8a8efefeffc5a2b75f69d13a880b65cc1739db3f9a0dd4e1`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 5abcfedda5e5e66a8a8efefeffc5a2b75f69d13a880b65cc1739db3f9a0dd4e1
- `build/assets/blobs/4d0d09ec9d79ebf4750fc82e935eab11a9f89ba4f23126f55edb8379c3800a5b`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 4d0d09ec9d79ebf4750fc82e935eab11a9f89ba4f23126f55edb8379c3800a5b
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-cdedb724cc39c098c38899c8.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 0ce93472a25b07d4e09e6c4cc7ba404e5dd8e13041cb01cb1e9c8ec76c27609e

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 384, length 192 bytes, with stages discovery and extraction validated. [evidence-a39e48c3c7409526bf22b8e0]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (328, 1). [evidence-a39e48c3c7409526bf22b8e0]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-a39e48c3c7409526bf22b8e0]

<!-- resource-asset:node-1df572b4f9718339479d069f -->
## node-1df572b4f9718339479d069f — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f; 192 bytes.
- Verified manifest: c4e216a658bdd25617c055f7fcaf3db554b28dbbd816a030a15f3832d0d5ca72.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-cb2fc2d043f686e09cdb3457. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-1df572b4f9718339479d069f",
    "blob": "blobs/f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 576
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-1df572b4f9718339479d069f/original.tim`: extraction, SHA-256 f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f
- `build/assets/images/node-1df572b4f9718339479d069f/bank-0.rgba`: decoding, SHA-256 dd43ea4e4ce3dec4907b61d7a7dffe3afc25e1072c708da77a6ffa59576740ec
- `build/assets/images/node-1df572b4f9718339479d069f/bank-0.stp`: decoding, SHA-256 ba3ce24328675fa2701253f7cb4da32e3e08164a709dcf925cf1e4e3e56dff6b
- `build/assets/images/node-1df572b4f9718339479d069f/bank-0.ppm`: export, SHA-256 7028ebb8f335137452e0c4917667afcc20b0d5b31a405435766d52da73b1ed29

Backing artifacts (not committed):
- `build/assets/blobs/f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":576}}, SHA-256 f355ed3c02619d949ccf1be7a4b8a4ce72f4c35c6609d43b1101b707f98a3f3f
- `build/assets/blobs/dd43ea4e4ce3dec4907b61d7a7dffe3afc25e1072c708da77a6ffa59576740ec`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 dd43ea4e4ce3dec4907b61d7a7dffe3afc25e1072c708da77a6ffa59576740ec
- `build/assets/blobs/ba3ce24328675fa2701253f7cb4da32e3e08164a709dcf925cf1e4e3e56dff6b`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 ba3ce24328675fa2701253f7cb4da32e3e08164a709dcf925cf1e4e3e56dff6b
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-3a4d81ec88d2a99c956eaaf7.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 7028ebb8f335137452e0c4917667afcc20b0d5b31a405435766d52da73b1ed29

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 576, length 192 bytes, with stages discovery and extraction validated. [evidence-cb2fc2d043f686e09cdb3457]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (320, 1). [evidence-cb2fc2d043f686e09cdb3457]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-cb2fc2d043f686e09cdb3457]

<!-- resource-asset:node-639bd53bcf4d8654b1055378 -->
## node-639bd53bcf4d8654b1055378 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb; 192 bytes.
- Verified manifest: 6ba56b80b4e224f3c12365814d3e9b7ef9e536a61511146d2ff43d5c357928ad.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-f8f92f36c4be3fc4fe295bcc. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-639bd53bcf4d8654b1055378",
    "blob": "blobs/6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 768
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-639bd53bcf4d8654b1055378/original.tim`: extraction, SHA-256 6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb
- `build/assets/images/node-639bd53bcf4d8654b1055378/bank-0.rgba`: decoding, SHA-256 ef6a5b22da8897f8c882607d61f98c1d82c0b0047474b6a0a9b633bf29019a3e
- `build/assets/images/node-639bd53bcf4d8654b1055378/bank-0.stp`: decoding, SHA-256 54ed472ff9a1494b77528fb86775bf326ab96af1438d8b64ccea3c7db3ccf054
- `build/assets/images/node-639bd53bcf4d8654b1055378/bank-0.ppm`: export, SHA-256 8fb3c5421a65ac1c02c71955093750002cdc7b57b71738d0d23f35e60a001bcc

Backing artifacts (not committed):
- `build/assets/blobs/6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":768}}, SHA-256 6e752f993db5808deb4bbadbfc4de55c16f0128a02e825814e1cc4c8aa941cdb
- `build/assets/blobs/ef6a5b22da8897f8c882607d61f98c1d82c0b0047474b6a0a9b633bf29019a3e`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 ef6a5b22da8897f8c882607d61f98c1d82c0b0047474b6a0a9b633bf29019a3e
- `build/assets/blobs/54ed472ff9a1494b77528fb86775bf326ab96af1438d8b64ccea3c7db3ccf054`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 54ed472ff9a1494b77528fb86775bf326ab96af1438d8b64ccea3c7db3ccf054
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-f1e24a08592b32d25fe7895b.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 8fb3c5421a65ac1c02c71955093750002cdc7b57b71738d0d23f35e60a001bcc

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 768, length 192 bytes, with stages discovery and extraction validated. [evidence-f8f92f36c4be3fc4fe295bcc]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (324, 1). [evidence-f8f92f36c4be3fc4fe295bcc]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-f8f92f36c4be3fc4fe295bcc]

<!-- resource-asset:node-9d2ac312941663260413aa13 -->
## node-9d2ac312941663260413aa13 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58; 192 bytes.
- Verified manifest: f77e80dcb65316ab458aaa4f36ebb07d539f6c2fda61fb31da5d64c4b9b44d81.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-ea8c73b626c717459903ed69. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-9d2ac312941663260413aa13",
    "blob": "blobs/e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 960
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-9d2ac312941663260413aa13/original.tim`: extraction, SHA-256 e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58
- `build/assets/images/node-9d2ac312941663260413aa13/bank-0.rgba`: decoding, SHA-256 8b6ca7bc8f1a5dec636286c599d86ae4bfad5b76eea312524867d20aa34a5aec
- `build/assets/images/node-9d2ac312941663260413aa13/bank-0.stp`: decoding, SHA-256 ec4afcc02b88e514c5852cd2f7764c67e404ca0668428792336c9453e729ba73
- `build/assets/images/node-9d2ac312941663260413aa13/bank-0.ppm`: export, SHA-256 a897e4c353f46d3e2fd3a53eb4c4cb2d6d4c2855bfba75c0921a8845204ac3eb

Backing artifacts (not committed):
- `build/assets/blobs/e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":960}}, SHA-256 e1ec82049d79bb0e8e359d3944e3e4c68ee4c4e905dd2996e3de72131cfc2e58
- `build/assets/blobs/8b6ca7bc8f1a5dec636286c599d86ae4bfad5b76eea312524867d20aa34a5aec`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 8b6ca7bc8f1a5dec636286c599d86ae4bfad5b76eea312524867d20aa34a5aec
- `build/assets/blobs/ec4afcc02b88e514c5852cd2f7764c67e404ca0668428792336c9453e729ba73`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 ec4afcc02b88e514c5852cd2f7764c67e404ca0668428792336c9453e729ba73
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-c457138bfd0f0c1add21c905.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 a897e4c353f46d3e2fd3a53eb4c4cb2d6d4c2855bfba75c0921a8845204ac3eb

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 960, length 192 bytes, with stages discovery and extraction validated. [evidence-ea8c73b626c717459903ed69]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (328, 1). [evidence-ea8c73b626c717459903ed69]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-ea8c73b626c717459903ed69]

<!-- resource-asset:node-22e508386963014f311f6076 -->
## node-22e508386963014f311f6076 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859; 192 bytes.
- Verified manifest: 71e31cfaace2ca3fdf304044a03979d62f77460a6d1afaf9082231d0d53ae7b5.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-dfc00279e80be3ca93c3a2af. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-22e508386963014f311f6076",
    "blob": "blobs/fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 1152
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-22e508386963014f311f6076/original.tim`: extraction, SHA-256 fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859
- `build/assets/images/node-22e508386963014f311f6076/bank-0.rgba`: decoding, SHA-256 6ffaabd294868cab256099c9caf9f4b49ee6227703559475f6bdf2857d7b0b43
- `build/assets/images/node-22e508386963014f311f6076/bank-0.stp`: decoding, SHA-256 5c372e1d9614d90d280a8f9c5ebe03fa120e0fed55936d1d3f386dea350b76b2
- `build/assets/images/node-22e508386963014f311f6076/bank-0.ppm`: export, SHA-256 88c4d47ee06a84deafe89a9d83b7ee767e1bf6abf5ee2a4313310f50c1bee1e9

Backing artifacts (not committed):
- `build/assets/blobs/fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":1152}}, SHA-256 fe24a8cd4f3cbee7414278b57eb546ab48ad8a0e38d60c6b0956b6e049163859
- `build/assets/blobs/6ffaabd294868cab256099c9caf9f4b49ee6227703559475f6bdf2857d7b0b43`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 6ffaabd294868cab256099c9caf9f4b49ee6227703559475f6bdf2857d7b0b43
- `build/assets/blobs/5c372e1d9614d90d280a8f9c5ebe03fa120e0fed55936d1d3f386dea350b76b2`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 5c372e1d9614d90d280a8f9c5ebe03fa120e0fed55936d1d3f386dea350b76b2
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-d42f2e58006f8018441d45fe.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 88c4d47ee06a84deafe89a9d83b7ee767e1bf6abf5ee2a4313310f50c1bee1e9

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 1152, length 192 bytes, with stages discovery and extraction validated. [evidence-dfc00279e80be3ca93c3a2af]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (320, 1). [evidence-dfc00279e80be3ca93c3a2af]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-dfc00279e80be3ca93c3a2af]

<!-- resource-asset:node-7a8c5002d34aabcb589ec52c -->
## node-7a8c5002d34aabcb589ec52c — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42; 192 bytes.
- Verified manifest: 8ba288759b27f2894606441e5eae928b1d718a381930e896457756d62d357436.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-de61de6615b3fdf34c9484f6. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-7a8c5002d34aabcb589ec52c",
    "blob": "blobs/077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 1344
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-7a8c5002d34aabcb589ec52c/original.tim`: extraction, SHA-256 077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42
- `build/assets/images/node-7a8c5002d34aabcb589ec52c/bank-0.rgba`: decoding, SHA-256 9d362badabfda3d0c73899e696d9bb5b7ed8df4cab5fed9c0bb8e2fd7226f4cd
- `build/assets/images/node-7a8c5002d34aabcb589ec52c/bank-0.stp`: decoding, SHA-256 0236a5659a4e4a464fd4f64621b4749aab205b103b55fc8b3bb798965b7b17a6
- `build/assets/images/node-7a8c5002d34aabcb589ec52c/bank-0.ppm`: export, SHA-256 6a33699a6f89d92b469d3a3048e0ba549481ad2179a29ff56b1e3c934b6676fc

Backing artifacts (not committed):
- `build/assets/blobs/077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":1344}}, SHA-256 077e83a23ba876f8388065c0bdfbe750818046c82826472b4566fecc8df9cd42
- `build/assets/blobs/9d362badabfda3d0c73899e696d9bb5b7ed8df4cab5fed9c0bb8e2fd7226f4cd`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 9d362badabfda3d0c73899e696d9bb5b7ed8df4cab5fed9c0bb8e2fd7226f4cd
- `build/assets/blobs/0236a5659a4e4a464fd4f64621b4749aab205b103b55fc8b3bb798965b7b17a6`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 0236a5659a4e4a464fd4f64621b4749aab205b103b55fc8b3bb798965b7b17a6
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-873f3fcd9e8fdcee76c87f18.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 6a33699a6f89d92b469d3a3048e0ba549481ad2179a29ff56b1e3c934b6676fc

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 1344, length 192 bytes, with stages discovery and extraction validated. [evidence-de61de6615b3fdf34c9484f6]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (324, 1). [evidence-de61de6615b3fdf34c9484f6]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-de61de6615b3fdf34c9484f6]

<!-- resource-asset:node-4c144518b1efe2cf43585ecd -->
## node-4c144518b1efe2cf43585ecd — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d; 192 bytes.
- Verified manifest: 4f04440733473a8aca0b4402096f8f271682df77b9bd9d10a4cd01f584f3750b.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-a205b09d62f303301abddb1e. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-4c144518b1efe2cf43585ecd",
    "blob": "blobs/a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 1536
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-4c144518b1efe2cf43585ecd/original.tim`: extraction, SHA-256 a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d
- `build/assets/images/node-4c144518b1efe2cf43585ecd/bank-0.rgba`: decoding, SHA-256 fcc5b49f1b921863aebcd2741ad4776477da5853b781289e9c47f88c6b9cceed
- `build/assets/images/node-4c144518b1efe2cf43585ecd/bank-0.stp`: decoding, SHA-256 1c1cbfe45c6e7fc5b7efce457cc5cff16882ec41bbb4d117a4b7daa0340dca83
- `build/assets/images/node-4c144518b1efe2cf43585ecd/bank-0.ppm`: export, SHA-256 6451bddafe68e8c1eb3dc30cf5e025aa37ab5de7bc138c093b22402634138eef

Backing artifacts (not committed):
- `build/assets/blobs/a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":1536}}, SHA-256 a33d4d2c9082db94bace53ed13dc90ff648891f626a06c53db40ae9f132d7f9d
- `build/assets/blobs/fcc5b49f1b921863aebcd2741ad4776477da5853b781289e9c47f88c6b9cceed`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 fcc5b49f1b921863aebcd2741ad4776477da5853b781289e9c47f88c6b9cceed
- `build/assets/blobs/1c1cbfe45c6e7fc5b7efce457cc5cff16882ec41bbb4d117a4b7daa0340dca83`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 1c1cbfe45c6e7fc5b7efce457cc5cff16882ec41bbb4d117a4b7daa0340dca83
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-412a2e5734195b07845a2234.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 6451bddafe68e8c1eb3dc30cf5e025aa37ab5de7bc138c093b22402634138eef

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 1536, length 192 bytes, with stages discovery and extraction validated. [evidence-a205b09d62f303301abddb1e]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (328, 1). [evidence-a205b09d62f303301abddb1e]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-a205b09d62f303301abddb1e]

<!-- resource-asset:node-e449e49a471633e4c9a24c61 -->
## node-e449e49a471633e4c9a24c61 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02; 192 bytes.
- Verified manifest: 1052cc3434e2e84757d197734077cf8300ff72273ac8b4f91a2df7d76fb9908b.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-3e5ca504696f5d16978af8ae. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-e449e49a471633e4c9a24c61",
    "blob": "blobs/36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 1728
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-e449e49a471633e4c9a24c61/original.tim`: extraction, SHA-256 36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02
- `build/assets/images/node-e449e49a471633e4c9a24c61/bank-0.rgba`: decoding, SHA-256 72a446fe1d48284b8f5416b72c191a139f2f9ecb117140eab3e4e5ad94cabcf2
- `build/assets/images/node-e449e49a471633e4c9a24c61/bank-0.stp`: decoding, SHA-256 f4bdb6604f837c2c49f1f71fceb6b2aa1a30435354750922c4f19ff042685ebb
- `build/assets/images/node-e449e49a471633e4c9a24c61/bank-0.ppm`: export, SHA-256 684e3673708e80bc9f2b7a6c4438b82ec48250522adaeeb09be8bc8a4dcbaf4b

Backing artifacts (not committed):
- `build/assets/blobs/36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":1728}}, SHA-256 36358a01c5289664c35612640bc7475f7f047e4074c5f3fca8df82ebe8fdff02
- `build/assets/blobs/72a446fe1d48284b8f5416b72c191a139f2f9ecb117140eab3e4e5ad94cabcf2`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 72a446fe1d48284b8f5416b72c191a139f2f9ecb117140eab3e4e5ad94cabcf2
- `build/assets/blobs/f4bdb6604f837c2c49f1f71fceb6b2aa1a30435354750922c4f19ff042685ebb`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 f4bdb6604f837c2c49f1f71fceb6b2aa1a30435354750922c4f19ff042685ebb
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-ac252623d71c89a6f0d1bddf.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 684e3673708e80bc9f2b7a6c4438b82ec48250522adaeeb09be8bc8a4dcbaf4b

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 1728, length 192 bytes, with stages discovery and extraction validated. [evidence-3e5ca504696f5d16978af8ae]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (328, 0). [evidence-3e5ca504696f5d16978af8ae]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-3e5ca504696f5d16978af8ae]

<!-- resource-asset:node-cb4eaab638e979118939fd9a -->
## node-cb4eaab638e979118939fd9a — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc; 192 bytes.
- Verified manifest: 52afd72d655bcf41955fe769a23ac17b3b280593fc91f51211ebd330435b9c03.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-651482526f37feda9e09774b. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-cb4eaab638e979118939fd9a",
    "blob": "blobs/12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 1920
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-cb4eaab638e979118939fd9a/original.tim`: extraction, SHA-256 12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc
- `build/assets/images/node-cb4eaab638e979118939fd9a/bank-0.rgba`: decoding, SHA-256 3a8d2de58dfac7041fd318c309205043d768d7e0538acc072b21412c9bd5a8b8
- `build/assets/images/node-cb4eaab638e979118939fd9a/bank-0.stp`: decoding, SHA-256 6c4c138b0e9161724332ca7cedbfe8777218bdee0cadd8e166140724ec66072b
- `build/assets/images/node-cb4eaab638e979118939fd9a/bank-0.ppm`: export, SHA-256 e95fc3e3090b228c43b90154ad10b9eb4caa79bb77beb77ae5d1a9a9d49399e3

Backing artifacts (not committed):
- `build/assets/blobs/12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":1920}}, SHA-256 12d0cd5db4bc7dd043642e3d36368e5c857ef74471c2cfbc3cf12f988e890fcc
- `build/assets/blobs/3a8d2de58dfac7041fd318c309205043d768d7e0538acc072b21412c9bd5a8b8`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 3a8d2de58dfac7041fd318c309205043d768d7e0538acc072b21412c9bd5a8b8
- `build/assets/blobs/6c4c138b0e9161724332ca7cedbfe8777218bdee0cadd8e166140724ec66072b`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 6c4c138b0e9161724332ca7cedbfe8777218bdee0cadd8e166140724ec66072b
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-2473ed487ddea069ade450ba.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 e95fc3e3090b228c43b90154ad10b9eb4caa79bb77beb77ae5d1a9a9d49399e3

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 1920, length 192 bytes, with stages discovery and extraction validated. [evidence-651482526f37feda9e09774b]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (320, 0). [evidence-651482526f37feda9e09774b]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-651482526f37feda9e09774b]

<!-- resource-asset:node-72f2dc357eb7bfaa8b37aad3 -->
## node-72f2dc357eb7bfaa8b37aad3 — TIM

- Parser: tim-v1 v1.
- Raw SHA-256: 5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d; 192 bytes.
- Verified manifest: 24049006b0ef54fac058f6095469a9273d3f770a15a27e49beb1434c9720bf3d.
- Stages: {"decoding":"validated","discovery":"validated","export":"validated","extraction":"validated"}.
- Evidence: evidence-83220d05d637ad6d854fbf41. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-72f2dc357eb7bfaa8b37aad3",
    "blob": "blobs/5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d",
    "size": 192,
    "source": {
      "coordinate": "file-byte",
      "length": 192,
      "node": "input-d0eff97af8780c30caf6a5d7",
      "offset": 2112
    }
  },
  {
    "node": "input-d0eff97af8780c30caf6a5d7",
    "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
    "size": 4096,
    "input": {
      "blob": "blobs/688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "hash": "688ddcdc75fc71f451cb6db1e1b9a7638a4e9caf1d4105cde78d94208f7630cb",
      "id": "input-d0eff97af8780c30caf6a5d7",
      "path": "extracted/overlays/ovl_16.bin",
      "size": 4096
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/images/node-72f2dc357eb7bfaa8b37aad3/original.tim`: extraction, SHA-256 5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d
- `build/assets/images/node-72f2dc357eb7bfaa8b37aad3/bank-0.rgba`: decoding, SHA-256 42718f9d34a0dd2ee25afa356cdec75667ee20ae99a1957c62a5a86344385a86
- `build/assets/images/node-72f2dc357eb7bfaa8b37aad3/bank-0.stp`: decoding, SHA-256 99ae514bd73ff00ff375e7a5a42cb65ba73e4ab1802bac9c65264ac5262261d3
- `build/assets/images/node-72f2dc357eb7bfaa8b37aad3/bank-0.ppm`: export, SHA-256 48ead290f3557c53d43e2f3aa280ce467dc2324190e5e18e79b0fb76d257e241

Backing artifacts (not committed):
- `build/assets/blobs/5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":192,"node":"input-d0eff97af8780c30caf6a5d7","offset":2112}}, SHA-256 5bc9f57405a4c815be12a081d11ac2be1a187fa24bad501588046ed9aef6cd5d
- `build/assets/blobs/42718f9d34a0dd2ee25afa356cdec75667ee20ae99a1957c62a5a86344385a86`: tim-v1, {"bank":0,"height":16,"kind":"rgba","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 42718f9d34a0dd2ee25afa356cdec75667ee20ae99a1957c62a5a86344385a86
- `build/assets/blobs/99ae514bd73ff00ff375e7a5a42cb65ba73e4ab1802bac9c65264ac5262261d3`: tim-v1, {"bank":0,"height":16,"kind":"stp","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 99ae514bd73ff00ff375e7a5a42cb65ba73e4ab1802bac9c65264ac5262261d3
- `build/assets/runs/538f241dded91efe-68e318a9943ec948/exports/artifact-8aeae88223f4c6f9c9df5adb.ppm`: tim-v1, {"bank":0,"height":16,"kind":"ppm","mode":0,"paletteBank":0,"ppmLoss":"PPM discards transparency and STP; RGBA and STP blobs are authoritative","rgbaConvention":"zero color is transparent; STP stored separately, not approximated by alpha","rowPaddingBytes":0,"variant":{"bank":0},"width":16}, SHA-256 48ead290f3557c53d43e2f3aa280ce467dc2324190e5e18e79b0fb76d257e241

### Qualified observations

- Candidate interpretation: The selected asset is a TIM image parsed by tim-v1 version 1 from input-d0eff97af8780c30caf6a5d7 at file-byte offset 2112, length 192 bytes, with stages discovery and extraction validated. [evidence-83220d05d637ad6d854fbf41]
- Candidate interpretation: The TIM is mode 0 (4 bpp with CLUT): 16x16 pixels, 64 pixels total, 8 row bytes, 4 pixel words, with one palette bank of 16 colors at offset 20 within the image, positioned at (324, 0). [evidence-83220d05d637ad6d854fbf41]
- Candidate interpretation: Structural validation by tim-v1 establishes format compatibility only; it is not evidence of the asset's historical filename, in-game name, or consumer association. [evidence-83220d05d637ad6d854fbf41]

<!-- resource-asset:node-0c1d6ebbc3a5709868f323b6 -->
## node-0c1d6ebbc3a5709868f323b6 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc; 4672 bytes.
- Verified manifest: 95f0efecd6d5c8b2b9bb5af6995d9cc663ada4699b154bdb27b779595adeb21d.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-a5d1ebbc7107afe64ed128c8. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-0c1d6ebbc3a5709868f323b6",
    "blob": "blobs/d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 577948
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-0c1d6ebbc3a5709868f323b6/original.xa`: extraction, SHA-256 d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc
- `build/assets/video/node-0c1d6ebbc3a5709868f323b6/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b
- `build/assets/video/node-0c1d6ebbc3a5709868f323b6/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa

Backing artifacts (not committed):
- `build/assets/blobs/d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":577948}}, SHA-256 d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc
- `build/assets/blobs/b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b
- `build/assets/blobs/1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa

### Qualified observations

- Candidate interpretation: Node-0c1d6ebbc3a5709868f323b6 is a 4672-byte XA-structured resource at file-byte offset 577948 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 88 and 101, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-a5d1ebbc7107afe64ed128c8]

<!-- resource-asset:node-18c7fab54af351b922e0f020 -->
## node-18c7fab54af351b922e0f020 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e; 4672 bytes.
- Verified manifest: b0ebf43a8c2ccd3febdd8e8942fa391f878038e79fed3d2cc769d715d9f34a35.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-592cef92c432af767da37f60. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-18c7fab54af351b922e0f020",
    "blob": "blobs/51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 600868
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-18c7fab54af351b922e0f020/original.xa`: extraction, SHA-256 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e
- `build/assets/video/node-18c7fab54af351b922e0f020/variant-dc3b0f318254cb3a-xa-audio-adpcm.adpcm`: decoding, SHA-256 f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5
- `build/assets/video/node-18c7fab54af351b922e0f020/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e

Backing artifacts (not committed):
- `build/assets/blobs/51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":600868}}, SHA-256 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e
- `build/assets/blobs/f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":119,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":119,"kind":"audio"}}, SHA-256 f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5
- `build/assets/blobs/b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e

### Qualified observations

- Candidate interpretation: Node-18c7fab54af351b922e0f020 is a 4672-byte XA-structured resource at file-byte offset 600868 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 119 and file numbers 119 and 141, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-592cef92c432af767da37f60]

<!-- resource-asset:node-4918017e87d3df4fe2c44899 -->
## node-4918017e87d3df4fe2c44899 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b; 4672 bytes.
- Verified manifest: 4a15dfc395036f1195298bd000673f07480d8e9faf471f1e2d6ead458a09c161.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-2cafa84683c2b92a6fc2730d. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-4918017e87d3df4fe2c44899",
    "blob": "blobs/b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 624796
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-4918017e87d3df4fe2c44899/original.xa`: extraction, SHA-256 b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b
- `build/assets/video/node-4918017e87d3df4fe2c44899/variant-7be818c40ca03370-xa-audio-adpcm.adpcm`: decoding, SHA-256 bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2
- `build/assets/video/node-4918017e87d3df4fe2c44899/variant-302735931dbf1850-xa-audio-adpcm.adpcm`: decoding, SHA-256 de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3

Backing artifacts (not committed):
- `build/assets/blobs/b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":624796}}, SHA-256 b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b
- `build/assets/blobs/bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":102,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":102,"kind":"audio"}}, SHA-256 bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2
- `build/assets/blobs/de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":116,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":116,"kind":"audio"}}, SHA-256 de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3

### Qualified observations

- Candidate interpretation: Node-4918017e87d3df4fe2c44899 is a 4672-byte XA-structured resource at file-byte offset 624796 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 audio sectors and 0 data sectors, with channels 102 and 116 and file numbers 102 and 116, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-2cafa84683c2b92a6fc2730d]

<!-- resource-asset:node-16eb64f084e702d927f92595 -->
## node-16eb64f084e702d927f92595 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f; 4672 bytes.
- Verified manifest: 735d7d9459b36fc90cc7082d762eeb5667604243055d4968780e9cb2be6fa9b9.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-795f3e23edeb8f94d64294dd. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-16eb64f084e702d927f92595",
    "blob": "blobs/04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 625008
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-16eb64f084e702d927f92595/original.xa`: extraction, SHA-256 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f
- `build/assets/video/node-16eb64f084e702d927f92595/variant-f7f461b9bef300b9-xa-audio-adpcm.adpcm`: decoding, SHA-256 9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75
- `build/assets/video/node-16eb64f084e702d927f92595/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c

Backing artifacts (not committed):
- `build/assets/blobs/04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":625008}}, SHA-256 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f
- `build/assets/blobs/9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":120,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":120,"kind":"audio"}}, SHA-256 9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75
- `build/assets/blobs/7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c

### Qualified observations

- Candidate interpretation: Node-16eb64f084e702d927f92595 is a 4672-byte XA-structured resource at file-byte offset 625008 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 120 and file numbers 120 and 128, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-795f3e23edeb8f94d64294dd]

<!-- resource-asset:node-4ed6d6c93a748ca9addac5b4 -->
## node-4ed6d6c93a748ca9addac5b4 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155; 4672 bytes.
- Verified manifest: c56d3d90802ee7f93c4f414fecb3cb751edf66175fa73cbcd2cebe76674f88b6.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-c9099341e714230e22f86b4b. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-4ed6d6c93a748ca9addac5b4",
    "blob": "blobs/0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 640836
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-4ed6d6c93a748ca9addac5b4/original.xa`: extraction, SHA-256 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155
- `build/assets/video/node-4ed6d6c93a748ca9addac5b4/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf

Backing artifacts (not committed):
- `build/assets/blobs/0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":640836}}, SHA-256 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155
- `build/assets/blobs/91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf

### Qualified observations

- Candidate interpretation: Node-4ed6d6c93a748ca9addac5b4 is a 4672-byte XA-structured resource at file-byte offset 640836 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file number 154 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-c9099341e714230e22f86b4b]

<!-- resource-asset:node-cc4ee5b8adb93aa395b3fe75 -->
## node-cc4ee5b8adb93aa395b3fe75 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0; 4672 bytes.
- Verified manifest: 482876c12a2c1164a1a52a3097136b07bff7df6d5bb1678cf3e904bebae9c554.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-7a8cc1dc1db2cfaf99869fb3. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-cc4ee5b8adb93aa395b3fe75",
    "blob": "blobs/066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 669968
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-cc4ee5b8adb93aa395b3fe75/original.xa`: extraction, SHA-256 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0
- `build/assets/video/node-cc4ee5b8adb93aa395b3fe75/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee

Backing artifacts (not committed):
- `build/assets/blobs/066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":669968}}, SHA-256 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0
- `build/assets/blobs/539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee

### Qualified observations

- Candidate interpretation: Node-cc4ee5b8adb93aa395b3fe75 is a 4672-byte XA-structured resource at file-byte offset 669968 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file number 154 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-7a8cc1dc1db2cfaf99869fb3]

<!-- resource-asset:node-3cf432f545f306822d7f75df -->
## node-3cf432f545f306822d7f75df — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516; 4672 bytes.
- Verified manifest: 01a31043ab4632f92b7a79e3bceab2000e85790a3e93b904cea801d0aacffa56.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-a9f3b2c71092b8a9863a2661. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-3cf432f545f306822d7f75df",
    "blob": "blobs/9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 691288
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-3cf432f545f306822d7f75df/original.xa`: extraction, SHA-256 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516
- `build/assets/video/node-3cf432f545f306822d7f75df/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575

Backing artifacts (not committed):
- `build/assets/blobs/9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":691288}}, SHA-256 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516
- `build/assets/blobs/372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575

### Qualified observations

- Candidate interpretation: Node-3cf432f545f306822d7f75df is a 4672-byte XA-structured resource at file-byte offset 691288 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file numbers 154 and 159 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-a9f3b2c71092b8a9863a2661]

<!-- resource-asset:node-b9d0c45786309d0d07d95155 -->
## node-b9d0c45786309d0d07d95155 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a; 4672 bytes.
- Verified manifest: 850b7850d55277ae6c82f5e8abe14ea350194bf57824e43c0f9f23c4ba199bf8.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-0100c67b7fa5f7c50dd6432e. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-b9d0c45786309d0d07d95155",
    "blob": "blobs/4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 704980
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-b9d0c45786309d0d07d95155/original.xa`: extraction, SHA-256 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a
- `build/assets/video/node-b9d0c45786309d0d07d95155/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f

Backing artifacts (not committed):
- `build/assets/blobs/4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":704980}}, SHA-256 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a
- `build/assets/blobs/7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f

### Qualified observations

- Candidate interpretation: Node-b9d0c45786309d0d07d95155 is a 4672-byte XA-structured resource at file-byte offset 704980 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file numbers 159 and 185 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-0100c67b7fa5f7c50dd6432e]

<!-- resource-asset:node-2105e490b27ba3c22b443ea0 -->
## node-2105e490b27ba3c22b443ea0 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa; 4672 bytes.
- Verified manifest: 7be19878ad8d34e23084d4e3bb2e5babb0b2713887e7d951d719270c474204bb.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-13886cf827972d7424bf35c2. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-2105e490b27ba3c22b443ea0",
    "blob": "blobs/60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 705596
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-2105e490b27ba3c22b443ea0/original.xa`: extraction, SHA-256 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa
- `build/assets/video/node-2105e490b27ba3c22b443ea0/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca
- `build/assets/video/node-2105e490b27ba3c22b443ea0/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e

Backing artifacts (not committed):
- `build/assets/blobs/60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":705596}}, SHA-256 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa
- `build/assets/blobs/faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca
- `build/assets/blobs/a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e

### Qualified observations

- Candidate interpretation: Node-2105e490b27ba3c22b443ea0 is a 4672-byte XA-structured resource at file-byte offset 705596 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 101 and 154, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-13886cf827972d7424bf35c2]

<!-- resource-asset:node-f25a04c8ca90a7f137bbd052 -->
## node-f25a04c8ca90a7f137bbd052 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591; 4672 bytes.
- Verified manifest: bc08434927cd212ec640b83ae5310301ecbdef427a46381c401e823e79c75839.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-4a9eb3a44ecf1fc1a5ec7086. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-f25a04c8ca90a7f137bbd052",
    "blob": "blobs/58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 705816
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-f25a04c8ca90a7f137bbd052/original.xa`: extraction, SHA-256 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591
- `build/assets/video/node-f25a04c8ca90a7f137bbd052/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0
- `build/assets/video/node-f25a04c8ca90a7f137bbd052/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f

Backing artifacts (not committed):
- `build/assets/blobs/58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":705816}}, SHA-256 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591
- `build/assets/blobs/3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0
- `build/assets/blobs/09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f

### Qualified observations

- Candidate interpretation: Node-f25a04c8ca90a7f137bbd052 is a 4672-byte XA-structured resource at file-byte offset 705816 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 101 and 154, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-4a9eb3a44ecf1fc1a5ec7086]

<!-- resource-asset:node-b9610e16634eb11e5e11df5e -->
## node-b9610e16634eb11e5e11df5e — XA

- Parser: xa-v1 v1.
- Raw SHA-256: d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc; 4672 bytes.
- Verified manifest: cea0289afa2fb211692ccb30378b4cbb47add5b668d2fc5b0a9dbca57b46c576.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-026bfe0af066435a9dca228b. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-b9610e16634eb11e5e11df5e",
    "blob": "blobs/d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1026460
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-b9610e16634eb11e5e11df5e/original.xa`: extraction, SHA-256 d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc
- `build/assets/video/node-b9610e16634eb11e5e11df5e/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b
- `build/assets/video/node-b9610e16634eb11e5e11df5e/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa

Backing artifacts (not committed):
- `build/assets/blobs/d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1026460}}, SHA-256 d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc
- `build/assets/blobs/b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b
- `build/assets/blobs/1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa

### Qualified observations

- Candidate interpretation: Node-b9610e16634eb11e5e11df5e is a 4672-byte XA-structured resource at file-byte offset 1026460 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 88 and 101, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-026bfe0af066435a9dca228b]

<!-- resource-asset:node-ead2cf01576b36ad59b7e159 -->
## node-ead2cf01576b36ad59b7e159 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e; 4672 bytes.
- Verified manifest: 20cc0c4958193d36c4fe48ae913bd1a0c55bc525717ff3e7b8d71721b0bbcdf8.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-a2ffea1b8a018d55505c7d56. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-ead2cf01576b36ad59b7e159",
    "blob": "blobs/51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1049380
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-ead2cf01576b36ad59b7e159/original.xa`: extraction, SHA-256 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e
- `build/assets/video/node-ead2cf01576b36ad59b7e159/variant-dc3b0f318254cb3a-xa-audio-adpcm.adpcm`: decoding, SHA-256 f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5
- `build/assets/video/node-ead2cf01576b36ad59b7e159/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e

Backing artifacts (not committed):
- `build/assets/blobs/51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1049380}}, SHA-256 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e
- `build/assets/blobs/f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":119,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":119,"kind":"audio"}}, SHA-256 f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5
- `build/assets/blobs/b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e

### Qualified observations

- Candidate interpretation: Node-ead2cf01576b36ad59b7e159 is a 4672-byte XA-structured resource at file-byte offset 1049380 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 119 and file numbers 119 and 141, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-a2ffea1b8a018d55505c7d56]

<!-- resource-asset:node-de50e5e9f69045e577af1809 -->
## node-de50e5e9f69045e577af1809 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b; 4672 bytes.
- Verified manifest: 1ce8b5744c11111b119146337e4a49f24123bea12001eb3520c4a91758903196.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-198e8a5b3db7865896b9eb09. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-de50e5e9f69045e577af1809",
    "blob": "blobs/b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1073308
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-de50e5e9f69045e577af1809/original.xa`: extraction, SHA-256 b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b
- `build/assets/video/node-de50e5e9f69045e577af1809/variant-7be818c40ca03370-xa-audio-adpcm.adpcm`: decoding, SHA-256 bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2
- `build/assets/video/node-de50e5e9f69045e577af1809/variant-302735931dbf1850-xa-audio-adpcm.adpcm`: decoding, SHA-256 de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3

Backing artifacts (not committed):
- `build/assets/blobs/b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1073308}}, SHA-256 b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b
- `build/assets/blobs/bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":102,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":102,"kind":"audio"}}, SHA-256 bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2
- `build/assets/blobs/de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":116,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":116,"kind":"audio"}}, SHA-256 de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3

### Qualified observations

- Candidate interpretation: Node-de50e5e9f69045e577af1809 is a 4672-byte XA-structured resource at file-byte offset 1073308 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 audio sectors and 0 data sectors, with channels 102 and 116 and file numbers 102 and 116, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-198e8a5b3db7865896b9eb09]

<!-- resource-asset:node-34efe8748dbe92072417e9dd -->
## node-34efe8748dbe92072417e9dd — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f; 4672 bytes.
- Verified manifest: c0ba5621a546f4aadfe6059e08d1ab7841e58bd628274782dd2f4e8c2846c11f.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-11bfce0e6bb14435e4a71897. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-34efe8748dbe92072417e9dd",
    "blob": "blobs/04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1073520
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-34efe8748dbe92072417e9dd/original.xa`: extraction, SHA-256 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f
- `build/assets/video/node-34efe8748dbe92072417e9dd/variant-f7f461b9bef300b9-xa-audio-adpcm.adpcm`: decoding, SHA-256 9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75
- `build/assets/video/node-34efe8748dbe92072417e9dd/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c

Backing artifacts (not committed):
- `build/assets/blobs/04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1073520}}, SHA-256 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f
- `build/assets/blobs/9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":120,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":120,"kind":"audio"}}, SHA-256 9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75
- `build/assets/blobs/7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c

### Qualified observations

- Candidate interpretation: Node-34efe8748dbe92072417e9dd is a 4672-byte XA-structured resource at file-byte offset 1073520 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 120 and file numbers 120 and 128, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-11bfce0e6bb14435e4a71897]

<!-- resource-asset:node-67ddc91f48ced4a176a643e8 -->
## node-67ddc91f48ced4a176a643e8 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155; 4672 bytes.
- Verified manifest: fe71034bb69bf6c99b562c006e4a5e13bcd3b7169e804f42bfacf3cbbd791a07.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-71c46199ec18c3c20a264e6f. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-67ddc91f48ced4a176a643e8",
    "blob": "blobs/0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1089348
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-67ddc91f48ced4a176a643e8/original.xa`: extraction, SHA-256 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155
- `build/assets/video/node-67ddc91f48ced4a176a643e8/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf

Backing artifacts (not committed):
- `build/assets/blobs/0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1089348}}, SHA-256 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155
- `build/assets/blobs/91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf

### Qualified observations

- Candidate interpretation: Node-67ddc91f48ced4a176a643e8 is a 4672-byte XA-structured resource at file-byte offset 1089348 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file number 154 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-71c46199ec18c3c20a264e6f]

<!-- resource-asset:node-d82686bdc3a650b7a5438b09 -->
## node-d82686bdc3a650b7a5438b09 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0; 4672 bytes.
- Verified manifest: 3fb0440a982d72a99b7eaed1153f4edc0df5c9a38037f9f9b271858cccef8f0a.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-a52a4c1f20f5f5d3dc6383da. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-d82686bdc3a650b7a5438b09",
    "blob": "blobs/066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1118480
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-d82686bdc3a650b7a5438b09/original.xa`: extraction, SHA-256 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0
- `build/assets/video/node-d82686bdc3a650b7a5438b09/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee

Backing artifacts (not committed):
- `build/assets/blobs/066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1118480}}, SHA-256 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0
- `build/assets/blobs/539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee

### Qualified observations

- Candidate interpretation: Node-d82686bdc3a650b7a5438b09 is a 4672-byte XA-structured resource at file-byte offset 1118480 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file number 154 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-a52a4c1f20f5f5d3dc6383da]

<!-- resource-asset:node-830097bb022bd40794da9a9e -->
## node-830097bb022bd40794da9a9e — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516; 4672 bytes.
- Verified manifest: 622e534049a7ac02e375bfdb82c37dd81b1d8e262fff79fb09dba51cc0a17007.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-53452f2b5f84aebea1f4f7c9. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-830097bb022bd40794da9a9e",
    "blob": "blobs/9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1139800
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-830097bb022bd40794da9a9e/original.xa`: extraction, SHA-256 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516
- `build/assets/video/node-830097bb022bd40794da9a9e/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575

Backing artifacts (not committed):
- `build/assets/blobs/9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1139800}}, SHA-256 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516
- `build/assets/blobs/372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575

### Qualified observations

- Candidate interpretation: Node-830097bb022bd40794da9a9e is a 4672-byte XA-structured resource at file-byte offset 1139800 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file numbers 154 and 159 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-53452f2b5f84aebea1f4f7c9]

<!-- resource-asset:node-3c213ff957137ec2aa62e018 -->
## node-3c213ff957137ec2aa62e018 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a; 4672 bytes.
- Verified manifest: 8d626593303fa77e65ef45a7c46b677e1c0c64defe872284785d373c2bc0e270.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-a82bd9b296cf0a2dd438949e. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-3c213ff957137ec2aa62e018",
    "blob": "blobs/4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1153492
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-3c213ff957137ec2aa62e018/original.xa`: extraction, SHA-256 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a
- `build/assets/video/node-3c213ff957137ec2aa62e018/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f

Backing artifacts (not committed):
- `build/assets/blobs/4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1153492}}, SHA-256 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a
- `build/assets/blobs/7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f

### Qualified observations

- Candidate interpretation: Node-3c213ff957137ec2aa62e018 is a 4672-byte XA-structured resource at file-byte offset 1153492 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file numbers 159 and 185 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-a82bd9b296cf0a2dd438949e]

<!-- resource-asset:node-2df4c24c10febae285b7bba8 -->
## node-2df4c24c10febae285b7bba8 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa; 4672 bytes.
- Verified manifest: 054bce4bbeb04c3c4ee68948af40151e0341b80bca5a2fa846a11435a519786a.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-f33a9eebbd0c2c006d91b960. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-2df4c24c10febae285b7bba8",
    "blob": "blobs/60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1154108
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-2df4c24c10febae285b7bba8/original.xa`: extraction, SHA-256 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa
- `build/assets/video/node-2df4c24c10febae285b7bba8/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca
- `build/assets/video/node-2df4c24c10febae285b7bba8/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e

Backing artifacts (not committed):
- `build/assets/blobs/60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1154108}}, SHA-256 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa
- `build/assets/blobs/faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca
- `build/assets/blobs/a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e

### Qualified observations

- Candidate interpretation: Node-2df4c24c10febae285b7bba8 is a 4672-byte XA-structured resource at file-byte offset 1154108 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 101 and 154, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-f33a9eebbd0c2c006d91b960]

<!-- resource-asset:node-ac45cd4669edd29619b58641 -->
## node-ac45cd4669edd29619b58641 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591; 4672 bytes.
- Verified manifest: c4f8cf1aee815dee4910824df46c155a439a992e8a9a9521e3ecc664cc94e026.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-2b38fd3b2fc7a04314abcd96. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-ac45cd4669edd29619b58641",
    "blob": "blobs/58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1154328
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-ac45cd4669edd29619b58641/original.xa`: extraction, SHA-256 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591
- `build/assets/video/node-ac45cd4669edd29619b58641/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0
- `build/assets/video/node-ac45cd4669edd29619b58641/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f

Backing artifacts (not committed):
- `build/assets/blobs/58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1154328}}, SHA-256 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591
- `build/assets/blobs/3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0
- `build/assets/blobs/09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f

### Qualified observations

- Candidate interpretation: Node-ac45cd4669edd29619b58641 is a 4672-byte XA-structured resource at file-byte offset 1154328 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 101 and 154, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-2b38fd3b2fc7a04314abcd96]

<!-- resource-asset:node-742cad59f10501711bcdc358 -->
## node-742cad59f10501711bcdc358 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc; 4672 bytes.
- Verified manifest: 7794fdf5fc9a64894c6f436cb95f0102c28998b78a5f5e9898de0cf3ea7608dd.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-5c2f8051346a257f6d776592. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-742cad59f10501711bcdc358",
    "blob": "blobs/d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1474972
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-742cad59f10501711bcdc358/original.xa`: extraction, SHA-256 d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc
- `build/assets/video/node-742cad59f10501711bcdc358/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b
- `build/assets/video/node-742cad59f10501711bcdc358/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa

Backing artifacts (not committed):
- `build/assets/blobs/d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1474972}}, SHA-256 d69b11b103c5c70c6bcaf2511ed8e933b8636d5fc1895c9ce8a39ebe71bc25fc
- `build/assets/blobs/b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 b862cb53c65e68fca842499f3cd1bff23dd76ee7ec12886bbe55e29ca475bc5b
- `build/assets/blobs/1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 1596b2ec88a8a89d271089dc1d7711cfeada99c15a8cc869748d8a5ce9b9ddaa

### Qualified observations

- Candidate interpretation: Node-742cad59f10501711bcdc358 is a 4672-byte XA-structured resource at file-byte offset 1474972 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 88 and 101, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-5c2f8051346a257f6d776592]

<!-- resource-asset:node-fd84d359811533ed8f1ae84a -->
## node-fd84d359811533ed8f1ae84a — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e; 4672 bytes.
- Verified manifest: 67bd4031f4f606e6551a4324ee6f62272cc3c4bf88d283837acf7e8f9114379d.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-d0dd3911bad206f7178d8eaa. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-fd84d359811533ed8f1ae84a",
    "blob": "blobs/51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1497892
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-fd84d359811533ed8f1ae84a/original.xa`: extraction, SHA-256 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e
- `build/assets/video/node-fd84d359811533ed8f1ae84a/variant-dc3b0f318254cb3a-xa-audio-adpcm.adpcm`: decoding, SHA-256 f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5
- `build/assets/video/node-fd84d359811533ed8f1ae84a/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e

Backing artifacts (not committed):
- `build/assets/blobs/51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1497892}}, SHA-256 51fdf004058d5599fc5acaccae87983256c2d40dd9547d2b0536fa98fb46af4e
- `build/assets/blobs/f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":119,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":119,"kind":"audio"}}, SHA-256 f92668be84092132bbeb6098aa742c20b1711359c0c645d6260a50f178ccbad5
- `build/assets/blobs/b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 b36ef096ff0d5b601086f85295ffcc61ee755b248e88cc5a932e7fbf812cca1e

### Qualified observations

- Candidate interpretation: Node-fd84d359811533ed8f1ae84a is a 4672-byte XA-structured resource at file-byte offset 1497892 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 119 and file numbers 119 and 141, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-d0dd3911bad206f7178d8eaa]

<!-- resource-asset:node-1f5238570e9468cc801f69de -->
## node-1f5238570e9468cc801f69de — XA

- Parser: xa-v1 v1.
- Raw SHA-256: b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b; 4672 bytes.
- Verified manifest: c46229da4ee19d2f11d20d929e321567dcb7cd8435e480a6f14ed924bb60c1f0.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-a31ab604b847473786b8d33f. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-1f5238570e9468cc801f69de",
    "blob": "blobs/b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1521820
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-1f5238570e9468cc801f69de/original.xa`: extraction, SHA-256 b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b
- `build/assets/video/node-1f5238570e9468cc801f69de/variant-7be818c40ca03370-xa-audio-adpcm.adpcm`: decoding, SHA-256 bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2
- `build/assets/video/node-1f5238570e9468cc801f69de/variant-302735931dbf1850-xa-audio-adpcm.adpcm`: decoding, SHA-256 de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3

Backing artifacts (not committed):
- `build/assets/blobs/b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1521820}}, SHA-256 b2426ddb36c8e22aae5da92f2800b055b0c114fc53767d1af78a2629893deb3b
- `build/assets/blobs/bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":102,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":102,"kind":"audio"}}, SHA-256 bb7b90c6a9734b9840cc10fc0ff6c4bb045a4598f6b9280c05efb51053d37be2
- `build/assets/blobs/de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":116,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":116,"kind":"audio"}}, SHA-256 de3ca9ed727d2189eed04f5f85625201dc28dc1edc7fd63a7bd0e8156a561ea3

### Qualified observations

- Candidate interpretation: Node-1f5238570e9468cc801f69de is a 4672-byte XA-structured resource at file-byte offset 1521820 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 audio sectors and 0 data sectors, with channels 102 and 116 and file numbers 102 and 116, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-a31ab604b847473786b8d33f]

<!-- resource-asset:node-cef7e640b59ccdd9489a11b9 -->
## node-cef7e640b59ccdd9489a11b9 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f; 4672 bytes.
- Verified manifest: 05483f3290adbf9258c6687876d0633a2e1b2e4635d96580fe783b4f4aadf7b0.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-2c888949ca8f65ab00d274ac. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-cef7e640b59ccdd9489a11b9",
    "blob": "blobs/04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1522032
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-cef7e640b59ccdd9489a11b9/original.xa`: extraction, SHA-256 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f
- `build/assets/video/node-cef7e640b59ccdd9489a11b9/variant-f7f461b9bef300b9-xa-audio-adpcm.adpcm`: decoding, SHA-256 9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75
- `build/assets/video/node-cef7e640b59ccdd9489a11b9/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c

Backing artifacts (not committed):
- `build/assets/blobs/04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1522032}}, SHA-256 04fc517762929ce1d066c1484c06454fc8804c311e76789f4a270f7a5fa75b4f
- `build/assets/blobs/9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":120,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":120,"kind":"audio"}}, SHA-256 9b90c091357d2966e856c08e6de18a55b562f42481b0717debcaa18b8393ef75
- `build/assets/blobs/7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 7c70526abd6717ea54bc254d551ce4ac468c273b5ef587ac9ae37dd32f39a96c

### Qualified observations

- Candidate interpretation: Node-cef7e640b59ccdd9489a11b9 is a 4672-byte XA-structured resource at file-byte offset 1522032 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 120 and file numbers 120 and 128, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-2c888949ca8f65ab00d274ac]

<!-- resource-asset:node-6ceca3c333402ef000d34051 -->
## node-6ceca3c333402ef000d34051 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155; 4672 bytes.
- Verified manifest: 0879c5b6fa4d3314ebf35af748a0b7d65b403cd838e10b847082166e0ef7844a.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-928bd950e6ccb481fd7e7940. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-6ceca3c333402ef000d34051",
    "blob": "blobs/0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1537860
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-6ceca3c333402ef000d34051/original.xa`: extraction, SHA-256 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155
- `build/assets/video/node-6ceca3c333402ef000d34051/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf

Backing artifacts (not committed):
- `build/assets/blobs/0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1537860}}, SHA-256 0e1c1f4fc36b9c130dac2739a5c1399b5a5bf20a899bd0ce4b17a435b7e83155
- `build/assets/blobs/91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 91c9aaf6e8a4c026550e26d82bf498af776c8d635baa645eecf484d413db3ebf

### Qualified observations

- Candidate interpretation: Node-6ceca3c333402ef000d34051 is a 4672-byte XA-structured resource at file-byte offset 1537860 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file number 154 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-928bd950e6ccb481fd7e7940]

<!-- resource-asset:node-fd03e59330595a8a35ecf987 -->
## node-fd03e59330595a8a35ecf987 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0; 4672 bytes.
- Verified manifest: 16a1940dac338b262ea2e09eaeeafe1fac7207e858f588fc61e36824e4c38db8.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-9c720f1f80e7f4b8f4221bed. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-fd03e59330595a8a35ecf987",
    "blob": "blobs/066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1566992
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-fd03e59330595a8a35ecf987/original.xa`: extraction, SHA-256 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0
- `build/assets/video/node-fd03e59330595a8a35ecf987/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee

Backing artifacts (not committed):
- `build/assets/blobs/066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1566992}}, SHA-256 066df69bec8b5ed6f2cfc3280fdc5dcfa86270c62862d2b0881bc6c3b648a8e0
- `build/assets/blobs/539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 539db16687071c49bde0396c8671b90141795a9926f6198c8c3f844ba93271ee

### Qualified observations

- Candidate interpretation: Node-fd03e59330595a8a35ecf987 is a 4672-byte XA-structured resource at file-byte offset 1566992 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file number 154 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-9c720f1f80e7f4b8f4221bed]

<!-- resource-asset:node-06fbd3e586e658583344f6de -->
## node-06fbd3e586e658583344f6de — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516; 4672 bytes.
- Verified manifest: d369190243a7791099ad2c2abd2bba98056cae00efca544908eb43bcf5ca894c.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-625c8920f8fe40574fe30917. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-06fbd3e586e658583344f6de",
    "blob": "blobs/9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1588312
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-06fbd3e586e658583344f6de/original.xa`: extraction, SHA-256 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516
- `build/assets/video/node-06fbd3e586e658583344f6de/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575

Backing artifacts (not committed):
- `build/assets/blobs/9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1588312}}, SHA-256 9eb71594d18a7c4cd84ca26780a311002151fb0f2e1c289b501cd790216d5516
- `build/assets/blobs/372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 372fbfec263053be9a80aab2212a819120caabcdb888df819480ce5a76d55575

### Qualified observations

- Candidate interpretation: Node-06fbd3e586e658583344f6de is a 4672-byte XA-structured resource at file-byte offset 1588312 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file numbers 154 and 159 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-625c8920f8fe40574fe30917]

<!-- resource-asset:node-eec815d0ff6dbd2b6428f4cb -->
## node-eec815d0ff6dbd2b6428f4cb — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a; 4672 bytes.
- Verified manifest: 00fcad75137e5f62542ee8bb27920ebcfa18cb9746049cf3d13117fd93779845.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-1ab8e74d08da392d7d61012e. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-eec815d0ff6dbd2b6428f4cb",
    "blob": "blobs/4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1602004
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-eec815d0ff6dbd2b6428f4cb/original.xa`: extraction, SHA-256 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a
- `build/assets/video/node-eec815d0ff6dbd2b6428f4cb/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f

Backing artifacts (not committed):
- `build/assets/blobs/4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1602004}}, SHA-256 4a74e6a09e31ef730cc9523aeac68e43b2ed555bdeb273dba84497fd38ab615a
- `build/assets/blobs/7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 7847fd6994960bf50d20cc0c9336b9489888e7fee5a31150a56b693bc97d646f

### Qualified observations

- Candidate interpretation: Node-eec815d0ff6dbd2b6428f4cb is a 4672-byte XA-structured resource at file-byte offset 1602004 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file numbers 159 and 185 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-1ab8e74d08da392d7d61012e]

<!-- resource-asset:node-2ecc21c2e95df3cec8a2a07c -->
## node-2ecc21c2e95df3cec8a2a07c — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa; 4672 bytes.
- Verified manifest: a768a3d0611a2ff37122165035285d5526147dd8cf24b5f4f762c6e12ac56c31.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-e79b4e5ed85fd1763765e217. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-2ecc21c2e95df3cec8a2a07c",
    "blob": "blobs/60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1602620
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-2ecc21c2e95df3cec8a2a07c/original.xa`: extraction, SHA-256 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa
- `build/assets/video/node-2ecc21c2e95df3cec8a2a07c/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca
- `build/assets/video/node-2ecc21c2e95df3cec8a2a07c/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e

Backing artifacts (not committed):
- `build/assets/blobs/60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1602620}}, SHA-256 60f0a6a59ecf1d3fcec61991b0bb558b8c7edad296fd8a973c87cb9a65f999aa
- `build/assets/blobs/faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 faee21abe5f5cca8d0bbc71830cba55b4597afc760bf042ecf9a1589cdc05fca
- `build/assets/blobs/a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 a3bfb583616e369d85c460f46baacf3012837ba75c5a129530967d07ef1f648e

### Qualified observations

- Candidate interpretation: Node-2ecc21c2e95df3cec8a2a07c is a 4672-byte XA-structured resource at file-byte offset 1602620 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 101 and 154, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-e79b4e5ed85fd1763765e217]

<!-- resource-asset:node-e4c7531f467204b31274bc6a -->
## node-e4c7531f467204b31274bc6a — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591; 4672 bytes.
- Verified manifest: 114ef34de6c338bd8c82e6578fa6349966a2b455e1ee809a2d1c34186abc6f15.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-646127f7a91468f1c7980253. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-e4c7531f467204b31274bc6a",
    "blob": "blobs/58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1602840
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-e4c7531f467204b31274bc6a/original.xa`: extraction, SHA-256 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591
- `build/assets/video/node-e4c7531f467204b31274bc6a/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0
- `build/assets/video/node-e4c7531f467204b31274bc6a/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f

Backing artifacts (not committed):
- `build/assets/blobs/58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1602840}}, SHA-256 58ebfbcbb337c97d8c26171071dad4368a6584fc4bf1d85dd38fadf90bf6a591
- `build/assets/blobs/3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 3167434ff6ff6cdcd68ff5535625ddfe4ccd1227cd00fe540633df5d335499c0
- `build/assets/blobs/09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 09f18d5af070e11844c10fbed27a23cde9c2ace5060e45daeddb2f4634ccfc9f

### Qualified observations

- Candidate interpretation: Node-e4c7531f467204b31274bc6a is a 4672-byte XA-structured resource at file-byte offset 1602840 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 101 and 154, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-646127f7a91468f1c7980253]

<!-- resource-asset:node-7ae0966c03e4ab58efa78822 -->
## node-7ae0966c03e4ab58efa78822 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 5061aeb4886a9477067e66f8a61485536e5024b94b791192ccff344bd489056d; 4672 bytes.
- Verified manifest: c2ccf342ba57aebed3c0a65482b41813fc1368110580324a0b413f84461a9516.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-231bb4e34085ee97379731a1. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-7ae0966c03e4ab58efa78822",
    "blob": "blobs/5061aeb4886a9477067e66f8a61485536e5024b94b791192ccff344bd489056d",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1916364
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-7ae0966c03e4ab58efa78822/original.xa`: extraction, SHA-256 5061aeb4886a9477067e66f8a61485536e5024b94b791192ccff344bd489056d
- `build/assets/video/node-7ae0966c03e4ab58efa78822/variant-8d15ff0d190a4596-xa-audio-adpcm.adpcm`: decoding, SHA-256 19525a45fb32db8e809426b986ec87d63dcfc5592581e2ddc4f6460c336e572d
- `build/assets/video/node-7ae0966c03e4ab58efa78822/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 d37de6b60c06eef65bfcb3f13d3dc7db5b71a4b65e9b287368fadfba37aab556

Backing artifacts (not committed):
- `build/assets/blobs/5061aeb4886a9477067e66f8a61485536e5024b94b791192ccff344bd489056d`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1916364}}, SHA-256 5061aeb4886a9477067e66f8a61485536e5024b94b791192ccff344bd489056d
- `build/assets/blobs/19525a45fb32db8e809426b986ec87d63dcfc5592581e2ddc4f6460c336e572d`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":123,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":123,"kind":"audio"}}, SHA-256 19525a45fb32db8e809426b986ec87d63dcfc5592581e2ddc4f6460c336e572d
- `build/assets/blobs/d37de6b60c06eef65bfcb3f13d3dc7db5b71a4b65e9b287368fadfba37aab556`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 d37de6b60c06eef65bfcb3f13d3dc7db5b71a4b65e9b287368fadfba37aab556

### Qualified observations

- Candidate interpretation: Node-7ae0966c03e4ab58efa78822 is a 4672-byte XA-structured resource at file-byte offset 1916364 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 123 and file numbers 123 and 185, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-231bb4e34085ee97379731a1]

<!-- resource-asset:node-9bac746fe4ed6338dd2be333 -->
## node-9bac746fe4ed6338dd2be333 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 09c398687ca403fbfca160efebda224304483d757f7a96fcb76b9c0be1c22d09; 4672 bytes.
- Verified manifest: d2ef704289a6221f2fe2e9cb2a0ea2c19a103f6e14f9746782913321dec23504.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-0d2064f477dcd2b41e2f9330. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-9bac746fe4ed6338dd2be333",
    "blob": "blobs/09c398687ca403fbfca160efebda224304483d757f7a96fcb76b9c0be1c22d09",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 1967032
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-9bac746fe4ed6338dd2be333/original.xa`: extraction, SHA-256 09c398687ca403fbfca160efebda224304483d757f7a96fcb76b9c0be1c22d09
- `build/assets/video/node-9bac746fe4ed6338dd2be333/variant-8d15ff0d190a4596-xa-audio-adpcm.adpcm`: decoding, SHA-256 8fe6d11883042e63f46c1ec75ad3dbe2d89d3339afa346ef4f4b52030882e76b
- `build/assets/video/node-9bac746fe4ed6338dd2be333/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 d7f074b88fb8a8a26f8378616aa5eda9629ba1f3a320c153ff98ad6fc0b29820

Backing artifacts (not committed):
- `build/assets/blobs/09c398687ca403fbfca160efebda224304483d757f7a96fcb76b9c0be1c22d09`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":1967032}}, SHA-256 09c398687ca403fbfca160efebda224304483d757f7a96fcb76b9c0be1c22d09
- `build/assets/blobs/8fe6d11883042e63f46c1ec75ad3dbe2d89d3339afa346ef4f4b52030882e76b`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":123,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":123,"kind":"audio"}}, SHA-256 8fe6d11883042e63f46c1ec75ad3dbe2d89d3339afa346ef4f4b52030882e76b
- `build/assets/blobs/d7f074b88fb8a8a26f8378616aa5eda9629ba1f3a320c153ff98ad6fc0b29820`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 d7f074b88fb8a8a26f8378616aa5eda9629ba1f3a320c153ff98ad6fc0b29820

### Qualified observations

- Candidate interpretation: Node-9bac746fe4ed6338dd2be333 is a 4672-byte XA-structured resource at file-byte offset 1967032 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 123 and file numbers 61 and 123, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-0d2064f477dcd2b41e2f9330]

<!-- resource-asset:node-a8c1dd24dd4cd7b15efd7aad -->
## node-a8c1dd24dd4cd7b15efd7aad — XA

- Parser: xa-v1 v1.
- Raw SHA-256: a38c3bdb3577adab3140679bd623fa2aaf316abd3162f219393a934904b23a21; 4672 bytes.
- Verified manifest: 84be2e30b0892fad8429e7f10892482a7853a4a0184d84f3587bf1d0cd4200a4.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-53c798f63eda9aca50dca761. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-a8c1dd24dd4cd7b15efd7aad",
    "blob": "blobs/a38c3bdb3577adab3140679bd623fa2aaf316abd3162f219393a934904b23a21",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2080184
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-a8c1dd24dd4cd7b15efd7aad/original.xa`: extraction, SHA-256 a38c3bdb3577adab3140679bd623fa2aaf316abd3162f219393a934904b23a21
- `build/assets/video/node-a8c1dd24dd4cd7b15efd7aad/variant-7be818c40ca03370-xa-audio-adpcm.adpcm`: decoding, SHA-256 2944e687f3a05855668e4f07d4b02760812f177fc593afea80b793b2a6b36767
- `build/assets/video/node-a8c1dd24dd4cd7b15efd7aad/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 d8da50b71039cbc94457501bc93bcdedc52d7e64c5fbeb505770471a290a4d75

Backing artifacts (not committed):
- `build/assets/blobs/a38c3bdb3577adab3140679bd623fa2aaf316abd3162f219393a934904b23a21`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2080184}}, SHA-256 a38c3bdb3577adab3140679bd623fa2aaf316abd3162f219393a934904b23a21
- `build/assets/blobs/2944e687f3a05855668e4f07d4b02760812f177fc593afea80b793b2a6b36767`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":102,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":102,"kind":"audio"}}, SHA-256 2944e687f3a05855668e4f07d4b02760812f177fc593afea80b793b2a6b36767
- `build/assets/blobs/d8da50b71039cbc94457501bc93bcdedc52d7e64c5fbeb505770471a290a4d75`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 d8da50b71039cbc94457501bc93bcdedc52d7e64c5fbeb505770471a290a4d75

### Qualified observations

- Candidate interpretation: Node-a8c1dd24dd4cd7b15efd7aad is a 4672-byte XA-structured resource at file-byte offset 2080184 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 102 and file numbers 102 and 104, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-53c798f63eda9aca50dca761]

<!-- resource-asset:node-6bdcd45fd1335d5088f16231 -->
## node-6bdcd45fd1335d5088f16231 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 445ca41acd9a5587ce2e7270d0a24c7a0631179726e35e7050a0154d760b1ff9; 4672 bytes.
- Verified manifest: 9bf827e95c3a23d0047e1ad0ef912d7476c16369fbeb1747017d47ea84252387.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-c858d71112476d234bd94f33. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-6bdcd45fd1335d5088f16231",
    "blob": "blobs/445ca41acd9a5587ce2e7270d0a24c7a0631179726e35e7050a0154d760b1ff9",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2080372
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-6bdcd45fd1335d5088f16231/original.xa`: extraction, SHA-256 445ca41acd9a5587ce2e7270d0a24c7a0631179726e35e7050a0154d760b1ff9
- `build/assets/video/node-6bdcd45fd1335d5088f16231/variant-02727e77b1f8b049-xa-audio-adpcm.adpcm`: decoding, SHA-256 efc7bd667267a28130fc52f1631e21ec81bca4395e8e717071241d3e4e836949
- `build/assets/video/node-6bdcd45fd1335d5088f16231/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 c064283e111fb409fe3aa253613ca47f604bf8838db56a107575503cb801f71c

Backing artifacts (not committed):
- `build/assets/blobs/445ca41acd9a5587ce2e7270d0a24c7a0631179726e35e7050a0154d760b1ff9`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2080372}}, SHA-256 445ca41acd9a5587ce2e7270d0a24c7a0631179726e35e7050a0154d760b1ff9
- `build/assets/blobs/efc7bd667267a28130fc52f1631e21ec81bca4395e8e717071241d3e4e836949`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":106,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":106,"kind":"audio"}}, SHA-256 efc7bd667267a28130fc52f1631e21ec81bca4395e8e717071241d3e4e836949
- `build/assets/blobs/c064283e111fb409fe3aa253613ca47f604bf8838db56a107575503cb801f71c`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 c064283e111fb409fe3aa253613ca47f604bf8838db56a107575503cb801f71c

### Qualified observations

- Candidate interpretation: Node-6bdcd45fd1335d5088f16231 is a 4672-byte XA-structured resource at file-byte offset 2080372 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 106 and file numbers 106 and 128, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-c858d71112476d234bd94f33]

<!-- resource-asset:node-73d8f3aba31b723b781d00ad -->
## node-73d8f3aba31b723b781d00ad — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 988fc31fc313e4dcc596f5bb52e1ec5653a29f0c63741a54d696b9be915963f9; 4672 bytes.
- Verified manifest: 7bd33066152a86eead8bd9a75c577369134159f83a050ead7a7db44ef512b5fd.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-f2bee8fc7dea691c9a0f9fbc. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-73d8f3aba31b723b781d00ad",
    "blob": "blobs/988fc31fc313e4dcc596f5bb52e1ec5653a29f0c63741a54d696b9be915963f9",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2080960
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-73d8f3aba31b723b781d00ad/original.xa`: extraction, SHA-256 988fc31fc313e4dcc596f5bb52e1ec5653a29f0c63741a54d696b9be915963f9
- `build/assets/video/node-73d8f3aba31b723b781d00ad/variant-7be818c40ca03370-xa-audio-adpcm.adpcm`: decoding, SHA-256 00650715929886317d70352e80c2b26e09a4bf65a26ab6a0fa5f3a0ec5233d3c
- `build/assets/video/node-73d8f3aba31b723b781d00ad/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 cb121830191c65fe09fd58787a6d6156d8cdc6a0c64d5ad69e9e6bb3e42cff73

Backing artifacts (not committed):
- `build/assets/blobs/988fc31fc313e4dcc596f5bb52e1ec5653a29f0c63741a54d696b9be915963f9`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2080960}}, SHA-256 988fc31fc313e4dcc596f5bb52e1ec5653a29f0c63741a54d696b9be915963f9
- `build/assets/blobs/00650715929886317d70352e80c2b26e09a4bf65a26ab6a0fa5f3a0ec5233d3c`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":102,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":102,"kind":"audio"}}, SHA-256 00650715929886317d70352e80c2b26e09a4bf65a26ab6a0fa5f3a0ec5233d3c
- `build/assets/blobs/cb121830191c65fe09fd58787a6d6156d8cdc6a0c64d5ad69e9e6bb3e42cff73`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 cb121830191c65fe09fd58787a6d6156d8cdc6a0c64d5ad69e9e6bb3e42cff73

### Qualified observations

- Candidate interpretation: Node-73d8f3aba31b723b781d00ad is a 4672-byte XA-structured resource at file-byte offset 2080960 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 102 and file numbers 102 and 104, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-f2bee8fc7dea691c9a0f9fbc]

<!-- resource-asset:node-494f058ee304092542abf3c3 -->
## node-494f058ee304092542abf3c3 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 0457351f83f05458582cc3e45ec0d75b06fa623f4b88dfb978d4a5d823dde9b3; 4672 bytes.
- Verified manifest: 34a72be8d4f74e4e892fbddae69fbce6cafebfedc7be14371404742b75fdcd31.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-fa6f93b158d5922c6bc98f88. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-494f058ee304092542abf3c3",
    "blob": "blobs/0457351f83f05458582cc3e45ec0d75b06fa623f4b88dfb978d4a5d823dde9b3",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2081148
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-494f058ee304092542abf3c3/original.xa`: extraction, SHA-256 0457351f83f05458582cc3e45ec0d75b06fa623f4b88dfb978d4a5d823dde9b3
- `build/assets/video/node-494f058ee304092542abf3c3/variant-02727e77b1f8b049-xa-audio-adpcm.adpcm`: decoding, SHA-256 a481a216ad2274d5f0b7b7215c73902fa4d7b54e8495e0858d57e038bcb60924
- `build/assets/video/node-494f058ee304092542abf3c3/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 b802ab644e7006f197413079ac9d988977d46541774265cb26570ef4458cdc0d

Backing artifacts (not committed):
- `build/assets/blobs/0457351f83f05458582cc3e45ec0d75b06fa623f4b88dfb978d4a5d823dde9b3`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2081148}}, SHA-256 0457351f83f05458582cc3e45ec0d75b06fa623f4b88dfb978d4a5d823dde9b3
- `build/assets/blobs/a481a216ad2274d5f0b7b7215c73902fa4d7b54e8495e0858d57e038bcb60924`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":106,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":106,"kind":"audio"}}, SHA-256 a481a216ad2274d5f0b7b7215c73902fa4d7b54e8495e0858d57e038bcb60924
- `build/assets/blobs/b802ab644e7006f197413079ac9d988977d46541774265cb26570ef4458cdc0d`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 b802ab644e7006f197413079ac9d988977d46541774265cb26570ef4458cdc0d

### Qualified observations

- Candidate interpretation: Node-494f058ee304092542abf3c3 is a 4672-byte XA-structured resource at file-byte offset 2081148 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 106 and file numbers 106 and 128, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-fa6f93b158d5922c6bc98f88]

<!-- resource-asset:node-2831279fb1884431af507b68 -->
## node-2831279fb1884431af507b68 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: fce3cfe9e405eaf6abc89dcee1a555c7f51da835c4a0ae12adc5b3d35612e260; 4672 bytes.
- Verified manifest: 9d9df7d111b4c2b0460f1472c806189464cd9d7afa70aeb4a69feeaa0a8fc85b.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-07108d95e0cf8a8fddf7fbbb. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-2831279fb1884431af507b68",
    "blob": "blobs/fce3cfe9e405eaf6abc89dcee1a555c7f51da835c4a0ae12adc5b3d35612e260",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2305692
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-2831279fb1884431af507b68/original.xa`: extraction, SHA-256 fce3cfe9e405eaf6abc89dcee1a555c7f51da835c4a0ae12adc5b3d35612e260
- `build/assets/video/node-2831279fb1884431af507b68/variant-302735931dbf1850-xa-audio-adpcm.adpcm`: decoding, SHA-256 4b58f325083d50cd2a652a586baa210e0c686ee8e9fe968149a357ed878097c6
- `build/assets/video/node-2831279fb1884431af507b68/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 413ca88c06a785be1629fa18c0ea99596835bf1550986a2e5fb8988e0d5545db

Backing artifacts (not committed):
- `build/assets/blobs/fce3cfe9e405eaf6abc89dcee1a555c7f51da835c4a0ae12adc5b3d35612e260`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2305692}}, SHA-256 fce3cfe9e405eaf6abc89dcee1a555c7f51da835c4a0ae12adc5b3d35612e260
- `build/assets/blobs/4b58f325083d50cd2a652a586baa210e0c686ee8e9fe968149a357ed878097c6`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":116,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":116,"kind":"audio"}}, SHA-256 4b58f325083d50cd2a652a586baa210e0c686ee8e9fe968149a357ed878097c6
- `build/assets/blobs/413ca88c06a785be1629fa18c0ea99596835bf1550986a2e5fb8988e0d5545db`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2324,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 413ca88c06a785be1629fa18c0ea99596835bf1550986a2e5fb8988e0d5545db

### Qualified observations

- Candidate interpretation: Node-2831279fb1884431af507b68 is a 4672-byte XA-structured resource at file-byte offset 2305692 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 116 and file numbers 116 and 185, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-07108d95e0cf8a8fddf7fbbb]

<!-- resource-asset:node-f0a2a63e54230d49d8069242 -->
## node-f0a2a63e54230d49d8069242 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 9e33cf799ff9eb14dab71807fff797978a7073f31aeae03e0c5ca77a2db58b32; 4672 bytes.
- Verified manifest: da8976507f173ee503006391349cd0569aaf46b6d63028f7a265d763a8a7fc6f.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-57c18ce4ef6bee38db78acb8. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-f0a2a63e54230d49d8069242",
    "blob": "blobs/9e33cf799ff9eb14dab71807fff797978a7073f31aeae03e0c5ca77a2db58b32",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2318868
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-f0a2a63e54230d49d8069242/original.xa`: extraction, SHA-256 9e33cf799ff9eb14dab71807fff797978a7073f31aeae03e0c5ca77a2db58b32
- `build/assets/video/node-f0a2a63e54230d49d8069242/variant-f16e646999a83d42-xa-audio-adpcm.adpcm`: decoding, SHA-256 26c27f2f20f4d60460f4af4c00b1beafcef95fcaebda8968f9099b7d6526e5a2
- `build/assets/video/node-f0a2a63e54230d49d8069242/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 94107dacaa531fafc8187d61647a798aa41528cc39208771eb9e22bf39d6566a

Backing artifacts (not committed):
- `build/assets/blobs/9e33cf799ff9eb14dab71807fff797978a7073f31aeae03e0c5ca77a2db58b32`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2318868}}, SHA-256 9e33cf799ff9eb14dab71807fff797978a7073f31aeae03e0c5ca77a2db58b32
- `build/assets/blobs/26c27f2f20f4d60460f4af4c00b1beafcef95fcaebda8968f9099b7d6526e5a2`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":101,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":101,"kind":"audio"}}, SHA-256 26c27f2f20f4d60460f4af4c00b1beafcef95fcaebda8968f9099b7d6526e5a2
- `build/assets/blobs/94107dacaa531fafc8187d61647a798aa41528cc39208771eb9e22bf39d6566a`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 94107dacaa531fafc8187d61647a798aa41528cc39208771eb9e22bf39d6566a

### Qualified observations

- Candidate interpretation: Node-f0a2a63e54230d49d8069242 is a 4672-byte XA-structured resource at file-byte offset 2318868 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 101 and file numbers 88 and 101, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-57c18ce4ef6bee38db78acb8]

<!-- resource-asset:node-7be913f0c2cc609c6e017bed -->
## node-7be913f0c2cc609c6e017bed — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 950907e02e945e5aa66f50563c47ba92bc32537b9fa5134611d02b7bd3ce405a; 4672 bytes.
- Verified manifest: d4d74ddf68e917f3ab20d0cc61095182f2991d76b518b03d70cd4e81d466ddcd.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-ebe5dff551b0b67628281920. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-7be913f0c2cc609c6e017bed",
    "blob": "blobs/950907e02e945e5aa66f50563c47ba92bc32537b9fa5134611d02b7bd3ce405a",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2339608
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-7be913f0c2cc609c6e017bed/original.xa`: extraction, SHA-256 950907e02e945e5aa66f50563c47ba92bc32537b9fa5134611d02b7bd3ce405a
- `build/assets/video/node-7be913f0c2cc609c6e017bed/variant-dc3b0f318254cb3a-xa-audio-adpcm.adpcm`: decoding, SHA-256 db85d8829ca3c588c0dcc30775e00c05724cd564d180fb17d66ed3090f0cc917
- `build/assets/video/node-7be913f0c2cc609c6e017bed/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 7a3ae65f6adb2fbdb17cd9729e196a9a3c482ee9010824133f1e3df0617aba90

Backing artifacts (not committed):
- `build/assets/blobs/950907e02e945e5aa66f50563c47ba92bc32537b9fa5134611d02b7bd3ce405a`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2339608}}, SHA-256 950907e02e945e5aa66f50563c47ba92bc32537b9fa5134611d02b7bd3ce405a
- `build/assets/blobs/db85d8829ca3c588c0dcc30775e00c05724cd564d180fb17d66ed3090f0cc917`: xa-v1, {"adpcm":"raw XA sound groups preserved; PCM synthesis is not performed","channel":119,"codings":[0],"emphasis":false,"form":"stripped-2336","kind":"xa-audio-adpcm","payloadBytes":2324,"sampleRateHz":37800,"sectors":1,"stereo":false,"stride":2336,"variant":{"channel":119,"kind":"audio"}}, SHA-256 db85d8829ca3c588c0dcc30775e00c05724cd564d180fb17d66ed3090f0cc917
- `build/assets/blobs/7a3ae65f6adb2fbdb17cd9729e196a9a3c482ee9010824133f1e3df0617aba90`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 7a3ae65f6adb2fbdb17cd9729e196a9a3c482ee9010824133f1e3df0617aba90

### Qualified observations

- Candidate interpretation: Node-7be913f0c2cc609c6e017bed is a 4672-byte XA-structured resource at file-byte offset 2339608 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 1 data sector and 1 audio sector, with channel 119 and file numbers 119 and 141, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-ebe5dff551b0b67628281920]

<!-- resource-asset:node-2c2b7da50f5d67d78b96f968 -->
## node-2c2b7da50f5d67d78b96f968 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: 5aa486b711572df4566880107d92c9349d28335a265bf2570c68c8796590a2e0; 4672 bytes.
- Verified manifest: ab9e5171790e45fcd276d1003a4f682c1e0723322b533d986064698409419f5b.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-6f4a29e153bdc46607f5c3fb. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-2c2b7da50f5d67d78b96f968",
    "blob": "blobs/5aa486b711572df4566880107d92c9349d28335a265bf2570c68c8796590a2e0",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2385376
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-2c2b7da50f5d67d78b96f968/original.xa`: extraction, SHA-256 5aa486b711572df4566880107d92c9349d28335a265bf2570c68c8796590a2e0
- `build/assets/video/node-2c2b7da50f5d67d78b96f968/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 f26038070c28c425b1f07e7c7452f4074bfcd65aeaad9a4cb0090b378dea1432

Backing artifacts (not committed):
- `build/assets/blobs/5aa486b711572df4566880107d92c9349d28335a265bf2570c68c8796590a2e0`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2385376}}, SHA-256 5aa486b711572df4566880107d92c9349d28335a265bf2570c68c8796590a2e0
- `build/assets/blobs/f26038070c28c425b1f07e7c7452f4074bfcd65aeaad9a4cb0090b378dea1432`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 f26038070c28c425b1f07e7c7452f4074bfcd65aeaad9a4cb0090b378dea1432

### Qualified observations

- Candidate interpretation: Node-2c2b7da50f5d67d78b96f968 is a 4672-byte XA-structured resource at file-byte offset 2385376 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file number 154 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-6f4a29e153bdc46607f5c3fb]

<!-- resource-asset:node-40e6ce62be074be4fcb4fb13 -->
## node-40e6ce62be074be4fcb4fb13 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: fa23a64cac40df66502df78ce4fa7c6e5cd85a498966c32a25cdfd85a0dc6f62; 4672 bytes.
- Verified manifest: 2602dea6c05d92bfacad5197b060b7fc7150ab23e61e38359ef047abe74e3228.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-d46785c67118a5242c38cc53. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-40e6ce62be074be4fcb4fb13",
    "blob": "blobs/fa23a64cac40df66502df78ce4fa7c6e5cd85a498966c32a25cdfd85a0dc6f62",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2414508
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-40e6ce62be074be4fcb4fb13/original.xa`: extraction, SHA-256 fa23a64cac40df66502df78ce4fa7c6e5cd85a498966c32a25cdfd85a0dc6f62
- `build/assets/video/node-40e6ce62be074be4fcb4fb13/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 f5d07f77f706486a03879f40900ffcbc806066ee7f10acf6c21ecb1f851840fb

Backing artifacts (not committed):
- `build/assets/blobs/fa23a64cac40df66502df78ce4fa7c6e5cd85a498966c32a25cdfd85a0dc6f62`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2414508}}, SHA-256 fa23a64cac40df66502df78ce4fa7c6e5cd85a498966c32a25cdfd85a0dc6f62
- `build/assets/blobs/f5d07f77f706486a03879f40900ffcbc806066ee7f10acf6c21ecb1f851840fb`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 f5d07f77f706486a03879f40900ffcbc806066ee7f10acf6c21ecb1f851840fb

### Qualified observations

- Candidate interpretation: Node-40e6ce62be074be4fcb4fb13 is a 4672-byte XA-structured resource at file-byte offset 2414508 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file number 154 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-d46785c67118a5242c38cc53]

<!-- resource-asset:node-e535cf71b2a4d3689cdd29a0 -->
## node-e535cf71b2a4d3689cdd29a0 — XA

- Parser: xa-v1 v1.
- Raw SHA-256: ee6a28c5c5c3c88296f6eaf9a1aed7db2ed28eba164a6fb9662516ec6fdcee74; 4672 bytes.
- Verified manifest: 45c1d0d48fa673d070f8c5a6c02c6d70ef44b372442a093f899276f2d5c79287.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-570d6a39fa4ec04810606625. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-e535cf71b2a4d3689cdd29a0",
    "blob": "blobs/ee6a28c5c5c3c88296f6eaf9a1aed7db2ed28eba164a6fb9662516ec6fdcee74",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 2449520
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/video/node-e535cf71b2a4d3689cdd29a0/original.xa`: extraction, SHA-256 ee6a28c5c5c3c88296f6eaf9a1aed7db2ed28eba164a6fb9662516ec6fdcee74
- `build/assets/video/node-e535cf71b2a4d3689cdd29a0/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 9a5ece65a2a98f308c842ce240ff4be02e6481e9fd901b027ca6607a2e8e90f7

Backing artifacts (not committed):
- `build/assets/blobs/ee6a28c5c5c3c88296f6eaf9a1aed7db2ed28eba164a6fb9662516ec6fdcee74`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":2449520}}, SHA-256 ee6a28c5c5c3c88296f6eaf9a1aed7db2ed28eba164a6fb9662516ec6fdcee74
- `build/assets/blobs/9a5ece65a2a98f308c842ce240ff4be02e6481e9fd901b027ca6607a2e8e90f7`: xa-v1, {"codings":[0],"form":"stripped-2336","interpretation":"form 1 payload concatenation only; member/frame semantics unresolved","kind":"xa-data","payloadBytes":2048,"sectors":2,"stride":2336,"variant":{"kind":"data"}}, SHA-256 9a5ece65a2a98f308c842ce240ff4be02e6481e9fd901b027ca6607a2e8e90f7

### Qualified observations

- Candidate interpretation: Node-e535cf71b2a4d3689cdd29a0 is a 4672-byte XA-structured resource at file-byte offset 2449520 of input-5fe7a25fe1c481a46175463f, spanning 2 sectors of 2336 bytes (stripped-2336 form, no trailing bytes), comprising 2 data sectors and 0 audio sectors, with file numbers 159 and 185 and no audio channels, as validated by parser xa-v1 version 1. This establishes format compatibility only; no asset name, disc LBA, or in-game consumer association is claimed. [evidence-570d6a39fa4ec04810606625]

<!-- resource-asset:node-a81d4e565e5786a579bba501 -->
## node-a81d4e565e5786a579bba501 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 931cdd6bb9906c782a4a53306982c36e85539b2fcdbfdcdb59d1215cd7e326bc; 7008 bytes.
- Verified manifest: 0bf66a035058218d8b07f9d5341b8f59d5eafef4ef62503abdfa2a600584953d.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-af227c6a44f67bf036986419. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-a81d4e565e5786a579bba501",
    "blob": "blobs/931cdd6bb9906c782a4a53306982c36e85539b2fcdbfdcdb59d1215cd7e326bc",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488524
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-a81d4e565e5786a579bba501/original.xa`: extraction, SHA-256 931cdd6bb9906c782a4a53306982c36e85539b2fcdbfdcdb59d1215cd7e326bc
- `build/assets/data/node-a81d4e565e5786a579bba501/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 0c4211eed32d03cb85a7f88ab99440bd60eee7037c094d5dac9cc8be71ddb167

Backing artifacts (not committed):
- `build/assets/blobs/931cdd6bb9906c782a4a53306982c36e85539b2fcdbfdcdb59d1215cd7e326bc`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488524}}, SHA-256 931cdd6bb9906c782a4a53306982c36e85539b2fcdbfdcdb59d1215cd7e326bc
- `build/assets/blobs/0c4211eed32d03cb85a7f88ab99440bd60eee7037c094d5dac9cc8be71ddb167`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 0c4211eed32d03cb85a7f88ab99440bd60eee7037c094d5dac9cc8be71ddb167

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488524 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-af227c6a44f67bf036986419]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-af227c6a44f67bf036986419]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. [evidence-af227c6a44f67bf036986419]
- Candidate interpretation: Limitation: this identification is structural compatibility only. It is not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-af227c6a44f67bf036986419]

<!-- resource-asset:node-8e323940c9936cdd79af1291 -->
## node-8e323940c9936cdd79af1291 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: f80add8053e4ce302f5f902ce4c39c2b68b3b69a811e1c90a49c22be6247b1fb; 7008 bytes.
- Verified manifest: 81e73ca86c53fe26f34c386effcd9450fa854b50bba5242143357f4bb1f4c321.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-143e423b787fa9934aff4821. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-8e323940c9936cdd79af1291",
    "blob": "blobs/f80add8053e4ce302f5f902ce4c39c2b68b3b69a811e1c90a49c22be6247b1fb",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488526
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-8e323940c9936cdd79af1291/original.xa`: extraction, SHA-256 f80add8053e4ce302f5f902ce4c39c2b68b3b69a811e1c90a49c22be6247b1fb
- `build/assets/data/node-8e323940c9936cdd79af1291/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 0e324b61bb740d7870bc524db9e44344cce93b789e3bb37ecdac2ff94e1019b9

Backing artifacts (not committed):
- `build/assets/blobs/f80add8053e4ce302f5f902ce4c39c2b68b3b69a811e1c90a49c22be6247b1fb`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488526}}, SHA-256 f80add8053e4ce302f5f902ce4c39c2b68b3b69a811e1c90a49c22be6247b1fb
- `build/assets/blobs/0e324b61bb740d7870bc524db9e44344cce93b789e3bb37ecdac2ff94e1019b9`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 0e324b61bb740d7870bc524db9e44344cce93b789e3bb37ecdac2ff94e1019b9

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488526 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-143e423b787fa9934aff4821]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-143e423b787fa9934aff4821]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 34] are recorded in node metadata but their meaning (e.g. XA subheader fields) is not established by this run's evidence. [evidence-143e423b787fa9934aff4821]
- Candidate interpretation: Candidate interpretation: this extent begins 2 bytes after the previously documented iteration-1 XA extent (offset 87488524, same 7008-byte length), so the two extents overlap almost entirely and may represent shifted detections of the same underlying bytes. This overlap observation is qualified interpretation, not established sector alignment or identity. [evidence-143e423b787fa9934aff4821, evidence-af227c6a44f67bf036986419]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-143e423b787fa9934aff4821]

<!-- resource-asset:node-5223973a3ca4ddc88f71a4bf -->
## node-5223973a3ca4ddc88f71a4bf — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 04e93d2ccf4184f01de41372a1704136698d3f23c29da8c7615b6f06a117ad7c; 7008 bytes.
- Verified manifest: 976a63dbe39adfd682af1297237b6d800ffeaa931389d1d58d0fb4761ed81da0.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-5b6cd0ca2201a73a72f970b6. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-5223973a3ca4ddc88f71a4bf",
    "blob": "blobs/04e93d2ccf4184f01de41372a1704136698d3f23c29da8c7615b6f06a117ad7c",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488528
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-5223973a3ca4ddc88f71a4bf/original.xa`: extraction, SHA-256 04e93d2ccf4184f01de41372a1704136698d3f23c29da8c7615b6f06a117ad7c
- `build/assets/data/node-5223973a3ca4ddc88f71a4bf/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 4cc3eddfecf94198bdee2376b1b552d4240458bacb6ea8d974013bab3f88fdac

Backing artifacts (not committed):
- `build/assets/blobs/04e93d2ccf4184f01de41372a1704136698d3f23c29da8c7615b6f06a117ad7c`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488528}}, SHA-256 04e93d2ccf4184f01de41372a1704136698d3f23c29da8c7615b6f06a117ad7c
- `build/assets/blobs/4cc3eddfecf94198bdee2376b1b552d4240458bacb6ea8d974013bab3f88fdac`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 4cc3eddfecf94198bdee2376b1b552d4240458bacb6ea8d974013bab3f88fdac

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488528 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-5b6cd0ca2201a73a72f970b6]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-5b6cd0ca2201a73a72f970b6]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-5b6cd0ca2201a73a72f970b6]
- Candidate interpretation: Candidate interpretation: this is the third overlapping detection in a +2-byte-offset drift series at offsets 87488524, 87488526, and 87488528, all 7008-byte XA extents with identical sector composition. The series suggests shifted detections of the same underlying byte region rather than three distinct assets; this is qualified interpretation, not established identity or sector alignment. [evidence-5b6cd0ca2201a73a72f970b6, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-5b6cd0ca2201a73a72f970b6]

<!-- resource-asset:node-dcc4f005432f3d401371a1e1 -->
## node-dcc4f005432f3d401371a1e1 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 39daa20fee0ec405802b9b637bbcbb40533109bc43374e211ca03f4706668ea4; 7008 bytes.
- Verified manifest: 4a74e2f98d3eb44d7537eab6bfc0d48c809912733d61366f0e8fdd9b79b9aa91.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-83ebb46ed08ffab4079a0d13. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-dcc4f005432f3d401371a1e1",
    "blob": "blobs/39daa20fee0ec405802b9b637bbcbb40533109bc43374e211ca03f4706668ea4",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488530
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-dcc4f005432f3d401371a1e1/original.xa`: extraction, SHA-256 39daa20fee0ec405802b9b637bbcbb40533109bc43374e211ca03f4706668ea4
- `build/assets/data/node-dcc4f005432f3d401371a1e1/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 2c443072e7956f82fb181fc69a2de86ee01f98aa14ac5d4ed9cfc9dda3f05cae

Backing artifacts (not committed):
- `build/assets/blobs/39daa20fee0ec405802b9b637bbcbb40533109bc43374e211ca03f4706668ea4`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488530}}, SHA-256 39daa20fee0ec405802b9b637bbcbb40533109bc43374e211ca03f4706668ea4
- `build/assets/blobs/2c443072e7956f82fb181fc69a2de86ee01f98aa14ac5d4ed9cfc9dda3f05cae`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 2c443072e7956f82fb181fc69a2de86ee01f98aa14ac5d4ed9cfc9dda3f05cae

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488530 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-83ebb46ed08ffab4079a0d13]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-83ebb46ed08ffab4079a0d13]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 34] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-83ebb46ed08ffab4079a0d13]
- Candidate interpretation: Candidate interpretation: this is the fourth detection in a consistent +2-byte-offset drift series at offsets 87488524, 87488526, 87488528, and 87488530, all 7008-byte stripped-2336 XA extents with identical sector composition (1 data, 2 padding, 0 audio), and with fileNumbers alternating between [0, 105] and [0, 34] across the series. The pattern suggests shifted detections of the same underlying byte region rather than distinct assets; qualified interpretation only. [evidence-83ebb46ed08ffab4079a0d13, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-83ebb46ed08ffab4079a0d13]

<!-- resource-asset:node-f68980d96febe7509b57244b -->
## node-f68980d96febe7509b57244b — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 50407b9ce5e00b5412727e7adae625e7730bf6da8eed861c85dc26955395c544; 7008 bytes.
- Verified manifest: 3a02fba7a2339710c61ef4525701cd5e5f66525f7984f81c18cdc7731abc0853.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-37e97f73fcec97d84e373f6d. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-f68980d96febe7509b57244b",
    "blob": "blobs/50407b9ce5e00b5412727e7adae625e7730bf6da8eed861c85dc26955395c544",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488532
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-f68980d96febe7509b57244b/original.xa`: extraction, SHA-256 50407b9ce5e00b5412727e7adae625e7730bf6da8eed861c85dc26955395c544
- `build/assets/data/node-f68980d96febe7509b57244b/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 2192e295c5e11cee33a845dfa6c5b3d72777445dff675bcaf23d0d4c41288233

Backing artifacts (not committed):
- `build/assets/blobs/50407b9ce5e00b5412727e7adae625e7730bf6da8eed861c85dc26955395c544`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488532}}, SHA-256 50407b9ce5e00b5412727e7adae625e7730bf6da8eed861c85dc26955395c544
- `build/assets/blobs/2192e295c5e11cee33a845dfa6c5b3d72777445dff675bcaf23d0d4c41288233`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 2192e295c5e11cee33a845dfa6c5b3d72777445dff675bcaf23d0d4c41288233

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488532 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-37e97f73fcec97d84e373f6d]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-37e97f73fcec97d84e373f6d]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-37e97f73fcec97d84e373f6d]
- Candidate interpretation: Candidate interpretation: this is the fifth detection in a consistent +2-byte-offset drift series at offsets 87488524, 87488526, 87488528, 87488530, and 87488532, all 7008-byte stripped-2336 XA extents with identical sector composition (1 data, 2 padding, 0 audio), and with fileNumbers alternating between [0, 105] and [0, 34]. The pattern suggests shifted detections of the same underlying byte region rather than distinct assets; qualified interpretation only. If the series continues, a parser-side fix (deduplication or alignment anchoring) may be the appropriate next capability rather than per-extent notes. [evidence-37e97f73fcec97d84e373f6d, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-37e97f73fcec97d84e373f6d]

<!-- resource-asset:node-75bf6bc217730ca30a4bc4d9 -->
## node-75bf6bc217730ca30a4bc4d9 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 197639468c6297edaaae89acdddb81206a2f4b127a0eb7a81328d0c8027381e3; 7008 bytes.
- Verified manifest: 1267185fbcf7d2becd787da50551cf270437286554f8fdc578f1ed8d0df2feb4.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-3d74ee8da4ac7c5f3b507cf7. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-75bf6bc217730ca30a4bc4d9",
    "blob": "blobs/197639468c6297edaaae89acdddb81206a2f4b127a0eb7a81328d0c8027381e3",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488564
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-75bf6bc217730ca30a4bc4d9/original.xa`: extraction, SHA-256 197639468c6297edaaae89acdddb81206a2f4b127a0eb7a81328d0c8027381e3
- `build/assets/data/node-75bf6bc217730ca30a4bc4d9/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 99ac056f440a626bad3025819a7bd8424f9839e01413d4ce457dcf061beb3abe

Backing artifacts (not committed):
- `build/assets/blobs/197639468c6297edaaae89acdddb81206a2f4b127a0eb7a81328d0c8027381e3`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488564}}, SHA-256 197639468c6297edaaae89acdddb81206a2f4b127a0eb7a81328d0c8027381e3
- `build/assets/blobs/99ac056f440a626bad3025819a7bd8424f9839e01413d4ce457dcf061beb3abe`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 99ac056f440a626bad3025819a7bd8424f9839e01413d4ce457dcf061beb3abe

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488564 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-3d74ee8da4ac7c5f3b507cf7]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-3d74ee8da4ac7c5f3b507cf7]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 32] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-3d74ee8da4ac7c5f3b507cf7]
- Candidate interpretation: Candidate interpretation: this detection starts 32 bytes after the fifth detection in the prior +2-byte drift series (87488524 through 87488532), breaking that series' step. It is still heavily overlapping with those extents and introduces a new fileNumbers value [0, 32] (previously seen: 105 and 34). Whether this reflects a genuinely distinct subheader pattern or further shifted detection of the same region is not established; qualified interpretation only. [evidence-3d74ee8da4ac7c5f3b507cf7, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-3d74ee8da4ac7c5f3b507cf7]

<!-- resource-asset:node-2417b9b228e797820c78ac07 -->
## node-2417b9b228e797820c78ac07 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 97d40e510de818ba318c480d35c2a17fa91400ea0c4f664166297b1889f71b07; 7008 bytes.
- Verified manifest: 22ea54efa4cee16dfef115391dc71ccae314918d5c4c17ef72785f12b50df42a.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-01e64b20d81bfb89a61eb2ae. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-2417b9b228e797820c78ac07",
    "blob": "blobs/97d40e510de818ba318c480d35c2a17fa91400ea0c4f664166297b1889f71b07",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488630
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-2417b9b228e797820c78ac07/original.xa`: extraction, SHA-256 97d40e510de818ba318c480d35c2a17fa91400ea0c4f664166297b1889f71b07
- `build/assets/data/node-2417b9b228e797820c78ac07/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 68df6e7884c304166961288fecc174f942f22d7104be71b1c2a1cc5ced029101

Backing artifacts (not committed):
- `build/assets/blobs/97d40e510de818ba318c480d35c2a17fa91400ea0c4f664166297b1889f71b07`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488630}}, SHA-256 97d40e510de818ba318c480d35c2a17fa91400ea0c4f664166297b1889f71b07
- `build/assets/blobs/68df6e7884c304166961288fecc174f942f22d7104be71b1c2a1cc5ced029101`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 68df6e7884c304166961288fecc174f942f22d7104be71b1c2a1cc5ced029101

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488630 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-01e64b20d81bfb89a61eb2ae]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-01e64b20d81bfb89a61eb2ae]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 34] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-01e64b20d81bfb89a61eb2ae]
- Candidate interpretation: Candidate interpretation: this is the seventh overlapping detection in the same 7008-byte-byte region; observed start offsets are 87488524, 87488526, 87488528, 87488530, 87488532, 87488564, and 87488630, with steps of +2 (x4), +32, then +66 — irregular rather than a fixed stride. fileNumbers observed so far: 105, 34, 32. All extents share identical sector composition (1 data, 2 padding, 0 audio). The accumulating pattern of heavily overlapping detections with drifting offsets suggests the scanner is sliding across a padding-heavy region; a parser-side deduplication/alignment capability may be more appropriate than further per-extent notes. Qualified interpretation only. [evidence-01e64b20d81bfb89a61eb2ae, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-01e64b20d81bfb89a61eb2ae]

<!-- resource-asset:node-ce9272b03b358318e13a4043 -->
## node-ce9272b03b358318e13a4043 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: c979fb5c7770b779170950839e3f1009a70d2d4fa8877ef1971c0502c382f2d8; 7008 bytes.
- Verified manifest: 6c3b200937b62a0d4e4acdbd5cf8e7cd5f4d2d7364bba50dea34f42d42a2c9ce.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-4a7c7617117f6adb7b17dacb. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-ce9272b03b358318e13a4043",
    "blob": "blobs/c979fb5c7770b779170950839e3f1009a70d2d4fa8877ef1971c0502c382f2d8",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488632
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-ce9272b03b358318e13a4043/original.xa`: extraction, SHA-256 c979fb5c7770b779170950839e3f1009a70d2d4fa8877ef1971c0502c382f2d8
- `build/assets/data/node-ce9272b03b358318e13a4043/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 0900e1d5ed1eba4ed779f3cf1effac6a904d6c16dba955b7160a6dd231d418fb

Backing artifacts (not committed):
- `build/assets/blobs/c979fb5c7770b779170950839e3f1009a70d2d4fa8877ef1971c0502c382f2d8`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488632}}, SHA-256 c979fb5c7770b779170950839e3f1009a70d2d4fa8877ef1971c0502c382f2d8
- `build/assets/blobs/0900e1d5ed1eba4ed779f3cf1effac6a904d6c16dba955b7160a6dd231d418fb`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 0900e1d5ed1eba4ed779f3cf1effac6a904d6c16dba955b7160a6dd231d418fb

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488632 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-4a7c7617117f6adb7b17dacb]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-4a7c7617117f6adb7b17dacb]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-4a7c7617117f6adb7b17dacb]
- Candidate interpretation: Candidate interpretation: this is the eighth overlapping detection in the same byte region; observed start offsets are 87488524, 87488526, 87488528, 87488530, 87488532, 87488564, 87488630, and 87488632, with irregular steps (+2 x4, +32, +66, +2). fileNumbers observed so far: 105, 34, 32. All extents share identical sector composition (1 data, 2 padding, 0 audio). The pattern of heavily overlapping drifting detections across a single region suggests scanner sliding over padding rather than distinct assets; a parser-side deduplication/alignment capability is likely the right next capability. Qualified interpretation only. [evidence-4a7c7617117f6adb7b17dacb, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-4a7c7617117f6adb7b17dacb]

<!-- resource-asset:node-4486df251d3032ce6a516790 -->
## node-4486df251d3032ce6a516790 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 4439e1a6f20477b2d2abfc7a69b697fba5df2b701b90c7a5c07eb3386e49aa7c; 7008 bytes.
- Verified manifest: b6f857ed566bd9ecc059081fb59814a621dc1012e09cd3871d9c87f3973f284d.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-1eb1d52c81b7d3bf8f89d759. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-4486df251d3032ce6a516790",
    "blob": "blobs/4439e1a6f20477b2d2abfc7a69b697fba5df2b701b90c7a5c07eb3386e49aa7c",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488634
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-4486df251d3032ce6a516790/original.xa`: extraction, SHA-256 4439e1a6f20477b2d2abfc7a69b697fba5df2b701b90c7a5c07eb3386e49aa7c
- `build/assets/data/node-4486df251d3032ce6a516790/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 33afae3a58f2355e9d696aee8fedfecd7be2f2b499eb61e4bc386a5c927df3f3

Backing artifacts (not committed):
- `build/assets/blobs/4439e1a6f20477b2d2abfc7a69b697fba5df2b701b90c7a5c07eb3386e49aa7c`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488634}}, SHA-256 4439e1a6f20477b2d2abfc7a69b697fba5df2b701b90c7a5c07eb3386e49aa7c
- `build/assets/blobs/33afae3a58f2355e9d696aee8fedfecd7be2f2b499eb61e4bc386a5c927df3f3`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 33afae3a58f2355e9d696aee8fedfecd7be2f2b499eb61e4bc386a5c927df3f3

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488634 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-1eb1d52c81b7d3bf8f89d759]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-1eb1d52c81b7d3bf8f89d759]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 34] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-1eb1d52c81b7d3bf8f89d759]
- Candidate interpretation: Candidate interpretation: this is the ninth overlapping detection in the same byte region; observed start offsets are 87488524 through 87488532 (+2 x5), 87488564 (+32), 87488630 (+66), 87488632 (+2), and 87488634 (+2). fileNumbers observed so far: 105, 34, 32. All extents share identical sector composition (1 data, 2 padding, 0 audio). The pattern of heavily overlapping drifting detections across a single region suggests scanner sliding over padding rather than distinct assets; a parser-side deduplication/alignment capability is likely the right next capability rather than further per-extent notes. Qualified interpretation only. [evidence-1eb1d52c81b7d3bf8f89d759, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-1eb1d52c81b7d3bf8f89d759]

<!-- resource-asset:node-7a27c800a6a1421db7851296 -->
## node-7a27c800a6a1421db7851296 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: cbce238c8d6d1cf8510ac04fae5c56abdfbca921ec0ac71b8f2a834846bf2a08; 7008 bytes.
- Verified manifest: 4a5bf745393f08a8c5e4e1b8f2312dd9ff867d7547e3479aa4f2c90850301899.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-69d592ea5e173bb8e176ac62. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-7a27c800a6a1421db7851296",
    "blob": "blobs/cbce238c8d6d1cf8510ac04fae5c56abdfbca921ec0ac71b8f2a834846bf2a08",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 87488636
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-7a27c800a6a1421db7851296/original.xa`: extraction, SHA-256 cbce238c8d6d1cf8510ac04fae5c56abdfbca921ec0ac71b8f2a834846bf2a08
- `build/assets/data/node-7a27c800a6a1421db7851296/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 eb90ca3bcee7d91899fca123e0062f6dc531f95d3b1c0795cd48071374bf9a9a

Backing artifacts (not committed):
- `build/assets/blobs/cbce238c8d6d1cf8510ac04fae5c56abdfbca921ec0ac71b8f2a834846bf2a08`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":87488636}}, SHA-256 cbce238c8d6d1cf8510ac04fae5c56abdfbca921ec0ac71b8f2a834846bf2a08
- `build/assets/blobs/eb90ca3bcee7d91899fca123e0062f6dc531f95d3b1c0795cd48071374bf9a9a`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 eb90ca3bcee7d91899fca123e0062f6dc531f95d3b1c0795cd48071374bf9a9a

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 87488636 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-69d592ea5e173bb8e176ac62]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-69d592ea5e173bb8e176ac62]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-69d592ea5e173bb8e176ac62]
- Candidate interpretation: Candidate interpretation: this is the tenth overlapping detection in the same byte region; observed start offsets are 87488524 through 87488532 (+2 x5), 87488564 (+32), 87488630 (+66), 87488632 and 87488634 (+2 each), and 87488636. fileNumbers observed so far: 105, 34, 32. All extents share identical sector composition (1 data, 2 padding, 0 audio). The accumulating pattern of heavily overlapping drifting detections across one region strongly suggests scanner sliding over padding rather than distinct assets; a parser-side deduplication/alignment capability is likely the right next capability rather than further per-extent notes. Qualified interpretation only. [evidence-69d592ea5e173bb8e176ac62, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-69d592ea5e173bb8e176ac62]

<!-- resource-asset:node-fed525c7d1b82e6cf714e521 -->
## node-fed525c7d1b82e6cf714e521 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 49cbeeb1353a8111d98bcc44db2066fb01e8f2da04d3a11ecb8b5137152f15af; 7008 bytes.
- Verified manifest: 748358ce65b68541230a68bf20217d7f880db2244df5846e2faea6dc0c3b0939.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-9be3c7e5fe6995f8d922dcfb. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-fed525c7d1b82e6cf714e521",
    "blob": "blobs/49cbeeb1353a8111d98bcc44db2066fb01e8f2da04d3a11ecb8b5137152f15af",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 106593598
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-fed525c7d1b82e6cf714e521/original.xa`: extraction, SHA-256 49cbeeb1353a8111d98bcc44db2066fb01e8f2da04d3a11ecb8b5137152f15af
- `build/assets/data/node-fed525c7d1b82e6cf714e521/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 276fea0415b70e9d61f9b5714a5533dbdf07d401e5c1397e0d57ece9388138b7

Backing artifacts (not committed):
- `build/assets/blobs/49cbeeb1353a8111d98bcc44db2066fb01e8f2da04d3a11ecb8b5137152f15af`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":106593598}}, SHA-256 49cbeeb1353a8111d98bcc44db2066fb01e8f2da04d3a11ecb8b5137152f15af
- `build/assets/blobs/276fea0415b70e9d61f9b5714a5533dbdf07d401e5c1397e0d57ece9388138b7`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 276fea0415b70e9d61f9b5714a5533dbdf07d401e5c1397e0d57ece9388138b7

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 106593598 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-9be3c7e5fe6995f8d922dcfb]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-9be3c7e5fe6995f8d922dcfb]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 36] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-9be3c7e5fe6995f8d922dcfb]
- Candidate interpretation: Candidate interpretation: unlike the ten previously documented extents (all clustered at offsets 87488524-87488636 with drifting overlap), this extent lies in a different region at offset 106593598, roughly 19 MB later, and carries a previously unseen fileNumbers value 36. It is structurally a distinct detection, though whether it represents a genuinely separate game asset remains unestablished; qualified interpretation only. [evidence-9be3c7e5fe6995f8d922dcfb, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-9be3c7e5fe6995f8d922dcfb]

<!-- resource-asset:node-c3ad4a8f4076d33c215d2bde -->
## node-c3ad4a8f4076d33c215d2bde — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 4e411b5c795e072162d2f86a0e45de4a4c48b47266a33deead002e0272e87b8e; 7008 bytes.
- Verified manifest: 15d9795e356dd96fccc9bab21fdea91ad07c95e6b0e63b2f9d3dd83763851440.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-f0911461cc8ef5bb51de8004. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-c3ad4a8f4076d33c215d2bde",
    "blob": "blobs/4e411b5c795e072162d2f86a0e45de4a4c48b47266a33deead002e0272e87b8e",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 106674896
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-c3ad4a8f4076d33c215d2bde/original.xa`: extraction, SHA-256 4e411b5c795e072162d2f86a0e45de4a4c48b47266a33deead002e0272e87b8e
- `build/assets/data/node-c3ad4a8f4076d33c215d2bde/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 6196008746764e3469fe6bb3217192bef78edbb5111d3d76cd2a465933673239

Backing artifacts (not committed):
- `build/assets/blobs/4e411b5c795e072162d2f86a0e45de4a4c48b47266a33deead002e0272e87b8e`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":106674896}}, SHA-256 4e411b5c795e072162d2f86a0e45de4a4c48b47266a33deead002e0272e87b8e
- `build/assets/blobs/6196008746764e3469fe6bb3217192bef78edbb5111d3d76cd2a465933673239`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 6196008746764e3469fe6bb3217192bef78edbb5111d3d76cd2a465933673239

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 106674896 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-f0911461cc8ef5bb51de8004]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-f0911461cc8ef5bb51de8004]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 36] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-f0911461cc8ef5bb51de8004]
- Candidate interpretation: Candidate interpretation: this extent starts 81,298 bytes after the iteration-11 extent at 106593598 and therefore does not overlap it, making it a second distinct XA detection region beyond the eleven previously documented extents (the 87488524-87488636 drift cluster plus 106593598). It shares the same sector composition and the fileNumbers value 36 seen at 106593598. Whether these region-separated detections correspond to distinct game assets remains unestablished; qualified interpretation only. [evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-f0911461cc8ef5bb51de8004]

<!-- resource-asset:node-11112dbbfe665cb7c0e31386 -->
## node-11112dbbfe665cb7c0e31386 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: a59afe96146c26ffd08cb602af808d63301a1fd98c6430a5894d2bb1d20fb9d4; 4672 bytes.
- Verified manifest: 3a46d389eb6f9420423f18a1fd7f31771a67c670450361c43a72cbc5589587fc.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-20155b90fd83fbdcf4301efe. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-11112dbbfe665cb7c0e31386",
    "blob": "blobs/a59afe96146c26ffd08cb602af808d63301a1fd98c6430a5894d2bb1d20fb9d4",
    "size": 4672,
    "source": {
      "coordinate": "file-byte",
      "length": 4672,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 106725102
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-11112dbbfe665cb7c0e31386/original.xa`: extraction, SHA-256 a59afe96146c26ffd08cb602af808d63301a1fd98c6430a5894d2bb1d20fb9d4
- `build/assets/data/node-11112dbbfe665cb7c0e31386/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 fbf959db8ee87795cc4e7825c540406430778f805e5b793feb90f63b680780b1

Backing artifacts (not committed):
- `build/assets/blobs/a59afe96146c26ffd08cb602af808d63301a1fd98c6430a5894d2bb1d20fb9d4`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":4672,"node":"input-5fe7a25fe1c481a46175463f","offset":106725102}}, SHA-256 a59afe96146c26ffd08cb602af808d63301a1fd98c6430a5894d2bb1d20fb9d4
- `build/assets/blobs/fbf959db8ee87795cc4e7825c540406430778f805e5b793feb90f63b680780b1`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 fbf959db8ee87795cc4e7825c540406430778f805e5b793feb90f63b680780b1

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 4672 bytes at file-byte offset 106725102 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-20155b90fd83fbdcf4301efe]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-20155b90fd83fbdcf4301efe]
- Candidate interpretation: The extent consists of 2 sectors at stride 2336 in stripped-2336 form: 1 data sector, 1 padding sector, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 99] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-20155b90fd83fbdcf4301efe]
- Candidate interpretation: Candidate interpretation: this is a third distinct XA detection region: it begins after the end of the iteration-12 extent (106674896 + 7008 = 106681904) and does not overlap any previously documented extent. It differs from all thirteen extents documented so far in sector count (2 vs 3), size (4672 vs 7008) and carries a previously unseen fileNumbers value 99 (previously seen: 105, 34, 32, 36). Qualified interpretation only. [evidence-20155b90fd83fbdcf4301efe, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-20155b90fd83fbdcf4301efe]

<!-- resource-asset:node-451cc12e3bf0114bbed8002c -->
## node-451cc12e3bf0114bbed8002c — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 3e1643349a704c75b145720419de67c3a227c0690fdee845942995bcd7f60ac4; 7008 bytes.
- Verified manifest: 3ca1908740bee5215fc922b70480c590b5b829d0dbb82043e3381367e6f7499f.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-b5180f38e164e591415f2c49. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-451cc12e3bf0114bbed8002c",
    "blob": "blobs/3e1643349a704c75b145720419de67c3a227c0690fdee845942995bcd7f60ac4",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 106936730
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-451cc12e3bf0114bbed8002c/original.xa`: extraction, SHA-256 3e1643349a704c75b145720419de67c3a227c0690fdee845942995bcd7f60ac4
- `build/assets/data/node-451cc12e3bf0114bbed8002c/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 149a95c07f81228156262c10411e454b1b8621a6aafeb4fbd1006ac9fe2120d3

Backing artifacts (not committed):
- `build/assets/blobs/3e1643349a704c75b145720419de67c3a227c0690fdee845942995bcd7f60ac4`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":106936730}}, SHA-256 3e1643349a704c75b145720419de67c3a227c0690fdee845942995bcd7f60ac4
- `build/assets/blobs/149a95c07f81228156262c10411e454b1b8621a6aafeb4fbd1006ac9fe2120d3`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 149a95c07f81228156262c10411e454b1b8621a6aafeb4fbd1006ac9fe2120d3

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 106936730 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-b5180f38e164e591415f2c49]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-b5180f38e164e591415f2c49]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 36] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-b5180f38e164e591415f2c49]
- Candidate interpretation: Candidate interpretation: this is a fourth distinct XA detection region. It does not overlap any previously documented extent: the documented non-overlapping starts are 106593598, 106674896, and 106725102 (plus the overlapping drift cluster at 87488524-87488636), and this extent starts past all of their ends. It shares the 3-sector composition and the fileNumbers value 36 seen at the other 106-MB regions. Qualified interpretation only. [evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-b5180f38e164e591415f2c49]

<!-- resource-asset:node-6dcdef8da36732432b1df64f -->
## node-6dcdef8da36732432b1df64f — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 17c38d6a99a926f9b1be770e630e94e62d89e9343ef0665c65fab6fdd9a222f6; 7008 bytes.
- Verified manifest: f8f95065a864065b9c7b9386cc2acac8832215890076a4576b23b396f033e3d4.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-f2658dcb483b60a5455c856f. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-6dcdef8da36732432b1df64f",
    "blob": "blobs/17c38d6a99a926f9b1be770e630e94e62d89e9343ef0665c65fab6fdd9a222f6",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 106953122
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-6dcdef8da36732432b1df64f/original.xa`: extraction, SHA-256 17c38d6a99a926f9b1be770e630e94e62d89e9343ef0665c65fab6fdd9a222f6
- `build/assets/data/node-6dcdef8da36732432b1df64f/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 698995c7039fce0bc4e2605e277980b8905aeb18d43da744c20ea39429621cbc

Backing artifacts (not committed):
- `build/assets/blobs/17c38d6a99a926f9b1be770e630e94e62d89e9343ef0665c65fab6fdd9a222f6`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":106953122}}, SHA-256 17c38d6a99a926f9b1be770e630e94e62d89e9343ef0665c65fab6fdd9a222f6
- `build/assets/blobs/698995c7039fce0bc4e2605e277980b8905aeb18d43da744c20ea39429621cbc`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 698995c7039fce0bc4e2605e277980b8905aeb18d43da744c20ea39429621cbc

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 106953122 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 36] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Candidate interpretation: this is a fifth distinct XA detection region. It starts 16,392 bytes after the end of the iteration-14 extent (106936730 + 7008 = 106943738) and does not overlap any previously documented extent. Documented non-overlapping starts so far: 106593598, 106674896, 106725102, 106936730, and now 106953122, plus the overlapping drift cluster at 87488524-87488636. It shares the 3-sector composition and fileNumbers value 36 of the neighboring 106-MB regions. Qualified interpretation only. [evidence-f2658dcb483b60a5455c856f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-f2658dcb483b60a5455c856f]

<!-- resource-asset:node-d310027cbbe1c08a2652ede4 -->
## node-d310027cbbe1c08a2652ede4 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 34545f88fe6a977506f311cf959cdf976556b0f223ab4969829948b6f0ec7940; 7008 bytes.
- Verified manifest: 0998d0e47b060df785fbd107ec113bdf6ee00af6cd42cb9cc96c6341c131b74f.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-b83cdcd544c5258cc9d9252f. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-d310027cbbe1c08a2652ede4",
    "blob": "blobs/34545f88fe6a977506f311cf959cdf976556b0f223ab4969829948b6f0ec7940",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107052040
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-d310027cbbe1c08a2652ede4/original.xa`: extraction, SHA-256 34545f88fe6a977506f311cf959cdf976556b0f223ab4969829948b6f0ec7940
- `build/assets/data/node-d310027cbbe1c08a2652ede4/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 01dcde26ad66ee2e26c4c3c9572aecf130b937f132f40770a3c641909626a809

Backing artifacts (not committed):
- `build/assets/blobs/34545f88fe6a977506f311cf959cdf976556b0f223ab4969829948b6f0ec7940`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107052040}}, SHA-256 34545f88fe6a977506f311cf959cdf976556b0f223ab4969829948b6f0ec7940
- `build/assets/blobs/01dcde26ad66ee2e26c4c3c9572aecf130b937f132f40770a3c641909626a809`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 01dcde26ad66ee2e26c4c3c9572aecf130b937f132f40770a3c641909626a809

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107052040 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-b83cdcd544c5258cc9d9252f]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-b83cdcd544c5258cc9d9252f]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 40] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-b83cdcd544c5258cc9d9252f]
- Candidate interpretation: Candidate interpretation: this is a sixth distinct XA detection region. It does not overlap any previously documented extent; documented non-overlapping starts so far are 106593598, 106674896, 106725102, 106936730, 106953122, and now 107052040, plus the overlapping drift cluster at 87488524-87488636. It introduces a previously unseen fileNumbers value 40 (previously seen: 105, 34, 32, 36, 99). Qualified interpretation only. [evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-b83cdcd544c5258cc9d9252f]

<!-- resource-asset:node-de21b9a2c0652222a461bf97 -->
## node-de21b9a2c0652222a461bf97 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 69a93fb89d4e7a2c2ba2ef0cefdef3ca4d7f31ffba2912d5f2f7a465ad3ded50; 7008 bytes.
- Verified manifest: 5b0c02f35c1a04385f6c097fa765b2500c7925e874b2d0fc359799c25b5ab8c2.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-4ea57e19a796549fa51597e4. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-de21b9a2c0652222a461bf97",
    "blob": "blobs/69a93fb89d4e7a2c2ba2ef0cefdef3ca4d7f31ffba2912d5f2f7a465ad3ded50",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107100964
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-de21b9a2c0652222a461bf97/original.xa`: extraction, SHA-256 69a93fb89d4e7a2c2ba2ef0cefdef3ca4d7f31ffba2912d5f2f7a465ad3ded50
- `build/assets/data/node-de21b9a2c0652222a461bf97/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 682b60a4f28d7d9588daaf62afb8fb0aa430ad30a4db16ba1743b45f6fe79f3b

Backing artifacts (not committed):
- `build/assets/blobs/69a93fb89d4e7a2c2ba2ef0cefdef3ca4d7f31ffba2912d5f2f7a465ad3ded50`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107100964}}, SHA-256 69a93fb89d4e7a2c2ba2ef0cefdef3ca4d7f31ffba2912d5f2f7a465ad3ded50
- `build/assets/blobs/682b60a4f28d7d9588daaf62afb8fb0aa430ad30a4db16ba1743b45f6fe79f3b`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 682b60a4f28d7d9588daaf62afb8fb0aa430ad30a4db16ba1743b45f6fe79f3b

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107100964 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-4ea57e19a796549fa51597e4]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-4ea57e19a796549fa51597e4]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 99] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-4ea57e19a796549fa51597e4]
- Candidate interpretation: Candidate interpretation: this is a seventh distinct XA detection region. It starts 41,916 bytes after the end of the iteration-16 extent (107052040 + 7008 = 107059048) and does not overlap any previously documented extent. Documented non-overlapping starts so far: 106593598, 106674896, 106725102, 106936730, 106953122, 107052040, and now 107100964, plus the overlapping drift cluster at 87488524-87488636. It carries the fileNumbers value 99 previously seen on the small 2-sector extent at 106725102. Qualified interpretation only. [evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-4ea57e19a796549fa51597e4]

<!-- resource-asset:node-0d93233050912d7d3b83dc8e -->
## node-0d93233050912d7d3b83dc8e — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 366c3106f753d5748041769f745d8d6dd3077b8d1afd52902610ebe8a7189c95; 7008 bytes.
- Verified manifest: 0b52cee4e6b11c69257d8039f457d3074d070e0d39abe5089b00c17ab8e7ab28.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-af70082128fa6540f74a9585. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-0d93233050912d7d3b83dc8e",
    "blob": "blobs/366c3106f753d5748041769f745d8d6dd3077b8d1afd52902610ebe8a7189c95",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107100966
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-0d93233050912d7d3b83dc8e/original.xa`: extraction, SHA-256 366c3106f753d5748041769f745d8d6dd3077b8d1afd52902610ebe8a7189c95
- `build/assets/data/node-0d93233050912d7d3b83dc8e/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 8e337c8b17b29520c61b7c7c6c9c1c3169a4c17dfe0a85bac713c0e69384418a

Backing artifacts (not committed):
- `build/assets/blobs/366c3106f753d5748041769f745d8d6dd3077b8d1afd52902610ebe8a7189c95`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107100966}}, SHA-256 366c3106f753d5748041769f745d8d6dd3077b8d1afd52902610ebe8a7189c95
- `build/assets/blobs/8e337c8b17b29520c61b7c7c6c9c1c3169a4c17dfe0a85bac713c0e69384418a`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 8e337c8b17b29520c61b7c7c6c9c1c3169a4c17dfe0a85bac713c0e69384418a

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107100966 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-af70082128fa6540f74a9585]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-af70082128fa6540f74a9585]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 99] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-af70082128fa6540f74a9585]
- Candidate interpretation: Candidate interpretation: this extent starts exactly +2 bytes after the iteration-17 extent (107100964), with identical size and metadata — the same +2-step overlapping drift pattern previously observed in the 87488524-87488636 cluster. This is the second detection at the ~107.1 MB region and its drift behavior mirrors the earlier cluster, reinforcing that a parser-side deduplication/alignment capability is likely more appropriate than further per-extent notes. Qualified interpretation only. [evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-af70082128fa6540f74a9585]

<!-- resource-asset:node-6c9ec8a2e708281d1bf00cb0 -->
## node-6c9ec8a2e708281d1bf00cb0 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: d950e0cb575ef7e5e3a9ae22b35d248ec3f1bccfe8e09be5afdf3dd32d26c221; 7008 bytes.
- Verified manifest: 4d92fd33b906f5aba2667fc42ddaf57b5c3213ed2169edae92c1b0c8b825d422.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-86d66c5220244dbd9b2b9052. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-6c9ec8a2e708281d1bf00cb0",
    "blob": "blobs/d950e0cb575ef7e5e3a9ae22b35d248ec3f1bccfe8e09be5afdf3dd32d26c221",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281112
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-6c9ec8a2e708281d1bf00cb0/original.xa`: extraction, SHA-256 d950e0cb575ef7e5e3a9ae22b35d248ec3f1bccfe8e09be5afdf3dd32d26c221
- `build/assets/data/node-6c9ec8a2e708281d1bf00cb0/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 34331ad48b3cec380bec1ad72b67c318c983ad9831caf9f8d03e2b3e6c4cfd8b

Backing artifacts (not committed):
- `build/assets/blobs/d950e0cb575ef7e5e3a9ae22b35d248ec3f1bccfe8e09be5afdf3dd32d26c221`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281112}}, SHA-256 d950e0cb575ef7e5e3a9ae22b35d248ec3f1bccfe8e09be5afdf3dd32d26c221
- `build/assets/blobs/34331ad48b3cec380bec1ad72b67c318c983ad9831caf9f8d03e2b3e6c4cfd8b`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 34331ad48b3cec380bec1ad72b67c318c983ad9831caf9f8d03e2b3e6c4cfd8b

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281112 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-86d66c5220244dbd9b2b9052]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-86d66c5220244dbd9b2b9052]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-86d66c5220244dbd9b2b9052]
- Candidate interpretation: Candidate interpretation: this is an eighth distinct XA detection region. It starts well past the end of the latest ~107.1 MB extents (107100966 + 7008 = 107107974) and does not overlap any previously documented extent. Documented non-overlapping starts so far: 106593598, 106674896, 106725102, 106936730, 106953122, 107052040, 107100964 (+1 overlapping +2 drift at 107100966), and now 107281112, plus the overlapping drift cluster at 87488524-87488636. fileNumbers value 105 matches the earliest drift-cluster detections. Qualified interpretation only. [evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-86d66c5220244dbd9b2b9052]

<!-- resource-asset:node-d8f6fef2b2337553bb3bcc69 -->
## node-d8f6fef2b2337553bb3bcc69 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: ec537aeaf9fe16cebf3aa9a825dc6590c348d9b532171b4e96f4ccce5b403009; 7008 bytes.
- Verified manifest: 6b10b13067e36fc7675175b83bcdffc2676627bcf0268ab1d9d11e0e37b1db75.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-6507924e3d901da1d7937643. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-d8f6fef2b2337553bb3bcc69",
    "blob": "blobs/ec537aeaf9fe16cebf3aa9a825dc6590c348d9b532171b4e96f4ccce5b403009",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281114
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-d8f6fef2b2337553bb3bcc69/original.xa`: extraction, SHA-256 ec537aeaf9fe16cebf3aa9a825dc6590c348d9b532171b4e96f4ccce5b403009
- `build/assets/data/node-d8f6fef2b2337553bb3bcc69/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 9eeb568b2e4c91654aa49a459aef519eba95b8eda533af0bb613de6bb826b56e

Backing artifacts (not committed):
- `build/assets/blobs/ec537aeaf9fe16cebf3aa9a825dc6590c348d9b532171b4e96f4ccce5b403009`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281114}}, SHA-256 ec537aeaf9fe16cebf3aa9a825dc6590c348d9b532171b4e96f4ccce5b403009
- `build/assets/blobs/9eeb568b2e4c91654aa49a459aef519eba95b8eda533af0bb613de6bb826b56e`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 9eeb568b2e4c91654aa49a459aef519eba95b8eda533af0bb613de6bb826b56e

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281114 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-6507924e3d901da1d7937643]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-6507924e3d901da1d7937643]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-6507924e3d901da1d7937643]
- Candidate interpretation: Candidate interpretation: this extent starts exactly +2 bytes after the iteration-19 extent (107281112), with identical size and metadata — the same +2-step overlapping drift pattern seen in both the 87488524-87488636 cluster and the ~107.1 MB region. Twenty iterations in, the dominant structure is a small number of distinct regions (87488524 cluster; 106593598; 106674896; 106725102; 106936730; 106953122; 107052040; 107100964; 107281112) each surrounded by overlapping +2-step drift detections. A parser-side deduplication/alignment capability is likely more appropriate than further per-extent notes. Qualified interpretation only. [evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-6507924e3d901da1d7937643]

<!-- resource-asset:node-9a1efa17380766fdf534ce7a -->
## node-9a1efa17380766fdf534ce7a — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 9035b725a6df93758a4314d995d1cfddc1b7665b6a38739cacd5c315e2a99686; 7008 bytes.
- Verified manifest: 8a0c5f52e20c58d1fdbaf538bf9b4b4e1263e8b837fb2436bf684603446aca99.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-2ab41c7855acaf3d731c5e77. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-9a1efa17380766fdf534ce7a",
    "blob": "blobs/9035b725a6df93758a4314d995d1cfddc1b7665b6a38739cacd5c315e2a99686",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281116
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-9a1efa17380766fdf534ce7a/original.xa`: extraction, SHA-256 9035b725a6df93758a4314d995d1cfddc1b7665b6a38739cacd5c315e2a99686
- `build/assets/data/node-9a1efa17380766fdf534ce7a/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 38792c350501ff91fdb25a56753c76b18be4e803cf162324b874b98573281dd4

Backing artifacts (not committed):
- `build/assets/blobs/9035b725a6df93758a4314d995d1cfddc1b7665b6a38739cacd5c315e2a99686`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281116}}, SHA-256 9035b725a6df93758a4314d995d1cfddc1b7665b6a38739cacd5c315e2a99686
- `build/assets/blobs/38792c350501ff91fdb25a56753c76b18be4e803cf162324b874b98573281dd4`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 38792c350501ff91fdb25a56753c76b18be4e803cf162324b874b98573281dd4

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281116 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-2ab41c7855acaf3d731c5e77]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-2ab41c7855acaf3d731c5e77]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-2ab41c7855acaf3d731c5e77]
- Candidate interpretation: Candidate interpretation: this is the third detection at the ~107.28 MB region (starts 107281112, 107281114, 107281116), each exactly +2 bytes apart with identical metadata — the same drift pattern as the 87488524-87488636 cluster and the ~107.1 MB region. Across twenty-one iterations the structure is consistently: a handful of distinct regions, each surrounded by overlapping +2-step drift detections. Parser-side deduplication/alignment remains the likely right next capability rather than further per-extent notes. Qualified interpretation only. [evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-2ab41c7855acaf3d731c5e77]

<!-- resource-asset:node-18a59192c8771710c609f6da -->
## node-18a59192c8771710c609f6da — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 8a035f8f8d171cb798ebad5ef9c88fb581b9e2351f46bb8d1b0a3ce7e900a08f; 7008 bytes.
- Verified manifest: e6c18a449f96a92f8d0e1207026500f6589a8e1aec9e1f32c13b79255ab0eafe.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-cedf175bd4913d7485e64d9c. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-18a59192c8771710c609f6da",
    "blob": "blobs/8a035f8f8d171cb798ebad5ef9c88fb581b9e2351f46bb8d1b0a3ce7e900a08f",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281118
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-18a59192c8771710c609f6da/original.xa`: extraction, SHA-256 8a035f8f8d171cb798ebad5ef9c88fb581b9e2351f46bb8d1b0a3ce7e900a08f
- `build/assets/data/node-18a59192c8771710c609f6da/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 77f96585ee4b1a31e49b6d7ad2429ef0f81fdf933f91d9cd52e0c6d0b50e0cba

Backing artifacts (not committed):
- `build/assets/blobs/8a035f8f8d171cb798ebad5ef9c88fb581b9e2351f46bb8d1b0a3ce7e900a08f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281118}}, SHA-256 8a035f8f8d171cb798ebad5ef9c88fb581b9e2351f46bb8d1b0a3ce7e900a08f
- `build/assets/blobs/77f96585ee4b1a31e49b6d7ad2429ef0f81fdf933f91d9cd52e0c6d0b50e0cba`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 77f96585ee4b1a31e49b6d7ad2429ef0f81fdf933f91d9cd52e0c6d0b50e0cba

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281118 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-cedf175bd4913d7485e64d9c]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-cedf175bd4913d7485e64d9c]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-cedf175bd4913d7485e64d9c]
- Candidate interpretation: Candidate interpretation: this is the fourth detection at the ~107.28 MB region (starts 107281112, 107281114, 107281116, 107281118), each exactly +2 bytes apart with identical metadata. The drift pattern is now confirmed at all three multi-detection regions (87488524-87488636 cluster, ~107.1 MB, ~107.28 MB). Parser-side deduplication/alignment remains the likely right next capability rather than further per-extent notes. Qualified interpretation only. [evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-cedf175bd4913d7485e64d9c]

<!-- resource-asset:node-7c949be98ca04130d7cc3bf7 -->
## node-7c949be98ca04130d7cc3bf7 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: b49b8b7672529bb498bb0aa8cb2bb5ef5225fbd7754f9a841f11d2c612ee5d04; 7008 bytes.
- Verified manifest: 53719fa84c7e20c2ddb13ed3a785902feaf14d9101e6cd14ef5095217187ed27.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-6696e0d36be7388fe115b5fb. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-7c949be98ca04130d7cc3bf7",
    "blob": "blobs/b49b8b7672529bb498bb0aa8cb2bb5ef5225fbd7754f9a841f11d2c612ee5d04",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281120
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-7c949be98ca04130d7cc3bf7/original.xa`: extraction, SHA-256 b49b8b7672529bb498bb0aa8cb2bb5ef5225fbd7754f9a841f11d2c612ee5d04
- `build/assets/data/node-7c949be98ca04130d7cc3bf7/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 34156915b1c6341799d18e3c7463c4951318f835aa2b8d2c97eb571681d575a9

Backing artifacts (not committed):
- `build/assets/blobs/b49b8b7672529bb498bb0aa8cb2bb5ef5225fbd7754f9a841f11d2c612ee5d04`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281120}}, SHA-256 b49b8b7672529bb498bb0aa8cb2bb5ef5225fbd7754f9a841f11d2c612ee5d04
- `build/assets/blobs/34156915b1c6341799d18e3c7463c4951318f835aa2b8d2c97eb571681d575a9`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 34156915b1c6341799d18e3c7463c4951318f835aa2b8d2c97eb571681d575a9

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281120 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-6696e0d36be7388fe115b5fb]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-6696e0d36be7388fe115b5fb]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-6696e0d36be7388fe115b5fb]
- Candidate interpretation: Candidate interpretation: this is the fifth detection at the ~107.28 MB region (starts 107281112 through 107281120, each exactly +2 bytes apart with identical metadata). Every multi-detection region shows the same +2-step drift; distinct regions documented so far remain 87488524 (cluster), 106593598, 106674896, 106725102, 106936730, 106953122, 107052040, 107100964, and 107281112. Parser-side deduplication/alignment remains the likely right next capability. Qualified interpretation only. [evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-6696e0d36be7388fe115b5fb]

<!-- resource-asset:node-9ab46ddd4a8838f22c928c22 -->
## node-9ab46ddd4a8838f22c928c22 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 49b38028d7177c80d4901e4c5d7a650db9f3a33e53b20628a4028a60b73f4c3c; 7008 bytes.
- Verified manifest: a6726053c2c98808bc903fd84cd78f1e1d8c99bf2c11d17a4df0b9c161159511.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-985410698291c9b448ec2aa6. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-9ab46ddd4a8838f22c928c22",
    "blob": "blobs/49b38028d7177c80d4901e4c5d7a650db9f3a33e53b20628a4028a60b73f4c3c",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281122
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-9ab46ddd4a8838f22c928c22/original.xa`: extraction, SHA-256 49b38028d7177c80d4901e4c5d7a650db9f3a33e53b20628a4028a60b73f4c3c
- `build/assets/data/node-9ab46ddd4a8838f22c928c22/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 fd4757c3a1222a12877fb6fc353daa387d00bb0d4e6747edbcefd1976a59632b

Backing artifacts (not committed):
- `build/assets/blobs/49b38028d7177c80d4901e4c5d7a650db9f3a33e53b20628a4028a60b73f4c3c`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281122}}, SHA-256 49b38028d7177c80d4901e4c5d7a650db9f3a33e53b20628a4028a60b73f4c3c
- `build/assets/blobs/fd4757c3a1222a12877fb6fc353daa387d00bb0d4e6747edbcefd1976a59632b`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 fd4757c3a1222a12877fb6fc353daa387d00bb0d4e6747edbcefd1976a59632b

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281122 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-985410698291c9b448ec2aa6]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-985410698291c9b448ec2aa6]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-985410698291c9b448ec2aa6]
- Candidate interpretation: Candidate interpretation: this is the sixth detection at the ~107.28 MB region (starts 107281112 through 107281122, each exactly +2 bytes apart with identical metadata). The +2-step drift pattern now accounts for the majority of all twenty-four documented extents across every multi-detection region. Further per-extent notes add little information; a parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-985410698291c9b448ec2aa6]

<!-- resource-asset:node-e9a5fe670190948029bc2aaa -->
## node-e9a5fe670190948029bc2aaa — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 5f14d8f09da11c93460bca9ce5ec789214dea6c19310977e5c568c37b2e1584f; 7008 bytes.
- Verified manifest: 2b6185bd57f12eeb3052842c943f693b2b04c9f32bf400795f0d6252984e30cc.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-06829de95e84722903782587. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-e9a5fe670190948029bc2aaa",
    "blob": "blobs/5f14d8f09da11c93460bca9ce5ec789214dea6c19310977e5c568c37b2e1584f",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281124
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-e9a5fe670190948029bc2aaa/original.xa`: extraction, SHA-256 5f14d8f09da11c93460bca9ce5ec789214dea6c19310977e5c568c37b2e1584f
- `build/assets/data/node-e9a5fe670190948029bc2aaa/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 835e06e887f6bd0fa597610b2b88f7f02bd62ef4292ade060a68e6fc0edeaee2

Backing artifacts (not committed):
- `build/assets/blobs/5f14d8f09da11c93460bca9ce5ec789214dea6c19310977e5c568c37b2e1584f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281124}}, SHA-256 5f14d8f09da11c93460bca9ce5ec789214dea6c19310977e5c568c37b2e1584f
- `build/assets/blobs/835e06e887f6bd0fa597610b2b88f7f02bd62ef4292ade060a68e6fc0edeaee2`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 835e06e887f6bd0fa597610b2b88f7f02bd62ef4292ade060a68e6fc0edeaee2

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281124 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-06829de95e84722903782587]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-06829de95e84722903782587]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-06829de95e84722903782587]
- Candidate interpretation: Candidate interpretation: this is the seventh detection at the ~107.28 MB region (starts 107281112 through 107281124, each exactly +2 bytes apart with identical metadata). Twenty-five iterations confirm the same picture: distinct XA regions surrounded by +2-step overlapping drift detections. Further per-extent notes add no new structural information; a parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-06829de95e84722903782587]

<!-- resource-asset:node-295463c9edf4a649c996a104 -->
## node-295463c9edf4a649c996a104 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: ae95a9f1fae8f1e26a1554b3873026cc71fd317e67639acf225a15e151d9cadb; 7008 bytes.
- Verified manifest: 1f21a7a4a39bd85772ec16f0b1145bdda024b596d26ff077f4f5ffae865644d7.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-5d7965a4ccc013bb515f562a. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-295463c9edf4a649c996a104",
    "blob": "blobs/ae95a9f1fae8f1e26a1554b3873026cc71fd317e67639acf225a15e151d9cadb",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281126
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-295463c9edf4a649c996a104/original.xa`: extraction, SHA-256 ae95a9f1fae8f1e26a1554b3873026cc71fd317e67639acf225a15e151d9cadb
- `build/assets/data/node-295463c9edf4a649c996a104/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 a115bca846e8c3a4eb05b7e809fbad1bc9c20e4b53a170b8952d870167cc60e9

Backing artifacts (not committed):
- `build/assets/blobs/ae95a9f1fae8f1e26a1554b3873026cc71fd317e67639acf225a15e151d9cadb`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281126}}, SHA-256 ae95a9f1fae8f1e26a1554b3873026cc71fd317e67639acf225a15e151d9cadb
- `build/assets/blobs/a115bca846e8c3a4eb05b7e809fbad1bc9c20e4b53a170b8952d870167cc60e9`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 a115bca846e8c3a4eb05b7e809fbad1bc9c20e4b53a170b8952d870167cc60e9

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281126 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-5d7965a4ccc013bb515f562a]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-5d7965a4ccc013bb515f562a]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-5d7965a4ccc013bb515f562a]
- Candidate interpretation: Candidate interpretation: this is the eighth detection at the ~107.28 MB region (starts 107281112 through 107281126, each exactly +2 bytes apart with identical metadata). Twenty-six iterations confirm the recurring structure: distinct XA regions surrounded by +2-step overlapping drift detections. A parser-side deduplication/alignment capability remains the appropriate next capability rather than further per-extent notes. Qualified interpretation only. [evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-5d7965a4ccc013bb515f562a]

<!-- resource-asset:node-dd8e7f1753de2bee8086611c -->
## node-dd8e7f1753de2bee8086611c — XA

- Parser: xa-v1 v3.
- Raw SHA-256: b9d77afdfce467274861801aad6193532e84dac98b11d27acf0317277d933e06; 7008 bytes.
- Verified manifest: acb5441fd999db0726181e30afe3378577d7459a155e831d949a09788785c4e1.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-07b6f90d7e7f82cd84e84d88. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-dd8e7f1753de2bee8086611c",
    "blob": "blobs/b9d77afdfce467274861801aad6193532e84dac98b11d27acf0317277d933e06",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281128
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-dd8e7f1753de2bee8086611c/original.xa`: extraction, SHA-256 b9d77afdfce467274861801aad6193532e84dac98b11d27acf0317277d933e06
- `build/assets/data/node-dd8e7f1753de2bee8086611c/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 2885ad0e369b3d71f8cc4a88ac060e7b672484173da5f5467e3c887259f935fb

Backing artifacts (not committed):
- `build/assets/blobs/b9d77afdfce467274861801aad6193532e84dac98b11d27acf0317277d933e06`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281128}}, SHA-256 b9d77afdfce467274861801aad6193532e84dac98b11d27acf0317277d933e06
- `build/assets/blobs/2885ad0e369b3d71f8cc4a88ac060e7b672484173da5f5467e3c887259f935fb`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 2885ad0e369b3d71f8cc4a88ac060e7b672484173da5f5467e3c887259f935fb

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281128 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-07b6f90d7e7f82cd84e84d88]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-07b6f90d7e7f82cd84e84d88]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-07b6f90d7e7f82cd84e84d88]
- Candidate interpretation: Candidate interpretation: this is the ninth detection at the ~107.28 MB region (starts 107281112 through 107281128, each exactly +2 bytes apart with identical metadata). The per-extent ledger is saturated for this pattern; every additional detection repeats known structure. A parser-side deduplication/alignment capability remains the appropriate next capability. Qualified interpretation only. [evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-07b6f90d7e7f82cd84e84d88]

<!-- resource-asset:node-cad69891c841c88df03d2f7b -->
## node-cad69891c841c88df03d2f7b — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 86b75107d5563f8963b302a6a1577aea9d489620fabe3db2d736e89313acfa14; 7008 bytes.
- Verified manifest: da1c15212d1a63072cf4ae1c31a1fe6c7420167db68a2560c802e899f67dec22.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-878a7bc77cf5fa4251c1febe. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-cad69891c841c88df03d2f7b",
    "blob": "blobs/86b75107d5563f8963b302a6a1577aea9d489620fabe3db2d736e89313acfa14",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281130
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-cad69891c841c88df03d2f7b/original.xa`: extraction, SHA-256 86b75107d5563f8963b302a6a1577aea9d489620fabe3db2d736e89313acfa14
- `build/assets/data/node-cad69891c841c88df03d2f7b/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 ddd543a11795dd5763af52316070460b00b1a18a004d340a6063a2422352556d

Backing artifacts (not committed):
- `build/assets/blobs/86b75107d5563f8963b302a6a1577aea9d489620fabe3db2d736e89313acfa14`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281130}}, SHA-256 86b75107d5563f8963b302a6a1577aea9d489620fabe3db2d736e89313acfa14
- `build/assets/blobs/ddd543a11795dd5763af52316070460b00b1a18a004d340a6063a2422352556d`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 ddd543a11795dd5763af52316070460b00b1a18a004d340a6063a2422352556d

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281130 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-878a7bc77cf5fa4251c1febe]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-878a7bc77cf5fa4251c1febe]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-878a7bc77cf5fa4251c1febe]
- Candidate interpretation: Candidate interpretation: this is the tenth detection at the ~107.28 MB region (starts 107281112 through 107281130, each exactly +2 bytes apart with identical metadata). The pattern is fully saturated: no new structural information has appeared for several iterations. A parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-878a7bc77cf5fa4251c1febe]

<!-- resource-asset:node-def77a74f76f882b9d6ca306 -->
## node-def77a74f76f882b9d6ca306 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 517028d22980c07171d41ff8fc43b9e4aab5f8e0c507afb7f0e41f288d5fcc83; 7008 bytes.
- Verified manifest: 78f19607d7ec4c8d123c5475b5dad5c3200429098174c7def8f8479bfa757bb6.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-2bec037d94287cb2b6279f67. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-def77a74f76f882b9d6ca306",
    "blob": "blobs/517028d22980c07171d41ff8fc43b9e4aab5f8e0c507afb7f0e41f288d5fcc83",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281132
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-def77a74f76f882b9d6ca306/original.xa`: extraction, SHA-256 517028d22980c07171d41ff8fc43b9e4aab5f8e0c507afb7f0e41f288d5fcc83
- `build/assets/data/node-def77a74f76f882b9d6ca306/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 7adf32c6d0fc67156436e0e62c700b34aef1bf753bcb25b1c7613d900aa2751a

Backing artifacts (not committed):
- `build/assets/blobs/517028d22980c07171d41ff8fc43b9e4aab5f8e0c507afb7f0e41f288d5fcc83`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281132}}, SHA-256 517028d22980c07171d41ff8fc43b9e4aab5f8e0c507afb7f0e41f288d5fcc83
- `build/assets/blobs/7adf32c6d0fc67156436e0e62c700b34aef1bf753bcb25b1c7613d900aa2751a`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 7adf32c6d0fc67156436e0e62c700b34aef1bf753bcb25b1c7613d900aa2751a

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281132 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-2bec037d94287cb2b6279f67]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-2bec037d94287cb2b6279f67]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-2bec037d94287cb2b6279f67]
- Candidate interpretation: Candidate interpretation: this is the eleventh detection at the ~107.28 MB region (starts 107281112 through 107281132, each exactly +2 bytes apart with identical metadata). The pattern remains fully saturated; no new structural information. A parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-2bec037d94287cb2b6279f67]

<!-- resource-asset:node-581a7b008f26cbcb2a07659f -->
## node-581a7b008f26cbcb2a07659f — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 154e5c9e5ea753b46eb30cfb289c2975fd23636f28ff0d37e6f1e3fd1b280c86; 7008 bytes.
- Verified manifest: eb9b010ebc7ba49b20432f7ff4ce5a77894cfea70bcde665d48c2106d8e4c8aa.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-e80548fb2a04bee082a9be06. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-581a7b008f26cbcb2a07659f",
    "blob": "blobs/154e5c9e5ea753b46eb30cfb289c2975fd23636f28ff0d37e6f1e3fd1b280c86",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281134
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-581a7b008f26cbcb2a07659f/original.xa`: extraction, SHA-256 154e5c9e5ea753b46eb30cfb289c2975fd23636f28ff0d37e6f1e3fd1b280c86
- `build/assets/data/node-581a7b008f26cbcb2a07659f/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 b1ee73d18355e932f86af046afb4ccf1f3e2a7363c2a06c242f4ce10eda8f247

Backing artifacts (not committed):
- `build/assets/blobs/154e5c9e5ea753b46eb30cfb289c2975fd23636f28ff0d37e6f1e3fd1b280c86`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281134}}, SHA-256 154e5c9e5ea753b46eb30cfb289c2975fd23636f28ff0d37e6f1e3fd1b280c86
- `build/assets/blobs/b1ee73d18355e932f86af046afb4ccf1f3e2a7363c2a06c242f4ce10eda8f247`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 b1ee73d18355e932f86af046afb4ccf1f3e2a7363c2a06c242f4ce10eda8f247

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281134 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-e80548fb2a04bee082a9be06]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-e80548fb2a04bee082a9be06]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-e80548fb2a04bee082a9be06]
- Candidate interpretation: Candidate interpretation: this is the twelfth detection at the ~107.28 MB region (starts 107281112 through 107281134, each exactly +2 bytes apart with identical metadata). Thirty iterations confirm the recurring structure: distinct XA regions surrounded by +2-step overlapping drift detections. Further per-extent notes add no new structural information; a parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-e80548fb2a04bee082a9be06]

<!-- resource-asset:node-c96232467fd4df5cfb9ed78a -->
## node-c96232467fd4df5cfb9ed78a — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 16fcf8811c6db9cf67832c280eede08986dd6018359b50f68af1ba8f16c8e1ab; 7008 bytes.
- Verified manifest: 866ef907d08097d6e5fe9543a2e85a721cf5a5533f9e70303b3a539da4864550.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-02a24ea5e89d3d6038436cc3. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-c96232467fd4df5cfb9ed78a",
    "blob": "blobs/16fcf8811c6db9cf67832c280eede08986dd6018359b50f68af1ba8f16c8e1ab",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281136
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-c96232467fd4df5cfb9ed78a/original.xa`: extraction, SHA-256 16fcf8811c6db9cf67832c280eede08986dd6018359b50f68af1ba8f16c8e1ab
- `build/assets/data/node-c96232467fd4df5cfb9ed78a/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 3e3571f77150fce86aa1b1b533eb17873c551565be21e0d0c68fec12f5342cf3

Backing artifacts (not committed):
- `build/assets/blobs/16fcf8811c6db9cf67832c280eede08986dd6018359b50f68af1ba8f16c8e1ab`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281136}}, SHA-256 16fcf8811c6db9cf67832c280eede08986dd6018359b50f68af1ba8f16c8e1ab
- `build/assets/blobs/3e3571f77150fce86aa1b1b533eb17873c551565be21e0d0c68fec12f5342cf3`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 3e3571f77150fce86aa1b1b533eb17873c551565be21e0d0c68fec12f5342cf3

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281136 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-02a24ea5e89d3d6038436cc3]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-02a24ea5e89d3d6038436cc3]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-02a24ea5e89d3d6038436cc3]
- Candidate interpretation: Candidate interpretation: this is the thirteenth detection at the ~107.28 MB region (starts 107281112 through 107281136, each exactly +2 bytes apart with identical metadata). The +2-step drift pattern remains fully saturated; no new structural information. A parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-02a24ea5e89d3d6038436cc3, evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-02a24ea5e89d3d6038436cc3]

<!-- resource-asset:node-58af75970753c2883c71813c -->
## node-58af75970753c2883c71813c — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 778eea98396e2718867ee1f8bcdae1cc8fe5f68cb62fa8986410f636a8ed3758; 7008 bytes.
- Verified manifest: 997cc8839bfc86b195eb55cc2cf95cff9afd295407649660ef74b1e77eee8df9.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-3c8acb889f61f8a5d33a036f. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-58af75970753c2883c71813c",
    "blob": "blobs/778eea98396e2718867ee1f8bcdae1cc8fe5f68cb62fa8986410f636a8ed3758",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281138
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-58af75970753c2883c71813c/original.xa`: extraction, SHA-256 778eea98396e2718867ee1f8bcdae1cc8fe5f68cb62fa8986410f636a8ed3758
- `build/assets/data/node-58af75970753c2883c71813c/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 940b42efc54f9a9240bf3fe507f57e4dd6b9e4ab752d8781fc465cbb3db7241a

Backing artifacts (not committed):
- `build/assets/blobs/778eea98396e2718867ee1f8bcdae1cc8fe5f68cb62fa8986410f636a8ed3758`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281138}}, SHA-256 778eea98396e2718867ee1f8bcdae1cc8fe5f68cb62fa8986410f636a8ed3758
- `build/assets/blobs/940b42efc54f9a9240bf3fe507f57e4dd6b9e4ab752d8781fc465cbb3db7241a`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 940b42efc54f9a9240bf3fe507f57e4dd6b9e4ab752d8781fc465cbb3db7241a

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281138 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-3c8acb889f61f8a5d33a036f]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-3c8acb889f61f8a5d33a036f]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-3c8acb889f61f8a5d33a036f]
- Candidate interpretation: Candidate interpretation: this is the fourteenth detection at the ~107.28 MB region (starts 107281112 through 107281138, each exactly +2 bytes apart with identical metadata). The pattern remains fully saturated; no new structural information. A parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-3c8acb889f61f8a5d33a036f, evidence-02a24ea5e89d3d6038436cc3, evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-3c8acb889f61f8a5d33a036f]

<!-- resource-asset:node-69bdf9452ce4d8f9b8f38778 -->
## node-69bdf9452ce4d8f9b8f38778 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 94657494d59276acd963eca10f43b1e4bb3d158e69c6d05b1ac80753bd15767d; 7008 bytes.
- Verified manifest: 871c28e07965c7a8ff6f0bec54773ccc4d37a84e40a25ef5482fd806fbf52cf5.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-a56680fd654adde0cb18307a. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-69bdf9452ce4d8f9b8f38778",
    "blob": "blobs/94657494d59276acd963eca10f43b1e4bb3d158e69c6d05b1ac80753bd15767d",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281140
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-69bdf9452ce4d8f9b8f38778/original.xa`: extraction, SHA-256 94657494d59276acd963eca10f43b1e4bb3d158e69c6d05b1ac80753bd15767d
- `build/assets/data/node-69bdf9452ce4d8f9b8f38778/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 94f5fbb3a8a57414cdc4f69f664e6834035965b5d320cd8590ded7f6033e4f5e

Backing artifacts (not committed):
- `build/assets/blobs/94657494d59276acd963eca10f43b1e4bb3d158e69c6d05b1ac80753bd15767d`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281140}}, SHA-256 94657494d59276acd963eca10f43b1e4bb3d158e69c6d05b1ac80753bd15767d
- `build/assets/blobs/94f5fbb3a8a57414cdc4f69f664e6834035965b5d320cd8590ded7f6033e4f5e`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 94f5fbb3a8a57414cdc4f69f664e6834035965b5d320cd8590ded7f6033e4f5e

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281140 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-a56680fd654adde0cb18307a]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-a56680fd654adde0cb18307a]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-a56680fd654adde0cb18307a]
- Candidate interpretation: Candidate interpretation: this is the fifteenth detection at the ~107.28 MB region (starts 107281112 through 107281140, each exactly +2 bytes apart with identical metadata). The pattern remains fully saturated; no new structural information. A parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-a56680fd654adde0cb18307a, evidence-3c8acb889f61f8a5d33a036f, evidence-02a24ea5e89d3d6038436cc3, evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-a56680fd654adde0cb18307a]

<!-- resource-asset:node-e1ae96423011e6b52de36776 -->
## node-e1ae96423011e6b52de36776 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 907ad1b8ee96ae16ff8829973e13347b766a92ab4da0f3d3c45ca9884f8a1d6f; 7008 bytes.
- Verified manifest: 6582889598e15e681760acf2d1728e0549cfdbef3c706171ca78013f995d1733.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-3e3658c6a936c0db52222709. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-e1ae96423011e6b52de36776",
    "blob": "blobs/907ad1b8ee96ae16ff8829973e13347b766a92ab4da0f3d3c45ca9884f8a1d6f",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281142
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-e1ae96423011e6b52de36776/original.xa`: extraction, SHA-256 907ad1b8ee96ae16ff8829973e13347b766a92ab4da0f3d3c45ca9884f8a1d6f
- `build/assets/data/node-e1ae96423011e6b52de36776/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 0635f22f25421f930fdb524239f0da8ea113414744ee25453c4828529fc28d74

Backing artifacts (not committed):
- `build/assets/blobs/907ad1b8ee96ae16ff8829973e13347b766a92ab4da0f3d3c45ca9884f8a1d6f`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281142}}, SHA-256 907ad1b8ee96ae16ff8829973e13347b766a92ab4da0f3d3c45ca9884f8a1d6f
- `build/assets/blobs/0635f22f25421f930fdb524239f0da8ea113414744ee25453c4828529fc28d74`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 0635f22f25421f930fdb524239f0da8ea113414744ee25453c4828529fc28d74

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281142 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-3e3658c6a936c0db52222709]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-3e3658c6a936c0db52222709]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-3e3658c6a936c0db52222709]
- Candidate interpretation: Candidate interpretation: this is the sixteenth detection at the ~107.28 MB region (starts 107281112 through 107281142, each exactly +2 bytes apart with identical metadata). The pattern remains fully saturated; no new structural information. A parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-3e3658c6a936c0db52222709, evidence-a56680fd654adde0cb18307a, evidence-3c8acb889f61f8a5d33a036f, evidence-02a24ea5e89d3d6038436cc3, evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-3e3658c6a936c0db52222709]

<!-- resource-asset:node-feb4e6e19754f5bed36c77dd -->
## node-feb4e6e19754f5bed36c77dd — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 818215069c486a82686d706b4181b6e745e56edfe212745f5e0e551477ad8202; 7008 bytes.
- Verified manifest: 40b459d89537a9b5dd7ad167168feb51bf646308c80fe0b0746950754e1243bf.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-77c6349e58cadd3c6f389ab8. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-feb4e6e19754f5bed36c77dd",
    "blob": "blobs/818215069c486a82686d706b4181b6e745e56edfe212745f5e0e551477ad8202",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107281144
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-feb4e6e19754f5bed36c77dd/original.xa`: extraction, SHA-256 818215069c486a82686d706b4181b6e745e56edfe212745f5e0e551477ad8202
- `build/assets/data/node-feb4e6e19754f5bed36c77dd/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 c083ae996c9c6abad4fcdb78fd2baa38f8606104b0c64df7c7fc59c435357fa8

Backing artifacts (not committed):
- `build/assets/blobs/818215069c486a82686d706b4181b6e745e56edfe212745f5e0e551477ad8202`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107281144}}, SHA-256 818215069c486a82686d706b4181b6e745e56edfe212745f5e0e551477ad8202
- `build/assets/blobs/c083ae996c9c6abad4fcdb78fd2baa38f8606104b0c64df7c7fc59c435357fa8`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 c083ae996c9c6abad4fcdb78fd2baa38f8606104b0c64df7c7fc59c435357fa8

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107281144 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-77c6349e58cadd3c6f389ab8]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-77c6349e58cadd3c6f389ab8]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-77c6349e58cadd3c6f389ab8]
- Candidate interpretation: Candidate interpretation: this is the seventeenth detection at the ~107.28 MB region (starts 107281112 through 107281144, each exactly +2 bytes apart with identical metadata). The pattern remains fully saturated; no new structural information. A parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-77c6349e58cadd3c6f389ab8, evidence-3e3658c6a936c0db52222709, evidence-a56680fd654adde0cb18307a, evidence-3c8acb889f61f8a5d33a036f, evidence-02a24ea5e89d3d6038436cc3, evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-77c6349e58cadd3c6f389ab8]

<!-- resource-asset:node-c33382960ccf618bc3e19881 -->
## node-c33382960ccf618bc3e19881 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: dbbef8c8935f34455013c3e01539dbf57188d3fbb8afbe0f75260ff10e49962b; 7008 bytes.
- Verified manifest: 0b2a9e88b901a0af8660523f35aa28543bde3421389aa271b6f66d5c83139d09.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-3bd97646be693a1d83d06434. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-c33382960ccf618bc3e19881",
    "blob": "blobs/dbbef8c8935f34455013c3e01539dbf57188d3fbb8afbe0f75260ff10e49962b",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107297532
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-c33382960ccf618bc3e19881/original.xa`: extraction, SHA-256 dbbef8c8935f34455013c3e01539dbf57188d3fbb8afbe0f75260ff10e49962b
- `build/assets/data/node-c33382960ccf618bc3e19881/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 ef3e033d2c20a8035f23d366572b4a5b24dc2ec86d0df0c9d91ef397f6f7df1b

Backing artifacts (not committed):
- `build/assets/blobs/dbbef8c8935f34455013c3e01539dbf57188d3fbb8afbe0f75260ff10e49962b`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107297532}}, SHA-256 dbbef8c8935f34455013c3e01539dbf57188d3fbb8afbe0f75260ff10e49962b
- `build/assets/blobs/ef3e033d2c20a8035f23d366572b4a5b24dc2ec86d0df0c9d91ef397f6f7df1b`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 ef3e033d2c20a8035f23d366572b4a5b24dc2ec86d0df0c9d91ef397f6f7df1b

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107297532 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-3bd97646be693a1d83d06434]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-3bd97646be693a1d83d06434]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-3bd97646be693a1d83d06434]
- Candidate interpretation: Candidate interpretation: this is a tenth distinct non-overlapping XA detection region. It starts past the end of the ~107.28 MB cluster's last extent (107281144 + 7008 = 107288152) and does not overlap any previously documented extent. Documented non-overlapping starts so far: 87488524, 106593598, 106674896, 106725102, 106936730, 106953122, 107052040, 107100964, 107281112, and now 107297532. It shares fileNumbers value 105 with the 87.5 MB cluster and the 107281112 region. Qualified interpretation only. [evidence-3bd97646be693a1d83d06434, evidence-77c6349e58cadd3c6f389ab8, evidence-3e3658c6a936c0db52222709, evidence-a56680fd654adde0cb18307a, evidence-3c8acb889f61f8a5d33a036f, evidence-02a24ea5e89d3d6038436cc3, evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-3bd97646be693a1d83d06434]

<!-- resource-asset:node-3aff3144861d1be8aa4f6683 -->
## node-3aff3144861d1be8aa4f6683 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: 1e889157fc71aeac9c6e49d16fd96b73f2c71aa3c831edec7b8d769cad3e2d62; 7008 bytes.
- Verified manifest: c0035a2f9386d41120e13a8f3fa6eb43f873c4bbc128f1b999874cf70223a450.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-f1a165d36135d9a7fbceba5c. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-3aff3144861d1be8aa4f6683",
    "blob": "blobs/1e889157fc71aeac9c6e49d16fd96b73f2c71aa3c831edec7b8d769cad3e2d62",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107297534
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-3aff3144861d1be8aa4f6683/original.xa`: extraction, SHA-256 1e889157fc71aeac9c6e49d16fd96b73f2c71aa3c831edec7b8d769cad3e2d62
- `build/assets/data/node-3aff3144861d1be8aa4f6683/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 fe7b755ada11654f4e15bfe2101499d6c58b4d739d14e507f69a96b7f9243ac5

Backing artifacts (not committed):
- `build/assets/blobs/1e889157fc71aeac9c6e49d16fd96b73f2c71aa3c831edec7b8d769cad3e2d62`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107297534}}, SHA-256 1e889157fc71aeac9c6e49d16fd96b73f2c71aa3c831edec7b8d769cad3e2d62
- `build/assets/blobs/fe7b755ada11654f4e15bfe2101499d6c58b4d739d14e507f69a96b7f9243ac5`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 fe7b755ada11654f4e15bfe2101499d6c58b4d739d14e507f69a96b7f9243ac5

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107297534 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-f1a165d36135d9a7fbceba5c]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-f1a165d36135d9a7fbceba5c]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-f1a165d36135d9a7fbceba5c]
- Candidate interpretation: Candidate interpretation: this is the second detection at the ~107.3 MB region (starts 107297532 and 107297534, +2 bytes apart with identical metadata) — the same +2-step drift pattern now observed at every multi-detection region. Thirty-seven iterations confirm the structure is saturated; a parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-f1a165d36135d9a7fbceba5c, evidence-3bd97646be693a1d83d06434, evidence-77c6349e58cadd3c6f389ab8, evidence-3e3658c6a936c0db52222709, evidence-a56680fd654adde0cb18307a, evidence-3c8acb889f61f8a5d33a036f, evidence-02a24ea5e89d3d6038436cc3, evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-f1a165d36135d9a7fbceba5c]

<!-- resource-asset:node-6cd9826f03aca68e760d1f11 -->
## node-6cd9826f03aca68e760d1f11 — XA

- Parser: xa-v1 v3.
- Raw SHA-256: f07883240d0c7a4c66bd8dbd3dfde83eb559417eb38d7474fcd05c2a1e8815bb; 7008 bytes.
- Verified manifest: 8a0693c390b1428e036ec3429c15a7cefdfbbcf5ff5265ba4d901a8a9e305967.
- Stages: {"decoding":"validated","discovery":"validated","extraction":"validated"}.
- Evidence: evidence-3d19eaa0aebd70f7e7ae5993. Structural compatibility is not historical naming evidence.

### Source and extraction

```json
[
  {
    "node": "node-6cd9826f03aca68e760d1f11",
    "blob": "blobs/f07883240d0c7a4c66bd8dbd3dfde83eb559417eb38d7474fcd05c2a1e8815bb",
    "size": 7008,
    "source": {
      "coordinate": "file-byte",
      "length": 7008,
      "node": "input-5fe7a25fe1c481a46175463f",
      "offset": 107297536
    }
  },
  {
    "node": "input-5fe7a25fe1c481a46175463f",
    "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
    "size": 133935104,
    "input": {
      "blob": "blobs/612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "hash": "612f9ac8279a364c2fdd19cb75e63df2e892a6f52b6f1d8081ea8560b18decd4",
      "id": "input-5fe7a25fe1c481a46175463f",
      "path": "extracted/iso/a_file.bin",
      "size": 133935104
    }
  }
]
```

Recreate a run from the original scope, using the registered parser:

```sh
npx tsx tools/agent/resourceCampaign.ts --input 'extracted' --limits '{"maxAssets":2000,"maxFileBytes":268435456,"maxFiles":4096,"maxFunctions":128,"maxInputBytes":536870912,"maxInstructions":4096,"maxOutputBytes":268435456}'

```

The documented resource ID and source hashes identify the result independently
of a generated run directory. Replace RUN with the new campaign's run ID.
Required schemas (if nonempty, save this JSON to the --schemas path above):

```json
[]
```

For transformed views, the commands and code-origin hashes above reproduce the
recorded parameters. Input association is conditional, not an inferred game call.

Browsable files (not committed):
- `build/assets/data/node-6cd9826f03aca68e760d1f11/original.xa`: extraction, SHA-256 f07883240d0c7a4c66bd8dbd3dfde83eb559417eb38d7474fcd05c2a1e8815bb
- `build/assets/data/node-6cd9826f03aca68e760d1f11/variant-62c68d5a435c3507-xa-data.bin`: decoding, SHA-256 47f976b194d0c6426900334007a49e50b13e53fd4a068bc0cfe29d1173417fbe

Backing artifacts (not committed):
- `build/assets/blobs/f07883240d0c7a4c66bd8dbd3dfde83eb559417eb38d7474fcd05c2a1e8815bb`: slice-v1, {"basis":"validated-parser","source":{"coordinate":"file-byte","length":7008,"node":"input-5fe7a25fe1c481a46175463f","offset":107297536}}, SHA-256 f07883240d0c7a4c66bd8dbd3dfde83eb559417eb38d7474fcd05c2a1e8815bb
- `build/assets/blobs/47f976b194d0c6426900334007a49e50b13e53fd4a068bc0cfe29d1173417fbe`: xa-v1, {"form":"stripped-2336","interpretation":"Non-audio payload concatenation only; not decoded video or established member/frame semantics","kind":"xa-data","payloadSizes":[2324],"sectors":1,"stride":2336,"variant":{"kind":"data"}}, SHA-256 47f976b194d0c6426900334007a49e50b13e53fd4a068bc0cfe29d1173417fbe

### Qualified observations

- Candidate interpretation: The selected resource is an XA-format extent of 7008 bytes at file-byte offset 107297536 in input-5fe7a25fe1c481a46175463f (source coordinate: file-byte). [evidence-3d19eaa0aebd70f7e7ae5993]
- Candidate interpretation: Parser xa-v1 (version 3) validated the extent's structural constraints; discovery and extraction stages are both validated. [evidence-3d19eaa0aebd70f7e7ae5993]
- Candidate interpretation: The extent consists of 3 sectors at stride 2336 in stripped-2336 form: 1 data sector, 2 padding sectors, and 0 audio sectors, with no trailing bytes; no XA channel numbers are recorded for this extent. fileNumbers [0, 105] are recorded in node metadata but their meaning is not established by this run's evidence. [evidence-3d19eaa0aebd70f7e7ae5993]
- Candidate interpretation: Candidate interpretation: this is the third detection at the ~107.3 MB region (starts 107297532, 107297534, 107297536, each exactly +2 bytes apart with identical metadata). Every multi-detection region shows the same +2-step drift. The per-extent ledger is saturated; a parser-side deduplication/alignment capability is the appropriate next capability. Qualified interpretation only. [evidence-3d19eaa0aebd70f7e7ae5993, evidence-f1a165d36135d9a7fbceba5c, evidence-3bd97646be693a1d83d06434, evidence-77c6349e58cadd3c6f389ab8, evidence-3e3658c6a936c0db52222709, evidence-a56680fd654adde0cb18307a, evidence-3c8acb889f61f8a5d33a036f, evidence-02a24ea5e89d3d6038436cc3, evidence-e80548fb2a04bee082a9be06, evidence-2bec037d94287cb2b6279f67, evidence-878a7bc77cf5fa4251c1febe, evidence-07b6f90d7e7f82cd84e84d88, evidence-5d7965a4ccc013bb515f562a, evidence-06829de95e84722903782587, evidence-985410698291c9b448ec2aa6, evidence-6696e0d36be7388fe115b5fb, evidence-cedf175bd4913d7485e64d9c, evidence-2ab41c7855acaf3d731c5e77, evidence-6507924e3d901da1d7937643, evidence-86d66c5220244dbd9b2b9052, evidence-af70082128fa6540f74a9585, evidence-4ea57e19a796549fa51597e4, evidence-b83cdcd544c5258cc9d9252f, evidence-b5180f38e164e591415f2c49, evidence-f0911461cc8ef5bb51de8004, evidence-9be3c7e5fe6995f8d922dcfb, evidence-20155b90fd83fbdcf4301efe, evidence-af227c6a44f67bf036986419, evidence-143e423b787fa9934aff4821, evidence-5b6cd0ca2201a73a72f970b6, evidence-83ebb46ed08ffab4079a0d13, evidence-37e97f73fcec97d84e373f6d, evidence-3d74ee8da4ac7c5f3b507cf7, evidence-01e64b20d81bfb89a61eb2ae, evidence-4a7c7617117f6adb7b17dacb, evidence-1eb1d52c81b7d3bf8f89d759, evidence-69d592ea5e173bb8e176ac62, evidence-f2658dcb483b60a5455c856f]
- Candidate interpretation: Limitation: structural compatibility only. Not evidence of a historical asset name, game-asset consumer association, disc LBA, or physical-sector coordinates; the run's inputs do not establish disc metadata (recorded as unresolved in the handoff). [evidence-3d19eaa0aebd70f7e7ae5993]
