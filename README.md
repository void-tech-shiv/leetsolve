# LeetSolve 🔥

LeetSolve is a web application that automatically prepares one coding solution every day. It fetches the current Daily Challenge, asks an AI coding model for a solution, optionally performs a Judge0-compatible compile check, retries failed generations, stores the result in Neon PostgreSQL, and displays everything in a dashboard.

> **Scope:** LeetSolve does not log into a LeetCode account, store LeetCode cookies/passwords, or automatically submit code to LeetCode. It automates solution preparation, verification, history, and scheduling.

## What is included

- Full web dashboard — no Telegram bot
- Today's Daily Challenge card
- Automatic Gemini solution generation
- Optional Judge0 compile/syntax verification
- AI repair loop when verification fails
- LeetSolve prepared-streak, longest run, and total generated statistics
- Recent solution history
- Generated code viewer + copy button
- Manual `Solve now` test control
- Neon PostgreSQL persistence
- Vercel Cron daily automation
- Server-side secrets only

## Stack

- Next.js 15 + React 19 + TypeScript
- Gemini REST API
- Neon PostgreSQL
- Optional Judge0-compatible runner
- Vercel + Vercel Cron

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
DATABASE_URL=
JUDGE0_URL=
JUDGE0_API_KEY=
JUDGE0_API_HOST=
CRON_SECRET=
APP_ACCESS_KEY=
DEFAULT_LANGUAGE=java
MAX_REPAIR_ATTEMPTS=2
```

`JUDGE0_*` is optional. Without it, LeetSolve still generates and stores a solution and marks verification as skipped.

`APP_ACCESS_KEY` is optional but recommended on a public deployment. When configured, the dashboard asks for the key before a manual solve request. The key is stored only in your browser's local storage and sent as a request header; it is not rendered into the page source.

## Database

Create a free Neon project and put the connection string in `DATABASE_URL`. The application creates the `solutions` table automatically. You can also run `sql/schema.sql` manually.

## Daily automation

`vercel.json` schedules:

```text
GET /api/cron/daily
```

at `00:15 UTC` every day. Configure `CRON_SECRET` in your Vercel project so scheduled invocations are authenticated.

## Manual solve API

```bash
curl -X POST https://YOUR_DOMAIN/api/solve \
  -H "content-type: application/json" \
  -H "x-leetsolve-key: YOUR_APP_ACCESS_KEY" \
  -d '{"language":"java"}'
```

The `x-leetsolve-key` header is only required when `APP_ACCESS_KEY` is configured.

## Verification note

The streak shown in the dashboard is LeetSolve's own prepared-solution streak, not your official LeetCode account streak.

A normal LeetCode function depends on LeetCode's hidden harness. The included Judge0 adapter therefore performs a compile/syntax sanity check unless you add a problem-specific harness. A generated/compiled result must not be treated as proof that LeetCode itself will accept the answer.

## Security

- Never commit `.env.local`.
- Keep Gemini, database, cron, Judge0, and app-access secrets in Vercel environment variables.
- No LeetCode password, session cookie, or account credential is required.

## License

MIT
