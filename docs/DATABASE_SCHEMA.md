# 数据库设计草案

最后更新：2026-05-13

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
- 选手：`players`、`team_members`
- 赛制：`stages`、`rounds`、`series`、`series_games`
- 榜单：`standings`、`bracket_nodes`
- OpenDota：`opendota_matches`、`sync_tasks`
- 互动：`app_users`、`tags`、`tag_likes`、`tag_reports`

## 关键约束

- `stages.type` 固定为 `group`、`swiss`、`knockout`，后台和用户端统一识别普通小组赛、瑞士轮、淘汰赛。
- `series_games.match_id` 全局唯一，避免同一局 OpenDota match 被重复绑定。
- `series_games.conflict_status` 用于标记人工赛果和 OpenDota 赛果冲突；冲突未处理前不推进积分、瑞士轮配对或淘汰赛节点。
- `opendota_matches.raw_json` 暂存原始 OpenDota 返回，后端 normalizer 统一生成比赛详情视图。
- `tags` 支持选手和队伍两类目标，`tag_likes` 通过联合主键限制同一用户重复点赞。

## 后续迁移方向

1. 将 `opendota_matches.raw_json` 的高频查询字段拆到结构化表，例如玩家单局统计、技能加点、BP、眼位、聊天。
2. 为瑞士轮增加对手分、轮空记录和重复交手约束表。
3. 为管理员操作增加 `audit_logs`，覆盖赛果修改、冲突处理、标签隐藏和恢复。
4. 上云时将 SQLite migration 转写为 PostgreSQL migration，并加入连接池、备份和只读查询副本策略。
