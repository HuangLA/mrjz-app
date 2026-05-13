export type AppRoute = "home" | "stage" | "schedule" | "match" | "tags";

export type StageKey = "group" | "swiss" | "knockout";

export type TeamSide = "radiant" | "dire";

export type AghanimState = "owned" | "queued" | "none";

export interface TeamInfo {
  side: TeamSide;
  name: string;
  shortName: string;
  seed: string;
  color: string;
}

export interface TournamentStat {
  label: string;
  value: string;
  hint: string;
}

export interface StandingRow {
  rank: number;
  team: string;
  score: string;
  points: string;
  streak: string;
  status: "晋级区" | "观察区" | "淘汰区";
}

export interface StageView {
  key: StageKey;
  name: string;
  status: string;
  currentRound: string;
  note: string;
  standings: StandingRow[];
}

export interface ScheduleGroup {
  date: string;
  label: string;
  matches: ScheduleItem[];
}

export interface ScheduleItem {
  time: string;
  stage: string;
  round: string;
  teamA: string;
  teamB: string;
  bo: string;
  status: "未开始" | "待补录" | "已完赛" | "延期";
  score?: string;
  matchId?: string;
}

export interface PlayerStats {
  id: string;
  side: TeamSide;
  name: string;
  hero: string;
  heroShort: string;
  portrait: string;
  role: string;
  lane: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  participation: string;
  damageShare: string;
  gpm: number;
  xpm: number;
  netWorth: string;
  lastHits: number;
  denies: number;
  heroDamage: string;
  towerDamage: string;
  healing: string;
  damageTaken: string;
  items: string[];
  neutralItem: string;
  scepter: AghanimState;
  shard: AghanimState;
  abilityOrder: string[];
  tags: string[];
}

export interface DraftStep {
  order: number;
  side: TeamSide;
  type: "Ban" | "Pick";
  hero: string;
  actor: string;
}

export interface WardEvent {
  time: string;
  side: TeamSide;
  type: "观察守卫" | "岗哨守卫" | "反眼";
  lane: string;
  note: string;
}

export interface ChatLine {
  time: string;
  side: TeamSide;
  player: string;
  hero: string;
  text: string;
}

export interface MatchData {
  id: string;
  league: string;
  series: string;
  mode: string;
  endedAt: string;
  duration: string;
  radiantScore: number;
  direScore: number;
  winner: TeamSide;
  radiant: TeamInfo;
  dire: TeamInfo;
  mvpPlayerId: string;
  parseStatus: string;
  players: PlayerStats[];
  draft: DraftStep[];
  wardTimeline: WardEvent[];
  chat: ChatLine[];
}

export const tournamentStats: TournamentStat[] = [
  { label: "当前赛季", value: "MRJZ 春季杯 S1", hint: "公开 H5 预览" },
  { label: "总赛程", value: "42", hint: "已确认 31 场" },
  { label: "已同步比赛", value: "18", hint: "OpenDota 已解析 16 场" },
  { label: "下一场", value: "20:30", hint: "瑞士轮 R3" },
];

export const stageViews: Record<StageKey, StageView> = {
  group: {
    key: "group",
    name: "小组赛",
    status: "A/B 组双循环进行中",
    currentRound: "A 组第 4 轮",
    note: "前二直进胜者组，第三进入附加赛。",
    standings: [
      { rank: 1, team: "死亡之拳", score: "3-0", points: "+41", streak: "W3", status: "晋级区" },
      { rank: 2, team: "夜魇补刀学院", score: "2-1", points: "+12", streak: "W1", status: "晋级区" },
      { rank: 3, team: "Roshan Snack", score: "1-2", points: "-6", streak: "L1", status: "观察区" },
      { rank: 4, team: "泉水守卫", score: "0-3", points: "-47", streak: "L3", status: "淘汰区" },
    ],
  },
  swiss: {
    key: "swiss",
    name: "瑞士轮",
    status: "第 3 轮配对待确认",
    currentRound: "R3: 2-0 组内对阵",
    note: "所有配对均为草稿，管理员确认后公开。",
    standings: [
      { rank: 1, team: "天辉老中医", score: "2-0", points: "+31", streak: "W2", status: "晋级区" },
      { rank: 2, team: "死亡之拳", score: "2-0", points: "+22", streak: "W2", status: "晋级区" },
      { rank: 3, team: "肉山研究所", score: "1-1", points: "+4", streak: "L1", status: "观察区" },
      { rank: 4, team: "高地不掉队", score: "1-1", points: "-2", streak: "W1", status: "观察区" },
      { rank: 5, team: "迷雾信使", score: "0-2", points: "-25", streak: "L2", status: "淘汰区" },
    ],
  },
  knockout: {
    key: "knockout",
    name: "淘汰赛",
    status: "胜者组半决赛未开始",
    currentRound: "Upper SF",
    note: "Bracket 只展示已确认种子位，后续晋级由后端返回。",
    standings: [
      { rank: 1, team: "死亡之拳", score: "Seed 1", points: "Upper", streak: "BYE", status: "晋级区" },
      { rank: 2, team: "天辉老中医", score: "Seed 2", points: "Upper", streak: "BYE", status: "晋级区" },
      { rank: 3, team: "夜魇补刀学院", score: "Seed 3", points: "Lower", streak: "R1", status: "观察区" },
      { rank: 4, team: "肉山研究所", score: "Seed 4", points: "Lower", streak: "R1", status: "观察区" },
    ],
  },
};

export const scheduleGroups: ScheduleGroup[] = [
  {
    date: "5月13日",
    label: "今天",
    matches: [
      {
        time: "20:30",
        stage: "瑞士轮",
        round: "R3",
        teamA: "死亡之拳",
        teamB: "天辉老中医",
        bo: "BO3",
        status: "未开始",
      },
      {
        time: "22:00",
        stage: "小组赛",
        round: "B4",
        teamA: "Roshan Snack",
        teamB: "高地不掉队",
        bo: "BO2",
        status: "待补录",
      },
    ],
  },
  {
    date: "5月12日",
    label: "昨日",
    matches: [
      {
        time: "21:10",
        stage: "小组赛",
        round: "A3",
        teamA: "死亡之拳",
        teamB: "夜魇补刀学院",
        bo: "BO1",
        status: "已完赛",
        score: "33 : 27",
        matchId: "7845123091",
      },
      {
        time: "20:00",
        stage: "瑞士轮",
        round: "R2",
        teamA: "肉山研究所",
        teamB: "迷雾信使",
        bo: "BO1",
        status: "延期",
      },
    ],
  },
];

const portraitBase = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes";

export const featuredMatch: MatchData = {
  id: "7845123091",
  league: "MRJZ 春季杯 S1",
  series: "小组赛 A3",
  mode: "Captain Mode",
  endedAt: "2026-05-12 21:57",
  duration: "47:05",
  radiantScore: 33,
  direScore: 27,
  winner: "radiant",
  radiant: {
    side: "radiant",
    name: "死亡之拳",
    shortName: "DOF",
    seed: "A1",
    color: "#78d66c",
  },
  dire: {
    side: "dire",
    name: "夜魇补刀学院",
    shortName: "DLA",
    seed: "A2",
    color: "#ef6467",
  },
  mvpPlayerId: "r2",
  parseStatus: "高级解析完成，聊天与视野已入库",
  players: [
    {
      id: "r1",
      side: "radiant",
      name: "MomoCarry",
      hero: "幻影刺客",
      heroShort: "PA",
      portrait: `${portraitBase}/phantom_assassin.png`,
      role: "1号位",
      lane: "优势路",
      level: 25,
      kills: 11,
      deaths: 4,
      assists: 13,
      participation: "72%",
      damageShare: "31%",
      gpm: 681,
      xpm: 768,
      netWorth: "32.8k",
      lastHits: 412,
      denies: 21,
      heroDamage: "41.9k",
      towerDamage: "6.3k",
      healing: "0",
      damageTaken: "29.6k",
      items: ["狂战", "BKB", "撒旦", "深渊", "银月", "蝴蝶"],
      neutralItem: "寂灭",
      scepter: "none",
      shard: "owned",
      abilityOrder: ["窒碍", "闪烁", "窒碍", "恩赐", "窒碍", "暴击", "窒碍", "闪烁", "闪烁", "天赋", "暴击", "闪烁"],
      tags: ["后期接管", "切入干净"],
    },
    {
      id: "r2",
      side: "radiant",
      name: "River.Mid",
      hero: "风行者",
      heroShort: "WR",
      portrait: `${portraitBase}/windrunner.png`,
      role: "2号位",
      lane: "中路",
      level: 27,
      kills: 14,
      deaths: 2,
      assists: 15,
      participation: "88%",
      damageShare: "36%",
      gpm: 642,
      xpm: 811,
      netWorth: "29.4k",
      lastHits: 356,
      denies: 18,
      heroDamage: "48.7k",
      towerDamage: "4.8k",
      healing: "0",
      damageTaken: "22.1k",
      items: ["缚灵索", "BKB", "雷锤", "金箍棒", "羊刀", "飞鞋"],
      neutralItem: "神弓",
      scepter: "owned",
      shard: "owned",
      abilityOrder: ["强力击", "风步", "强力击", "束缚", "强力击", "集中火力", "强力击", "束缚", "束缚", "天赋", "集中火力", "束缚"],
      tags: ["MVP", "关键束缚", "经济不断档"],
    },
    {
      id: "r3",
      side: "radiant",
      name: "OldElevenFan",
      hero: "玛尔斯",
      heroShort: "Mars",
      portrait: `${portraitBase}/mars.png`,
      role: "3号位",
      lane: "劣势路",
      level: 22,
      kills: 4,
      deaths: 7,
      assists: 20,
      participation: "73%",
      damageShare: "15%",
      gpm: 421,
      xpm: 584,
      netWorth: "18.6k",
      lastHits: 192,
      denies: 12,
      heroDamage: "20.8k",
      towerDamage: "2.1k",
      healing: "0",
      damageTaken: "46.5k",
      items: ["跳刀", "刃甲", "莲花", "希瓦", "魔晶", "刷新球"],
      neutralItem: "忍者",
      scepter: "queued",
      shard: "owned",
      abilityOrder: ["盾击", "神矛", "神矛", "护身", "神矛", "竞技场", "神矛", "盾击", "盾击", "天赋", "竞技场", "盾击"],
      tags: ["开团果断", "承伤拉满"],
    },
    {
      id: "r4",
      side: "radiant",
      name: "LotusSupport",
      hero: "水晶室女",
      heroShort: "CM",
      portrait: `${portraitBase}/crystal_maiden.png`,
      role: "4号位",
      lane: "游走",
      level: 20,
      kills: 2,
      deaths: 8,
      assists: 24,
      participation: "79%",
      damageShare: "8%",
      gpm: 326,
      xpm: 452,
      netWorth: "11.2k",
      lastHits: 68,
      denies: 5,
      heroDamage: "11.1k",
      towerDamage: "0.6k",
      healing: "1.8k",
      damageTaken: "31.8k",
      items: ["推推", "微光", "绿鞋", "真眼", "魂泪", "以太"],
      neutralItem: "望远镜",
      scepter: "none",
      shard: "owned",
      abilityOrder: ["冰封", "光环", "冰封", "冰霜", "冰封", "极寒", "冰封", "光环", "光环", "天赋", "极寒", "光环"],
      tags: ["视野干净", "买雾积极"],
    },
    {
      id: "r5",
      side: "radiant",
      name: "WardEconomist",
      hero: "撼地者",
      heroShort: "ES",
      portrait: `${portraitBase}/earthshaker.png`,
      role: "5号位",
      lane: "辅助",
      level: 19,
      kills: 2,
      deaths: 6,
      assists: 25,
      participation: "82%",
      damageShare: "10%",
      gpm: 301,
      xpm: 431,
      netWorth: "10.5k",
      lastHits: 45,
      denies: 3,
      heroDamage: "13.4k",
      towerDamage: "0.9k",
      healing: "0.7k",
      damageTaken: "34.7k",
      items: ["跳刀", "微光", "圣洁", "真眼", "芒果", "雾"],
      neutralItem: "贤者",
      scepter: "none",
      shard: "none",
      abilityOrder: ["沟壑", "余震", "沟壑", "强化", "沟壑", "回音", "沟壑", "余震", "余震", "天赋", "回音", "余震"],
      tags: ["团战救场", "眼位到位"],
    },
    {
      id: "d1",
      side: "dire",
      name: "LastHitOnly",
      hero: "龙骑士",
      heroShort: "DK",
      portrait: `${portraitBase}/dragon_knight.png`,
      role: "1号位",
      lane: "优势路",
      level: 24,
      kills: 9,
      deaths: 5,
      assists: 11,
      participation: "74%",
      damageShare: "28%",
      gpm: 602,
      xpm: 711,
      netWorth: "27.5k",
      lastHits: 383,
      denies: 17,
      heroDamage: "35.3k",
      towerDamage: "5.5k",
      healing: "0",
      damageTaken: "42.4k",
      items: ["强袭", "BKB", "大炮", "跳刀", "撒旦", "银月"],
      neutralItem: "巨人",
      scepter: "owned",
      shard: "none",
      abilityOrder: ["火焰", "龙血", "火焰", "神龙", "火焰", "龙形", "火焰", "龙血", "龙血", "天赋", "龙形", "龙血"],
      tags: ["抗压核心", "拆塔稳定"],
    },
    {
      id: "d2",
      side: "dire",
      name: "BottleRune",
      hero: "风暴之灵",
      heroShort: "Storm",
      portrait: `${portraitBase}/storm_spirit.png`,
      role: "2号位",
      lane: "中路",
      level: 25,
      kills: 10,
      deaths: 6,
      assists: 12,
      participation: "81%",
      damageShare: "33%",
      gpm: 587,
      xpm: 747,
      netWorth: "26.1k",
      lastHits: 322,
      denies: 14,
      heroDamage: "42.1k",
      towerDamage: "1.1k",
      healing: "0",
      damageTaken: "27.8k",
      items: ["血精", "紫苑", "BKB", "林肯", "希瓦", "飞鞋"],
      neutralItem: "魔童",
      scepter: "queued",
      shard: "owned",
      abilityOrder: ["残影", "超负荷", "残影", "电子", "残影", "球状", "残影", "超负荷", "超负荷", "天赋", "球状", "超负荷"],
      tags: ["节奏发动机", "切后排"],
    },
    {
      id: "d3",
      side: "dire",
      name: "AxePlease",
      hero: "斧王",
      heroShort: "Axe",
      portrait: `${portraitBase}/axe.png`,
      role: "3号位",
      lane: "劣势路",
      level: 21,
      kills: 4,
      deaths: 8,
      assists: 14,
      participation: "67%",
      damageShare: "13%",
      gpm: 388,
      xpm: 522,
      netWorth: "16.2k",
      lastHits: 176,
      denies: 9,
      heroDamage: "16.4k",
      towerDamage: "0.8k",
      healing: "0",
      damageTaken: "51.2k",
      items: ["跳刀", "刃甲", "挑战", "莲花", "魔晶", "板甲"],
      neutralItem: "蛛丝",
      scepter: "none",
      shard: "owned",
      abilityOrder: ["反击", "战吼", "反击", "狂战", "反击", "斩杀", "反击", "战吼", "战吼", "天赋", "斩杀", "战吼"],
      tags: ["先手压力", "买活关键"],
    },
    {
      id: "d4",
      side: "dire",
      name: "WillowDew",
      hero: "邪影芳灵",
      heroShort: "DW",
      portrait: `${portraitBase}/dark_willow.png`,
      role: "4号位",
      lane: "游走",
      level: 19,
      kills: 3,
      deaths: 7,
      assists: 18,
      participation: "78%",
      damageShare: "14%",
      gpm: 337,
      xpm: 443,
      netWorth: "11.7k",
      lastHits: 73,
      denies: 4,
      heroDamage: "17.8k",
      towerDamage: "0.4k",
      healing: "0",
      damageTaken: "24.4k",
      items: ["微光", "吹风", "以太", "魔晶", "真眼", "雾"],
      neutralItem: "望远镜",
      scepter: "none",
      shard: "owned",
      abilityOrder: ["荆棘", "暗影", "荆棘", "诅咒", "荆棘", "恐吓", "荆棘", "暗影", "暗影", "天赋", "恐吓", "暗影"],
      tags: ["控制链", "反打意识"],
    },
    {
      id: "d5",
      side: "dire",
      name: "SmokeBreaker",
      hero: "发条技师",
      heroShort: "Clock",
      portrait: `${portraitBase}/rattletrap.png`,
      role: "5号位",
      lane: "辅助",
      level: 18,
      kills: 1,
      deaths: 7,
      assists: 20,
      participation: "78%",
      damageShare: "12%",
      gpm: 289,
      xpm: 397,
      netWorth: "9.4k",
      lastHits: 39,
      denies: 2,
      heroDamage: "15.1k",
      towerDamage: "0.3k",
      healing: "0.5k",
      damageTaken: "37.6k",
      items: ["推推", "骨灰", "绿鞋", "真眼", "微光", "雾"],
      neutralItem: "铲子",
      scepter: "none",
      shard: "none",
      abilityOrder: ["弹幕", "照明", "弹幕", "齿轮", "弹幕", "钩爪", "弹幕", "齿轮", "齿轮", "天赋", "钩爪", "齿轮"],
      tags: ["破雾", "抢符"],
    },
  ],
  draft: [
    { order: 1, side: "radiant", type: "Ban", hero: "影魔", actor: "死亡之拳" },
    { order: 2, side: "dire", type: "Ban", hero: "陈", actor: "夜魇补刀学院" },
    { order: 3, side: "radiant", type: "Pick", hero: "风行者", actor: "River.Mid" },
    { order: 4, side: "dire", type: "Pick", hero: "龙骑士", actor: "LastHitOnly" },
    { order: 5, side: "dire", type: "Ban", hero: "兽王", actor: "夜魇补刀学院" },
    { order: 6, side: "radiant", type: "Ban", hero: "炼金术士", actor: "死亡之拳" },
    { order: 7, side: "radiant", type: "Pick", hero: "玛尔斯", actor: "OldElevenFan" },
    { order: 8, side: "dire", type: "Pick", hero: "风暴之灵", actor: "BottleRune" },
    { order: 9, side: "radiant", type: "Pick", hero: "幻影刺客", actor: "MomoCarry" },
    { order: 10, side: "dire", type: "Pick", hero: "斧王", actor: "AxePlease" },
  ],
  wardTimeline: [
    { time: "00:15", side: "radiant", type: "观察守卫", lane: "中路高台", note: "开局侦察符点" },
    { time: "06:40", side: "dire", type: "岗哨守卫", lane: "天辉野区", note: "排掉远古入口眼" },
    { time: "13:22", side: "radiant", type: "反眼", lane: "肉山口", note: "控盾前清视野" },
    { time: "24:08", side: "dire", type: "观察守卫", lane: "下路二塔", note: "抓边线经济位" },
    { time: "36:31", side: "radiant", type: "岗哨守卫", lane: "夜魇高地", note: "高地推进前插真眼" },
  ],
  chat: [
    { time: "09:31", side: "dire", player: "BottleRune", hero: "风暴之灵", text: "miss mid, careful bot" },
    { time: "18:44", side: "radiant", player: "LotusSupport", hero: "水晶室女", text: "smoke after rune, ward rosh first" },
    { time: "31:06", side: "dire", player: "AxePlease", hero: "斧王", text: "buyback 80, hold shrine line" },
    { time: "42:18", side: "radiant", player: "River.Mid", hero: "风行者", text: "no storm buyback, go throne" },
  ],
};

export const playerTags = [
  { label: "关键先生", votes: 88, target: "River.Mid" },
  { label: "眼位经济学", votes: 64, target: "WardEconomist" },
  { label: "后期保险", votes: 51, target: "MomoCarry" },
  { label: "团战发动机", votes: 43, target: "OldElevenFan" },
  { label: "反打意识", votes: 31, target: "WillowDew" },
  { label: "破雾嗅觉", votes: 24, target: "SmokeBreaker" },
];

export const teamTags = [
  { label: "控盾纪律好", votes: 73, target: "死亡之拳" },
  { label: "中期推进快", votes: 58, target: "死亡之拳" },
  { label: "敢接劣势团", votes: 42, target: "夜魇补刀学院" },
  { label: "BP 有想法", votes: 36, target: "夜魇补刀学院" },
];
