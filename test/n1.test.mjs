import assert from "node:assert";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const n1 = require("../n1.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
}

// ── shape normalization ──
t("shape strips numbers and strings to ?", () => {
  assert.equal(
    n1.shape("SELECT * FROM users WHERE id = 42"),
    n1.shape("SELECT * FROM users WHERE id = 99"),
  );
});
t("shape strips a log prefix", () => {
  const a = n1.shape("[2026-07-04 10:00:00] SELECT * FROM posts WHERE user_id = 1");
  const b = n1.shape("Query: SELECT * FROM posts WHERE user_id = 7");
  assert.equal(a, b);
});
t("shape collapses IN-lists so a batched query is one shape", () => {
  assert.equal(
    n1.shape("SELECT * FROM users WHERE id IN (1,2,3)"),
    n1.shape("SELECT * FROM users WHERE id IN (4,5,6,7,8)"),
  );
});
t("tableOf reads the FROM table", () => {
  assert.equal(n1.tableOf(n1.shape("SELECT name FROM authors WHERE id = 1")), "authors");
});

// ── the core N+1 case ──
t("classic N+1: 1 parent + N child lookups is flagged", () => {
  const log = [
    "SELECT * FROM posts",                    // parent list
    "SELECT * FROM users WHERE id = 1",       // then one user per post...
    "SELECT * FROM users WHERE id = 2",
    "SELECT * FROM users WHERE id = 3",
    "SELECT * FROM users WHERE id = 4",
    "SELECT * FROM users WHERE id = 5",
  ].join("\n");
  const r = n1.analyze(log);
  assert.equal(r.findings.length, 1, "one finding");
  assert.equal(r.findings[0].count, 5, "5 repeats");
  assert.equal(r.findings[0].table, "users");
});

t("threshold default 3: two repeats is NOT flagged", () => {
  const log = [
    "SELECT * FROM users WHERE id = 1",
    "SELECT * FROM users WHERE id = 2",
  ].join("\n");
  assert.equal(n1.analyze(log).findings.length, 0);
});

t("already batched IN (?) query is NOT flagged", () => {
  const log = "SELECT * FROM users WHERE id IN (1,2,3,4,5,6,7,8,9,10)";
  assert.equal(n1.analyze(log).findings.length, 0);
});

t("non-parameterized repeats (same full query) are not called N+1", () => {
  // identical COUNT with no per-key filter — not the N+1 shape
  const log = Array(5).fill("SELECT COUNT(*) FROM jobs").join("\n");
  assert.equal(n1.analyze(log).findings.length, 0);
});

t("interleaved N+1 still summed across the log", () => {
  const log = [
    "SELECT * FROM orders",
    "SELECT * FROM items WHERE order_id = 1",
    "SELECT * FROM shipments WHERE order_id = 1",
    "SELECT * FROM items WHERE order_id = 2",
    "SELECT * FROM shipments WHERE order_id = 2",
    "SELECT * FROM items WHERE order_id = 3",
    "SELECT * FROM shipments WHERE order_id = 3",
  ].join("\n");
  const r = n1.analyze(log);
  // both items and shipments repeat 3× -> two findings
  assert.equal(r.findings.length, 2);
  assert.ok(r.findings.every((f) => f.count === 3));
});

t("severity scales with repeat count", () => {
  const many = ["SELECT * FROM t"].concat(
    Array.from({ length: 25 }, (_, i) => `SELECT * FROM u WHERE id = ${i}`),
  ).join("\n");
  assert.equal(n1.analyze(many).findings[0].severity, "high");
});

t("fix hint names the table and offers IN-batch + eager-load", () => {
  const log = ["SELECT * FROM x"].concat(
    Array.from({ length: 4 }, (_, i) => `SELECT * FROM authors WHERE id = ${i}`),
  ).join("\n");
  const f = n1.analyze(log).findings[0];
  assert.ok(f.fix.batched.includes("authors"));
  assert.ok(/IN \(\?/.test(f.fix.batched));
  assert.ok(f.fix.orm.length > 0);
});

t("singularize table for ORM hint", () => {
  assert.equal(n1._singular("categories"), "category");
  assert.equal(n1._singular("users"), "user");
  assert.equal(n1._singular("fish"), "fish");
});

t("empty / blank input is safe", () => {
  const r = n1.analyze("\n\n   \n");
  assert.equal(r.total, 0);
  assert.equal(r.findings.length, 0);
});

t("real ORM log with JOIN parent + per-row child", () => {
  const log = [
    "SELECT `posts`.* FROM `posts` LIMIT 10",
    ...Array.from({ length: 10 }, (_, i) =>
      `SELECT \`comments\`.* FROM \`comments\` WHERE \`comments\`.\`post_id\` = ${i + 1}`),
  ].join("\n");
  const r = n1.analyze(log);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].table, "comments");
  assert.equal(r.findings[0].count, 10);
});

t("Rails double-quoted identifiers keep the table name", () => {
  const sh = n1.shape(`  User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 5`);
  assert.equal(n1.tableOf(sh), "users");
});

t("full Rails N+1 log flags with the real table", () => {
  const log = [
    `  Post Load (0.4ms)  SELECT "posts".* FROM "posts" LIMIT 20`,
    ...Array.from({ length: 8 }, (_, i) =>
      `  User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = ${i + 1}`),
  ].join("\n");
  const r = n1.analyze(log);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].table, "users");
  assert.equal(r.findings[0].count, 8);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
