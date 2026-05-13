# AGENTS

This file defines how coding agents should work in this repository.

## Project Mission

MRJZ is a Dota 2 community tournament platform with four surfaces:

- `apps/api`: cloud backend, tournament management, OpenDota sync, public APIs, admin APIs.
- `apps/admin`: Web Admin for operators.
- `apps/mobile-web`: H5 fallback and public share surface.
- `apps/miniprogram`: WeChat mini program for user display and logged-in interactions.
- `packages/shared`: shared TypeScript types and browser-safe constants.

## Source Of Truth

- Product requirements: `docs/PRD.md`.
- Technical design: `docs/TECHNICAL_DESIGN.md`.
- Tournament management: `docs/TOURNAMENT_MANAGEMENT_SPEC.md`.
- Admin requirements: `docs/ADMIN_WEB_SPEC.md`.
- H5 requirements: `docs/MOBILE_WEB_SPEC.md`.
- Progress tracker: `docs/PROGRESS.md`.

When code and docs disagree, pause and update the smaller wrong surface. Do not silently drift away from the docs.

## Development Rules

1. Backend owns tournament rules.
   Frontends must not independently calculate Swiss ranking, group ranking, or knockout advancement.

2. Web Admin owns complex writes.
   Mini program and H5 are display-first surfaces. Mini program may support user interactions such as tags and likes.

3. OpenDota is a data source, not the tournament authority.
   OpenDota match data fills `series_games`; platform `series`, standings, and bracket state remain authoritative.

4. Generated pairings are drafts.
   Group schedules, Swiss pairings, and knockout brackets must be confirmed by an admin before becoming public.

5. Keep shared code browser-safe.
   `packages/shared` must not import Node-only APIs, secrets, or backend-only clients.

6. Prefer explicit domain names.
   Use `tournament`, `stage`, `round`, `series`, and `series_game` consistently.

7. Record progress.
   Update `docs/PROGRESS.md` whenever a task changes project state, adds a milestone, or leaves a known blocker.

8. Protect secrets.
   Never commit real `.env` files, keys, tokens, OpenDota keys, WeChat secrets, or production database URLs.

9. Verify before finishing.
   For docs, run `git diff --check`. For HTML design drafts, also run `python3 -m html.parser docs/design/page-direction.html`.

10. Keep commits focused.
    Commit logical units with concise messages. Do not mix unrelated refactors with feature work.

## Expected Workflow

1. Read the relevant docs before editing.
2. Make the smallest useful implementation step.
3. Add or update tests when behavior is implemented.
4. Update progress and docs when scope or decisions change.
5. Run the available checks.
6. Commit the completed unit.

## Current Implementation State

The repository is initialized as a TypeScript monorepo skeleton. Most packages contain placeholders and README files. Framework dependencies still need to be installed and wired during the M1 engineering skeleton phase.
