import assert from "node:assert/strict";
import test from "node:test";
import { hasLinkedMatch, scheduleRoundLabel, seriesGameWinnerLabel } from "./schedule.js";

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

test("linked games and their winner text are normalized for public clients", () => {
  assert.equal(hasLinkedMatch({ matchId: 8123456789 }), true);
  assert.equal(hasLinkedMatch({ matchId: null }), false);
  assert.equal(
    seriesGameWinnerLabel({
      winnerTeamId: "team-b",
      radiantTeam: { id: "team-a", name: "A 队" },
      direTeam: { id: "team-b", name: "B 队" },
    }),
    "B 队 胜",
  );
  assert.equal(
    seriesGameWinnerLabel({
      winnerTeamId: null,
      radiantTeam: { id: "team-a", name: "A 队" },
      direTeam: { id: "team-b", name: "B 队" },
    }),
    "查看详情",
  );
});
