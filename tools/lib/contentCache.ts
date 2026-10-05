/** Content-addressed caches: missing inputs and directory membership are facts.
 * Publication is atomic; corrupt/interrupted records are misses, never evidence. */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";

export const digest = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
export const fileDigest = (path: string): string => existsSync(path) ? digest(readFileSync(path)) : "absent";
export function filesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => e.isDirectory() ? filesUnder(join(path, e.name)) : [join(path, e.name)]);
}
export function snapshot(root: string, paths: string[], filter: (path: string) => boolean = () => true): Record<string, string> {
  const result: Record<string, string> = {};
  for (const path of [...new Set(paths)].sort()) {
    const absolute = isAbsolute(path) ? path : join(root, path);
    const key = relative(root, absolute);
    if (!existsSync(absolute)) { result[key] = "absent"; continue; }
    if (!statSync(absolute).isDirectory()) { result[key] = fileDigest(absolute); continue; }
    const files = filesUnder(absolute).filter(filter);
    result[`${key}/#membership`] = digest(JSON.stringify(files.map((p) => relative(root, p))));
    for (const file of files) result[relative(root, file)] = fileDigest(file);
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
export const sameSnapshot = (a: Record<string, string>, b: Record<string, string>): boolean => JSON.stringify(a) === JSON.stringify(b);
export function writeIfChanged(path: string, content: string): boolean {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temp, content); renameSync(temp, path); } finally { rmSync(temp, { force: true }); }
  return true;
}
export interface CacheRecord<T> { schema: 1; key: string; value: T; valueHash: string }
export function readCache<T>(path: string, key: string): T | undefined {
  try {
    const record = JSON.parse(readFileSync(path, "utf8")) as CacheRecord<T>;
    if (record.schema !== 1 || record.key !== key || record.valueHash !== digest(JSON.stringify(record.value))) return;
    return record.value;
  } catch { return; }
}
export function writeCache<T>(path: string, key: string, value: T): void {
  writeIfChanged(path, JSON.stringify({ schema: 1, key, value, valueHash: digest(JSON.stringify(value)) } satisfies CacheRecord<T>) + "\n");
}
export interface PhaseTiming { phase: string; durationMs: number; cache?: "hit" | "miss"; reason?: string }
export class Timings {
  readonly phases: PhaseTiming[] = [];
  private readonly start = performance.now();
  async measure<T>(phase: string, task: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try { return await task(); } finally { this.phases.push({ phase, durationMs: performance.now() - start }); }
  }
  measureSync<T>(phase: string, task: () => T): T {
    const start = performance.now();
    try { return task(); } finally { this.phases.push({ phase, durationMs: performance.now() - start }); }
  }
  get totalMs(): number { return performance.now() - this.start; }
}
