import assert from "node:assert/strict";
import { test } from "node:test";
import { PARSERS } from "../registry.ts";
import { XA_PARSER, xaEdc } from "./xa.ts";

// Synthetic sectors from PSX-SPX CDROM Format; no extracted game bytes.
const DATA = 0x48, AUDIO = 0x64;
function sector(stride: number, submode = AUDIO, coding = 1, channel = 0, file = 1): Buffer {
  const bytes = Buffer.alloc(stride), sub = stride === 2352 ? 16 : 0, payload = sub + 8;
  if (stride === 2352) { bytes.fill(255, 1, 11); bytes.set([0, 2, 1, 2], 12); }
  bytes.set([file, channel, submode, coding, file, channel, submode, coding], sub);
  if (submode & 4) for (let group = 0; group < 18; group++) bytes.fill(coding & 16 ? 8 : 12, payload + group * 128, payload + group * 128 + 16);
  if (!(submode & 32)) bytes.writeUInt32LE(xaEdc(bytes, sub, 8 + 2048), payload + 2048);
  return bytes;
}
const audioVariant = (file = 1, channel = 0, segment = 0) => ({ kind: "audio", file, channel, segment });

for (const stride of [2352, 2336]) test(`XA ${stride}: bounded parse, scan, variants and native WAV replay`, async () => {
  const a0 = sector(stride), a1 = sector(stride), data = sector(stride, DATA, 0);
  const bytes = Buffer.concat([a0, a1, data]), embedded = Buffer.concat([Buffer.from([1, 2, 3]), bytes, Buffer.alloc(100)]);
  const parsed = XA_PARSER.parse(embedded, 3);
  assert.deepEqual(parsed.metadata, { form: stride === 2352 ? "raw-2352" : "stripped-2336", stride, sectors: 3,
    audioSectors: 2, dataSectors: 1, paddingSectors: 0, channels: [0], fileNumbers: [1], trailingBytes: 100 });
  assert.equal(parsed.length, bytes.length);
  assert.throws(() => XA_PARSER.parse(embedded, 3 + stride), /after a valid sector/);
  const scan = await PARSERS.scan(embedded, 100);
  assert.equal(scan.matches.length, 1); assert.equal(scan.matches[0]!.offset, 3); assert.ok(scan.complete);
  assert.deepEqual(PARSERS.variants(XA_PARSER.id, bytes), [audioVariant(), { kind: "data" }]);
  const audio = PARSERS.decode(XA_PARSER.id, bytes, audioVariant(), 100000);
  assert.deepEqual(audio.map(out => [out.kind, out.extension, out.stage]), [["xa-audio-adpcm", "adpcm", "decoding"], ["xa-audio", "wav", "export"]]);
  const payload = stride === 2352 ? 24 : 8;
  assert.deepEqual(audio[0]!.bytes, Buffer.concat([a0.subarray(payload, payload + 2324), a1.subarray(payload, payload + 2324)]));
  assert.equal(audio[1]!.bytes.readUInt32LE(24), 37800); assert.equal(audio[1]!.bytes.readUInt16LE(22), 2);
  assert.equal(audio[1]!.bytes.length, 44 + 2 * 18 * 8 * 28 * 2);
  assert.deepEqual(PARSERS.replay(XA_PARSER.id, bytes, audioVariant(), "xa-audio", 100000).bytes, audio[1]!.bytes);
  const decodedData = PARSERS.decode(XA_PARSER.id, bytes, { kind: "data" }, 100000)[0]!;
  assert.deepEqual(decodedData.bytes, data.subarray(payload, payload + 2048));
  assert.match(decodedData.metadata.interpretation as string, /not decoded video/);
  const total = audio.reduce((size, out) => size + out.bytes.length, 0);
  assert.throws(() => PARSERS.decode(XA_PARSER.id, bytes, audioVariant(), total - 1), /budget/);
  assert.equal(PARSERS.decode(XA_PARSER.id, bytes, audioVariant(), total).length, 2);
  assert.throws(() => PARSERS.decode(XA_PARSER.id, embedded.subarray(3), audioVariant(), 100000), /extent/);
  assert.throws(() => PARSERS.decode(XA_PARSER.id, bytes, audioVariant(1, 9), 100000), /variant/);
});

test("XA rejects bogus channels, reserved coding bits, invalid ADPCM and missing subheaders", async () => {
  const bad = [
    sector(2352, AUDIO, 1, 101), sector(2352, DATA, 0, 101),
    sector(2352, AUDIO, 2), sector(2352, AUDIO, 8), sector(2352, AUDIO, 32),
    sector(2352, 0x44, 1), sector(2352, AUDIO | 8, 1), sector(2352, DATA, 1),
  ];
  const copies = sector(2352); copies[24] ^= 1; bad.push(copies);
  const filter = sector(2352); filter.fill(0x40, 24, 40); bad.push(filter);
  const sync = sector(2352); sync[5] = 254; bad.push(sync);
  const bcd = sector(2352); bcd[13] = 0x60; bad.push(bcd);
  const mode = sector(2352); mode[15] = 1; bad.push(mode);
  const sub = sector(2352); sub[20] ^= 1; bad.push(sub);
  for (const bytes of bad) assert.throws(() => XA_PARSER.parse(bytes, 0), /sector/);
  // Regression for the previous archive false positives: duplicated ASCII-ish
  // subheaders at two 2336-byte strides used to manufacture audio channels 101.
  const falseChain = Buffer.concat([sector(2336, AUDIO, 0, 101), sector(2336, DATA, 0, 101)]);
  assert.equal((await PARSERS.scan(falseChain, 100)).matches.length, 0);
  const bare = Buffer.alloc(4096); bare.fill(12, 0, 16);
  assert.throws(() => XA_PARSER.parse(bare, 0), /sector/);
  assert.equal((await PARSERS.scan(bare, 100)).matches.length, 0);
  assert.throws(() => XA_PARSER.parse(sector(2336), 0), /two consecutive/);
  assert.throws(() => XA_PARSER.parse(sector(2352).subarray(0, 2351), 0), /sector/);
});

test("file/channel interleave, coding changes and EOFs never merge unrelated audio or histories", () => {
  const bytes = Buffer.concat([
    sector(2352, AUDIO, 1, 3, 1), sector(2352, AUDIO, 1, 3, 2),
    sector(2352, AUDIO | 0x80, 1, 3, 1), sector(2352, AUDIO, 5, 3, 1),
    sector(2352, AUDIO, 0, 3, 1), sector(2352, DATA, 0),
  ]);
  assert.deepEqual(PARSERS.variants(XA_PARSER.id, bytes), [audioVariant(1, 3), audioVariant(2, 3), audioVariant(1, 3, 1), audioVariant(1, 3, 2), { kind: "data" }]);
  const first = PARSERS.decode(XA_PARSER.id, bytes, audioVariant(1, 3), 100000)[1]!;
  const other = PARSERS.decode(XA_PARSER.id, bytes, audioVariant(2, 3), 100000)[1]!;
  assert.equal(first.metadata.sectors, 2); assert.equal(other.metadata.sectors, 1);
  assert.equal(PARSERS.decode(XA_PARSER.id, bytes, audioVariant(1, 3, 1), 100000)[1]!.metadata.sampleRateHz, 18900);
  assert.equal(PARSERS.decode(XA_PARSER.id, bytes, audioVariant(1, 3, 2), 100000)[1]!.metadata.channels, 1);
});

test("mixed form 1/form 2 data uses each sector's payload size and is not classified as video", () => {
  const first = sector(2352, DATA, 0), second = sector(2352, DATA | 32, 0);
  first.fill(1, 24, 24 + 2048); second.fill(2, 24, 24 + 2324);
  first.writeUInt32LE(xaEdc(first, 16, 8 + 2048), 24 + 2048);
  const bytes = Buffer.concat([first, second]), out = PARSERS.decode(XA_PARSER.id, bytes, { kind: "data" }, 100000)[0]!;
  assert.deepEqual(out.bytes, Buffer.concat([Buffer.alloc(2048, 1), Buffer.alloc(2324, 2)]));
  assert.deepEqual(out.metadata.payloadSizes, [2048, 2324]);
  assert.equal(PARSERS.category(XA_PARSER.id, XA_PARSER.parse(bytes, 0).metadata), "data");
  assert.equal(PARSERS.category(XA_PARSER.id, XA_PARSER.parse(sector(2352), 0).metadata), "sound");
  assert.equal(XA_PARSER.version, 3); assert.equal(PARSERS.get("tim-v1").format, "TIM");
});

for (const stride of [2352, 2336]) test(`XA ${stride}: real-disc interleave padding is preserved without truncating or decoding junk`, async () => {
  const a = sector(stride), gap = sector(stride, 0, 0), b = sector(stride, AUDIO | 0x80);
  const end = sector(stride, 0x80, 0), sub = stride === 2352 ? 16 : 0;
  // Mastered unused sectors may contain arbitrary data, not silent ADPCM.
  gap.fill(0xf7, sub + 8, sub + 8 + 2048);
  gap.writeUInt32LE(xaEdc(gap, sub, 8 + 2048), sub + 8 + 2048);
  const bytes = Buffer.concat([a, gap, b, gap, end]);
  const parsed = PARSERS.parse(XA_PARSER.id, bytes, 0);
  assert.equal(parsed.length, bytes.length);
  assert.equal(parsed.metadata.audioSectors, 2); assert.equal(parsed.metadata.dataSectors, 0);
  assert.equal(parsed.metadata.paddingSectors, 3);
  assert.deepEqual(PARSERS.variants(XA_PARSER.id, bytes), [audioVariant()]);
  const actual = PARSERS.decode(XA_PARSER.id, bytes, audioVariant(), 100000);
  assert.deepEqual(actual[1]!.bytes, PARSERS.decode(XA_PARSER.id, Buffer.concat([a, b]), audioVariant(), 100000)[1]!.bytes);
  assert.equal(actual[0]!.bytes.length, 2 * 2324);
  const scan = await PARSERS.scan(Buffer.concat([bytes, Buffer.alloc(100)]), 10);
  assert(scan.complete); assert.equal(scan.matches.length, 1); assert.equal(scan.matches[0]!.length, bytes.length);
  assert.equal((await PARSERS.scan(Buffer.concat([gap, end]), 10)).matches.length, 0);
  const bad = Buffer.from(gap); bad[sub + 8] ^= 1;
  assert.throws(() => PARSERS.variants(XA_PARSER.id, Buffer.concat([a, bad, b])), /extent|sector chain/);
});

test("terminal untyped EOF separates adjacent files, while channel EOFs do not truncate the container", async () => {
  const one = Buffer.concat([sector(2352, AUDIO | 0x80, 1, 0), sector(2352, AUDIO | 0x80, 1, 1), sector(2352, 0x80, 0)]);
  const two = Buffer.concat([sector(2352, AUDIO, 1, 0), sector(2352, 0x80, 0)]);
  const bytes = Buffer.concat([one, two]);
  const scan = await PARSERS.scan(bytes, 10);
  assert.deepEqual(scan.matches.map(m => [m.offset, m.length]), [[0, one.length], [one.length, two.length]]);
  assert.deepEqual(PARSERS.variants(XA_PARSER.id, one), [audioVariant(1, 0), audioVariant(1, 1)]);
});

test("zero-filled stripped padding is not a byte-wise discovery signature", async () => {
  const bytes = Buffer.alloc(10000);
  for (let at = 0; at < bytes.length; at++) assert.equal(XA_PARSER.probe(bytes, at), false);
  assert.equal((await PARSERS.scan(bytes, 10)).matches.length, 0);
});

test("CD-ROM EDC has the standard check value, is mandatory for form 1 and optional-zero for form 2", () => {
  assert.equal(xaEdc(Buffer.from("123456789"), 0, 9), 0x6ec2edc4);
  assert.throws(() => xaEdc(Buffer.alloc(9), 0, 10), /extent/);
  const first = sector(2352, DATA, 0);
  assert.doesNotThrow(() => XA_PARSER.parse(first, 0));
  first[24] ^= 1; assert.throws(() => XA_PARSER.parse(first, 0), /sector/);
  const second = sector(2352, DATA | 32, 0);
  assert.doesNotThrow(() => XA_PARSER.parse(second, 0));
  second.writeUInt32LE(xaEdc(second, 16, 8 + 2324), 24 + 2324);
  assert.doesNotThrow(() => XA_PARSER.parse(second, 0));
  second[24] ^= 1; assert.throws(() => XA_PARSER.parse(second, 0), /sector/);
});
