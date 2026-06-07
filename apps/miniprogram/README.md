# Mini Program

WeChat mini program display client built with Taro + React + TypeScript.

## Pages

- Home tournament entry.
- Tournament stage overview with backend standings, rounds, and bracket nodes.
- Published schedule.
- Match records and match detail.
- Player directory and player profile.
- Team directory and team profile.
- My page for login state and local API base URL.
- Player tag submission and real tag like/unlike interactions.

## Development

```sh
npm --workspace @mrjz/miniprogram run dev
npm --workspace @mrjz/miniprogram run build
npm --workspace @mrjz/miniprogram run typecheck
```

Open `apps/miniprogram/project.config.json` in WeChat DevTools. The local default API base is `http://127.0.0.1:3001/api`; it can be changed on the My page for device testing.

## Auth Notes

The mini program calls `POST /api/auth/wechat-login`. When `WECHAT_APP_ID` and `WECHAT_APP_SECRET` are configured, the API resolves the code through WeChat `code2Session`. Without those secrets, the API creates or reuses a local development user, which is enough to test tag submission and tag like/unlike against the SQLite backend.
