# Supah Dupah

**If you ain't Supah, you ain't Dupah!**

A parody prediction market and "fell off da truck" futures exchange, run out of the back of a 1990s New York slice joint. Play money only. Nothing here is real.

- **Hot Right Now / sections:** markets on neighborhood nonsense ("Will the guy from Jersey use a fork?"). Every share pays one (1) dollar slice. Tony resolves them.
- **Da Back Kitchen:** a live dough-toss over/under every 2½ minutes, forever. Bet for 110 seconds, then watch the pie get tossed. Rounds resolve themselves.
- **Truck Futures:** go long or short on boxes of goods that fell off the truck. Prices move all day.
- **Crust Sports:** Pro Dough Toss League standings, built from every live pie.
- **Your Tab / Wall of Fame:** your receipt and the leaderboard.
- Regulars (bots) trade and trash-talk so the place never feels empty.
- Everything you hear is synthesized in the browser: service bell, cash register, crowd "AYYY", sad trombone, a plucked-mandolin tarantella jukebox, and Tony himself (recorded with ElevenLabs, see below). Type `ayyy` anywhere.

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

To get Tony's Office (create and settle markets), sign up and type your `BOSS_CODE` into the "Who sent you?" box. Anyone can register any name; only the code makes you Tony.

## Tony's voice

Tony talks in recorded clips made with ElevenLabs. Until a line has a clip, the browser's built-in voice reads it (robotically).

1. In ElevenLabs, open **Voice Design** and describe him. This works well:

   > A gruff, middle-aged Italian-American man from Brooklyn, New York. Thick New York accent, loud and warm, a little hoarse from yelling orders over the oven all day. Owns a pizzeria. Talks fast, full of swagger, always half-joking.

   Generate, pick the take that sounds most like a guy who'd call you "my guy," and save it. Copy its **voice ID**.
2. Copy `.env.voice.example` to `.env.voice` and fill in your API key and the voice ID. That file is git-ignored.
3. Generate the clips (roughly 60 short lines, a few thousand characters):
   ```sh
   npm run voice
   ```
4. Reload the app and turn on **Tony's voice**.

Every line lives in `src/voice/tony-lines.json`; each line can have several takes and one is picked at random. After editing, run `npm run voice -- <line-id>` to redo just that line, or `npm run voice -- --force` to redo everything. Clips go in `public/voice/` and ship with the app.

## Put it on supahdupah.com

1. `npx wrangler d1 create supah-dupah` and paste the `database_id` into `wrangler.jsonc`.
2. `npm run db:migrate:remote` (run again whenever a new file lands in `migrations/`)
3. `npx wrangler secret put TOSS_SECRET` (any long random string; it decides every toss and every van price, so keep it secret)
4. `npx wrangler secret put BOSS_CODE` (a long random phrase; whoever types it into "Who sent you?" at sign-up becomes Tony)
5. Add the domain to `wrangler.jsonc`:
   ```jsonc
   "routes": [{ "pattern": "supahdupah.com", "custom_domain": true }]
   ```
6. `npm run deploy`

The cron trigger (every minute) keeps bots trading and rounds settling even when nobody's looking.

## Fine print

Parody. Play money. No real people are depicted, and no goods actually fell off any trucks. Not affiliated with dem other so-called "exchanges" (they use spoons).
