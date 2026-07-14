# Mobile Web

Mobile H5 public tournament browsing surface.

Current pages:

- Home with real seeded leagues, lifecycle state, next schedule, and latest real match.
- Tournament stage overview for group, Swiss, and knockout stages.
- Schedule list with manual admin-entered series and match links.
- Match record archive backed by `/api/tournaments/:id/matches`.
- Match detail backed by `/api/matches/:matchId`, including players, ability order, items, Aghanim state, Ban/Pick, ward timeline, trends, and chat.
- Player/team tag cloud preview.

Run locally:

```bash
npm run dev:mobile-web
npm run dev:mobile-web:local
npm run dev:mobile-web:remote
```

Build for a known API:

```bash
npm run build:mobile-web:local
npm run build:mobile-web:remote
```

API base priority:

1. Runtime override in the browser: open `?apiBaseUrl=https://api.example.com/api` to save a temporary override, `?apiBaseUrl=local` to switch to local, or `?apiBaseUrl=reset` to remove the override.
2. Build-time `PUBLIC_API_BASE_URL` or `VITE_PUBLIC_API_BASE_URL`.
3. Same-origin fallback `/api`, which is expected to be reverse-proxied by Nginx in production.

Default dev/build scripts use `http://127.0.0.1:3001/api`; the root `dev:mobile-web` script follows the same local default. `dev:mobile-web:remote` proxies local `/api` requests to `https://api.dota2mrjz.icu/api` so cloud data can be previewed without local CORS access, and its proxy target can be overridden with `MRJZ_REMOTE_API_BASE_URL`. `build:mobile-web:remote` keeps `/api` as the production base so Nginx can use the existing same-origin cloud API proxy.

Refresh local Dota assets:

```bash
npm run assets:mobile-web
```

The H5 app reads hero portraits, item icons, ability icons, and Dota constants from `public/static/dota` first, so match detail pages do not depend on per-icon external CDN requests at runtime.

## UI themes

The MRJZ mark in the top-left corner of the home page switches between the original dark theme and the Island theme. The selection is stored in browser local storage and stays active across page navigation and reloads.

The Island theme uses the published [`animal-island-ui`](https://github.com/guokaigdg/animal-island-ui) React button implementation and design tokens under the project's [CC BY-NC 4.0 license](https://github.com/guokaigdg/animal-island-ui/blob/main/LICENSE). MRJZ is a non-commercial community project. Theme-specific layouts and backgrounds in this repository are original adaptations; no Nintendo or upstream demo-site artwork is bundled.
