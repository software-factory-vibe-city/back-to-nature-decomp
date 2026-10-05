import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFunctionSpans, loadSubsegments, loadSymbolIndex, loadSymbolAddresses, locateFunction, withSymbolMetadata } from "./symbolIndex.js";
import { loadContainers } from "./container.js";

test("request metadata agrees with uncached container indexes and cannot leak mutable views", () => {
  const containers = loadContainers(), chosen = [containers[0]!, containers.find((c) => c.kind === "overlay")!];
  for (const container of chosen) {
    const original = { spans: loadFunctionSpans(container), segments: loadSubsegments(container), address: loadSymbolIndex(container), names: loadSymbolAddresses(container) };
    withSymbolMetadata(() => {
      assert.deepEqual(loadFunctionSpans(container), original.spans); assert.deepEqual(loadSubsegments(container), original.segments);
      assert.deepEqual(loadSymbolIndex(container), original.address); assert.deepEqual(loadSymbolAddresses(container), original.names);
      const mutated = loadSymbolIndex(container); mutated.byAddress.clear(); mutated.addresses.length = 0;
      loadSymbolAddresses(container).clear(); loadFunctionSpans(container).length = 0;
      assert.deepEqual(loadSymbolIndex(container), original.address); assert.deepEqual(loadSymbolAddresses(container), original.names);
      assert.deepEqual(loadFunctionSpans(container), original.spans);
    });
    assert.deepEqual(loadSymbolIndex(container), original.address);
  }
});
test("shared RAM slots and ambiguous names remain container-qualified", () => {
  const exe = loadContainers()[0]!, name = loadFunctionSpans(exe)[0]!.name;
  const duplicate = { ...exe, id: "ambiguous-fixture" };
  assert.equal(withSymbolMetadata(() => locateFunction(name, [exe, duplicate])).length, 2);
});
