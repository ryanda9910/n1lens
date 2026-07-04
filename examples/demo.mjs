/**
 * Self-driving demo for the README / social recording (VHS). Deterministic,
 * key-free. Runs the REAL n1lens engine on a Rails N+1 log and prints the
 * report the way the tool shows it. Run: node examples/demo.mjs
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const n1 = require("../n1.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", b: "\x1b[1m",
  green: "\x1b[38;5;42m", red: "\x1b[38;5;203m", yellow: "\x1b[38;5;221m",
  grey: "\x1b[90m", cyan: "\x1b[36m",
};
async function line(s = "", d = 45) { process.stdout.write(s + "\n"); await sleep(d); }

const LOG = [
  `Post Load (0.4ms)  SELECT "posts".* FROM "posts" LIMIT 20`,
  ...Array.from({ length: 20 }, (_, i) =>
    `User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = ${i + 1}`),
].join("\n");

async function main() {
  await line(`${C.green}${C.b}  n1lens${C.reset} ${C.dim}— paste a query log, see the N+1${C.reset}\n`, 400);

  await line(`${C.grey}  query log (21 lines):${C.reset}`);
  await line(`${C.dim}    Post Load (0.4ms)  SELECT "posts".* FROM "posts" LIMIT 20${C.reset}`);
  await line(`${C.dim}    User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 1${C.reset}`);
  await line(`${C.dim}    User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 2${C.reset}`);
  await line(`${C.dim}    ... 18 more of the same${C.reset}\n`, 500);

  const r = n1.analyze(LOG);
  const f = r.findings[0];

  await line(`${C.grey}  ${r.total} queries · ${C.red}${r.findings.length} N+1 found${C.grey} · ${C.red}${r.flagged} wasted${C.reset}\n`, 350);
  await line(`  ${C.red}${C.b}${f.count}×${C.reset} the same lookup on ${C.b}${f.table}${C.reset} ${C.grey}(from line ${f.firstLine})${C.reset}`);
  await line(`  ${C.dim}${f.example}${C.reset}\n`, 400);
  await line(`  ${C.grey}One query for the list, then ${f.count} more to load ${f.table} one id at a time.${C.reset}\n`, 500);
  await line(`  ${C.green}batch it:${C.reset}`);
  await line(`  ${C.green}${f.fix.batched}${C.reset}\n`, 400);
  await line(`  ${C.grey}or eager-load: .includes(:user) · selectinload · include · prefetch_related${C.reset}\n`, 600);
}
main();
