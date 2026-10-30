# Workout Tracker Development Guidance

- Use npm. Run `npm run format`, `npm run lint`, `npm run typecheck`, and `npm test` before a handoff; run browser tests when the UI is available.
- Never commit `.env*` values, credentials, passcodes, hashes, tokens, `.data/`, or `docs/plans/`.
- The design doc and build plan in `docs/plans/` are local-only and must remain ignored by Git.
- During parallel work, each agent owns an explicit, non-overlapping file list. Do not concurrently edit package files, migrations, `src/db/schema.ts`, shared types, root layouts, global styles, or deployment configuration.
- A date can have any number of sessions (e.g. morning cardio and evening lifting). Calculate volume server-side; only sets marked done count.
- Local development uses embedded PGlite when `DATABASE_URL` is unset; production uses Neon. Only `src/db/client.ts` may differ between the two.
- UI work follows the `frontend-design` skill; React/Next.js code follows the `vercel-react-best-practices` skill.
