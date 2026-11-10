// Run with:  npm run setup
// Asks for your API keys and saves them in .env.local (press Enter to skip a key).
import readline from "node:readline";
import fs from "node:fs";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lines = rl[Symbol.asyncIterator]();

async function ask(question) {
  process.stdout.write(question);
  const next = await lines.next();
  return next.done ? "" : String(next.value).trim();
}

console.log("\nSentimentTube key setup (keys are saved only in .env.local on this computer)\n");
const youtube = await ask("YouTube Data API key (Enter to skip): ");
const gemini = await ask("Gemini API key        (Enter to skip): ");
rl.close();

const clean = (v) => v.replace(/["'\s]/g, "");
const entries = [];
if (youtube) entries.push(["YOUTUBE_API_KEY", clean(youtube)]);
if (gemini) entries.push(["GEMINI_API_KEY", clean(gemini)]);

if (entries.length === 0) {
  console.log("\nNo keys entered. Nothing changed.");
} else {
  const names = entries.map(([k]) => k);
  const existing = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
  const kept = existing
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .filter((l) => !names.includes(l.split("=")[0].trim()));
  const out = [...kept, ...entries.map(([k, v]) => `${k}="${v}"`)];
  fs.writeFileSync(".env.local", out.join("\n") + "\n");
  console.log("\nSaved to .env.local. Now run: npm run dev");
}
