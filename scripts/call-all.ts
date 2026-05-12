/// <reference types="bun-types" />
/**
 * Posts { name: "MyName" } to each of the three deployed targets and prints
 * the response. Run with `bun scripts/call-all.ts` (or `pnpm call`).
 */

const targets = [
  { name: "supabase  ", url: process.env.SUPABASE_FN_URL },
  { name: "vercel    ", url: process.env.VERCEL_FN_URL },
  { name: "cloudflare", url: process.env.CF_FN_URL },
];

const apikey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!apikey) {
  console.error("Missing SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const name = process.argv[2] ?? "server!";
const body = JSON.stringify({ name });

for (const { name, url } of targets) {
  if (!url) {
    console.log(`${name}  SKIPPED (no URL set)`);
    continue;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", apikey },
      body,
    });
    const text = await res.text();
    let display = text;
    try {
      const json = JSON.parse(text) as { greeting?: string; name?: string; language?: string };
      if (json.greeting && json.name && json.language) {
        display = `${json.greeting}, ${json.name}! (${json.language})`;
      }
    } catch {}
    console.log(`${name}  ${res.status}  ${display}`);
  } catch (err) {
    console.log(`${name}  ERROR  ${(err as Error).message}`);
  }
}
