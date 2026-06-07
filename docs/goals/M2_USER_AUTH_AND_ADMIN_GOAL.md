# M2 User Auth And Admin Goal

状态：已固化，第一版已执行

最后更新：2026-06-07

## 目标

完成 MRJZ 自有用户体系、微信小程序登录、Dota/Steam 账号绑定、Admin 登录保护和基础权限隔离。

小程序允许普通用户登录并使用大部分功能。用户即使没有参赛记录，也可以先绑定 Dota/Steam 数字账号；未来该账号出现在 MRJZ 联赛比赛中后，个人数据自动展示。Admin 端必须改为登录后使用，任何未授权用户不能访问后台管理能力。

## 执行约束

- 后续实现此目标时，以本文件为执行边界和验收依据。
- 不要把普通用户是否参赛作为小程序登录或使用大部分功能的前置条件。
- 不要把微信 `openid` 当作业务主键暴露到业务表中；业务表统一使用 MRJZ 自有 `user_id`。
- 不要让小程序用户 token 调用 Admin API。
- 不要只靠前端隐藏 Admin 页面或按钮来做权限保护；Admin API 必须后端鉴权。
- 不要在本目标内扩展支付、报名、论坛、H5 登录互动或完整队伍管理员工作流。

## 身份模型

MRJZ 需要区分四类身份：

```text
微信身份
  openid / unionid
  只用于确认微信用户来源

平台用户
  app_users.id
  小程序普通用户、观众、潜在参赛用户

Dota 玩家身份
  players.id
  由 dota_account_id / steam_id64 代表，可以没有任何比赛记录

Admin 用户
  admin_users.id
  只用于后台管理端
```

## 账号绑定模型

用户可以绑定尚未参赛的 Dota/Steam 数字账号。绑定成功不代表已经是已认证参赛选手。

推荐拆成两层状态：

```text
binding_status:
- active
- revoked

verification_status:
- unverified
- pending_review
- verified
- rejected
```

绑定流程：

```text
用户微信登录
  -> 输入 Dota account_id 或 SteamID64
  -> 后端统一转换成 dota_account_id
  -> 如果 players 表没有该账号，创建空 player 档案
  -> 建立 user 与 player/account 的绑定
  -> 当前无比赛数据也允许绑定成功
  -> 未来比赛同步命中该 account_id
  -> 我的页面自动展示比赛结果
```

## 权限边界

| 功能 | guest | user | bound user | verified player | admin |
| --- | --- | --- | --- | --- | --- |
| 看赛事 / 赛程 / 战报 | 可以 | 可以 | 可以 | 可以 | 可以 |
| 看选手 / 队伍主页 | 可以 | 可以 | 可以 | 可以 | 可以 |
| 提交选手标签 | 不可以 | 可以 | 可以 | 可以 | 可以 |
| 点赞标签 | 不可以 | 可以 | 可以 | 可以 | 可以 |
| 绑定 Dota/Steam 账号 | 不可以 | 可以 | 已绑定 | 已认证 | 不适用 |
| 查看我的比赛数据 | 不可以 | 显示绑定入口 | 可看，可能为空 | 可看 | 不适用 |
| 进入 Admin | 不可以 | 不可以 | 不可以 | 不可以 | 可以 |
| 管理赛程 / 标签审核 / 赛果 | 不可以 | 不可以 | 不可以 | 不可以 | 可以 |

## 后端范围

需要补齐或改造：

- `app_users`
- `user_sessions`
- `players`
- `user_dota_accounts` 或 `player_bindings`
- `admin_users`
- `admin_sessions`
- `admin_roles`
- `admin_audit_logs`

认证接口：

- `POST /api/auth/wechat-login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/me/player-binding`
- `GET /api/me/stats`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`

后端必须保证：

- 生产环境 token 不能继续直接使用 `user.id`。
- 小程序 session 和 Admin session 分离。
- 所有 `/api/admin/*` 写接口校验 admin token。
- Admin 登录、登出和关键写操作写入审计日志。
- OpenDota 同步或手动绑定比赛时，按 `dota_account_id` 归并到已有 `players` 档案。

## 小程序范围

需要完成：

- 微信登录。
- 我的页展示登录状态。
- 支持绑定 Dota `account_id` 或 SteamID64。
- 未绑定用户仍可浏览赛事、战报、选手和队伍。
- 已登录普通用户可提交选手标签、点赞标签。
- 已绑定但暂无比赛数据时，显示稳定空状态：暂无 MRJZ 联赛比赛记录，未来参赛后自动展示。
- 已绑定且已有比赛数据时，“我的”页显示该账号在 MRJZ 联赛内的数据。

## Admin 范围

需要完成：

- 新增 Admin 登录页。
- 登录成功后保存 admin token。
- token 无效、过期或撤销时回到登录页。
- Admin API 使用 `Authorization: Bearer <admin_token>`。
- 普通小程序 token 调用 Admin API 必须失败。
- 初始超级管理员只能通过安全 bootstrap 创建，不能开放注册。

## 验收标准

1. 未登录用户可以浏览公开赛事数据。
2. 微信登录后创建或复用 MRJZ `app_user`。
3. 生产环境 token 不再直接使用 `user.id`。
4. 小程序用户 session 和 Admin session 分离。
5. 普通登录用户可以提交标签、点赞标签。
6. 普通登录用户可以绑定尚未参赛的 Dota/Steam 数字账号。
7. 绑定账号如果没有比赛数据，“我的”页不报错，显示空状态。
8. 未来该账号出现在 MRJZ 比赛数据中，可自动归并到已绑定 player。
9. Admin 未登录不能进入后台。
10. 所有 `/api/admin/*` 写接口无 admin token 返回 `401`。
11. 普通小程序 token 调 Admin API 返回 `401` 或 `403`。
12. 初始超级管理员只能通过安全 bootstrap 创建，不能开放注册。
13. Admin 登录、登出、关键写操作记录审计日志。
14. 更新 `docs/PROGRESS.md` 和相关技术文档。

## 建议实施顺序

1. 数据库 migration：sessions、bindings、admin users。
2. 后端认证：小程序 session token、Admin session token。
3. Admin 登录页和 API 鉴权。
4. 小程序我的页：登录、绑定、空状态。
5. 绑定 Dota account_id / SteamID64，并允许创建空 player。
6. OpenDota 同步归并逻辑校准：按 account_id 归并到已有 player。
7. 标签接口改为正式 session 鉴权。
8. 测试、文档、进度更新。

## 完成定义

普通观众能登录并互动，未参赛用户能绑定账号并等待未来数据，Admin 端被真正保护起来，用户身份、Dota 玩家身份、参赛身份和管理员身份被后端清楚地区分。
