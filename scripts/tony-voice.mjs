#!/usr/bin/env node
// Generates Tony's voice clips with ElevenLabs.
//
//   npm run voice                      # only lines that don't have a clip yet
//   npm run voice -- --force           # redo everything
//   npm run voice -- welcome order-up  # redo just these lines
//
// Reads ELEVENLABS_API_KEY and TONY_VOICE_ID from .env.voice (git-ignored) or the shell.
//
// Optional: ELEVEN_MODEL (default eleven_multilingual_v2).
// Clips land in public/voice/<line>.<take>.mp3 and public/voice/manifest.json lists them.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "voice");
const lines = JSON.parse(readFileSync(join(root, "src", "voice", "tony-lines.json"), "utf8"));

// Settings come from .env.voice (git-ignored) unless they're already set in the shell.
const envFile = join(root, ".env.voice");
if (existsSync(envFile)) {
  for (const raw of readFileSync(envFile, "utf8").split("\n")) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*(#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.TONY_VOICE_ID;
const model = process.env.ELEVEN_MODEL ?? "eleven_multilingual_v2";
if (!key || !voice) {
  console.error("Put ELEVENLABS_API_KEY and TONY_VOICE_ID in .env.voice (copy .env.voice.example). See README, \"Tony's voice\".");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));
for (const id of only) if (!(id in lines)) console.warn(`No line called "${id}" in tony-lines.json`);

mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function speak(text) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: model,
        // low stability + some style = more swagger, more variety between takes
        voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
      }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      console.warn(`  ${res.status}, retrying in ${attempt * 3}s…`);
      await sleep(attempt * 3000);
      continue;
    }
    throw new Error(`ElevenLabs said ${res.status}: ${detail.slice(0, 300)}`);
  }
}

let made = 0;
let skipped = 0;
for (const [id, takes] of Object.entries(lines)) {
  if (id.startsWith("_")) continue;
  if (only.length && !only.includes(id)) continue;
  for (let i = 0; i < takes.length; i++) {
    const file = join(outDir, `${id}.${i}.mp3`);
    if (existsSync(file) && !force && !only.length) {
      skipped++;
      continue;
    }
    process.stdout.write(`${id}.${i}  "${takes[i]}"… `);
    writeFileSync(file, await speak(takes[i]));
    made++;
    console.log("done");
    await sleep(250);
  }
}

// The manifest only lists takes whose clip exists, so the app falls back to the browser voice for the rest.
const manifest = {};
for (const [id, takes] of Object.entries(lines)) {
  if (id.startsWith("_")) continue;
  manifest[id] = takes.map((_, i) => existsSync(join(outDir, `${id}.${i}.mp3`)));
}
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nMade ${made} clip(s), kept ${skipped} existing. Manifest written. Reload the app and turn on Tony's voice.`);
