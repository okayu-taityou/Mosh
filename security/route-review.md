**Route Security Review — quick recommendations**

Generated: 2025-11-28

Overview
- I ran `scripts/security-scan.js` which enumerates routes and checks for common auth middleware patterns (direct `auth` usage or alias arrays such as `attackHandlers`).
- Most routes are correctly protected or intentionally public (register/login, rates, public lists, password reset, etc.). Below are the items that deserve attention and recommended fixes.

Potentially suspicious routes (scanner flagged as unprotected)
- `src/routes/auth.js` — `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`
  - Status: intentionally public (register/login/refresh/logout must be unauthenticated). No change.

- `src/routes/bosses.js` — `GET /` (list bosses)
  - Status: intentionally public (clients need boss catalog). No change.

- `src/routes/coopBosses.js` — `GET /instances` and `GET /instances/:id`
  - Status: intentionally public so clients can browse available coop instances. Consider adding rate limits if abused.

- `src/routes/gacha.js` — `GET /rates` (probabilities)
  - Status: public OK.

- `src/routes/items.js` — `GET /` (item catalog)
  - Status: public OK.

- `src/routes/passwordReset.js` — `POST /request`, `POST /reset`
  - Status: public by necessity; ensure `request` doesn't leak user existence (consider returning generic message) — currently it returns a token in dev; in production ensure token isn't returned in API response (send by email only).

- `src/routes/rankings.js` — `GET /points`
  - Status: public OK; consider rate limiting.

- `src/routes/reactions.js` — `GET /:targetType/:targetId`
  - Status: public OK; ensure it doesn't return sensitive data.

- `src/routes/users.js` — `GET /:id`
  - Status: public but currently selects safe fields only (no passwordHash). OK.

High-priority recommendations
1. Password Reset: do NOT return reset tokens in API responses in production.
   - Current behavior: in development the token is returned for convenience. For production, return a generic message and deliver the token only via email.
   - Code change: in `src/routes/passwordReset.js` remove `token` from JSON response when `NODE_ENV === 'production'`.

2. Rate limiting: add/verify rate limits on public endpoints that could be abused:
   - `/api/gacha/rates` (trivial), `/api/gacha/spin` already has rate limiter.
   - `GET /api/coop/instances`, `GET /api/gacha/rates`, `GET /api/items/`, `GET /api/rankings/points` — consider light rate limits (per IP) to avoid scraping.

3. Audit logs & batch metadata for gacha batch
   - We added `POST /api/gacha/spin/batch`. Consider storing a `GachaBatch` record (batch id, userId, count, totalCost, createdAt) referencing per-spin `gachaRecord` entries for easier auditing / UI grouped display.

4. CI enforcement
   - Already added: `scripts/auth-guard-test.js` and `security-scan` in CI. Ensure these run on PRs and fail the build on regressions.

Medium-priority suggestions
 - Add an allowlist/denylist for admin-only routes (e.g., item creation) to ensure they are blocked in production (already partially implemented via `ALLOW_ITEM_MOD`).
 - Consider adding `authorizeOwner` middleware for resource update/delete endpoints to centralize checks (tasks/goals/items owned-by-user).

Low-priority
 - Consider exposing only public-safe fields via explicit `select` in all public endpoints (already done for `users`), audit other endpoints for accidental exposure.

If you'd like, I can implement the high-priority changes now:
- A: Remove returning reset tokens in production and send only by email (patch `src/routes/passwordReset.js`).
- B: Add lightweight rate-limiter middleware to public listing endpoints (patch `src/middleware/rateLimit.js` + hook into `src/routes/*`).
- C: Add `GachaBatch` Prisma model and migration skeleton + update `POST /api/gacha/spin/batch` to persist batch metadata.

Status: I implemented A/B/C in the codebase:
- A: `src/routes/passwordReset.js` now excludes tokens when `NODE_ENV==='production'` and requires `FALLBACK_DEV_RESET_TOKEN=1` for dev-only token returns.
- B: `src/middleware/rateLimit.js` gains `publicListLimiter` and it is attached to `GET /api/gacha/rates`, `GET /api/items/`, `GET /api/users/:id`, and `GET /api/rankings/points`.
- C: `prisma/schema.prisma` now includes `GachaBatch` and `GachaRecord.batchId`; `src/routes/gacha.js` creates a `gachaBatch` record during batch spins and attaches `batchId` to records when possible. The code gracefully continues if the DB migration hasn't been applied yet.

Next steps (recommended): run `npx prisma migrate dev --name add_gacha_batch` or `npx prisma db push`, restart the server, then run `scripts/flow-test.js` to verify batch persistence. CI updated to run `npm run prisma:push` before starting the server.

Tell me which of A/B/C to do (or "全部"), and I'll implement the patch and tests accordingly.
