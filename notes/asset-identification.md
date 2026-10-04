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
