# MRJZ Dota 2 社区赛平台

这是一个面向 Dota 2 社区联赛的赛事数据平台项目起点。当前规划为云服务器后端、网页管理后台、微信小程序展示端、手机网页 H5 展示端四部分。

## 项目目标

为“每日节奏”类 Dota 2 社区赛提供移动端展示入口，让普通观众通过小程序或手机网页查看赛程和比赛记录，让参赛选手登录后查看自己在本联赛内的比赛数据。管理员通过独立网页后台维护赛程、赛果、队伍、选手和数据同步状态。

比赛数据来源以 OpenDota 为主，赛程和人工赛果由管理员维护。所有选手个人数据必须限定在本项目配置的联赛、赛季和赛事范围内，不做泛 Dota 账号数据查询。小程序和手机网页端原则上只承载用户侧展示和必要互动，不承载复杂管理操作。

平台后端需要内置比赛管理系统，统一支持普通小组赛、瑞士轮和淘汰赛。Web Admin 负责配置赛事和阶段、生成或维护对阵、确认赛果和处理异常；小程序与 H5 通过统一 API 展示不同赛制下的赛程、积分榜、轮次和淘汰赛 bracket。

## 文档索引

- [产品需求文档](./docs/PRD.md)
- [技术方案](./docs/TECHNICAL_DESIGN.md)
- [比赛管理系统方案](./docs/TOURNAMENT_MANAGEMENT_SPEC.md)
- [Web 管理后台方案](./docs/ADMIN_WEB_SPEC.md)
- [手机网页端方案](./docs/MOBILE_WEB_SPEC.md)
- [比赛详情页参考分析](./docs/MATCH_DETAIL_REFERENCE.md)
- [开发计划](./docs/DEVELOPMENT_PLAN.md)

## 参考来源

- 现有网页端项目：[HuangLA/mrjz-dota2-tournament-stats](https://github.com/HuangLA/mrjz-dota2-tournament-stats)
- OpenDota OpenAPI：[https://api.opendota.com/api](https://api.opendota.com/api)
- OpenDota 文档入口：[https://docs.opendota.com/](https://docs.opendota.com/)
- 微信小程序登录能力：[小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- 微信 code2Session：[auth.code2Session](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html)
