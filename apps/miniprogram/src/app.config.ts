export default defineAppConfig({
  pages: [
    "pages/index/index",
    "pages/stage/index",
    "pages/schedule/index",
    "pages/records/index",
    "pages/players/index",
    "pages/player-detail/index",
    "pages/teams/index",
    "pages/team-detail/index",
    "pages/match-detail/index",
    "pages/mine/index",
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#111827",
    navigationBarTitleText: "MRJZ",
    navigationBarTextStyle: "white",
    backgroundColor: "#0f172a",
  },
  tabBar: {
    color: "#94a3b8",
    selectedColor: "#f59e0b",
    backgroundColor: "#111827",
    borderStyle: "black",
    list: [
      { pagePath: "pages/index/index", text: "首页" },
      { pagePath: "pages/schedule/index", text: "赛程" },
      { pagePath: "pages/records/index", text: "记录" },
      { pagePath: "pages/players/index", text: "选手" },
      { pagePath: "pages/mine/index", text: "我的" },
    ],
  },
});
