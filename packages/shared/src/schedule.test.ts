import assert from "node:assert/strict";
import test from "node:test";
import { formatSeriesGameResult, hasLinkedMatch, scheduleRoundLabel } from "./schedule.js";

test("group schedules hide their redundant first round label", () => {
  assert.equal(
    scheduleRoundLabel({
      stageType: "group",
      stageName: "小组赛",
      roundName: "第一轮",
      seriesKind: "regular",
    }),
    "小组赛",
  );
  assert.equal(
    scheduleRoundLabel({
      stageType: "group",
      stageName: "小组赛",
      roundName: "第一轮",
      seriesKind: "tiebreaker",
    }),
    "小组赛 · 加赛",
  );
});

test("non-group schedules retain stage and round context", () => {
  assert.equal(
    scheduleRoundLabel({
      stageType: "swiss",
      stageName: "瑞士轮",
      roundName: "第 3 轮",
    }),
    "瑞士轮 · 第 3 轮",
  );
});

test("linked games and their result text are normalized for public clients", () => {
  assert.equal(hasLinkedMatch({ matchId: 8123456789 }), true);
  assert.equal(hasLinkedMatch({ matchId: null }), false);
  assert.equal(formatSeriesGameResult({ radiantScore: 31, direScore: 18 }), "31 : 18");
  assert.equal(formatSeriesGameResult({ radiantScore: null, direScore: null }), "结果待同步");
});
