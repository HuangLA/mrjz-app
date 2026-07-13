import assert from "node:assert/strict";
import test from "node:test";
import { resolveSeriesGameWinnerTeamId } from "./seriesGameWinner.js";

const base = {
  storedWinnerTeamId: null,
  rawRadiantWin: true,
  rawRadiantTeamId: 101,
  rawDireTeamId: 202,
  seriesRadiantTeamId: "team-a",
  seriesDireTeamId: "team-b",
  seriesRadiantOpenDotaTeamId: 101,
  seriesDireOpenDotaTeamId: 202,
} as const;

test("resolves an OpenDota game winner when sides match the official series", () => {
  assert.equal(resolveSeriesGameWinnerTeamId(base), "team-a");
  assert.equal(resolveSeriesGameWinnerTeamId({ ...base, rawRadiantWin: false }), "team-b");
});

test("resolves the official team when OpenDota sides are reversed", () => {
  assert.equal(
    resolveSeriesGameWinnerTeamId({
      ...base,
      rawRadiantTeamId: 202,
      rawDireTeamId: 101,
      rawRadiantWin: true,
    }),
    "team-b",
  );
});

test("falls back to an explicit stored single-game winner", () => {
  assert.equal(
    resolveSeriesGameWinnerTeamId({
      ...base,
      storedWinnerTeamId: "team-b",
      rawRadiantWin: null,
      rawRadiantTeamId: null,
      rawDireTeamId: null,
    }),
    "team-b",
  );
});

test("does not guess a winner from unrelated or missing team data", () => {
  assert.equal(
    resolveSeriesGameWinnerTeamId({
      ...base,
      storedWinnerTeamId: "another-team",
      rawRadiantTeamId: 303,
      rawDireTeamId: 404,
    }),
    null,
  );
});
