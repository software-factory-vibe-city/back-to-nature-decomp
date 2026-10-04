/** CD-XA sound groups and native-rate PCM, per PSX-SPX CDROM Format:
 * https://psx-spx.consoledev.net/ps1/cdr/cdromformat/#cdrom-xa-audio-adpcm-compression
 * No console 44.1kHz interpolation or de-emphasis is simulated. */
export function xaCoding(coding: number): { sampleRateHz: number; channels: number; encodedBitsPerSample: number; emphasis: boolean } {
  // Each two-bit field permits only 0 or 1; bit 7 is reserved.
  if (!Number.isInteger(coding) || coding < 0 || coding > 255 || (coding & 0xaa)) throw new Error("Invalid XA audio coding info");
  return { sampleRateHz: coding & 4 ? 18900 : 37800, channels: coding & 1 ? 2 : 1, encodedBitsPerSample: coding & 16 ? 8 : 4, emphasis: (coding & 64) !== 0 };
}

export interface XaAudioExtent { payloadOffset: number; payloadSize: number }
export function validateXaAudio(bytes: Buffer, sector: XaAudioExtent, coding: number): void {
  const { encodedBitsPerSample } = xaCoding(coding);
  if (!Number.isSafeInteger(sector.payloadOffset) || sector.payloadOffset < 0 || sector.payloadSize !== 2324 || sector.payloadOffset + sector.payloadSize > bytes.length) throw new Error("Invalid XA audio extent");
  for (let group = 0; group < 18; group++) {
    const at = sector.payloadOffset + group * 128;
    for (let i = 0; i < 4; i++) {
      if (bytes[at + i] !== bytes[at + 4 + i]) throw new Error("XA sound parameter copies differ");
      if (encodedBitsPerSample === 4 && bytes[at + 8 + i] !== bytes[at + 12 + i]) throw new Error("XA sound parameter copies differ");
    }
    for (let unit = 0; unit < (encodedBitsPerSample === 4 ? 8 : 4); unit++) {
      const parameter = bytes[at + (encodedBitsPerSample === 4 ? 4 : 0) + unit]!;
      if ((parameter >>> 4) > 3) throw new Error("Invalid XA ADPCM filter");
    }
  }
}

export function decodeXaWav(bytes: Buffer, sectors: XaAudioExtent[], coding: number, maxBytes: number): { bytes: Buffer; metadata: Record<string, unknown> } {
  const format = xaCoding(coding), units = format.encodedBitsPerSample === 4 ? 8 : 4;
  const frames = sectors.length * 18 * units * 28 / format.channels, pcmBytes = frames * format.channels * 2;
  if (!sectors.length) throw new Error("No XA audio sectors");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || pcmBytes + 44 > maxBytes || pcmBytes + 36 > 0xffffffff) throw new Error("budget-exhausted: XA WAV bytes");
  for (const sector of sectors) validateXaAudio(bytes, sector, coding);
  const wav = Buffer.alloc(44 + pcmBytes);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + pcmBytes, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(format.channels, 22);
  wav.writeUInt32LE(format.sampleRateHz, 24); wav.writeUInt32LE(format.sampleRateHz * format.channels * 2, 28);
  wav.writeUInt16LE(format.channels * 2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(pcmBytes, 40);
  const positive = [0, 60, 115, 98], negative = [0, 0, -52, -55];
  const previous = [0, 0], older = [0, 0];
  let firstFrame = 0;
  for (const sector of sectors) for (let group = 0; group < 18; group++) {
    const at = sector.payloadOffset + group * 128;
    for (let unit = 0; unit < units; unit++) {
      const channel = unit % format.channels;
      const parameter = bytes[at + (format.encodedBitsPerSample === 4 ? 4 : 0) + unit]!;
      const filter = parameter >>> 4, range = parameter & 15, shift = range > 12 ? 9 : range;
      for (let sample = 0; sample < 28; sample++) {
        const packed = bytes[at + 16 + sample * 4 + (format.encodedBitsPerSample === 4 ? Math.floor(unit / 2) : unit)]!;
        const value = format.encodedBitsPerSample === 4 ? (packed >>> ((unit & 1) * 4)) & 15 : packed;
        const signed = value >= (format.encodedBitsPerSample === 4 ? 8 : 128) ? value - (format.encodedBitsPerSample === 4 ? 16 : 256) : value;
        const scaled = (signed << (format.encodedBitsPerSample === 4 ? 12 : 8)) >> shift;
        const predicted = scaled + ((previous[channel]! * positive[filter]! + older[channel]! * negative[filter]! + 32) >> 6);
        const pcm = Math.max(-32768, Math.min(32767, predicted));
        older[channel] = previous[channel]!; previous[channel] = pcm;
        const frame = firstFrame + Math.floor(unit / format.channels) * 28 + sample;
        wav.writeInt16LE(pcm, 44 + (frame * format.channels + channel) * 2);
      }
    }
    firstFrame += units * 28 / format.channels;
  }
  return { bytes: wav, metadata: { ...format, frames, bitsPerSample: 16, durationSeconds: frames / format.sampleRateHz,
    playback: "Native-rate PCM; console resampling and de-emphasis are not applied", initialHistory: "Zero at the start of each file/channel segment" } };
}
