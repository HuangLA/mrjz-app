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

Default `dev` and `build` use the cloud API at `https://api.dota2mrjz.icu/api`; `dev:remote` and `build:remote` inject the same address, or can be overridden with `MRJZ_REMOTE_API_BASE_URL`. Local API debugging is still available through `dev:local`, `build:local`, and the local asset variants. The API domain must be configured as a WeChat Mini Program request legal domain, and because Dota image assets are loaded from the same API origin, it should also be configured as a downloadFile legal domain for real-device preview, trial, and release builds. The mini program does not expose runtime API switching controls.

## Auth Notes

The mini program calls `POST /api/auth/wechat-login` with a real `wx.login` code. Release, preview, and production API services must configure `WECHAT_APP_ID` and `WECHAT_APP_SECRET` so the API resolves the code through WeChat `code2Session`. The mini program does not send development user IDs or local fake login codes.

The returned token is an opaque MRJZ user session, not the user id. Authenticated requests use `Authorization: Bearer <token>`. The My page can bind a Dota `account_id` or SteamID64 through `POST /api/me/player-binding`; binding succeeds even when that account has no MRJZ match records yet, and `GET /api/me/stats` returns a stable empty state until future tournament data is synced.

## UI themes

The MRJZ mark in the top-left corner of the home page switches between the original dark theme and the Island theme. The selection is stored in mini-program storage and is reused by the main tabs and detail pages.

The Island theme adapts the sea footer and selected animal item illustrations from [`animal-island-ui`](https://github.com/guokaigdg/animal-island-ui) under its [CC BY-NC 4.0 license](https://github.com/guokaigdg/animal-island-ui/blob/main/LICENSE). MRJZ is a non-commercial community project. The mini program keeps its Taro-native component and layout structure; upstream assets are resized and placed in new page compositions rather than copying the demo site.
