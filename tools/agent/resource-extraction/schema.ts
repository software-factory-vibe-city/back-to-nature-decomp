import type { ArchiveSchema, Field } from "./types.ts";
import { integer } from "./storage.ts";

function field(field: Field, stride: number): void {
  if (!field || ![1, 2, 4].includes(field.width) || !["le", "be"].includes(field.endian) || typeof field.signed !== "boolean") throw new Error("Invalid archive field");
  integer(field.offset, "field offset", 0, stride - field.width);
  integer(field.scale, "field scale", 1, 0x100000000);
}
export function validateSchema(schema: ArchiveSchema): void {
  if (!schema || typeof schema.index !== "string" || typeof schema.data !== "string" || schema.basis !== "supplied-hypothesis") throw new Error("Schema must explicitly declare supplied-hypothesis basis");
  integer(schema.tableOffset, "table offset"); integer(schema.count, "record count", 0, 1000000);
  integer(schema.stride, "record stride", 1, 65536); integer(schema.base, "position base");
  field(schema.position, schema.stride); field(schema.length, schema.stride);
}
function value(bytes: Buffer, at: number, field: Field): number {
  const read = field.signed ? (field.endian === "le" ? bytes.readIntLE.bind(bytes) : bytes.readIntBE.bind(bytes)) : (field.endian === "le" ? bytes.readUIntLE.bind(bytes) : bytes.readUIntBE.bind(bytes));
  return read(at + field.offset, field.width) * field.scale;
}
/** Supplied schemas validate extents, not the schema's historical interpretation.
 * Aliases, padding, embedded indexes and unsorted records are all legal here. */
export function schemaExtents(schema: ArchiveSchema, index: Buffer, dataSize: number): Array<{ index: number; offset: number; length: number }> {
  validateSchema(schema);
  integer(dataSize, "data size");
  if (schema.tableOffset + schema.count * schema.stride > index.length) throw new Error("Archive table extent outside index");
  const members = [];
  for (let i = 0; i < schema.count; i++) {
    const at = schema.tableOffset + i * schema.stride;
    const offset = schema.base + value(index, at, schema.position);
    const length = value(index, at, schema.length);
    integer(offset, "member offset"); integer(length, "member length");
    if (offset + length > dataSize) throw new Error(`Record ${i} outside data extent`);
    members.push({ index: i, offset, length });
  }
  return members;
}
