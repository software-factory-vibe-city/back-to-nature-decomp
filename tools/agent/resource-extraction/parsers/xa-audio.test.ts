import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeXaWav, validateXaAudio, xaCoding } from "./xa-audio.ts";

function sound(coding: number, parameter = coding & 16 ? 8 : 12): Buffer {
  const bytes = Buffer.alloc(2324);
  for (let group = 0; group < 18; group++) bytes.fill(parameter, group * 128, group * 128 + 16);
  return bytes;
}
const extent = { payloadOffset: 0, payloadSize: 2324 };
function samples(bytes: Buffer, first: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => bytes.readInt16LE(44 + (first + i) * 2));
}

test("XA coding fields use bits 0, 2, 4 and 6; reserved alternatives are rejected", () => {
  for (const coding of [0, 1, 4, 5, 16, 17, 20, 21, 64, 69, 85]) {
    const format = xaCoding(coding);
    assert.equal(format.channels, coding & 1 ? 2 : 1);
    assert.equal(format.sampleRateHz, coding & 4 ? 18900 : 37800);
    assert.equal(format.encodedBitsPerSample, coding & 16 ? 8 : 4);
    assert.equal(format.emphasis, Boolean(coding & 64));
  }
  for (const bad of [2, 3, 8, 32, 128, -1, 256, 1.5]) assert.throws(() => xaCoding(bad), /coding/);
});

for (const coding of [0, 1, 4, 5, 16, 17, 20, 21]) test(`XA ${coding}: independent signed samples, unit/channel order, WAV size/rate`, () => {
  const source = sound(coding), eight = Boolean(coding & 16), channels = coding & 1 ? 2 : 1;
  for (let group = 0; group < 18; group++) for (let row = 0; row < 28; row++) {
    source.set(eight ? [1, 255, 127, 128] : [0xf1, 0xe2, 0xd3, 0xc4], group * 128 + 16 + row * 4);
  }
  const out = decodeXaWav(source, [extent], coding, 100000), wav = out.bytes;
  const units = eight ? 4 : 8, expected = eight ? [1, -1, 127, -128] : [1, -1, 2, -2, 3, -3, 4, -4];
  assert.equal(wav.length, 44 + 18 * units * 28 * 2);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF"); assert.equal(wav.toString("ascii", 8, 16), "WAVEfmt ");
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(22), channels);
  assert.equal(wav.readUInt32LE(24), coding & 4 ? 18900 : 37800);
  assert.equal(wav.readUInt32LE(28), wav.readUInt32LE(24) * channels * 2);
  assert.equal(wav.readUInt16LE(32), channels * 2); assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString("ascii", 36, 40), "data"); assert.equal(wav.readUInt32LE(40), wav.length - 44);
  for (let unit = 0; unit < units; unit++) {
    const frame = Math.floor(unit / channels) * 28, channel = unit % channels;
    assert.equal(wav.readInt16LE(44 + (frame * channels + channel) * 2), expected[unit]);
    assert.equal(wav.readInt16LE(44 + ((frame + 27) * channels + channel) * 2), expected[unit]);
  }
  assert.equal(out.metadata.frames, 18 * units * 28 / channels);
  assert.throws(() => decodeXaWav(source, [extent], coding, wav.length - 1), /budget/);
  assert.deepEqual(decodeXaWav(source, [extent], coding, wav.length).bytes, wav);
});

test("predictor histories persist across units, groups and sectors, with independent stereo channels", () => {
  const source = sound(1, 0x1c);
  source[16] = 0xf1; // first L=+1, R=-1; filter 1 retains +/-1 under rounding
  const joined = Buffer.concat([source, sound(1, 0x1c)]);
  const wav = decodeXaWav(joined, [extent, { payloadOffset: 2324, payloadSize: 2324 }], 1, 100000).bytes;
  for (let at = 44; at < wav.length; at += 4) {
    assert.equal(wav.readInt16LE(at), 1); assert.equal(wav.readInt16LE(at + 2), -1);
  }
});

test("predictors 0..3 match independent impulse vectors (PSX-SPX integer recurrence)", () => {
  const expected = [
    [1, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 2, 2, 1, 0, -1, -2, -2],
  ];
  for (let filter = 0; filter < 4; filter++) {
    const source = sound(0);
    source.fill((filter << 4) | 12, 0, 16); source[16] = 1;
    const wav = decodeXaWav(source, [extent], 0, 100000).bytes;
    assert.deepEqual(samples(wav, 0, 8), expected[filter]);
  }
});

test("signed saturation and reserved shifts follow documented XA rules", () => {
  const source = sound(1, 0x10);
  for (let group = 0; group < 18; group++) source.fill(0x87, group * 128 + 16, group * 128 + 128);
  const wav = decodeXaWav(source, [extent], 1, 100000).bytes;
  assert.deepEqual(samples(wav, 0, 6), [28672, -32768, 32767, -32768, 32767, -32768]);
  const shifted = sound(0, 0x0d); shifted[16] = 1;
  assert.equal(decodeXaWav(shifted, [extent], 0, 100000).bytes.readInt16LE(44), 8);
});

test("bad sound groups, filters, extents and budgets fail before producing a WAV", () => {
  const source = sound(0);
  source[0] ^= 1; assert.throws(() => validateXaAudio(source, extent, 0), /copies/);
  source[0] ^= 1; source.fill(0x40, 0, 16);
  assert.throws(() => decodeXaWav(source, [extent], 0, 100000), /filter/);
  assert.throws(() => decodeXaWav(Buffer.alloc(2323), [extent], 0, 100000), /extent/);
  assert.throws(() => decodeXaWav(sound(0), [{ payloadOffset: -1, payloadSize: 2324 }], 0, 100000), /extent/);
  assert.throws(() => decodeXaWav(sound(0), [], 0, 100000), /No XA/);
  assert.throws(() => decodeXaWav(sound(0), [extent], 0, NaN), /budget/);
});
