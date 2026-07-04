<p align="center">
  <img src="assets/logo.svg" alt="n1lens" width="96" height="96" />
</p>

<h1 align="center">n1lens</h1>

<p align="center"><b>Tempel log query. Lihat N+1-nya. Dapat perbaikan batch-nya.</b></p>

<p align="center">
  <a href="README.md">🇺🇸 English</a> · 🇮🇩 Bahasa Indonesia · <a href="README.zh-CN.md">🇨🇳 简体中文</a>
</p>

<p align="center">
  <a href="https://ryanda9910.github.io/n1lens/"><b>→ buka tool-nya</b></a>
</p>

---

Query N+1 adalah bug performa paling umum di kode ORM, dan paling gampang kelewat. Kode kamu ambil
satu list, lalu loop tiap baris dan sentuh relasinya sekali per baris. Satu query jadi N+1. Lancar
saat 5 baris, ambruk saat 500.

**n1lens** baca log query dan menemukan pola itu. Tempel apa yang di-log ORM kamu, dan tool ini
menunjukkan query mana yang jalan sekali per baris, berapa banyak round trip yang terbuang, dan satu
query batch yang menggantikannya.

Semua jalan di browser kamu. Tidak ada yang diunggah.

## Cara kerjanya

1. Tiap baris log dinormalkan jadi **bentuk (shape)**: literal, id, dan daftar IN dikecilkan jadi
   `?`, jadi `WHERE id = 1` dan `WHERE id = 99` dianggap query yang sama.
2. Prefix log (timestamp, `User Load (0.2ms)`, `Query:`) dipotong sampai ke SQL-nya.
3. Setiap bentuk `SELECT` yang memfilter satu kunci (`WHERE ... = ?`) dan berulang **≥ N kali**
   (default 3) ditandai sebagai N+1.
4. Query yang sudah di-batch pakai `IN (...)` dibiarkan. Begitu juga agregat berulang tanpa filter
   per-kunci. Tujuannya: sedikit alarm palsu.

Ambang pengulangan bisa diatur di UI.

## Jalankan lokal

Cuma satu file HTML + satu file JS, tanpa build:

```bash
git clone https://github.com/ryanda9910/n1lens
cd n1lens
python3 -m http.server 8000
```

## Lisensi

MIT
