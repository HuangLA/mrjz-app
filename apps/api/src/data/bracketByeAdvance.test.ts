import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoAdvanceBracketNode } from "./bracketByeAdvance.js";

const base = {
  nodeId: "node-1",
  bracketGroup: "single",
  radiantTeamId: "team-a",
  direTeamId: null,
  incomingSlotKeys: new Set<string>(),
} as const;

test("advances a true bye when the empty slot has no incoming edge", () => {
  assert.equal(shouldAutoAdvanceBracketNode(base), true);
});

test("waits when the empty slot is fed by an upstream node", () => {
  assert.equal(
    shouldAutoAdvanceBracketNode({
      ...base,
      incomingSlotKeys: new Set(["node-1:dire"]),
    }),
    false,
  );
});

test("never auto-advances a grand final, even with a single team", () => {
  assert.equal(
    shouldAutoAdvanceBracketNode({ ...base, bracketGroup: "grand_final" }),
    false,
  );
});

test("does not advance nodes with both or no teams", () => {
  assert.equal(
    shouldAutoAdvanceBracketNode({ ...base, direTeamId: "team-b" }),
    false,
  );
  assert.equal(
    shouldAutoAdvanceBracketNode({ ...base, radiantTeamId: null }),
    false,
  );
});

test("advances when the incoming edge targets the occupied slot only", () => {
  assert.equal(
    shouldAutoAdvanceBracketNode({
      ...base,
      incomingSlotKeys: new Set(["node-1:radiant"]),
    }),
    true,
  );
});
