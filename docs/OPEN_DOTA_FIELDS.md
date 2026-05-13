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
- 如果包含 `x`、`y`，后续可映射到小地图。

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

## 10. 参考

- OpenDota OpenAPI: `https://api.opendota.com/api`
- dotaconstants permanent buffs: `https://github.com/odota/dotaconstants/blob/master/json/permanent_buffs.json`
