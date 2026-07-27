import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sha256, stableJson, writeStableJson } from "../variant-lab/artifacts.js";
import type { SearchVariantResult } from "./types.js";

export interface SearchCacheIdentity {
  schemaVersion: 1;
  function: string;
  sourceHash: string;
  preprocessedHash: string;
  compilerFlags: string[];
  compilerHash: string;
  assemblerShimHash: string;
  trace: boolean;
  full: boolean;
}

export function cacheKey(identity: SearchCacheIdentity): string {
  return sha256(stableJson(identity));
}

export function restoreCache(cacheRoot: string, key: string, outputDirectory: string): SearchVariantResult | undefined {
  const directory = join(cacheRoot, key);
  const metadata = join(directory, "result.json");
  if (!existsSync(metadata)) return undefined;
  mkdirSync(outputDirectory, { recursive: true });
  const artifacts = join(directory, "artifacts");
  if (existsSync(artifacts)) cpSync(artifacts, outputDirectory, { recursive: true, force: true });
  return JSON.parse(readFileSync(metadata, "utf8")) as SearchVariantResult;
}

export function storeCache(cacheRoot: string, key: string, outputDirectory: string, result: SearchVariantResult): void {
  const directory = join(cacheRoot, key);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  cpSync(outputDirectory, join(directory, "artifacts"), { recursive: true, force: true });
  writeStableJson(join(directory, "result.json"), result);
}
