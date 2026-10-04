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
