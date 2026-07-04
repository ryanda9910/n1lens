/* n1lens — spot N+1 query patterns in a query log. Zero dependencies.
 * Works in the browser (window.n1) and in Node (module.exports).
 *
 * The idea: an N+1 shows up as one "parent" query, then the SAME child query
 * shape repeated many times, differing only by the id it filters on. We
 * normalize every line to a shape (literals -> ?, id lists collapsed), group
 * consecutive same-shape queries, and flag any group that repeats enough times.
 */
(function (root) {
  "use strict";

  // ── normalize one SQL line into a stable "shape" ──
  // strips the varying bits (numbers, quoted strings, IN-lists) so two queries
  // that differ only by which id they load collapse to the same signature.
  function shape(sqlRaw) {
    let s = String(sqlRaw).trim();
    // drop trailing ; and collapse whitespace/newlines
    s = s.replace(/;+\s*$/, "").replace(/\s+/g, " ").trim();
    // strip whatever a logger prints before the SQL: timestamps, "Query:",
    // Rails "User Load (0.4ms)", Django "(0.001) ", etc. Cut to the first SQL verb.
    const verb = s.search(/\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i);
    if (verb > 0) s = s.slice(verb);
    if (!s) return "";
    let n = s
      // single-quoted string literals -> ?  (SQL strings)
      .replace(/'(?:[^'\\]|\\.)*'/g, "?")
      // double-quoted / backtick identifiers ("users", `posts`) -> unquote,
      // keep the name so we can still read the table. NOT string literals in
      // Postgres/Rails/MySQL-ANSI, so they must survive.
      .replace(/"([\w.]+)"/g, "$1")
      .replace(/`([\w.]+)`/g, "$1")
      // IN (1,2,3) / IN (?, ?, ?) -> IN (?)  (already-batched queries collapse)
      .replace(/\bIN\s*\(\s*[^)]*\)/gi, "IN (?)")
      // numbers -> ?
      .replace(/\b\d+\b/g, "?")
      // named/positional params -> ?
      .replace(/[:$]\w+/g, "?")
      .replace(/\?\d+/g, "?");
    // normalize keyword case + spacing so SELECT/select match
    n = n.replace(/\s+/g, " ").trim();
    return n;
  }

  function isSelect(sh) { return /^select\b/i.test(sh); }
  // does the shape look like a per-row lookup? (has a WHERE ... = ? or IN (?))
  function looksParameterized(sh) {
    return /\b(where|join)\b/i.test(sh) && /(=\s*\?|in\s*\(\?\))/i.test(sh);
  }
  // extract the table being read, for the human message + fix hint
  function tableOf(sh) {
    const m = sh.match(/\bfrom\s+([`"[]?[\w.]+[`"\]]?)/i);
    return m ? m[1].replace(/[`"[\]]/g, "") : null;
  }
  // is this shape already batched? (IN (?) came from a real IN-list)
  function isBatched(sh) { return /\bin\s*\(\?\)/i.test(sh); }

  /* analyze(input, opts) -> {
   *     lines, queries, groups: [{shape, count, table, indices, batched}],
   *     findings: [{shape, count, table, fix, severity, firstLine}],
   *     total, flagged
   *   }
   * opts.threshold = min repeats to call it N+1 (default 3).
   */
  function analyze(input, opts) {
    const threshold = (opts && opts.threshold) || 3;
    const rawLines = String(input || "").split(/\r?\n/);
    const queries = [];
    rawLines.forEach((line, i) => {
      const sh = shape(line);
      if (sh) queries.push({ raw: line.trim(), shape: sh, line: i + 1 });
    });

    // group CONSECUTIVE runs of the same shape — that's the N+1 signature
    // (a loop firing the same query back to back). Non-adjacent repeats of a
    // shape are also summed so an interleaved log still gets caught.
    const byShape = new Map();
    for (const q of queries) {
      if (!byShape.has(q.shape)) byShape.set(q.shape, []);
      byShape.get(q.shape).push(q);
    }

    const findings = [];
    for (const [sh, qs] of byShape) {
      if (!isSelect(sh)) continue;
      if (qs.length < threshold) continue;
      if (isBatched(sh)) continue;          // already an IN (?) batch — fine
      if (!looksParameterized(sh)) continue; // must be a per-key lookup
      const table = tableOf(sh);
      findings.push({
        shape: sh,
        count: qs.length,
        table,
        firstLine: qs[0].line,
        indices: qs.map((q) => q.line),
        example: qs[0].raw,
        severity: qs.length >= 20 ? "high" : qs.length >= 8 ? "medium" : "low",
        fix: fixHint(sh, table, qs.length),
      });
    }
    findings.sort((a, b) => b.count - a.count);

    return {
      total: queries.length,
      flagged: findings.reduce((n, f) => n + f.count, 0),
      queries,
      findings,
    };
  }

  // suggest the batched replacement for a per-row lookup
  function fixHint(sh, table, count) {
    const t = table || "the table";
    return {
      problem: `This query runs ${count}× — once per row. That's a classic N+1: 1 query for the parent list, then ${count} more to load ${t} one id at a time.`,
      batched: `SELECT ... FROM ${t} WHERE id IN (?, ?, ...)   -- one round trip for all ${count} ids`,
      orm: "Eager-load instead of lazy: e.g. `.includes(:" + (table ? singular(table) : "relation") +
        ")` (ActiveRecord), `selectinload`/`joinedload` (SQLAlchemy), `.leftJoinAndSelect` / `relations` (TypeORM), `include` (Prisma), `prefetch_related` (Django).",
    };
  }

  function singular(word) {
    if (/ies$/i.test(word)) return word.replace(/ies$/i, "y");
    if (/s$/i.test(word)) return word.replace(/s$/i, "");
    return word;
  }

  const api = { analyze, shape, tableOf, isBatched, looksParameterized, _singular: singular };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.n1 = api;
})(typeof window !== "undefined" ? window : this);
