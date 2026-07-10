# Workout Tracker Development Guidance

- Use pnpm with the bundled Node runtime documented in this task.
- Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` before a handoff; run browser tests when the UI is available.
- Never commit `.env*` values, credentials, passcodes, hashes, tokens, or `docs/plans/`.
- The source plan and implementation checklist are local-only and must remain ignored by Git.
- During parallel work, each agent owns an explicit, non-overlapping file list. Do not concurrently edit package files, migrations, shared types, root layouts, global styles, or deployment configuration.
- Preserve the product plan's one-workout-per-calendar-day constraint and calculate volume server-side.
