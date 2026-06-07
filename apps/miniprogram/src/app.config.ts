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
    navigationBarBackgroundColor: "#07090c",
    navigationBarTitleText: "MRJZ",
    navigationBarTextStyle: "white",
    backgroundColor: "#07090c",
  },
  tabBar: {
    color: "#9ba6b8",
    selectedColor: "#d5a64f",
    backgroundColor: "#080c12",
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
