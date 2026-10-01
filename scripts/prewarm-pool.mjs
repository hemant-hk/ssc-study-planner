import { readFileSync } from "fs";

// Usage: node scripts/prewarm-pool.mjs [--url=http://localhost:3000] [--target=30] [--rounds=40] [--delay=45000]
// Mirrors FULL_SECTIONS in src/app/api/mock-test/route.ts - keep the two in sync.
const SECTIONS = ["General Studies", "Reasoning", "Mathematics", "English"];

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const baseUrl = arg("url", "http://localhost:3000").replace(/\/+$/, "");
const target = Number(arg("target", "30"));
const maxRounds = Number(arg("rounds", "40"));
const delayMs = Number(arg("delay", "45000"));
const accessKey = process.env.APP_ACCESS_KEY || "";
const poolFile = new URL("../data/mock-pool.json", import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function counts() {
  let pool = {};
  try {
    pool = JSON.parse(readFileSync(poolFile, "utf-8"));
  } catch {
    pool = {};
  }
  return SECTIONS.map((s) => [s, Array.isArray(pool[s]) ? pool[s].length : 0]);
}

// The route answers partly from the existing pool, so its response total says
// nothing about fresh questions. Progress is the growth of the pool on disk.
function pooled() {
  return counts().reduce((a, [, n]) => a + n, 0);
}

function report(round) {
  const rows = counts();
  const line = rows.map(([s, n]) => `${s}=${n}`).join("  ");
  const reached = rows.filter(([, n]) => n >= target).length;
  console.log(`[round ${round}] ${line}  (${reached}/${SECTIONS.length} at target)`);
  return reached === SECTIONS.length;
}

async function round() {
  const res = await fetch(`${baseUrl}/api/mock-test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessKey ? { cookie: `app_session=${accessKey}` } : {}),
    },
    body: JSON.stringify({ type: "full" }),
  });
  if (!res.ok) throw new Error(`route returned ${res.status}`);
  await res.json();
}

async function main() {
  try {
    const probe = await fetch(`${baseUrl}/mock-test`, { method: "GET" });
    if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
  } catch (err) {
    console.error(`Cannot reach ${baseUrl} (${err.message}). Start the server with: npm run dev`);
    process.exit(1);
  }

  console.log(`Prewarming ${baseUrl} towards ${target} questions per section.`);
  if (report(0)) {
    console.log("Already warm.");
    return;
  }

  let stalls = 0;
  for (let i = 1; i <= maxRounds; i++) {
    const before = pooled();
    try {
      await round();
    } catch (err) {
      console.error(`  request failed: ${err.message}`);
    }
    if (report(i)) {
      console.log("Pool is warm. Every section can serve a full mock from disk.");
      return;
    }
    stalls = pooled() > before ? 0 : stalls + 1;
    if (stalls >= 3) {
      console.log("No new questions for 3 rounds - provider quota is spent. Re-run later to continue.");
      return;
    }
    if (i < maxRounds) await sleep(delayMs);
  }
  console.log(`Stopped after ${maxRounds} rounds. Re-run to continue from where the pool left off.`);
}

main();
