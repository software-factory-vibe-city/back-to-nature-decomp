import { createHash, randomBytes } from "node:crypto";
import { constants, existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Input, Limits } from "./types.ts";

export const hash = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const id = (prefix: string, value: unknown): string => `${prefix}-${hash(canonical(value)).slice(0, 24)}`;
export function integer(value: number, label: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${label}: ${value}`);
  return value;
}

/** Refuse symlinks in every component, including existing output parents.
 * This is containment for a trusted local checkout, not an OS sandbox against
 * a hostile process racing rename(2) while this process owns the run lock. */
export function safePath(root: string, path: string): string {
  const base = realpathSync(root);
  const target = resolve(base, path.replace(/^@/, ""));
  const rel = relative(base, target);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || rel.includes("\0")) throw new Error(`Path escapes root: ${path}`);
  let cursor = base;
  for (const part of rel.split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    try { if (lstatSync(cursor).isSymbolicLink()) throw new Error(`Symlink refused: ${cursor}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return target;
}
export class Store {
  readonly root: string;
  private readonly byteCache = new Map<string, Buffer>();
  clearBytes(): void { this.byteCache.clear(); }
  constructor(readonly project: string) {
    const output = safePath(project, "build/assets");
    mkdirSync(output, { recursive: true });
    this.root = realpathSync(output);
  }
  path(path: string): string { return safePath(this.root, path); }
  atomic(path: string, bytes: string | Uint8Array): void {
    const target = this.path(path);
    if (existsSync(target) && readFileSync(target).equals(Buffer.from(bytes))) return;
    mkdirSync(dirname(target), { recursive: true });
    const temp = `${target}.${randomBytes(8).toString("hex")}.tmp`;
    try { writeFileSync(temp, bytes, { flag: "wx" }); renameSync(temp, target); }
    finally { rmSync(temp, { force: true }); }
  }
  json(path: string, value: unknown): string {
    const bytes = canonical(value) + "\n";
    this.atomic(path, bytes);
    return hash(bytes);
  }
  read<T>(path: string): T { return JSON.parse(readFileSync(this.path(path), "utf8")) as T; }
  blob(bytes: Uint8Array): string {
    const digest = hash(bytes);
    const path = `blobs/${digest}`;
    // Only freshly computed bytes may repair a corrupt content-addressed object.
    // bytes() and verification remain strictly read-only integrity checks.
    if (!existsSync(this.path(path)) || hash(readFileSync(this.path(path))) !== digest) this.atomic(path, bytes);
    return path;
  }
  bytes(path: string): Buffer {
    if (!/^blobs\/[a-f0-9]{64}$/.test(path)) throw new Error(`Invalid blob path: ${path}`);
    const cached = this.byteCache.get(path);
    if (cached) return cached;
    const bytes = readFileSync(this.path(path));
    if (hash(bytes) !== path.slice(6)) throw new Error(`Corrupt blob: ${path}`);
    this.byteCache.set(path, bytes);
    return bytes;
  }
  async lock<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("Invalid lock name");
    const path = this.path(`locks/${name}.lock`);
    mkdirSync(dirname(path), { recursive: true });
    let fd: number;
    try { fd = openSync(path, "wx"); }
    catch { throw new Error(`Run is locked: ${name}. After confirming its owner stopped, remove ${path}.`); }
    try { writeFileSync(fd, `${process.pid}\n`); return await fn(); }
    finally { closeSync(fd); rmSync(path, { force: true }); }
  }
}

export async function inventory(project: string, selection: string, store: Store, limits: Limits, signal?: AbortSignal): Promise<Input[]> {
  const extracted = safePath(project, "extracted");
  if (!existsSync(extracted) || !statSync(extracted).isDirectory()) throw new Error("Missing extracted/ input directory");
  const selected = safePath(project, selection);
  safePath(extracted, selected);
  const files: string[] = [];
  function walk(path: string): void {
    signal?.throwIfAborted();
    const st = lstatSync(path);
    if (st.isSymbolicLink()) throw new Error(`Input symlink refused: ${path}`);
    if (st.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(path, child));
    else if (st.isFile()) {
      if (files.length >= limits.maxFiles) throw new Error("budget-exhausted: input file count; raise maxFiles");
      files.push(path);
    } else throw new Error(`Non-regular input: ${path}`);
  }
  walk(selected);
  const result: Input[] = [];
  let total = 0;
  for (const file of files) {
    signal?.throwIfAborted();
    const before = lstatSync(file);
    if (before.size > limits.maxFileBytes || total + before.size > limits.maxInputBytes) throw new Error("budget-exhausted: input bytes; narrow selection or raise byte limits");
    // O_NOFOLLOW closes the final-component symlink window on supported hosts.
    const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let bytes: Buffer;
    try { bytes = readFileSync(fd); } finally { closeSync(fd); }
    const confirmFd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let confirmed: Buffer;
    try { confirmed = readFileSync(confirmFd); } finally { closeSync(confirmFd); }
    const after = lstatSync(file);
    // Confirm identity and the consumed bytes, not timestamps: equal sizes or
    // preserved clocks cannot conceal an input changing during the snapshot.
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || bytes.length !== before.size ||
        !bytes.equals(confirmed)) throw new Error(`input-drift: ${file}`);
    total += bytes.length;
    const path = relative(realpathSync(project), file).split(sep).join("/");
    const digest = hash(bytes);
    result.push({ id: id("input", [path, digest]), path, hash: digest, size: bytes.length, blob: store.blob(bytes) });
    await new Promise<void>(r => setImmediate(r));
  }
  if (!result.length) throw new Error("Selected input scope contains no files");
  return result;
}
