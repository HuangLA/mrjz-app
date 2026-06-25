# OpenDota 字段映射

最后更新：2026-05-13

本文件记录比赛详情页需要用到的 OpenDota 字段。后端同步时保存 `raw_match_json`，再装配成前端使用的 `MatchDetailViewModel`。

## 1. 来源接口

主要接口：

- `GET /api/matches/{match_id}`：读取比赛详情。
- `POST /api/request/{match_id}`：请求 OpenDota 解析 replay。

OpenDota 的 match detail 在解析完成后会包含更多高级字段。未解析时，前端按模块降级。

## 2. 比赛摘要

| 展示内容 | OpenDota 字段 |
| --- | --- |
| match_id | `match_id` |
| 开始时间 | `start_time` |
| 时长 | `duration` |
| 天辉击杀 | `radiant_score` |
| 夜魇击杀 | `dire_score` |
| 胜方 | `radiant_win` |
| 联赛 | `leagueid`, `league` |

## 3. 玩家数据

| 展示内容 | OpenDota 字段 |
| --- | --- |
| 玩家槽位 | `players[].player_slot` |
| 账号 | `players[].account_id` |
| 昵称 | `players[].personaname` 或平台选手名 |
| 英雄 | `players[].hero_id` |
| K/D/A | `players[].kills`, `players[].deaths`, `players[].assists` |
| GPM/XPM | `players[].gold_per_min`, `players[].xp_per_min` |
| 净值 | `players[].net_worth` 或 `players[].total_gold` |
| 伤害/治疗 | `players[].hero_damage`, `players[].tower_damage`, `players[].hero_healing` |
| 物品 | `item_0` 到 `item_5`, `backpack_0` 到 `backpack_2`, `item_neutral` |

## 4. 技能加点顺序

优先字段：

- `players[].ability_upgrades_arr`

可辅助字段：

- `players[].ability_upgrades`

展示策略：

- 用数组顺序表达 1 到 N 级技能点。
- 如果只有 ability id，没有时间，就只显示等级序号和技能图标。
- 如果有 `time`，可在长按或详情里显示加点时间。

## 5. Ban/Pick 顺序

字段：

- `picks_bans`

映射：

- `is_pick=true` 显示为 pick。
- `is_pick=false` 显示为 ban。
- `team` 映射到天辉/夜魇。
- `order` 用于排序。

降级：

- 如果 `picks_bans` 缺失或为空，返回 `draft.hasDraft=false`。
- 前端不显示 Ban/Pick 模块，或显示“该模式无 BP”轻提示。

## 6. 阿哈利姆魔晶和神杖

优先字段：

- `players[].permanent_buffs`

已知常量：

- permanent buff `2` = `ultimate_scepter`
- permanent buff `12` = `aghanims_shard`

辅助判断：

- 物品栏存在 Aghanim's Scepter 时，也视为拥有神杖。
- 如果后续常量或物品 ID 变化，以 `dotaconstants` 为准。

展示策略：

- 前端使用两个小图标：神杖、魔晶。
- 拥有时高亮，不拥有时低透明度。
- 需要在数据中保留来源：`items`、`permanent_buffs`、`mixed`、`unknown`。

## 7. 眼位时间轴

字段：

- `players[].obs_log`
- `players[].sen_log`
- `players[].obs_left_log`
- `players[].sen_left_log`

展示策略：

- `obs_log` 和 `sen_log` 显示放置时间点。
- `obs_left_log` 和 `sen_left_log` 后续可用于显示消失、被反或过期。
- 统一装配为 `WardTimelineEvent[]`，按 `time` 排序。
- 如果包含 `x`、`y`，前端用共享 `mapDotaMapCoordinatesToPercent` 映射到小地图。OpenDota 眼位坐标需要先按 Dota world bounds 归一化，再映射到小地图百分比；当前 `400x400` 小地图素材整张图都是有效地图框，不再额外扣除图片内边界或内容 padding。

## 8. 全局聊天记录

字段：

- `chat`

映射：

- `time`：聊天发生时间。
- `unit`：发送者显示名。
- `key`：消息内容。
- `player_slot`：可映射队伍和平台选手。

展示策略：

- 默认只展示全局聊天和系统聊天。
- 如果 OpenDota 数据无法区分频道，先用 `all`。
- 空数组时不显示聊天模块。

## 9. 经济和经验趋势

字段：

- `radiant_gold_adv`
- `radiant_xp_adv`

展示策略：

- 数组下标按分钟或采样点显示。
- 负数代表天辉落后，正数代表天辉领先。
- 前端不重新计算曲线，只绘制后端返回数组。

## 10. 趣味称号

比赛详情页称号由后端从 OpenDota `raw_match_json` 统一计算，H5 和小程序只展示返回结果，并把称号写入对应选手数据卡片。

评分相关称号复用当前 MVP 评分公式，但对全场 10 名选手计算：

```text
score =
  KDA * 0.25 +
  参战率 * 100 * 0.25 +
  英雄伤害占比 * 100 * 0.20 +
  建筑伤害 / 1000 * 0.15 +
  GPM / 10 * 0.15
```

称号字段：

| 称号 | 规则 | OpenDota 字段 |
| --- | --- | --- |
| 躺 | 胜方阵营综合评分最低 | MVP 评分公式 |
| 破 | 全场击杀最多 | `players[].kills` |
| 采灵芝 | 击杀野怪最多，最高值为 0 时不显示 | `players[].neutral_kills` |
| 奶 | 治疗量最高，最高值为 0 时不显示 | `players[].hero_healing` |
| 钢琴手 | APM 最高 | `players[].actions_per_min` |
| 捆绑王 | 眩晕时间最长，最高值为 0 时不显示 | `players[].stuns` |
| 压力怪 | 发信号次数最多，缺字段或最高值为 0 时不显示 | `players[].pings` |
| 僵 | 败方阵营综合评分最低 | MVP 评分公式 |
| 鬼 | 全场死亡数最高 | `players[].deaths` |
| 硬 | 承受伤害总和最高 | `players[].damage_taken` |
| 力中暴力 | 英雄伤害最高 | `players[].hero_damage` |
| 助 | 助攻最高 | `players[].assists` |
| 辅 | 真眼、雾、粉、真视宝石购买次数最多 | `players[].purchase.ward_sentry`, `smoke_of_deceit`, `dust`, `gem` |
| 话痨 | 聊天区文字记录条数最多 | `chat[].type = chat` 按 `player_slot` 计数 |
| 富 | 全场净值最高，缺失时降级到总经济 | `players[].net_worth`, `players[].total_gold`, `players[].gold` |
| CTY | 10 分钟经济最高，缺 10 分钟经济时不显示 | `players[].gold_t[10]` |
| 拆 | 对建筑伤害最高 | `players[].tower_damage` |
| 魂 | 败方阵营综合评分最高 | MVP 评分公式 |

`ward_observer` 和 `ward_dispenser` 不计入“辅”：前者为 0 金币，后者可能与真假眼购买重复计数。

### 10.1 每届英雄榜字段

英雄榜和单场趣味称号使用相同 OpenDota 字段，但统计口径不同：英雄榜按单届赛事聚合，除 `PlayBoy` 按本届不同英雄数排名外，其余称号按场均值排名，并且只统计该届参赛 5 场及以上的选手。展开态展示每项候选前五、场均值或聚合值、总计和参赛场数。

| 英雄榜称号 | 排名字段 | 备注 |
| --- | --- | --- |
| 人头帝 | `players[].kills` | 场均击杀 |
| 采蘑菇的小姑娘 | `players[].neutral_kills` | 场均野怪击杀，数值单位显示为“只” |
| 奶妈王 | `players[].hero_healing` | 场均治疗量 |
| 压力狂 | `players[].pings` | 场均发 ping 次数 |
| SM帝 | `players[].stuns` | 场均控制时长，单位秒 |
| 鬼王宗宗主 | `players[].deaths` | 场均阵亡 |
| 老吴 | `players[].damage_taken` | 字段为对象时先求和再按场均 |
| 战争机器 | `players[].hero_damage` | 场均英雄伤害 |
| 助攻王 | `players[].assists` | 场均助攻 |
| 世界首富 | `players[].net_worth`，缺失时降级到 `total_gold` / `gold` | 场均财产 |
| 拆迁队队长 | `players[].tower_damage` | 场均建筑伤害 |
| 喝茶散步 | `players[].gold_per_min` | 场均 GPM 最低，按低值优先排名 |
| 技师 | `players[].hero_damage` | 场均英雄伤害最低，按低值优先排名 |
| 逛街按摩 | `players[].xp_per_min` | 场均 XPM 最低，按低值优先排名 |
| PlayBoy | `players[].hero_id` 去重数 | 本届使用不同英雄最多 |

## 11. 参考

- OpenDota OpenAPI: `https://api.opendota.com/api`
- dotaconstants permanent buffs: `https://github.com/odota/dotaconstants/blob/master/json/permanent_buffs.json`
