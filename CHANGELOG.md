# Changelog

All notable changes to n1lens are documented here.

## [0.1.0] — 2026-07-04

First release.

### Added
- The tool (`index.html`): paste a query log, see N+1 patterns and the batched fix. Runs entirely
  in the browser.
- Detection engine (`n1.js`), also usable from Node via `require`. Shape normalization, log-prefix
  stripping, per-key repeat detection, IN-batch awareness, severity, fix hints.
- 16 engine tests (`test/n1.test.mjs`).
- README + i18n (EN / ID / zh-CN), MIT license, CONTRIBUTING, commitlint config + CI + opt-in hook.

[0.1.0]: https://github.com/ryanda9910/n1lens/releases/tag/v0.1.0
