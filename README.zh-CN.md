<p align="center">
  <img src="assets/logo.svg" alt="n1lens" width="96" height="96" />
</p>

<h1 align="center">n1lens</h1>

<p align="center"><b>粘贴查询日志，看清 N+1，拿到批量修复方案。</b></p>

<p align="center">
  <a href="README.md">🇺🇸 English</a> · <a href="README.id.md">🇮🇩 Bahasa Indonesia</a> · 🇨🇳 简体中文
</p>

<p align="center">
  <a href="https://ryanda9910.github.io/n1lens/"><b>→ 打开工具</b></a>
</p>

---

N+1 查询是 ORM 代码里最常见、也最容易被忽略的性能问题。代码先取一个列表，然后逐行循环、每行访问一次
关联数据。一条查询变成了 N+1 条。5 行时一切正常，500 行时页面就崩了。

**n1lens** 读取查询日志并找出这些模式。粘贴 ORM 打出的日志，它会告诉你哪条查询在逐行执行、浪费了多少
次往返，以及一条可以替代它们的批量查询。

一切都在你的浏览器里运行，不上传任何数据。

## 判定方式

1. 每行日志被归一化为一个**形状（shape）**：字面量、id 和 IN 列表都折叠成 `?`，所以
   `WHERE id = 1` 和 `WHERE id = 99` 是同一条查询。
2. 日志前缀（时间戳、`User Load (0.2ms)`、`Query:`）被截去，只留 SQL。
3. 任何按键过滤（`WHERE ... = ?`）且重复 **≥ N 次**（默认 3）的 `SELECT` 形状都会被标记为 N+1。
4. 已经用 `IN (...)` 批量化的查询会被放过，没有按键过滤的重复聚合查询也会被放过。目标是尽量少误报。

重复阈值可在界面中调整。

## 本地运行

只有一个 HTML 文件和一个 JS 文件，无需构建：

```bash
git clone https://github.com/ryanda9910/n1lens
cd n1lens
python3 -m http.server 8000
```

## 许可证

MIT
