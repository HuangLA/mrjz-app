export const matchAwardRuleDescriptions = {
  lie_flat: "胜方评分最低",
  breaker: "击杀最多",
  herbalist: "野怪击杀最多",
  healer: "治疗量最高",
  pianist: "APM 最高",
  binder: "控制时间最长",
  pressure: "发信号最多",
  stiff: "败方评分最低",
  ghost: "死亡最多",
  tough: "承受伤害最高",
  violence: "英雄伤害最高",
  assist: "助攻最多",
  support: "辅助道具购买最多",
  talker: "聊天发言最多",
  rich: "净值最高",
  cty: "10 分钟经济最高",
  demolition: "建筑伤害最高",
  soul: "败方评分最高",
};

export function getMatchAwardRuleDescription(code) {
  return matchAwardRuleDescriptions[code] ?? "";
}
