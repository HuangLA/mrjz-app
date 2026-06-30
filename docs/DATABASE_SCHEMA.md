# 数据库设计草案

最后更新：2026-05-14

## 当前选择

当前本地开发使用 Node 22 内置 `node:sqlite` 和 `apps/api/var/mrjz.sqlite`。仓库提交 SQL migration 和初始化脚本，不提交运行态数据库文件。云服务器生产环境仍按关系型数据库设计，后续可以迁移到 PostgreSQL，并在需要时引入 Prisma 或 Drizzle。

## 初始化命令

```bash
npm run db:init
npm run db:status
npm run db:reset
```

默认数据库路径由 `MRJZ_DB_PATH` 控制，未设置时为 `apps/api/var/mrjz.sqlite`。

## 核心模块

- 赛事：`leagues`、`seasons`、`tournaments`、`teams`、`tournament_teams`
- 选手：`players`、`team_members`、`tournament_players`
- 赛制：`stages`、`rounds`、`series`、`series_games`
- 榜单：`standings`、`bracket_nodes`
- OpenDota：`opendota_matches`、`sync_tasks`
- 互动：`app_users`、`tags`、`tag_likes`、`tag_reports`、`tag_audit_logs`

## 当前种子数据

- 第一届：OpenDota `league_id = 17485`，本地赛事 `tournament_mrjz_s1`。
- 第二届：OpenDota `league_id = 18365`，本地赛事 `tournament_mrjz_s2`。
- 第三届：OpenDota `league_id = 19483`，本地赛事 `tournament_mrjz_s3`。
- 第一届和第二届默认 `completed`，第三届默认 `running`，用于验证 10 分钟 OpenDota 自动同步。
- 初始化脚本只写入三届真实联赛壳和默认阶段；赛程、队伍、积分榜和标签均等待管理员真实录入。
- 真实比赛通过 `npm run sync:opendota:backfill` 拉取并保存在本地运行态数据库。

## 当前本地 backfill 结果

截至 2026-05-19，本机 `apps/api/var/mrjz.sqlite` 已重新 backfill 前三届比赛：

| league_id | 本地赛事 | 状态 | 比赛数 | 解析状态 |
| --- | --- | --- | --- | --- |
| `17485` | `tournament_mrjz_s1` | `completed` | 30 | 7 场 `parsed`，23 场 `requested` |
| `18365` | `tournament_mrjz_s2` | `completed` | 42 | 42 场 `parsed` |
| `19483` | `tournament_mrjz_s3` | `running` | 47 | 47 场 `parsed` |

运行态 SQLite 文件仍不提交到 Git；新环境需要先 `npm run db:init`，再配置 OpenDota/Steam 凭据后执行 `npm run sync:opendota:backfill`。

## 关键约束

- `stages.type` 固定为 `group`、`swiss`、`knockout`，后台和用户端统一识别普通小组赛、瑞士轮、淘汰赛。
- `tournaments.status` 固定为 `draft`、`upcoming`、`running`、`completed`、`archived`；只有 `running` 会进入 10 分钟 OpenDota 自动同步。
- `tournaments.starts_at` 支持管理员为 `upcoming` 赛事手动设置开赛时间，H5 和管理后台都直接展示。
- `teams.opendota_team_id` 不做全局唯一约束；同一支 OpenDota 队伍可以在不同届次拥有各自的本地队伍记录。后端创建和 OpenDota 同步按 `tournament_teams` 在当前届次内优先去重，避免跨届队伍资料和统计串联。
- `series_games.match_id` 全局唯一，避免同一局 OpenDota match 被重复绑定。
- `series_games.conflict_status` 用于标记人工赛果和 OpenDota 赛果冲突；冲突未处理前不推进积分、瑞士轮配对或淘汰赛节点。
- `opendota_matches.raw_json` 暂存原始 OpenDota 返回，后端 normalizer 统一生成比赛详情视图。
- `sync_tasks.kind` 当前支持 `discover_match`、`request_parse`、`refresh_match`、`schedule_link`，对应联赛发现、请求解析、单场刷新和人工赛程关联。
- `tags` 首版只通过 API 开放选手标签；选手标签按 `target_id + normalized_text` 跨届归并，`tournament_id` 记录提交来源届次；`pending_review` 标签需管理员审核为 `approved` 后才向 H5 展示，`tag_likes` 支持小程序登录用户对已通过标签点赞且不进入审核，H5 点击标签只做本地动效；管理员可为测试或运营纠偏直接调整 `like_count`，`tag_audit_logs` 记录审核、隐藏、恢复和点赞数调整动作。
- `tournament_players.current_team_id` 是用户端展示某届选手队伍归属的优先来源；`players.current_team_id` 只代表全局 / 最新归属，不能用于历史届次展示。

## 后续迁移方向

1. 将 `opendota_matches.raw_json` 的高频查询字段拆到结构化表，例如玩家单局统计、技能加点、BP、眼位、聊天。
2. 为瑞士轮增加对手分、轮空记录和重复交手约束表。
3. 为管理员操作增加通用 `audit_logs`，覆盖赛果修改、冲突处理等非标签操作；标签审核首版先使用 `tag_audit_logs`。
4. 上云时将 SQLite migration 转写为 PostgreSQL migration，并加入连接池、备份和只读查询副本策略。
