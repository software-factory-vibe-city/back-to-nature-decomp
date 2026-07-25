#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function hex32(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(8, "0")}`;
}

function main() {
  const file = process.argv[2] ?? "./extracted/iso/slus_011.15";
  const outPath = process.argv[3] ?? "notes/slus_01115_header_info.md";

  const buf = readFileSync(file);

  if (buf.length < 0x800) {
    console.error(`error: file too small (${buf.length} bytes)`);
    process.exit(1);
  }

  const magic = buf.subarray(0, 8).toString("ascii").replace(/\0/g, "");
  if (magic !== "PS-X EXE") {
    console.error(`error: not a PS-X EXE (magic = ${JSON.stringify(magic)})`);
    process.exit(1);
  }

  // PSX EXE header fields (all little-endian 32-bit)
  const initialPc = buf.readUInt32LE(0x10);
  const initialGp = buf.readUInt32LE(0x14);
  const textAddr = buf.readUInt32LE(0x18);
  const textSize = buf.readUInt32LE(0x1c);
  const dataAddr = buf.readUInt32LE(0x20);
  const dataSize = buf.readUInt32LE(0x24);
  const bssAddr = buf.readUInt32LE(0x28);
  const bssSize = buf.readUInt32LE(0x2c);
  const spBase = buf.readUInt32LE(0x30);
  const spOffset = buf.readUInt32LE(0x34);

  // Derived values
  const textEnd = textAddr + textSize;
  const payloadEnd = textAddr + textSize; // end of loaded region
  const headerSize = 0x800;

  // Scan the region 0x4C-0x4F for the marker region (some PSX EXEs store info here)
  // Also dump raw header bytes 0x38-0x4B for inspection
  const reserved38 = buf.subarray(0x38, 0x4c);
  const marker = buf.subarray(0x4c, 0x800);

  // Check if marker region is all zeros
  const markerAllZero = marker.every((b) => b === 0);

  // Look for ASCII strings in the marker region
  let markerAscii = "";
  if (!markerAllZero) {
    const printable = marker.filter(
      (b) => (b >= 0x20 && b <= 0x7e) || b === 0x0a || b === 0x0d
    );
    if (printable.length > 4) {
      markerAscii = Buffer.from(printable).toString("ascii").trim();
    }
  }

  // Build markdown output
  const lines: string[] = [
    `# SLUS_011.15 PSX EXE Header Analysis`,
    ``,
    `**Source:** \`${file}\``,
    `**File size:** ${buf.length} bytes (${hex32(buf.length)})`,
    ``,
    `## Header Fields`,
    ``,
    `| Offset | Field | Raw Value | Notes |`,
    `|--------|-------|-----------|-------|`,
    `| 0x00 | Magic | \`${magic}\` | |`,
    `| 0x10 | initial_pc | \`${hex32(initialPc)}\` | Entry point |`,
    `| 0x14 | initial_gp | \`${hex32(initialGp)}\` | ${initialGp === 0 ? "**Zero — must discover from code**" : "Global pointer"} |`,
    `| 0x18 | text_addr | \`${hex32(textAddr)}\` | RAM load address |`,
    `| 0x1C | text_size | \`${hex32(textSize)}\` | ${textSize} bytes |`,
    `| 0x20 | data_addr | \`${hex32(dataAddr)}\` | ${dataAddr === 0 ? "Zero" : "Data section start"} |`,
    `| 0x24 | data_size | \`${hex32(dataSize)}\` | ${dataSize === 0 ? "Zero" : `${dataSize} bytes`} |`,
    `| 0x28 | bss_addr | \`${hex32(bssAddr)}\` | ${bssAddr === 0 ? "Zero" : "BSS section start"} |`,
    `| 0x2C | bss_size | \`${hex32(bssSize)}\` | ${bssSize === 0 ? "Zero" : `${bssSize} bytes`} |`,
    `| 0x30 | sp_base | \`${hex32(spBase)}\` | ${spBase === 0 ? "Zero" : "Initial stack pointer"} |`,
    `| 0x34 | sp_offset | \`${hex32(spOffset)}\` | ${spOffset === 0 ? "Zero" : "Stack offset"} |`,
    ``,
    `## Derived Values`,
    ``,
    `| Value | Result |`,
    `|-------|--------|`,
    `| Payload offset in file | \`${hex32(headerSize)}\` (${headerSize} bytes) |`,
    `| Load region | \`${hex32(textAddr)}\` — \`${hex32(textEnd)}\` |`,
    `| Entry offset from load | \`${hex32(initialPc - textAddr)}\` (${initialPc - textAddr} bytes into payload) |`,
  ];

  if (initialGp !== 0) {
    lines.push(
      `| GP offset from load | \`${hex32(initialGp - textAddr)}\` |`
    );
  }

  lines.push(``);

  // Header reserved/marker area
  lines.push(`## Reserved Region (0x38–0x4B)`);
  lines.push(``);
  const hexDump38 = Array.from(reserved38)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  lines.push(`\`\`\``);
  lines.push(hexDump38);
  lines.push(`\`\`\``);
  lines.push(``);

  lines.push(`## Marker Region (0x4C–0x7FF)`);
  lines.push(``);
  if (markerAllZero) {
    lines.push(`All zeros (no marker string).`);
  } else if (markerAscii) {
    lines.push(`ASCII content found:`);
    lines.push(`\`\`\``);
    lines.push(markerAscii);
    lines.push(`\`\`\``);
  } else {
    lines.push(`Non-zero content but no readable ASCII.`);
  }
  lines.push(``);

  // GP analysis hint
  if (initialGp === 0) {
    lines.push(`## GP Discovery Needed`);
    lines.push(``);
    lines.push(
      `The header \`initial_gp\` is zero. The GP value must be discovered from the startup code.`
    );
    lines.push(``);
    lines.push(`**Next steps:**`);
    lines.push(
      `1. Examine the entry point at \`${hex32(initialPc)}\` for \`lui $gp, 0xXXXX\` / \`addiu $gp, $gp, 0xXXXX\``
    );
    lines.push(
      `2. Scan all code for GP-relative load/store instructions (\`lw/sw reg, offset($gp)\`)`
    );
    lines.push(
      `3. The GP typically points 0x7FF0 bytes into .sdata, so \`GP = sdata_start + 0x7FF0\``
    );
    lines.push(``);
  }

  const output = lines.join("\n");

  // Write output file
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  console.log(`Wrote ${outPath}`);

  // Also print to stdout
  console.log();
  console.log(output);
}

main();
