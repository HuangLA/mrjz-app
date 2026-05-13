# API

Cloud backend for MRJZ tournament management, OpenDota synchronization, admin APIs, and public mobile APIs.

Current minimal prototype:

- Framework-free Node `node:http` server with TypeScript modules.
- SQLite-backed repository when `apps/api/var/mrjz.sqlite` exists, with mock fallback before initialization.
- Public health, tournament, standings, rounds, bracket, and match detail endpoints.
- OpenDota normalizers for `ability_upgrades_arr`, `picks_bans`, `permanent_buffs`, item slots, ward logs, chat, and trends.

Database commands:

```bash
npm run db:init
npm run db:status
npm run db:reset
```

Future production wiring can move the same relational model to PostgreSQL without changing the public response shape.
