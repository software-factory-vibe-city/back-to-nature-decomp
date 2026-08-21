import assert from "node:assert/strict";
import test from "node:test";
import {
  EXE_CONTAINER_ID,
  containersCovering,
  containsVram,
  loadContainer,
  loadContainers,
  romToVram,
  slotsOf,
  vramToRom,
  type Container,
} from "./container.ts";

function fake(id: string, loadAddr: number, size: number, payloadOffset = 0): Container {
  return {
    id,
    kind: id === "exe" ? "exe" : "overlay",
    basename: id,
    targetPath: `extracted/${id}.bin`,
    payloadOffset,
    payloadSize: size,
    loadAddr,
    gpValue: 0,
    paths: {
      splat: `configs/splat/${id}.yaml`,
      symbolAddrs: `configs/symbols/${id}.txt`,
      asmDir: `build/${id}/asm`,
      srcDir: `src/${id}`,
      objDir: `build/${id}/src`,
      ldScript: `build/${id}/${id}.ld`,
      builtElf: `build/${id}/${id}.elf`,
      builtBin: `build/${id}/${id}.bin`,
      undefinedFuncs: `build/${id}/undefined_funcs_auto.txt`,
      undefinedSyms: `build/${id}/undefined_syms_auto.txt`,
    },
  };
}

test("an address maps to a file offset through the container's own geometry", () => {
  const exe = fake("exe", 0x80010000, 0x4e800, 0x800);
  assert.equal(vramToRom(exe, 0x80010000), 0x800);
  assert.equal(romToVram(exe, 0x800), 0x80010000);

  /* An overlay is a raw blob: its first byte is its load address. */
  const overlay = fake("ovl_11", 0x800b7e20, 0x76000);
  assert.equal(vramToRom(overlay, 0x800b7e20), 0);
  assert.equal(vramToRom(overlay, 0x800ce744), 0x16924);
});

test("containment is half-open at the end of the image", () => {
  const overlay = fake("ovl_31", 0x800b7e20, 0x1000);
  assert.equal(containsVram(overlay, 0x800b7e20), true);
  assert.equal(containsVram(overlay, 0x800b8e1c), true);
  assert.equal(containsVram(overlay, 0x800b8e20), false);
});

test("an address in a shared slot names every container that could hold it", () => {
  const containers = [fake("ovl_11", 0x800b7e20, 0x76000), fake("ovl_19", 0x800b7e20, 0x8000)];
  const covering = containersCovering(0x800b8000, containers);
  assert.deepEqual(covering.map((c) => c.id), ["ovl_11", "ovl_19"]);

  /* Past the small member's extent only the large one remains. */
  assert.deepEqual(containersCovering(0x800c0000, containers).map((c) => c.id), ["ovl_11"]);
});

test("containers sharing a load address are grouped into one slot", () => {
  const containers = [
    fake("exe", 0x80010000, 0x4e800, 0x800),
    fake("ovl_11", 0x800b7e20, 0x76000),
    fake("ovl_19", 0x800b7e20, 0x8000),
    fake("ovl_15", 0x8012dde8, 0x18000),
  ];
  const slots = slotsOf(containers);
  assert.equal(slots.size, 2, "the exe is not a slot");
  assert.deepEqual(slots.get(0x800b7e20)!.map((c) => c.id), ["ovl_11", "ovl_19"]);
  assert.deepEqual(slots.get(0x8012dde8)!.map((c) => c.id), ["ovl_15"]);
});

test("the project loads an exe container whose geometry comes from the binary header", () => {
  const exe = loadContainer(EXE_CONTAINER_ID);
  assert.ok(exe, "the exe container always exists");
  assert.equal(exe!.kind, "exe");
  assert.equal(exe!.payloadOffset, 0x800);
  assert.ok(exe!.loadAddr >= 0x80000000 && exe!.loadAddr < 0x80200000);
  assert.ok(exe!.gpValue !== 0, "the exe uses gp-relative addressing");
});

test("every overlay container carries a solved base and no gp", () => {
  for (const container of loadContainers()) {
    if (container.kind !== "overlay") continue;
    assert.equal(container.gpValue, 0, `${container.id} must not claim a gp base`);
    assert.equal(container.member?.base?.verdict, "resolved");
    assert.ok(container.loadAddr >= 0x80000000 && container.loadAddr < 0x80200000);
  }
});
