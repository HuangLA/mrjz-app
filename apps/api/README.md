# API

Cloud backend for MRJZ tournament management, OpenDota synchronization, admin APIs, and public mobile APIs.

Current minimal prototype:

- Framework-free Node `node:http` server with TypeScript modules.
- Mock OpenDota-like match data plus lightweight tournament context for the match header.
- Public health endpoints and `GET /api/matches/:matchId`.
- OpenDota normalizers for `ability_upgrades_arr`, `picks_bans`, `permanent_buffs`, item slots, ward logs, chat, and trends.

Future production wiring can replace the mock repository with database-backed services without changing the public response shape.
