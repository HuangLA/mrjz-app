# Mini Program

WeChat mini program display client built with Taro + React + TypeScript.

## Pages

- Home tournament entry.
- Tournament stage overview with backend standings, rounds, and bracket nodes.
- Published schedule.
- Match records and match detail.
- Player directory and player profile.
- Team directory and team profile.
- My page for login state, Dota / Steam account binding, MRJZ match data, and local API base URL.
- Player tag submission and real tag like/unlike interactions.

## Development

```sh
npm --workspace @mrjz/miniprogram run dev
npm --workspace @mrjz/miniprogram run dev:local
MRJZ_REMOTE_API_BASE_URL=https://api.example.com/api npm --workspace @mrjz/miniprogram run dev:remote
npm --workspace @mrjz/miniprogram run build
npm --workspace @mrjz/miniprogram run build:remote
npm --workspace @mrjz/miniprogram run typecheck
```

Open `apps/miniprogram/project.config.json` in WeChat DevTools. The local default API base is `http://127.0.0.1:3001/api`.

API base priority:

1. My page saved API base URL, useful for device testing without rebuilding.
2. Build-time `MRJZ_MINIPROGRAM_API_BASE_URL`.
3. Build-time `PUBLIC_API_BASE_URL` or `VITE_PUBLIC_API_BASE_URL`.
4. Local fallback `http://127.0.0.1:3001/api`.

For remote preview or upload, set `MRJZ_REMOTE_API_BASE_URL` and use `dev:remote` or `build:remote`. Remote builds set `MRJZ_DEPLOY_ENV=production`, hide local development controls, and require the backend to complete real WeChat `code2Session`. The URL must be configured as a WeChat Mini Program request legal domain when running on real devices.

## Auth Notes

The mini program calls `POST /api/auth/wechat-login`. When `WECHAT_APP_ID` and `WECHAT_APP_SECRET` are configured, the API resolves the code through WeChat `code2Session`. Without those secrets, the API creates or reuses a local development user, which is enough to test tag submission and tag like/unlike against the SQLite backend.

For local HTTP testing, run the API locally, use `dev:local`, and keep WeChat DevTools `urlCheck` disabled in `project.config.json`. In the My page, set the API base to `http://127.0.0.1:3001/api` for the simulator or to your computer LAN IP for device debugging. The same My page also has a development user ID field; changing it lets you simulate different logged-in users for like de-duplication and Steam binding tests without HTTPS.

The returned token is an opaque MRJZ user session, not the user id. Authenticated requests use `Authorization: Bearer <token>`. The My page can bind a Dota `account_id` or SteamID64 through `POST /api/me/player-binding`; binding succeeds even when that account has no MRJZ match records yet, and `GET /api/me/stats` returns a stable empty state until future tournament data is synced.
