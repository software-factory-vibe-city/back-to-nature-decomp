# Asset identification

The extraction loop adds an entry here only after source extents, output hashes
and supported decoding have been verified. Each successful asset iteration
commits its extraction instructions and qualified evidence to this ledger.

Generated resources and full reports remain under `build/assets/` and are not
committed. A parser-compatible asset does not acquire a historical name or
consumer meaning without evidence. Total game asset count is unknown.

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
