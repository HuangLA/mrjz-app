# 项目进度追踪

最后更新：2026-05-13

## 当前状态

当前阶段：M1 工程骨架和三端原型启动。

总体判断：M0 文档基线已经完成，M1 已初始化 npm workspace、安装依赖并生成 lockfile。API、Web Admin、H5 已有可构建原型；比赛详情已经落到共享契约和 API normalizer 方向，覆盖技能加点、Ban/Pick、魔晶/神杖、眼位时间轴、经济经验趋势和聊天记录。微信小程序仍是占位入口。

## 里程碑状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| M0 产品和技术定稿 | 已完成 | PRD、技术方案、比赛管理系统、设计方向、开发计划已建立 |
| M1 工程骨架 | 进行中 | npm workspace、依赖、lockfile、API/Admin/H5 原型已建立，小程序待初始化 |
| M2 登录和权限 | 未开始 | 微信登录、管理员登录、RBAC |
| M3 赛事基础与管理后台 | 未开始 | TournamentService、赛事阶段、队伍选手、赛程赛果 |
| M4 OpenDota 自动同步 | 未开始 | league discovery、match sync、parse request |
| M5 用户侧 MVP | 未开始 | 小程序和 H5 核心展示 |
| M6 比赛详情增强 | 未开始 | 长复盘页、图表、Ban/Pick、聊天 |
| M7 上线准备 | 未开始 | 部署、真机、审核、合规 |

## 已完成

- 建立 Git 仓库。
- 完成 PRD、技术方案、Web Admin 方案、H5 方案、开发计划。
- 完成比赛详情参考分析和页面设计方向稿。
- 明确云服务器后端、Web Admin、小程序、H5 四端结构。
- 明确后端自动同步 OpenDota 的职责。
- 明确选手和队伍标签互动能力。
- 明确小组赛、瑞士轮、淘汰赛的比赛管理系统。
- 初始化 monorepo 空骨架。
- 建立 agent 开发规则和项目进度追踪文件。
- 建立 API `/health`、Admin/H5 `index.html`、小程序占位入口和共享类型。
- 建立比赛详情共享契约和 OpenDota 字段映射文档。
- 安装 npm workspace 依赖并生成 `package-lock.json`。
- 建立 API mock 数据仓库、赛事赛程接口和比赛详情 OpenDota normalizer。
- 建立 Web Admin 赛制、赛程、赛果、OpenDota 同步任务管理原型。
- 建立手机 H5 赛事首页、阶段赛程、比赛详情和标签互动原型。

## 最近提交

| Commit | 内容 |
| --- | --- |
| `2a2d2e4` | Build API admin and H5 prototypes |
| `90b659a` | Initialize project workspace |
| `7e53317` | Add tournament management system spec |

## 当前目录状态

```text
apps/
  api/            后端 API 占位
  admin/          Web Admin 占位
  mobile-web/     H5 占位
  miniprogram/    小程序占位
packages/
  shared/         共享类型和常量
docs/
  PROGRESS.md     当前文件，追踪项目状态
```

## 下一步任务

1. 选择数据库迁移方案并创建初始迁移。
2. 将 API mock repository 替换为持久化 repository，并接入配置加载。
3. 实现 `TournamentService` 的领域模型和单元测试。
4. 实现 OpenDota 同步 worker：league 拉取、parse request、异常队列和重试。
5. 初始化小程序 Taro 项目，并复用 H5 的页面信息架构。
6. 将 Web Admin/H5 从原生 DOM 原型升级为正式组件结构。
7. 接入真实 Dota 静态资源：英雄、技能、物品、队伍和选手头像。

## 决策记录

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-05-13 | 后端部署在云服务器，Web Admin 独立管理数据 | 小程序只做展示，后台操作更适合桌面端 |
| 2026-05-13 | H5 与小程序同步建设 | 规避小程序审核延迟，并支持分享落地 |
| 2026-05-13 | 后端自动拉取 OpenDota、请求解析并做异常队列 | 管理员不应手动维护所有 match_id |
| 2026-05-13 | 支持普通小组赛、瑞士轮和单败淘汰赛 | 赛事运营需要多赛制能力 |
| 2026-05-13 | 自动生成对阵先作为草稿 | 管理员必须保留最终确认权 |
| 2026-05-13 | 比赛详情由后端装配 MatchDetailViewModel | H5、小程序、Admin 复用同一字段，避免三端重复解析 OpenDota |
| 2026-05-13 | 本地包管理统一为 npm workspace | 当前机器可直接安装运行 npm，避免 pnpm 未安装造成 M1 阻塞 |

## 风险和阻塞

| 风险 | 当前状态 | 应对 |
| --- | --- | --- |
| OpenDota 数据不完整 | 未验证 | M4 用真实 match_id 做种子测试 |
| 瑞士轮配对规则复杂 | 已识别 | MVP 采用可解释的同分优先配对，复杂 Buchholz 后置 |
| 小程序上线延迟 | 已识别 | H5 同步实现公开浏览 |
| 前端页面密度不符合预期 | 进行中 | 设计稿已降字号，后续继续按真实 App 调整 |
| 小程序尚未初始化 | 已识别 | M1 后段使用 Taro 初始化，并复用 H5 页面契约 |
| 比赛详情静态资源缺失 | 已识别 | M2/M3 接入英雄、技能、物品图标映射和 CDN 策略 |

## 更新规则

- 每完成一个 milestone 或关键 issue，更新“已完成”和“最近提交”。
- 每产生重要产品或技术决策，更新“决策记录”。
- 每发现阻塞或风险变化，更新“风险和阻塞”。
- 保持这个文件短而可扫，不记录低价值流水账。
