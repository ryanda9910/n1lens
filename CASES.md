# Real runs

Actual n1lens runs, not mockups. The detection engine (`n1.js`) is verified two ways: 16 Node
assertions on the shape/detection logic, and a headless-browser check that the tool renders the
right findings from real ORM logs.

Reproduce the engine tests:
```
npm test
```

---

## Case 1 — Rails N+1 (one parent list, then one user per row)

Input pasted into the tool:
```
Post Load (0.4ms)  SELECT "posts".* FROM "posts" LIMIT 20
User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 1
User Load (0.2ms)  SELECT "users".* FROM "users" WHERE "users"."id" = 2
... (through id = 8)
```

n1lens reported:
```
10 queries · 1 N+1 found · 8 wasted queries
Found 1 N+1 pattern. 8 queries could collapse into 1 batched one.

[LOW] 8× the same lookup on users (from line 3)
  SELECT "users".* FROM "users" WHERE "users"."id" = 1
  This query runs 8× — once per row. That's a classic N+1: 1 query for the
  parent list, then 8 more to load users one id at a time.
  batch it: SELECT ... FROM users WHERE id IN (?, ?, ...)
  eager-load: .includes(:user) / selectinload / include / prefetch_related
```
Notable: it reads the table name through Rails' double-quoted identifiers (`"users"`), which are
SQL identifiers, not string literals. A naive string-strip would erase the table and report `?`.

## Case 2 — two relations, each N+1 in the same request

Input (orders list, then line_items AND shipments loaded per order):
```
SELECT * FROM orders LIMIT 10
SELECT * FROM line_items WHERE order_id = 1
SELECT * FROM shipments WHERE order_id = 1
... (through order_id = 4)
```

n1lens reported **two** findings, `line_items` 4× and `shipments` 4×, each with its own batched fix.
A per-loop N+1 on more than one association is common and both get surfaced.

## Case 3 — already batched, no false alarm

Input:
```
SELECT "posts".* FROM "posts" LIMIT 20
SELECT "users".* FROM "users" WHERE "users"."id" IN (1,2,3,4,5,6,7,8)
```

n1lens reported: **No N+1 pattern found.** The `IN (...)` query is already the batched form, so it's
left alone. Repeated aggregates with no per-key filter (`SELECT COUNT(*) FROM jobs` ×5) are also not
flagged. Keeping false alarms low is the point.
