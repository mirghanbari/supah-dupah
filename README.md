# Supah Dupah

**If you ain't Supah, you ain't Dupah.**

A parody prediction market and "fell off da truck" futures exchange, run out of the back of a 1990s New York slice joint. Play money only. Nothing here is real.

- **Hot Right Now / sections:** markets on neighborhood nonsense ("Will the guy from Jersey use a fork?"). Every share pays one (1) dollar slice. Sal resolves them.
- **Da Back Kitchen:** a live dough-toss over/under every 2½ minutes, forever. Bet for 110 seconds, then watch the pie get tossed. Rounds resolve themselves.
- **Truck Futures:** go long or short on boxes of goods that fell off the truck. Prices move all day.
- **Crust Sports:** Pro Dough Toss League standings, built from every live pie.
- **Your Tab / Wall of Fame:** your receipt and the leaderboard.
- Regulars (bots) trade and trash-talk so the place never feels empty.
- Everything you hear is synthesized in the browser: service bell, cash register, crowd "AYYY", sad trombone, a plucked-mandolin tarantella jukebox, and Sal's voice. Type `ayyy` anywhere.

## Stack

- Vite + React + Tailwind v4, Motion for animation, TanStack Query for polling
- Cloudflare Worker (Hono) + D1, served together by `@cloudflare/vite-plugin`
- Markets use an LMSR market maker (`shared/lmsr.ts`), so there's always somebody to take the other side

```
shared/   market math, toss simulator, van prices, API types (used by both sides)
worker/   API, auth, trading, settlement, bots, seed data
src/      the shop
migrations/  D1 schema
```

## Run it

```sh
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate      # local D1
npm run dev             # http://localhost:5173
```

Register with the username in `SAL_USERNAME` (default `sal` locally) to get Sal's Office, where you create and settle markets.

## Put it on supahdupah.com

1. `npx wrangler d1 create supah-dupah` and paste the `database_id` into `wrangler.jsonc`.
2. `npm run db:migrate:remote`
3. `npx wrangler secret put TOSS_SECRET` (any long random string; it decides every toss, so keep it secret)
4. `npx wrangler secret put SAL_USERNAME` (the name you'll register as Sal)
5. Add the domain to `wrangler.jsonc`:
   ```jsonc
   "routes": [{ "pattern": "supahdupah.com", "custom_domain": true }]
   ```
6. `npm run deploy`

The cron trigger (every minute) keeps bots trading and rounds settling even when nobody's looking.

## Fine print

Parody. Play money. No real people are depicted, and no goods actually fell off any trucks. Not affiliated with dem other so-called "exchanges" (they use spoons).
