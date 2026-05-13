# 技术方案

最后更新：2026-05-13

## 1. 技术选型

### 1.1 小程序前端

建议使用：

- 小程序框架：Taro + React + TypeScript
- UI 基础：TDesign Mini Program 或 NutUI for Taro
- 状态管理：Zustand 或 Taro 内置状态加 React Query 思路
- 图表：ECharts 微信小程序版
- 构建目标：微信小程序，专注用户侧展示

原因：

- 现有网页端是 React 技术栈，Taro 能复用 React 组件组织思路。
- 比赛详情页复杂，TypeScript 能降低字段映射错误。
- ECharts 更适合经济曲线、经验曲线、横向对比条。

### 1.2 Web Admin 前端

建议使用：

- 框架：React + TypeScript + Vite
- UI 基础：Ant Design
- 数据请求：TanStack Query + Axios
- 路由：React Router
- 表单：Ant Design Form，复杂场景可补充 React Hook Form

原因：

- 管理端以表格、筛选、表单、批量操作为主，Ant Design 的效率高。
- 管理端运行在电脑浏览器，适合承载赛程、队伍、选手、赛果、同步任务等复杂操作。
- 可以复用现有网页端项目的 React 经验，但不强行复用用户侧 UI。

### 1.3 后端

建议使用：

- Runtime：Node.js 22 LTS
- 框架：Express + TypeScript
- ORM：Sequelize
- 数据库：MySQL 8.0 或 MariaDB
- 缓存和队列：Redis + BullMQ，MVP 可先用数据库任务表
- 鉴权：微信登录 + 服务端自定义 token，管理员接口 RBAC

原因：

- 参考项目已经使用 Node.js + Express + Sequelize + MySQL，比赛、选手、成就、同步服务都能较平滑迁移。
- Sequelize 与现有表结构和迁移文件更接近。
- Redis 用于 token、同步队列、OpenDota 限流和热点详情缓存。

### 1.4 仓库结构

```text
mrjz-app/
  apps/
    miniprogram/          # Taro 微信小程序
    admin/                # React Web Admin
    api/                  # Express API 服务
  packages/
    shared/               # 共享类型、常量、字段枚举
  database/
    migrations/
    seeds/
  docs/
  README.md
```

当前仓库先创建文档，代码骨架在开发第一阶段落地。

## 2. 总体架构

```mermaid
flowchart TD
  A["微信小程序"] --> B["API Gateway / Express"]
  W["Web Admin"] --> B
  B --> C["Auth 模块"]
  B --> D["赛事业务模块"]
  B --> E["比赛数据模块"]
  B --> F["管理员模块"]
  C --> G["微信 code2Session"]
  D --> H["MySQL"]
  E --> H
  F --> H
  E --> I["OpenDota API"]
  E --> J["同步任务队列"]
  J --> I
  J --> H
  B --> K["Redis 缓存"]
```

核心原则：

- 小程序不直接请求 OpenDota，统一通过后端代理和缓存。
- Web Admin 是唯一推荐的数据维护入口，小程序端只展示公开数据和个人数据。
- 后端保存原始 OpenDota JSON，结构化字段用于列表、详情和统计。
- 管理员维护赛程和人工赛果，OpenDota 补全赛后详细数据。
- 用户个人数据按平台联赛范围聚合，禁止直接返回全局战绩。

## 3. OpenDota 集成

OpenDota 当前 OpenAPI 版本查询为 `31.1.0`。关键端点：

| 场景 | OpenDota 端点 | 说明 |
| --- | --- | --- |
| 获取比赛详情 | `GET /matches/{match_id}` | 核心详情数据 |
| 请求解析比赛 | `POST /request/{match_id}` | 解析请求计入更高 rate cost |
| 查询解析任务 | `GET /request/{jobId}` | 查看解析状态 |
| 联赛比赛 ID | `GET /leagues/{league_id}/matchIds` | 包含业余联赛，优先使用 |
| 联赛比赛数据 | `GET /leagues/{league_id}/matches` | OpenAPI 标注不含业余联赛，谨慎使用 |
| 英雄常量 | `GET /constants/{resource}` | heroes、items、abilities 等 |
| 英雄统计 | `GET /heroStats` | 可做补充，不作为 MVP 核心 |

### 3.1 同步策略

1. 按赛季配置 `league_id`。
2. 同步入口优先调用 `/leagues/{league_id}/matchIds`。
3. 对新 match_id 逐个调用 `/matches/{match_id}`。
4. 如果 `version`、`objectives`、`picks_bans`、`players.gold_t` 等高级字段缺失，则标记 `parse_status = not_parsed`。
5. 管理员可手动请求解析，后端调用 `POST /request/{match_id}`。
6. 后续任务轮询 `/matches/{match_id}` 或 `/request/{jobId}` 更新状态。
7. 所有 OpenDota 响应写入 `raw_match_json`，避免字段遗漏导致返工。

### 3.2 限流和缓存

- 普通详情读取优先读本地数据库。
- 外部请求必须经过队列，避免并发打爆 OpenDota。
- 同步任务默认串行或小并发，失败指数退避。
- 对常量资源做长缓存，英雄和物品版本变更时手动刷新。

## 4. 登录与权限

### 4.1 小程序登录

```mermaid
sequenceDiagram
  participant MP as 小程序
  participant API as 后端 API
  participant WX as 微信服务端
  participant DB as 数据库

  MP->>MP: wx.login 获取 code
  MP->>API: POST /auth/wechat-login { code }
  API->>WX: code2Session
  WX-->>API: openid, session_key, unionid
  API->>DB: upsert user
  API-->>MP: token, user, roles
  MP->>API: 携带 token 请求业务接口
```

### 4.2 Web Admin 登录

MVP 使用管理员账号密码登录，由超级管理员在数据库中创建管理员账号。后续可增加微信扫码登录、邮箱验证码或二次验证。

```mermaid
sequenceDiagram
  participant Admin as 管理员浏览器
  participant API as 后端 API
  participant DB as 数据库

  Admin->>API: POST /api/admin/auth/login { username, password }
  API->>DB: 校验密码哈希和角色
  API-->>Admin: adminToken, profile, permissions
  Admin->>API: 携带 adminToken 请求 /api/admin/*
```

安全要求：

- `session_key` 只保存在服务端，不返回给小程序。
- token 可用 JWT 或 opaque session token，推荐服务端可撤销 token。
- 管理员角色存数据库，接口层统一校验，不能依赖前端隐藏菜单。
- Web Admin token 与小程序 token 分开管理，便于设置更短有效期和更严格权限。
- 绑定 Dota 账号需要审核或白名单，防止冒领选手数据。

角色枚举：

- `guest`
- `user`
- `player`
- `team_admin`
- `tournament_admin`
- `super_admin`

## 5. 数据模型

### 5.1 用户与权限

| 表 | 关键字段 |
| --- | --- |
| `users` | id, openid, unionid, nickname, avatar_url, status, last_login_at |
| `admin_users` | id, username, password_hash, display_name, status, last_login_at |
| `user_roles` | user_id, role, scope_type, scope_id |
| `admin_roles` | admin_user_id, role, scope_type, scope_id |
| `player_bindings` | user_id, player_id, dota_account_id, status, reviewed_by, reviewed_at |
| `admin_audit_logs` | actor_user_id, action, resource_type, resource_id, before_json, after_json |

### 5.2 赛事域

| 表 | 关键字段 |
| --- | --- |
| `seasons` | id, name, edition_number, start_date, end_date, is_active |
| `leagues` | id, season_id, opendota_league_id, name, status |
| `teams` | id, season_id, name, short_name, logo_url, color |
| `team_members` | team_id, player_id, role, joined_at, left_at |
| `players` | id, dota_account_id, steam_id64, display_name, avatar_url |

### 5.3 赛程和赛果

| 表 | 关键字段 |
| --- | --- |
| `series` | id, season_id, league_id, radiant_team_id, dire_team_id, bo_type, stage, scheduled_at, status |
| `series_games` | id, series_id, game_index, match_id, radiant_score, dire_score, winner_team_id, manual_result_status |
| `schedule_notes` | series_id, note, visible_to_public, created_by |

说明：

- `series` 表达一轮 BO1、BO2、BO3。
- `series_games` 表达单局 Dota match。
- 人工赛果和 OpenDota 赛果都保留，冲突时显示“待管理员确认”。

### 5.4 比赛数据

| 表 | 关键字段 |
| --- | --- |
| `matches` | match_id, league_id, series_game_id, start_time, duration, radiant_win, radiant_score, dire_score, game_mode, parse_status, raw_match_json |
| `match_players` | match_id, player_id, dota_account_id, hero_id, team, level, kills, deaths, assists, gpm, xpm, net_worth, last_hits, denies, hero_damage, tower_damage, hero_healing, damage_taken |
| `match_player_items` | match_id, player_id, slot_type, slot_index, item_id |
| `match_player_abilities` | match_id, player_id, ability_id, level, time |
| `match_drafts` | match_id, order, team, action, hero_id, player_id |
| `match_time_series` | match_id, player_id, metric, values_json |
| `match_objectives` | match_id, time, type, team, player_slot, key, raw_json |
| `match_chat` | match_id, time, team, player_id, message |

### 5.5 同步任务

| 表 | 关键字段 |
| --- | --- |
| `sync_jobs` | id, type, scope, status, progress_current, progress_total, error_message, started_at, finished_at |
| `opendota_requests` | id, endpoint, params_json, status_code, cost, error_message, requested_at |

### 5.6 社区互动标签

| 表 | 关键字段 |
| --- | --- |
| `social_tags` | id, target_type, target_id, normalized_text, display_text, created_by_user_id, like_count, status, hidden_reason, created_at, updated_at |
| `social_tag_likes` | id, tag_id, user_id, created_at |
| `social_tag_reports` | id, tag_id, user_id, reason, status, created_at |

设计规则：

- `target_type` 取值为 `player` 或 `team`。
- `normalized_text` 用于去重，建议统一 trim、全角半角归一、大小写归一。
- 同一 `target_type + target_id + normalized_text` 只能存在一条可见标签。
- 同一 `tag_id + user_id` 只能点赞一次，取消点赞删除或软删除点赞记录。
- `like_count` 作为冗余计数字段，点赞/取消点赞时事务更新。
- `status` 取值建议为 `active`、`hidden`、`pending_review`。
- 标签展示大小由后端或前端根据 `like_count` 计算，建议限制在 12 到 28px。

## 6. API 设计

统一响应：

```json
{
  "success": true,
  "data": {},
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "没有权限"
  }
}
```

### 6.1 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/wechat-login` | 微信 code 登录 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/me` | 当前用户 |
| POST | `/api/me/player-binding` | 申请绑定 Dota 账号 |
| GET | `/api/me/stats` | 我的本联赛数据 |

### 6.2 Web Admin 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | 管理员账号密码登录 |
| POST | `/api/admin/auth/logout` | 管理员退出 |
| GET | `/api/admin/auth/me` | 当前管理员资料和权限 |
| PATCH | `/api/admin/auth/password` | 修改管理员密码 |

### 6.3 公开赛事

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/seasons` | 赛季列表 |
| GET | `/api/leagues` | 联赛列表 |
| GET | `/api/schedules` | 赛程列表 |
| GET | `/api/schedules/:id` | 赛程详情 |
| GET | `/api/matches` | 比赛记录列表 |
| GET | `/api/matches/:matchId` | 比赛详情 |
| GET | `/api/players` | 选手列表 |
| GET | `/api/players/:id` | 选手详情，限定联赛数据 |
| GET | `/api/players/:id/tags` | 获取选手标签云 |
| POST | `/api/players/:id/tags` | 登录用户给选手添加标签 |
| GET | `/api/teams` | 队伍列表 |
| GET | `/api/teams/:id` | 队伍详情 |
| GET | `/api/teams/:id/tags` | 获取队伍标签云 |
| POST | `/api/teams/:id/tags` | 登录用户给队伍添加标签 |
| POST | `/api/tags/:tagId/like` | 登录用户点赞标签 |
| DELETE | `/api/tags/:tagId/like` | 登录用户取消点赞 |

### 6.4 互动标签接口规则

添加标签请求：

```json
{
  "text": "绝活哥"
}
```

标签响应：

```json
{
  "id": 1,
  "targetType": "player",
  "targetId": 123,
  "text": "绝活哥",
  "likeCount": 18,
  "likedByMe": true,
  "sizeLevel": 4
}
```

规则：

- 只有登录用户可以添加标签和点赞。
- 标签长度建议限制为 2 到 8 个中文字符或 2 到 16 个英文字符。
- 单用户对同一目标添加标签需要频控，例如每分钟最多 3 个、每天最多 30 个。
- 重复标签不新建，直接返回已有标签；如果用户意图表达认可，前端引导点赞。
- `sizeLevel` 可按点赞数分为 1 到 5 档，前端用档位控制字号和视觉权重。
- 被隐藏或待审核标签不向普通用户展示。

### 6.5 管理端 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/admin/seasons` | 创建赛季 |
| PATCH | `/api/admin/seasons/:id` | 修改赛季 |
| POST | `/api/admin/teams` | 创建队伍 |
| PATCH | `/api/admin/teams/:id` | 修改队伍 |
| POST | `/api/admin/players` | 创建选手 |
| PATCH | `/api/admin/players/:id` | 修改选手 |
| POST | `/api/admin/schedules` | 创建赛程 |
| PATCH | `/api/admin/schedules/:id` | 修改赛程 |
| POST | `/api/admin/series-games/:id/result` | 录入单局结果 |
| POST | `/api/admin/matches/:matchId/sync` | 同步单场比赛 |
| POST | `/api/admin/leagues/:leagueId/sync` | 同步联赛比赛 |
| POST | `/api/admin/matches/:matchId/request-parse` | 请求 OpenDota 解析 |
| GET | `/api/admin/tags` | 标签列表与审核筛选 |
| PATCH | `/api/admin/tags/:tagId` | 隐藏、恢复或修改标签状态 |
| GET | `/api/admin/sync-jobs` | 同步任务列表 |
| GET | `/api/admin/audit-logs` | 审计日志 |

## 7. 比赛详情数据装配

后端推荐提供聚合接口 `GET /api/matches/:matchId`，避免小程序多次请求。

返回结构：

```json
{
  "match": {},
  "series": {},
  "teams": {
    "radiant": {},
    "dire": {}
  },
  "players": {
    "radiant": [],
    "dire": []
  },
  "drafts": [],
  "charts": {
    "playerGold": [],
    "goldAdvantage": [],
    "xpAdvantage": []
  },
  "lanes": [],
  "comparisons": [],
  "chat": [],
  "parseStatus": "parsed"
}
```

字段降级：

- 没有 `picks_bans`：隐藏 Ban/Pick 或显示“待解析”。
- 没有 `gold_t`、`xp_t`：隐藏趋势图。
- 没有 `chat`：显示空状态。
- 没有队伍名：使用手动维护队伍名，或降级为 Radiant/Dire。

## 8. 从现有网页端复用的内容

可复用思路：

- `matches`、`players`、`match_players`、`heroes`、`achievements`、`sync_logs` 的基础模型。
- OpenDota match detail 字段适配逻辑。
- account_id 到 steam_id64 的转换逻辑。
- 英雄和物品资源映射。
- 成就检测逻辑，可作为后续增强模块。
- 比赛详情页的数据分组：双方队伍表、装备、加点、经济指标。

需要调整：

- 比赛列表和详情必须按小程序交互重做。
- 用户体系从网页匿名访问升级为小程序微信登录、Web Admin 管理员登录和 RBAC。
- 赛程和赛果从 OpenDota 数据外扩展为平台手动维护。
- OpenDota 联赛同步优先使用 `/leagues/{league_id}/matchIds`，以兼容业余联赛。

## 9. 部署方案

MVP 推荐：

- 云服务器：一台 2C4G 起步的 Linux 云服务器即可支撑 MVP，后续按访问量拆分。
- Nginx：负责 HTTPS、静态资源、API 反向代理。
- API：Node.js 服务部署在云服务器或容器中，域名需配置到微信小程序 request 合法域名。
- Web Admin：Vite 构建后作为静态站点部署到 Nginx，建议使用独立子域名。
- DB：MySQL 8.0，MVP 可同机部署，正式期建议独立云数据库或至少每日备份。
- Redis：可选，若同步任务量不大可第二阶段加入；使用 BullMQ 时建议启用。
- 对象存储：队伍 Logo、静态图片、后续分享海报。
- 日志：文件日志 + 错误告警，后续接 Sentry 或类似服务。

域名建议：

```text
api.example.com      # 小程序和 Web Admin 共用 API
admin.example.com    # 管理后台
```

Nginx 路由建议：

```text
admin.example.com       -> apps/admin/dist
api.example.com/api/*   -> Node.js API
```

服务器进程：

- `api`：Express API。
- `worker`：OpenDota 同步任务 worker，可与 API 同代码不同进程。
- `mysql`：MVP 可本机运行，需开启自动备份。
- `redis`：可选，启用队列时运行。

环境：

- `development`
- `staging`
- `production`

关键环境变量：

```text
NODE_ENV=
PORT=
MYSQL_HOST=
MYSQL_PORT=
MYSQL_DATABASE=
MYSQL_USER=
MYSQL_PASSWORD=
REDIS_URL=
WECHAT_APP_ID=
WECHAT_APP_SECRET=
OPENDOTA_API_KEY=
TOKEN_SECRET=
ADMIN_TOKEN_SECRET=
DEFAULT_LEAGUE_ID=
```

## 10. 测试策略

后端：

- 单元测试：字段转换、权限判断、聚合统计。
- 集成测试：登录、赛程 CRUD、赛果录入、比赛详情读取。
- 同步测试：mock OpenDota 响应，覆盖 parsed 和 not_parsed。

小程序：

- 页面快照和手工验收。
- 关键机型：iPhone 小屏、iPhone Pro、常见 Android。
- 微信开发者工具真机预览。

Web Admin：

- 表单校验测试：赛程、赛果、选手、队伍。
- 权限测试：不同管理员角色只能访问授权范围。
- 浏览器测试：Chrome、Safari、Edge。

数据：

- 使用 2 到 3 场真实 match_id 做种子数据。
- 准备一场未解析比赛验证降级展示。

## 11. 技术风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| OpenDota 解析不稳定 | 高级复盘缺字段 | 保留基础详情和待解析状态 |
| 业余联赛接口差异 | 联赛比赛拉取不全 | 使用 `/matchIds`，支持手动补录 match_id |
| 微信审核与域名配置 | 上线延迟 | 提前准备 HTTPS 域名和隐私说明 |
| 账号冒领 | 个人数据错误 | 绑定审核和管理员白名单 |
| Web Admin 暴露在公网 | 数据被误改或攻击 | 强密码、限流、审计日志、HTTPS、后续二次验证 |
| 比赛详情页过长 | 加载慢 | 分段渲染，图表懒加载，缓存聚合结果 |

## 12. 参考来源

- 现有网页端项目：[HuangLA/mrjz-dota2-tournament-stats](https://github.com/HuangLA/mrjz-dota2-tournament-stats)
- OpenDota OpenAPI：[https://api.opendota.com/api](https://api.opendota.com/api)
- OpenDota 文档入口：[https://docs.opendota.com/](https://docs.opendota.com/)
- 微信小程序登录：[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- 微信 code2Session：[auth.code2Session](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html)
