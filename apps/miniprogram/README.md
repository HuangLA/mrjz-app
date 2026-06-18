# Mini Program

WeChat mini program display client built with Taro + React + TypeScript.

## Pages

- Home tournament entry.
- Tournament stage overview with backend standings, rounds, and bracket nodes.
- Published schedule.
- Match records and match detail.
- Player directory and player profile.
- Team directory and team profile.
- My page for login state, Dota / Steam account binding, and MRJZ match data.
- Player tag submission and real tag like/unlike interactions.

## Development

```sh
npm --workspace @mrjz/miniprogram run dev
npm --workspace @mrjz/miniprogram run dev:local
npm --workspace @mrjz/miniprogram run dev:remote
npm --workspace @mrjz/miniprogram run build
npm --workspace @mrjz/miniprogram run build:remote
npm --workspace @mrjz/miniprogram run typecheck
```

Open `apps/miniprogram/project.config.json` in WeChat DevTools. Every build must inject the API base at build time.

API base priority:

1. Build-time `MRJZ_MINIPROGRAM_API_BASE_URL`.
2. Build-time `PUBLIC_API_BASE_URL` or `VITE_PUBLIC_API_BASE_URL`.

Default `dev` and `build` use the local API at `http://127.0.0.1:3001/api`; `dev:local`, `build:local`, and the local asset variants inject the same address explicitly. For remote preview or upload, `dev:remote` and `build:remote` default to the cloud API, or can be overridden with `MRJZ_REMOTE_API_BASE_URL`. The URL must be configured as a WeChat Mini Program request legal domain when running on real devices. The mini program does not expose runtime API switching controls.

## Auth Notes

The mini program calls `POST /api/auth/wechat-login` with a real `wx.login` code. Release, preview, and production API services must configure `WECHAT_APP_ID` and `WECHAT_APP_SECRET` so the API resolves the code through WeChat `code2Session`. The mini program does not send development user IDs or local fake login codes.

The returned token is an opaque MRJZ user session, not the user id. Authenticated requests use `Authorization: Bearer <token>`. The My page can bind a Dota `account_id` or SteamID64 through `POST /api/me/player-binding`; binding succeeds even when that account has no MRJZ match records yet, and `GET /api/me/stats` returns a stable empty state until future tournament data is synced.
