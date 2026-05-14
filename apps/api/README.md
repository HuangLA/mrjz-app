# API

Cloud backend for MRJZ tournament management, OpenDota synchronization, admin APIs, and public mobile APIs.

Current minimal prototype:

- Framework-free Node `node:http` server with TypeScript modules.
- SQLite-backed repository only; the API returns empty states before initialization.
- Public health, league, tournament, tournament match list, standings, rounds, bracket, sync-task, and match detail endpoints.
- Admin write endpoints for tournament lifecycle, teams, stages, rounds, series, single-game results, and sync tasks.
- OpenDota normalizers for `ability_upgrades_arr`, `picks_bans`, `permanent_buffs`, item slots, ward logs, chat, and trends.
- OpenDota sync worker checks running tournaments every 10 minutes and requests parse for unparsed matches.
- Backfill command discovers MRJZ league match IDs through Steam MatchHistory, legacy seed IDs, and OpenDota player discovery, then stores full OpenDota match JSON in SQLite.
- Real seed league shells: first `17485` completed, second `18365` completed, third `19483` running.

Important routes:

- `GET /api/leagues`
- `GET /api/tournaments`
- `GET /api/tournaments/:id`
- `GET /api/tournaments/:id/matches`
- `POST /api/tournaments/:id/sync-opendota`
- `PATCH /api/tournaments/:id/lifecycle`
- `GET /api/stages/:stageId/rounds`
- `GET /api/stages/:stageId/standings`
- `GET /api/stages/:stageId/bracket`
- `GET /api/matches/:matchId`
- `GET /api/sync-tasks`
- `POST /api/teams`
- `POST /api/stages`
- `POST /api/rounds`
- `POST /api/series`
- `POST /api/series/:seriesId/games/:gameIndex/result`
- `POST /api/sync-tasks`

Database commands:

```bash
npm run db:init
npm run db:status
npm run db:reset
npm run sync:opendota
npm run sync:opendota:backfill
```

OpenDota worker env:

- `OPENDOTA_API_BASE_URL`: defaults to `https://api.opendota.com/api`
- `OPENDOTA_API_KEY`: optional API key
- `STEAM_API_KEY`: optional, used only to discover league match IDs for full backfills
- `OPENDOTA_BACKFILL_MATCH_LIMIT`: defaults to `1000`
- `OPENDOTA_REQUEST_DELAY_MS`: defaults to `1200` for backfill mode to avoid OpenDota `429`
- `OPENDOTA_PLAYER_DISCOVERY_MATCH_LIMIT`: defaults to `80`
- `OPENDOTA_SYNC_INTERVAL_MS`: defaults to `600000`
- `OPENDOTA_SYNC_MATCH_LIMIT`: defaults to `50`
- `OPENDOTA_SYNC_RUN_ON_START=1`: run once immediately on API boot
- `MRJZ_DISABLE_OPENDOTA_WORKER=1`: disable scheduler

Future production wiring can move the same relational model to PostgreSQL without changing the public response shape.
