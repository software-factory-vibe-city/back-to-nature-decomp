/**
 * engineApi.ts — the PS-X EXE surface that overlay code calls.
 *
 * Deliverable 2 of plans/overlay-decompilation-enablement.md. Overlay
 * translation units cannot be compiled without correct declarations for what
 * they call, so this surface is the dependency frontier for the whole overlay
 * effort and the prioritisation input for the remaining PS-X EXE tail.
 *
 * `jal` targets are absolute, so nothing here needs an overlay load address.
 *
 * Usage:
 *   npx tsx tools/diagnostics/engineApi.ts               # summary + hottest entry points
 *   npx tsx tools/diagnostics/engineApi.ts --all         # every entry point
 *   npx tsx tools/diagnostics/engineApi.ts --stubs       # only entry points not yet matched
 *   npx tsx tools/diagnostics/engineApi.ts --markdown    # markdown tables
 *   npx tsx tools/diagnostics/engineApi.ts --json        # write build/engineApi.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT } from "../lib/psxExeInfo.js";
import { scanOverlayReferences } from "../lib/overlayReferences.js";
import { loadFunctionSpans, loadSymbolIndex } from "../lib/symbolIndex.js";

const args = process.argv.slice(2);
const showAll = args.includes("--all");
const stubsOnly = args.includes("--stubs");
const markdown = args.includes("--markdown");
const json = args.includes("--json");
const topIdx = args.indexOf("--top");
const topN = topIdx >= 0 && args[topIdx + 1] ? Number(args[topIdx + 1]) : 15;

const scan = scanOverlayReferences();
if (!scan) {
  console.error(
    "No overlay manifest. Run: npx tsx tools/build/extractArchive.ts --write && " +
      "npx tsx tools/build/classifyArchiveMembers.ts --write"
  );
  process.exit(1);
}

/** `matched` and `stub` are project functions; `sdk` is linked, never decompiled. */
type Status = "matched" | "stub" | "handwritten" | "sdk";

const spans = new Map(loadFunctionSpans().map((s) => [s.vram, s]));
const symbols = loadSymbolIndex();
const asmDir = join(ROOT, "build/asm/nonmatchings");

function statusOf(address: number): { name: string; status: Status } {
  const span = spans.get(address);
  const name = span?.name ?? symbols.byAddress.get(address) ?? `func_${address.toString(16).toUpperCase()}`;
  if (!span) return { name, status: "sdk" };

  const sFile = join(asmDir, span.name, `${span.name}.s`);
  if (existsSync(sFile) && readFileSync(sFile, "utf-8").includes("Handwritten function")) {
    return { name, status: "handwritten" };
  }
  if (span.kind !== "c") return { name, status: "stub" };

  const cFile = join(ROOT, "src", `${span.name}.c`);
  if (!existsSync(cFile)) return { name, status: "stub" };
  return { name, status: readFileSync(cFile, "utf-8").includes("INCLUDE_ASM(") ? "stub" : "matched" };
}

interface EntryPoint {
  address: number;
  name: string;
  status: Status;
  callSites: number;
  memberCount: number;
  members: string[];
}

const entries: EntryPoint[] = [...scan.exeCallTargets.entries()]
  .map(([address, count]) => {
    const { name, status } = statusOf(address);
    return {
      address,
      name,
      status,
      callSites: count.sites,
      memberCount: count.members.length,
      members: [...count.members].sort(),
    };
  })
  .sort((a, b) => b.callSites - a.callSites || a.address - b.address);

const memberTotal = scan.perMember.length;
const byStatus = entries.reduce<Record<Status, number>>(
  (acc, e) => {
    acc[e.status]++;
    return acc;
  },
  { matched: 0, stub: 0, handwritten: 0, sdk: 0 }
);

const hex = (address: number) => `0x${address.toString(16).toUpperCase().padStart(8, "0")}`;

function renderTable(rows: EntryPoint[]): void {
  if (markdown) {
    console.log();
    console.log("| address | symbol | call sites | members | status |");
    console.log("|---|---|---|---|---|");
    for (const e of rows) {
      console.log(`| \`${hex(e.address)}\` | ${e.name} | ${e.callSites} | ${e.memberCount}/${memberTotal} | ${e.status} |`);
    }
    return;
  }
  console.log();
  console.log(`${"ADDRESS".padEnd(11)} ${"SITES".padStart(6)} ${"MEMBERS".padStart(8)}  ${"STATUS".padEnd(11)} SYMBOL`);
  console.log("-".repeat(72));
  for (const e of rows) {
    console.log(
      `${hex(e.address).padEnd(11)} ${String(e.callSites).padStart(6)} ${`${e.memberCount}/${memberTotal}`.padStart(8)}  ${e.status.padEnd(11)} ${e.name}`
    );
  }
}

console.log(`Engine API: ${entries.length} PS-X EXE entry points called from ${memberTotal} overlay code members`);
console.log(`  matched: ${byStatus.matched}   stub: ${byStatus.stub}   handwritten: ${byStatus.handwritten}   SDK: ${byStatus.sdk}`);
console.log(`  called by 8 or more members: ${entries.filter((e) => e.memberCount >= 8).length}`);
console.log(`  jal-shaped words rejected by the RAM-range check: ${scan.totalRejectedJalWords}`);

console.log();
console.log(`${"MEMBER".padEnd(8)} ${"SIZE".padStart(8)} ${"TARGETS".padStart(8)} ${"SITES".padStart(6)} ${"SELF".padStart(6)} ${"REJECT".padStart(7)}  SLOT BUCKETS`);
for (const m of scan.perMember) {
  const buckets = Object.entries(m.slotBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");
  console.log(
    `${m.id.padEnd(8)} ${String(m.size).padStart(8)} ${String(m.exeTargets).padStart(8)} ${String(m.exeCallSites).padStart(6)} ${String(m.selfCallSites).padStart(6)} ${String(m.rejectedJalWords).padStart(7)}  ${buckets}`
  );
}

const rows = stubsOnly
  ? entries.filter((e) => e.status === "stub")
  : showAll
    ? entries
    : entries.slice(0, topN);
renderTable(rows);
console.log();
console.log(`${rows.length} entry points listed`);

if (json) {
  const out = join(ROOT, "build/engineApi.json");
  mkdirSync(join(ROOT, "build"), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify(
      {
        generatedBy: "tools/diagnostics/engineApi.ts",
        exeImage: { start: hex(scan.exeImage.start), end: hex(scan.exeImage.end) },
        entryPointCount: entries.length,
        statusCounts: byStatus,
        rejectedJalWords: scan.totalRejectedJalWords,
        members: scan.perMember,
        entryPoints: entries.map((e) => ({ ...e, address: hex(e.address) })),
      },
      null,
      2
    )}\n`
  );
  console.log(`Wrote ${out}`);
}
