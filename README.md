<p align="center">
  <img src="assets/logo.svg" alt="n1lens" width="96" height="96" />
</p>

<h1 align="center">n1lens</h1>

<p align="center"><b>Paste a query log. See the N+1. Get the batched fix.</b></p>

<p align="center">
  🇺🇸 English · <a href="README.id.md">🇮🇩 Bahasa Indonesia</a> · <a href="README.zh-CN.md">🇨🇳 简体中文</a>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-34D399" />
  <img alt="deps" src="https://img.shields.io/badge/dependencies-0-34D399" />
  <img alt="tests" src="https://img.shields.io/badge/tests-16%20passing-34D399" />
</p>

<p align="center">
  <a href="https://ryanda9910.github.io/n1lens/"><b>→ open the tool</b></a>
</p>

---

An N+1 query is the most common performance bug in ORM code, and the easiest to miss. Your code
loads a list, then loops over it and touches a relation once per row. One query becomes N+1. The
page is fine with 5 rows and falls over with 500.

**n1lens** reads a query log and finds those patterns. Paste what your ORM logged, and it tells you
which query ran once per row, how many round trips that cost, and the single batched query that
replaces them.

Everything runs in your browser. Nothing is uploaded.

## What it does

Given a log like this (Rails, but any ORM or raw SQL works):

```
Post Load (0.4ms)  SELECT "posts".* FROM "posts" LIMIT 20
User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 1
User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 2
User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 3
... (17 more)
```

n1lens reports:

> **20× the same lookup on `users`** — this runs once per row. That's a classic N+1: one query for
> the parent list, then 20 more to load `users` one id at a time.
>
> Batch it:
> ```sql
> SELECT ... FROM users WHERE id IN (?, ?, ...)   -- one round trip for all 20 ids
> ```
> Or eager-load: `.includes(:user)` (ActiveRecord), `selectinload` (SQLAlchemy),
> `include` (Prisma), `prefetch_related` (Django).

## How it decides

1. Each log line is normalized to a **shape**: literals, ids, and IN-lists collapse to `?`, so
   `WHERE id = 1` and `WHERE id = 99` are the same query.
2. Log prefixes (timestamps, `User Load (0.2ms)`, `Query:`) are stripped down to the SQL.
3. Any `SELECT` shape that filters on a key (`WHERE ... = ?`) and repeats **≥ N times** (default 3)
   is flagged as an N+1.
4. A query that's already batched with `IN (...)` is left alone. So is a repeated aggregate with no
   per-key filter. The goal is few false alarms.

The repeat threshold is adjustable in the UI.

## Run it locally

It's one HTML file and one JS file, no build step:

```bash
git clone https://github.com/ryanda9910/n1lens
cd n1lens
python3 -m http.server 8000   # then open http://localhost:8000
```

The detection engine (`n1.js`) also runs in Node, so you can wire it into a test or a log parser:

```js
const n1 = require("./n1.js");
const report = n1.analyze(myQueryLog, { threshold: 3 });
console.log(report.findings); // [{ table, count, severity, fix, ... }]
```

## Tests

```bash
npm test    # 16 assertions on the detection engine
```

## License

MIT
