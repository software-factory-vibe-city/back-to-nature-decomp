import assert from "node:assert/strict";
import { test } from "node:test";
import { PARSERS } from "../registry.ts";
import { XA_PARSER } from "./xa.ts";

/** Fixtures are constructed from the published CD-ROM XA sector layout; no
 * extracted binary data is checked in. */

const SYNC = Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00]);
const VIDEO = 0x4a; // REALTIME | DATA | VIDEO, form 1, coding 0
const AUDIO = 0x64; // REALTIME | FORM2 | AUDIO

function fill(size: number, seed: number): Buffer {
  const bytes = Buffer.alloc(size);
  for (let i = 0; i < size; i++) bytes[i] = (seed + i * 7) & 0xff;
  return bytes;
}
function subheader(file: number, channel: number, submode: number, coding: number): Buffer {
  const half = Buffer.from([file, channel, submode, coding]);
  return Buffer.concat([half, half]);
}
function rawSector(submode: number, coding: number, channel = 0): Buffer {
  const bytes = Buffer.alloc(2352);
  SYNC.copy(bytes, 0);
  bytes[12] = 0; bytes[13] = 2; bytes[14] = 1; bytes[15] = 2;
  subheader(1, channel, submode, coding).copy(bytes, 16);
  fill((submode & 0x20) ? 2324 : 2048, channel + submode).copy(bytes, 24);
  return bytes;
}
function strippedSector(submode: number, coding: number, channel = 0): Buffer {
  const bytes = Buffer.alloc(2336);
  subheader(1, channel, submode, coding).copy(bytes, 0);
  fill((submode & 0x20) ? 2324 : 2048, channel + submode).copy(bytes, 8);
  return bytes;
}

test("raw mode 2 chain validates with spec fields and exact extent", () => {
  const file = Buffer.concat([rawSector(VIDEO, 0), rawSector(VIDEO, 0), rawSector(AUDIO, 0x10, 7)]);
  assert.ok(XA_PARSER.probe(file, 0));
  assert.ok(XA_PARSER.probe(file, 2352)); // sync hits inside the file; parse decides alignment
  const parsed = XA_PARSER.parse(file, 0);
  assert.equal(parsed.length, 3 * 2352);
  assert.deepEqual(parsed.metadata, {
    form: "raw-2352", stride: 2352, sectors: 3, audioSectors: 1, dataSectors: 2,
    channels: [7], fileNumbers: [1], trailingBytes: 0,
  });
});

test("interior alignment and spurious headerless patterns are rejected", async () => {
  const chain = Buffer.concat([rawSector(VIDEO, 0), rawSector(VIDEO, 0), rawSector(AUDIO, 0x10, 7)]);
  const file = Buffer.concat([Buffer.from([1, 2, 3]), chain]);
  assert.ok(XA_PARSER.probe(file, 3 + 2352));
  assert.throws(() => XA_PARSER.parse(file, 3 + 2352), /after a valid sector/);
  // A raw file's own subheader looks like one headerless sector; one sector
  // is not a valid headerless chain.
  assert.ok(XA_PARSER.probe(file, 3 + 16));
  assert.throws(() => XA_PARSER.parse(file, 3 + 16), /chain/);
  const scanned = await PARSERS.scan(file, 100);
  assert.equal(scanned.matches.length, 1);
  assert.equal(scanned.matches[0]!.offset, 3);
  assert.ok(scanned.rejected >= 3);
  assert.ok(scanned.complete);
});

test("headerless 2336 chains validate from two sectors onward", () => {
  const file = Buffer.concat([strippedSector(AUDIO, 0x10), strippedSector(AUDIO, 0x10), strippedSector(VIDEO, 0)]);
  assert.ok(XA_PARSER.probe(file, 0));
  const parsed = XA_PARSER.parse(file, 0);
  assert.equal(parsed.length, 3 * 2336);
  assert.equal(parsed.metadata.form, "stripped-2336");
  assert.deepEqual(parsed.metadata.channels, [0]);
  // A single duplicated subheader is not structural evidence.
  const lone = Buffer.concat([strippedSector(AUDIO, 0x10), Buffer.alloc(1024)]);
  assert.ok(XA_PARSER.probe(lone, 0));
  assert.throws(() => XA_PARSER.parse(lone, 0), /two consecutive/);
});

test("raw structural constraints: sync, MSF BCD, mode, subheader copy, coding", () => {
  const cases: Array<[string, (bytes: Buffer) => void, RegExp]> = [
    ["sync", bytes => { bytes[5] = 0xfe; }, /sector/],
    ["mode byte", bytes => { bytes[15] = 1; }, /sector/],
    ["second BCD", bytes => { bytes[13] = 0x60; }, /sector/],
    ["minute nibble", bytes => { bytes[12] = 0x0a; }, /sector/],
    ["frame range", bytes => { bytes[14] = 0x75; }, /sector/],
    ["subheader copy", bytes => { bytes[20] = bytes[20]! ^ 1; }, /sector/],
    ["audio without form 2", bytes => { bytes[18] = 0x44; }, /sector/],
    ["audio reserved coding bits", bytes => { bytes[19] = 0x03; }, /sector/],
    ["non-audio coding", bytes => { bytes[18] = VIDEO; bytes[19] = 0x40; }, /sector/],
  ];
  for (const [name, mutate, pattern] of cases) {
    const audioCase = name.startsWith("audio");
    const file = rawSector(audioCase ? AUDIO : VIDEO, audioCase ? 0x10 : 0, 3);
    assert.doesNotThrow(() => XA_PARSER.parse(file, 0), `pre-mutation fixture invalid: ${name}`);
    mutate(file);
    assert.throws(() => XA_PARSER.parse(file, 0), pattern, name);
  }
});

test("zero runs, EOR-only padding and truncated prefixes do not probe", () => {
  const zeros = Buffer.alloc(4096);
  assert.ok(!XA_PARSER.probe(zeros, 0));
  assert.ok(!XA_PARSER.probe(zeros, 4096 - 24));
  assert.ok(!XA_PARSER.probe(Buffer.alloc(0), 0));
  const eorOnly = Buffer.concat([Buffer.alloc(7), subheader(1, 0, 0x01, 0), Buffer.alloc(2400)]);
  assert.ok(!XA_PARSER.probe(eorOnly, 7));
  const truncated = Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0, 2, 1, 2, 9, 9, 0x4a, 0]);
  assert.ok(!XA_PARSER.probe(truncated, 0));
  assert.throws(() => XA_PARSER.parse(Buffer.from([1, 2, 3]), 0), /sector/);
});

test("false-positive duplicated subheaders probe but never parse or match", async () => {
  const tricky = Buffer.concat([Buffer.alloc(7), subheader(9, 9, VIDEO, 0), Buffer.alloc(2 * 2336)]);
  assert.ok(XA_PARSER.probe(tricky, 7));
  assert.throws(() => XA_PARSER.parse(tricky, 7), /two consecutive/);
  const scanned = await PARSERS.scan(tricky, 10);
  assert.equal(scanned.matches.length, 0);
  assert.ok(scanned.rejected >= 1);
  const empty = await PARSERS.scan(Buffer.alloc(64), 10);
  assert.equal(empty.matches.length, 0);
});

test("variants, bounded decode, replay and unknown variants through the registry", async () => {
  const a0 = rawSector(AUDIO, 0x10, 3), a1 = rawSector(AUDIO, 0x10, 3), d0 = rawSector(VIDEO, 0);
  const file = Buffer.concat([a0, a1, d0]);
  const scanned = await PARSERS.scan(file, 100);
  assert.equal(scanned.matches.length, 1);
  assert.equal(scanned.matches[0]!.parser, "xa-v1");
  assert.equal(scanned.matches[0]!.format, "XA");
  assert.equal(scanned.matches[0]!.length, 3 * 2352);
  assert.deepEqual(PARSERS.variants("xa-v1", file), [{ kind: "audio", channel: 3 }, { kind: "data" }]);
  const audio = PARSERS.decode("xa-v1", file, { kind: "audio", channel: 3 }, 1 << 20);
  assert.equal(audio.length, 1);
  const adpcm = audio[0]!;
  assert.equal(adpcm.kind, "xa-audio-adpcm");
  assert.equal(adpcm.extension, "adpcm");
  assert.equal(adpcm.stage, "decoding");
  assert.equal(adpcm.bytes.length, 2 * 2324);
  const expected = Buffer.concat([a0.subarray(24, 24 + 2324), a1.subarray(24, 24 + 2324)]);
  assert.ok(adpcm.bytes.equals(expected));
  assert.equal(adpcm.metadata.sampleRateHz, 37800);
  assert.equal(adpcm.metadata.stereo, true);
  assert.equal(adpcm.metadata.emphasis, false);
  assert.equal(adpcm.metadata.sectors, 2);
  const data = PARSERS.decode("xa-v1", file, { kind: "data" }, 1 << 20)[0]!;
  assert.equal(data.kind, "xa-data");
  assert.equal(data.extension, "bin");
  assert.equal(data.bytes.length, 2048);
  assert.ok(data.bytes.equals(d0.subarray(24, 24 + 2048)));
  assert.throws(() => PARSERS.decode("xa-v1", file, { kind: "audio", channel: 3 }, 2 * 2324 - 1), /budget/);
  assert.throws(() => PARSERS.decode("xa-v1", file, { kind: "audio", channel: 9 }, 1 << 20), /variant/);
  assert.throws(() => PARSERS.decode("xa-v1", file, { kind: "invented" }, 1 << 20), /variant/);
  const replayed = PARSERS.replay("xa-v1", file, { kind: "audio", channel: 3 }, "xa-audio-adpcm", 1 << 20);
  assert.ok(replayed.bytes.equals(adpcm.bytes));
  // Decode requires the exact sector extent: trailing bytes are not payload.
  const padded = Buffer.concat([file, Buffer.alloc(100)]);
  assert.throws(() => PARSERS.decode("xa-v1", padded, { kind: "data" }, 1 << 20), /extent/);
  const one = Buffer.concat([rawSector(VIDEO, 0), Buffer.alloc(100)]);
  const parsed = XA_PARSER.parse(one, 0);
  assert.equal(parsed.length, 2352);
  assert.equal(parsed.metadata.trailingBytes, 100);
  const oneScan = await PARSERS.scan(one, 10);
  assert.equal(oneScan.matches.length, 1);
});

test("audio codingInfo maps to the spec rate/stereo/emphasis table", () => {
  const rows = [
    [0x00, 37800, false, false], [0x10, 37800, true, false],
    [0x20, 18900, false, false], [0x30, 18900, true, false],
    [0x60, 18900, false, true],
  ] as const;
  for (const [coding, rate, stereo, emphasis] of rows) {
    const file = Buffer.concat([rawSector(AUDIO, coding, 1), rawSector(AUDIO, coding, 1)]);
    const out = PARSERS.decode("xa-v1", file, { kind: "audio", channel: 1 }, 1 << 20)[0]!;
    assert.equal(out.metadata.sampleRateHz, rate, `coding ${coding}`);
    assert.equal(out.metadata.stereo, stereo, `coding ${coding}`);
    assert.equal(out.metadata.emphasis, emphasis, `coding ${coding}`);
  }
});

test("parser is registered and preserves the existing registrations", () => {
  assert.equal(PARSERS.get("xa-v1").format, "XA");
  assert.equal(PARSERS.get("tim-v1").format, "TIM");
});
