export const matchAwardRuleDescriptions = {
  lie_flat: "胜方阵营综合评分最低，评分由 KDA、参战率、英雄伤害占比、建筑伤害和 GPM 加权计算。",
  breaker: "全场击杀数最高。",
  herbalist: "全场击杀野怪数最多；最高值为 0 时不展示。",
  healer: "全场英雄治疗量最高；最高值为 0 时不展示。",
  pianist: "全场 APM 最高。",
  binder: "全场眩晕 / 控制时长最长；最高值为 0 时不展示。",
  pressure: "全场发信号次数最多；缺少字段或最高值为 0 时不展示。",
  stiff: "败方阵营综合评分最低，评分由 KDA、参战率、英雄伤害占比、建筑伤害和 GPM 加权计算。",
  ghost: "全场死亡数最高。",
  tough: "全场承受伤害总和最高。",
  violence: "全场英雄伤害最高。",
  assist: "全场助攻数最高。",
  support: "真眼、雾、粉和真视宝石购买次数合计最高；侦查守卫和眼位分配器不计入。",
  talker: "全局聊天文字记录条数最多。",
  rich: "全场净值最高；缺少净值时降级使用总经济。",
  cty: "10 分钟经济最高；缺少 10 分钟经济时不展示。",
  demolition: "全场建筑伤害最高。",
  soul: "败方阵营综合评分最高，评分由 KDA、参战率、英雄伤害占比、建筑伤害和 GPM 加权计算。",
};

export function getMatchAwardRuleDescription(code) {
  return matchAwardRuleDescriptions[code] ?? "";
}
