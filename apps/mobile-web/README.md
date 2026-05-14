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
npm run dev:api
npm run dev:mobile-web
```

Refresh local Dota assets:

```bash
npm run assets:mobile-web
```

The H5 app reads hero portraits, item icons, ability icons, and Dota constants from `public/static/dota` first, so match detail pages do not depend on per-icon external CDN requests at runtime.
