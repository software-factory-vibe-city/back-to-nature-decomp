import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { splitSdkLibs } from "./splitSdkLibs.js";
import { auditSdkCollisions } from "./auditSdkCollisions.js";
import { collisionNames, isReturnPadding, loadMemberMap, patchedSdkObjectPath, readAr, readPsyqLib, readTextObject, signatureId, type SigEntry } from "../lib/psyqMembers.js";
import { acknowledgeFindings, scanSdkSignatures, verifiedMatches, type DetectionAcknowledgement } from "../lib/sdkDetection.js";
import { boundaryPremise, staleSdkSymbols } from "../lib/sdkProvenance.js";
import { ROOT } from "../lib/psxExeInfo.js";

function ar(members: { name: string; bytes: Buffer }[]): Buffer {
  return Buffer.concat([Buffer.from("!<arch>\n"), ...members.flatMap(m => [
    Buffer.from(`${(m.name + "/").padEnd(16)}${"0".padEnd(12)}${"0".padEnd(6)}${"0".padEnd(6)}${"644".padEnd(8)}${String(m.bytes.length).padEnd(10)}\x60\n`),
    m.bytes, ...(m.bytes.length & 1 ? [Buffer.from("\n")] : []),
  ])]);
}
function lib(members: { name: string; bytes: Buffer }[]): Buffer {
  return Buffer.concat([Buffer.from("LIB\x01"), ...members.flatMap(m => {
    const header = Buffer.alloc(20);
    header.write(m.name.padEnd(8), 0, 8, "ascii");
    header.writeUInt32LE(20, 12); header.writeUInt32LE(20 + m.bytes.length, 16);
    return [header, m.bytes];
  })]);
}
function assemble(root: string, name: string, words: string): Buffer {
  const source = join(root, name + ".s"), object = join(root, name + ".o");
  writeFileSync(source, `.set noreorder\n.text\n.globl ${name}\n${name}:\n${words}\n`);
  execFileSync("mips-linux-gnu-as", ["-EL", "-march=r3000", "-no-pad-sections", "-o", object, source]);
  return readFileSync(object);
}
function sig(name: string, object: Buffer): SigEntry {
  const text = readTextObject(object);
  return { name, sig: [...text.text].map((byte, i) => text.relocationMask[i] !== 0xff ? "??" : byte.toString(16).padStart(2, "0")).join(" "), labels: text.symbols };
}
function fixture(): { root: string; small: Buffer; large: Buffer; entries: SigEntry[]; scan: () => ReturnType<typeof scanSdkSignatures> } {
  const root = mkdtempSync(join(tmpdir(), "sdk-collision-test-"));
  const sdk = join(root, "sdk"), sigDir = join(root, "tools/vendor/psx_psyq_signatures/470");
  mkdirSync(sdk); mkdirSync(sigDir, { recursive: true });
  const small = assemble(root, "Small", "addiu $2,$0,1\njr $31\nnop\nnop");
  const large = assemble(root, "Large", "addiu $2,$0,2\naddiu $3,$0,3\naddiu $4,$0,4\naddiu $5,$0,5\naddiu $6,$0,6\njr $31\nnop\nnop");
  const entries = [sig("SAME.OBJ", small), sig("SAME.OBJ", large)];
  writeFileSync(join(sdk, "libtest.a"), ar([{ name: "same.o", bytes: small }, { name: "same.o", bytes: large }]));
  writeFileSync(join(sigDir, "LIBTEST.LIB.json"), JSON.stringify(entries));
  splitSdkLibs({ root, sdkDir: sdk, version: "470", write: true });
  const binary = Buffer.concat([readTextObject(small).text, readTextObject(large).text]);
  return { root, small, large, entries, scan: () => scanSdkSignatures({ root, sigDir, map: loadMemberMap(root, "470"), binary, searchStart: 0, searchEnd: binary.length }) };
}

test("LIB and ar preserve colliding member occurrences, but exact duplicates are not collisions", () => {
  const members = [{ name: "SAME", bytes: Buffer.from("LNK\x02A") }, { name: "SAME", bytes: Buffer.from("LNK\x02BBB") }, { name: "SAME", bytes: Buffer.from("LNK\x02A") }];
  const extracted = readPsyqLib(lib(members));
  assert.equal(extracted.length, 3);
  assert.deepEqual([...collisionNames(extracted)], ["same"]);
  assert.deepEqual(extracted.map(m => m.bytes.toString()), members.map(m => m.bytes.toString()));
  assert.equal(collisionNames([extracted[0]!, extracted[2]!]).size, 0);
  assert.throws(() => readPsyqLib(lib(members).subarray(0, 30)), /(?:Invalid|Truncated) LIB/);
  const archive = ar(members.map(m => ({ ...m, name: "same.o" })));
  assert.equal(readAr(archive).length, 3);
  assert.throws(() => readAr(archive.subarray(0, 70)), /Truncated ar/);
});

test("two-member collision: larger signature verifies its OWN object; removing it is a visible failure, not a fallback", () => {
  const f = fixture();
  try {
    const result = f.scan();
    assert.equal(result.candidates.length, 2);
    assert.equal(result.matchedButUnverifiable.length, 0);
    const large = result.candidates.find(c => c.entry.labels[0]!.name === "Large")!;
    assert.equal(large.textSize, 32); assert.deepEqual(large.offsets, [16]);
    assert.equal(large.oPath, "build/sdk/lib/470/libtest/same__Large.o");
    // The legacy ambiguous filename is intentionally wrong and must not be consulted.
    mkdirSync(join(f.root, "lib/libtest"), { recursive: true });
    writeFileSync(join(f.root, "lib/libtest/same.o"), f.small);
    unlinkSync(join(f.root, large.oPath));
    const missing = f.scan();
    assert.equal(missing.candidates.length, 1);
    assert.equal(missing.matchedButUnverifiable.length, 1);
    const finding = missing.matchedButUnverifiable[0]!;
    assert.equal(finding.category, "matched-but-unverifiable");
    assert.equal(finding.reason, "missing-file"); assert.deepEqual(finding.offsets, [16]);
    const output = JSON.stringify({ schemaVersion: 1, matches: missing.candidates, matchedButUnverifiable: missing.matchedButUnverifiable, rejectedPlacements: [], unacknowledged: 1 });
    assert.match(output, /matched-but-unverifiable/);
    assert.throws(() => verifiedMatches(output), /incomplete/);
    writeFileSync(join(f.root, large.oPath), f.small);
    assert.equal(f.scan().matchedButUnverifiable[0]!.reason, "size-mismatch");
    const corrupt = Buffer.from(f.large);
    // Change a fixed instruction, retaining the correct label/table/size.
    const originalText = readTextObject(corrupt).text; originalText[0] = 7;
    writeFileSync(join(f.root, large.oPath), corrupt);
    assert.equal(f.scan().matchedButUnverifiable[0]!.reason, "content-mismatch");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("split is deterministic, preserves non-colliding input filenames, and never writes binaries to src or lib", () => {
  const f = fixture();
  try {
    const stablePath = join(f.root, "lib/libtest/stable.o");
    mkdirSync(join(f.root, "lib/libtest"), { recursive: true }); writeFileSync(stablePath, f.small);
    const archive = ar([{ name: "same.o", bytes: f.small }, { name: "same.o", bytes: f.large }, { name: "stable.o", bytes: f.large }]);
    writeFileSync(join(f.root, "sdk/libtest.a"), archive);
    const first = splitSdkLibs({ root: f.root, sdkDir: join(f.root, "sdk"), version: "470", write: true });
    const second = splitSdkLibs({ root: f.root, sdkDir: join(f.root, "sdk"), version: "470", write: true });
    assert.deepEqual(first, second);
    assert.ok(first.members.some(m => m.oPath === "lib/libtest/stable.o"));
    assert.ok(readFileSync(stablePath).equals(f.small));
    assert.equal(existsSync(join(f.root, "lib/libtest/same__Large.o")), false);
    assert.equal(existsSync(join(f.root, "src")), false);
    assert.equal(patchedSdkObjectPath("build/sdk/lib/470/libtest/same__Large.o"), "build/lib/470/libtest/same__Large.o");
    assert.equal(patchedSdkObjectPath("lib/libtest/stable.o"), "build/lib/libtest/stable.o");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("SDK version namespaces cannot overwrite another version's colliding objects", () => {
  const f = fixture();
  try {
    const dir = join(f.root, "tools/vendor/psx_psyq_signatures/420"); mkdirSync(dir);
    writeFileSync(join(dir, "LIBTEST.LIB.json"), JSON.stringify(f.entries));
    const first = loadMemberMap(f.root, "470")!;
    const second = splitSdkLibs({ root: f.root, sdkDir: join(f.root, "sdk"), version: "420", write: true });
    assert.ok(second.members.every(m => m.oPath.startsWith("build/sdk/lib/420/")));
    assert.deepEqual(loadMemberMap(f.root, "470"), first);
    assert.equal(f.scan().candidates.length, 2);
    mkdirSync(join(f.root, "tools/vendor/psx_psyq_signatures/370"));
    const audit = auditSdkCollisions(f.root, ["370"]);
    assert.ok(audit.errors.some(e => e.includes("SDK 370: member map absent")));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("an absent member map cannot silently cross-check a collision by stored name", () => {
  const f = fixture();
  try {
    unlinkSync(join(f.root, "build/sdk/member-map-470.json"));
    assert.equal(f.scan().candidates.length, 0);
    assert.deepEqual(f.scan().matchedButUnverifiable.map(f => f.reason), ["unresolved-member", "unresolved-member"]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("complete object content and ELF relocation masks, not just signature prefix, gate placement", () => {
  const root = mkdtempSync(join(tmpdir(), "sdk-content-test-"));
  try {
    const sigDir = join(root, "sigs"), libDir = join(root, "lib/libtest");
    mkdirSync(sigDir); mkdirSync(libDir, { recursive: true });
    const object = assemble(root, "Reloc", "jal external\nnop\njr $31\nnop");
    writeFileSync(join(libDir, "reloc.o"), object);
    const entry = sig("RELOC.OBJ", object), text = Buffer.from(readTextObject(object).text);
    text.writeUInt32LE(0x0c001234, 0);
    writeFileSync(join(sigDir, "LIBTEST.LIB.json"), JSON.stringify([entry]));
    const scan = () => scanSdkSignatures({ root, sigDir, map: null, binary: text, searchStart: 0, searchEnd: text.length });
    assert.equal(scan().candidates.length, 1);
    entry.sig = entry.sig.split(" ").slice(0, 8).join(" ");
    writeFileSync(join(sigDir, "LIBTEST.LIB.json"), JSON.stringify([entry]));
    text.writeUInt32LE(0, 8); // Prefix still hits, but the return is wrong.
    assert.equal(scan().matchedButUnverifiable[0]!.reason, "content-mismatch");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("zero-reloc return/padding cannot be placed from generated names; legitimate return-value functions survive", () => {
  const root = mkdtempSync(join(tmpdir(), "sdk-return-test-"));
  try {
    const object = assemble(root, "Dummy", "jr $31\nnop\nnop\nnop");
    const real = assemble(root, "ReturnZero", "jr $31\naddu $2,$0,$0\nnop\nnop");
    assert.equal(isReturnPadding(readTextObject(object)), true);
    assert.equal(isReturnPadding(readTextObject(real)), false);
    const sigDir = join(root, "sigs"); mkdirSync(sigDir);
    mkdirSync(join(root, "lib/libsnd"), { recursive: true });
    writeFileSync(join(root, "lib/libsnd/dmynot1.o"), object);
    writeFileSync(join(sigDir, "LIBSND.LIB.json"), JSON.stringify([sig("DMYNOT1.OBJ", object)]));
    const binary = Buffer.concat([Buffer.from("0100022401000324", "hex"), readTextObject(object).text]);
    const result = scanSdkSignatures({ root, sigDir, map: null, binary, searchStart: 0, searchEnd: binary.length });
    assert.equal(result.candidates.length, 0); assert.equal(result.rejectedPlacements.length, 1);
    const premise = boundaryPremise(binary.subarray(0, 8), 0x80010000, readTextObject(object));
    assert.equal(premise.missingTerminal, true); assert.equal(premise.adjacentReturnPadding, true);
    assert.equal(boundaryPremise(readTextObject(real).text, 0x80010000).missingTerminal, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("acknowledgements bind the exact version, binary, signature, reason AND hit offsets", () => {
  const f = fixture();
  try {
    const largePath = join(f.root, "build/sdk/lib/470/libtest/same__Large.o"); unlinkSync(largePath);
    const findings = f.scan().matchedButUnverifiable;
    const entry = f.entries[1]!;
    const row: DetectionAcknowledgement = { version: "470", targetHash: "target", sigFile: "LIBTEST.LIB.json", identity: signatureId(entry), reason: "missing-file", offsets: [16], evidence: "Fixture: intentionally unavailable object." };
    assert.equal(acknowledgeFindings(findings, [row], "470", "target"), 0);
    assert.match(findings[0]!.acknowledgement!, /Fixture/);
    assert.equal(acknowledgeFindings(f.scan().matchedButUnverifiable, [row], "470", "changed"), 1);
    assert.equal(acknowledgeFindings(f.scan().matchedButUnverifiable, [{ ...row, offsets: [0] }], "470", "target"), 1);
    assert.equal(acknowledgeFindings(f.scan().matchedButUnverifiable, [{ ...row, reason: "content-mismatch" }], "470", "target"), 1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("retire only disproven return-stub labels and collision-manufactured generics; preserve unrelated SDK names and user renames", () => {
  const f = fixture();
  try {
    const sdkDir = join(f.root, "tools/vendor/psx_psyq_signatures/470");
    const dummy = { name: "DMYNOT1.OBJ", sig: "", labels: [{ name: "dmy_nothing1", offset: 0 }] };
    writeFileSync(join(sdkDir, "LIBSND.LIB.json"), JSON.stringify([dummy, { ...dummy, name: "OTHER.OBJ", labels: [{ name: "ChangeClearSIO", offset: 0 }] }]));
    const content = "MyRenamedFunction = 0x80030000;\ndmy_nothing1 = 0x80030010;\nfunc_80030014 = 0x80030014;\nChangeClearSIO = 0x80030018;\n";
    assert.deepEqual(staleSdkSymbols(content, [{ vramStart: 0x80030000, vramEnd: 0x80030020, oPath: "build/sdk/lib/470/libtest/same__Large.o" }], f.root, "470", new Set(["lib/libsnd/dmynot1.o"])), ["dmy_nothing1", "func_80030014"]);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("historical OuterProduct0 boundary fails the premise; its complete SDK extent passes", t => {
  const binaryPath = join(ROOT, "extracted/iso/slus_011.15"), dummy = join(ROOT, "lib/libsnd/dmynot1.o");
  if (!existsSync(binaryPath) || !existsSync(dummy)) { t.skip("Original binary/SDK input unavailable"); return; }
  const binary = readFileSync(binaryPath);
  const broken = boundaryPremise(binary.subarray(0x28e74, 0x28ec4), 0x80038674, readTextObject(readFileSync(dummy)));
  assert.equal(broken.missingTerminal, true); assert.equal(broken.adjacentReturnPadding, true);
  assert.equal(boundaryPremise(binary.subarray(0x28e74, 0x28ed4), 0x80038674).missingTerminal, false);
});

test("every vendored signature version is audited separately; all provisioned 4.7 collision variants verify", t => {
  if (!loadMemberMap(ROOT, "470")) { t.skip("Run make split-sdk-libs to provision the original SDK collision objects"); return; }
  const report = auditSdkCollisions(ROOT);
  assert.deepEqual(report.errors, []);
  const active = report.versions.find(v => v.version === "470")!;
  assert.equal(active.status, "verified"); assert.equal(active.collisions.length, 11);
  assert.equal(active.collisions.reduce((n, c) => n + c.objects.length, 0), 41);
  assert.equal(active.collisions.find(c => c.member === "smp_00_1")!.objects.length, 3);
  for (const version of ["370", "420", "430"]) assert.ok(report.versions.some(v => v.version === version));
  assert.ok(report.versions.filter(v => !loadMemberMap(ROOT, v.version)).every(v => v.status === "not-provisioned"));
});
