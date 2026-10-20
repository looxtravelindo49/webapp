# Lembang Adventure

Situs SvelteKit + Tailwind dengan SQLite (libSQL). Paket dan nomor WhatsApp dibaca dari database pada setiap request.
Berjalan di Vercel (database Turso + foto di Vercel Blob) atau di server/kontainer (berkas SQLite + folder foto); kodenya sama.

## Menjalankan lokal

```sh
npm install        # npm 10 (Node 22): gunakan `npm install --ignore-scripts`; binary libSQL sudah termasuk di paket
npm run dev        # http://localhost:5173, database di ./data/app.db
npm test           # tes Vitest (unit dan render server; cepat, tanpa peramban)
npm run test:e2e   # tes e2e Playwright (lihat bagian "Tes e2e")
npm run check      # svelte-check
npm run build && npm start   # build produksi (adapter-node)
```

Migrasi (`migrations/*.sql`) dan seed berjalan otomatis saat server start. Seed hanya mengisi data jika tabel
`package` kosong dan tidak pernah menimpa data yang sudah diedit. Pada database kosong, minimal peserta seed adalah
Offroad 7, Team Building 20, Rafting 5, Paintball 10, Fun Games 20 (harga tetap kosong). Situs yang sudah terisi
membaca `min_pax` dari admin, jadi angka itu tidak berubah sendiri.

## Kalkulator trip → invoice → WhatsApp

Section "Konsultasikan Tripmu" (`#konsultasi`) menghitung estimasi di browser. Paket **per orang** (bawaan):
`harga per orang × max(peserta, min_pax)`. Paket **per satuan** (Offroad: kapasitas 7, nama satuan mobil):
jumlah satuan = pembulatan ke atas dari peserta ÷ kapasitas, total = jumlah satuan × (kapasitas × harga per orang).
Satu mobil Offroad pada harga Rp249.000 = Rp1.743.000. Rinciannya, misalnya `3 mobil × Rp 1.743.000 (maks. 7 orang/mobil)`,
ikut ke invoice dan pesan WhatsApp. Paket tanpa harga tampil "Harga menyusul" dan tidak masuk total; bila semua paket
terpilih tanpa harga, totalnya "Dibahas via WhatsApp". Harga, `min_pax`, dan cara hitung dibaca dari tabel `package`
(bisa diubah di admin). Harga per orang yang sudah dikunci di CMS tidak diubah oleh alur ini.

**Kirim ke WhatsApp** (hanya bila pengaturan `whatsapp` valid):

1. Browser mengirim data ke `POST /api/leads`. Server menghitung ulang estimasi dari database (angka dari browser tidak dipakai).
2. Satu baris masuk ke tabel `lead` di database yang sama (SQLite lokal atau Turso). Nomor invoice `LA-YYYYMMDD-XXXXXXXX` (tanggal WIB, 8 karakter acak).
3. Bila simpan gagal, WhatsApp tidak dibuka dan tidak ada invoice kosong.
4. Bila berhasil, halaman `/invoice/<nomor>` terbuka dan `wa.me/<nomor pengaturan>` terbuka dengan detail kebutuhan, estimasi, dan tautan invoice. Tidak ada PDF dan tidak ada kalimat "Saya lampirkan PDF".
5. Invoice bisa dicetak atau disimpan lewat dialog cetak browser. Status awal **Baru** menampilkan cara transfer ke rekening PT dan tautan WhatsApp bukti transfer (nomor invoice sudah terisi). Tombol **Bayar DP 30% (segera)** tetap nonaktif. `dp_nominal` lead baru = 30% × estimasi (dibulatkan, konstanta `DP_PERCENT`), atau kosong bila estimasi belum berupa angka. Lead lama yang DP-nya turunan persen menampilkan 30% dari total tanpa menulis ulang baris; jumlah yang sudah dibayar tidak diubah. Tidak ada biaya gateway yang dikarang. Nomor invoice memakai 8 karakter acak, bukan urutan.

Invoice bersifat publik lewat nomor (tidak ditebak), `noindex`, dan tidak masuk sitemap. Nomor WhatsApp tujuan selalu dibaca dari Pengaturan. Ringkasan DP (2x24 jam) dan pelunasan (H-3) tampil di invoice, dengan tautan ke `/kebijakan-pembayaran`. Halaman itu juga ditautkan dari footer.

## Rekening

Invoice dan footer menampilkan rekening **CIMB Niaga Syariah**, **860025788700**, a/n **Loox Travel Luxury**, plus peringatan penipuan. Logonya berkas resmi di `static/media/cimb-niaga-syariah.png`, sudah dipotong dari pinggiran putih, proporsi asli, ditampilkan kecil supaya tetap tajam.

Foto utama beranda adalah `static/media/hero-2.jpg` (foto natural, 1280×720, di bawah 400 KB, pelat nomor kabur, tanpa teks). Berkas aslinya memang 1280×720, jadi tidak diperbesar ke 1920×1080.

## Katalog paket

Section **Katalog paket** (`#katalog`) ada di beranda, tepat sebelum "Satu tim, banyak cerita.". Kartu memakai foto, nama, durasi, harga, dan minimal peserta dari tabel `package`. Di layar di bawah 768px semua kartu digeser menyamping. Dari 768px, tiga kartu tampil; **Lihat semua paket** berada di bawah baris terakhir, membuka sisanya, dan berubah menjadi **Sembunyikan**. Tiap kartu menaut ke `/paket/<slug>`.

Halaman detail memuat foto, nama, durasi (disembunyikan bila kosong), harga, minimal peserta, dan deskripsi. **Tambah ke Trip** membuka kalkulator dengan paket itu sudah terpilih (`/?paket=<slug>#konsultasi`).

Kolom durasi sudah ada di admin. Tidak ada migrasi baru dan baris yang sudah tersimpan tidak diubah. Seed untuk database kosong mengisi Offroad `2-3 Jam` dan mengosongkan durasi paket lain.

## Admin

Area `/admin` dilindungi login. Saat database masih tanpa akun, server membuat satu akun awal:

| | |
|---|---|
| Login | `admin@looxtravel` |
| Password | `12345678` |

Akun awal **wajib ganti password** pada login pertama (semua halaman admin lain dialihkan ke
`/admin/ganti-password` sampai selesai). **Jangan buka situs ke publik sebelum password itu diganti**: password
bawaan tertulis di repositori ini. Untuk menimpanya sejak awal, setel `ADMIN_SEED_LOGIN` dan
`ADMIN_SEED_PASSWORD` sebelum start pertama (hanya dipakai bila tabel `user` kosong).

- **Kelola paket** di `/admin/paket`: daftar semua paket (termasuk draft) dengan status, harga, dan minimal peserta.
  - *Tambah paket* (`/admin/paket/baru`): paket baru selalu **draft** dan ditaruh di urutan terakhir; terbitkan dari daftar
    setelah siap. Slug dibuat otomatis dari nama dan **tidak berubah** walau nama diganti, supaya tautan
    `/#paket-<slug>` dan halaman `/paket/<slug>` tetap berlaku.
  - *Ubah paket*: nama, ringkasan, penjelasan, fasilitas (satu per baris), catatan, durasi, foto dan teks alternatif,
    **harga per orang**, **minimal peserta**, dan **cara hitung**. Harga berupa rupiah bulat: `250000`, `250.000`, `Rp 250.000`, atau
    `Rp250000` (titik hanya sebagai pemisah ribuan, jadi `250.5` ditolak; maksimal 100.000.000). Kosongkan harga =
    "Harga menyusul"; kosongkan minimal peserta = 1. Cara hitung bawaan **per orang**. **Per satuan** memakai kapasitas
    dan nama satuan (Offroad: 7, mobil).
  - *Terbitkan/Sembunyikan*, *Naik/Turun* (mengubah urutan tab dan kalkulator), dan *Hapus* (selalu minta konfirmasi,
    juga ditegakkan di server; tidak bisa dibatalkan). Perubahan langsung tampil di situs tanpa build atau restart.
  - Beranda admin memperingatkan bila ada paket terbit yang belum berharga.
- **Foto paket**: JPEG, PNG, WebP, atau AVIF, maksimal **4 MB** (ideal sekitar 1600 px lebar; batas 4 MB karena badan permintaan fungsi Vercel dibatasi 4,5 MB). Jenis berkas ditentukan
  dari isinya, bukan nama atau `Content-Type`; SVG dan GIF ditolak. Berkas disimpan dengan nama acak di folder unggahan
  (`UPLOAD_DIR`, bawaan: folder `uploads` di samping berkas database, jadi ikut volume `/data`) dan disajikan di
  `/uploads/<nama>`. Dengan `BLOB_READ_WRITE_TOKEN` berkas disimpan di Vercel Blob (store privat) dan tetap disajikan lewat rute yang sama. Foto dari ponsel dapat memuat data lokasi (EXIF); ekspor ulang tanpa lokasi bila perlu, karena
  berkas disimpan apa adanya. Mengganti atau menghapus foto (dan menghapus paket) menghapus berkas unggahan lamanya;
  gambar bawaan di `static/media/` tidak pernah dihapus.
- **Galeri paket** di halaman ubah (`/admin/paket/<id>`), maksimal 4 foto, memakai penyimpanan yang sama dengan foto utama.
  Isian berkas **Tambah foto galeri**, teks **Teks alternatif foto galeri**, tombol **Unggah ke galeri**. Tiap foto bisa
  diubah teks alternatifnya, dinaikkan, diturunkan, atau dihapus. Halaman `/paket/<slug>` menampilkan satu foto besar
  dan sisanya sebagai thumbnail; bila galeri kosong, foto utama yang dipakai. Kartu katalog memakai foto galeri pertama bila ada.
  Section "Satu tim, banyak cerita" menampilkan pil paket di atas slider. Pil tetap satu baris yang bisa digeser; di ponsel pil berikutnya mengintip. Geser slide atau panah desktop ikut memindahkan pil yang aktif. Galeri foto di dalam slide tidak menangkap geser horizontal.
- **Leads** di `/admin/leads`: setiap kiriman kalkulator (nama, WhatsApp, paket, peserta, tanggal, catatan, total, waktu, nomor invoice, status). Saring menurut status (Baru, DP diterima, Lunas, Batal). Detail di `/admin/leads/<nomor>` mencatat tanggal dan jumlah diterima (jumlah opsional), plus catatan internal. Tombol: **Konfirmasi DP diterima**, **Tandai lunas**, dan **Batalkan** (minta konfirmasi). Xendit belum menulis status ini. **Buat Invoice Manual** di `/admin/leads/baru` menyimpan lead `source = manual` dengan baris bebas (qty × harga satuan), diskon opsional, dan DP 30%. Halaman invoice publik membaca status langsung dari database (`cache-control: no-store`).
- **Pengaturan** di `/admin/pengaturan`: nomor WhatsApp tujuan. Format lokal (`0812-3456-7890`) atau internasional
  (`+62 812 3456 7890`) disimpan sebagai `6281234567890`. Kosong menyembunyikan tombol "Kirim ke WhatsApp" di kalkulator.
- **Batas ukuran body.** `adapter-node` menolak body di atas `BODY_SIZE_LIMIT` (bawaan 512 KB, yang menolak foto).
  Image container menyetelnya ke 8 MB; di lingkungan lain setel `BODY_SIZE_LIMIT=8M`. Reverse proxy di depan server juga
  harus mengizinkan body minimal 6 MB (mis. `client_max_body_size 8m;` di nginx).
- **Kelola akun** di `/admin/akun`: buat akun (password sementara), reset password akun lain, hapus akun. Semua admin
  setara. Akun baru dan akun yang direset wajib mengganti password saat login berikutnya. Tidak bisa menghapus akun
  sendiri atau akun terakhir.
- **Sesi**: cookie `session` (HttpOnly, SameSite=Lax, 7 hari). Server hanya menyimpan hash token.
- **Pembatasan login**: 5 kegagalan per 15 menit per kombinasi login + IP (disimpan di tabel `login_attempt`, jadi dibagi antar instance dan bertahan saat restart).
  Di balik reverse proxy sendiri (bukan Vercel), setel `ADDRESS_HEADER` (mis. `X-Forwarded-For`) dan `XFF_DEPTH` agar IP
  klien benar; tanpa itu semua pengunjung tampak berasal dari satu IP. Di Vercel, IP klien sudah benar tanpa pengaturan.
- **Lupa password dan tidak ada admin lain?** Start server sekali dengan `ADMIN_RESET_LOGIN=<login>` dan
  `ADMIN_RESET_PASSWORD=<password sementara>`. Password akun itu diatur ulang dan ia wajib menggantinya. **Hapus kedua
  variabel setelahnya**; bila dibiarkan, password diatur ulang di setiap start (di Vercel: setiap instance baru, jadi
  hapus variabelnya lalu deploy ulang).
- **HTTPS di depan server.** Form admin memakai pemeriksaan asal (CSRF) bawaan SvelteKit, dan cookie sesi bertanda
  `Secure` bila permintaan dianggap HTTPS. Pada `adapter-node` 6 (SvelteKit 3), alamat asal diturunkan dari header
  permintaan dengan **protokol bawaan `https`** dan host dari header `Host`; variabel `ORIGIN` tidak lagi dibaca. Jadi di
  produksi pasang reverse proxy HTTPS yang meneruskan `Host` (bila proxy memakai header lain, setel `HOST_HEADER`,
  `PROTOCOL_HEADER`, `PORT_HEADER`). **Mengakses server langsung lewat HTTP polos (mis. `npm start` atau `docker run`
  tanpa proxy) membuat form login ditolak 403**; untuk uji lokal pakai `npm run dev` (pemeriksaan asal tidak aktif di
  mode dev) atau jalankan di belakang proxy yang mengirim `X-Forwarded-Proto` dengan `PROTOCOL_HEADER=x-forwarded-proto`.

## Tes e2e

Suite end-to-end memakai [Playwright Test](https://playwright.dev) dan menguji perilaku yang tidak bisa dibuktikan
tes unit: interaksi di peramban, alur lintas halaman (login → paksa ganti password → kelola akun), header/cookie HTTP,
dan hal yang hanya ada di **build produksi** (pemeriksaan CSRF, chunk ber-hash). `npm test` tidak menjalankannya.

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e              # semuanya
CHROMIUM_PATH=/usr/bin/chromium npx playwright test e2e/admin # satu folder / satu file
CHROMIUM_PATH=/usr/bin/chromium npx playwright test --headed  # lihat peramban
CHROMIUM_PATH=/usr/bin/chromium npx playwright test --ui      # mode interaktif
npx playwright test --list                                     # daftar tes (tanpa peramban)
npx playwright show-report                                     # laporan HTML setelah kegagalan
npm run check:e2e                                              # typecheck folder e2e/
```

**Peramban.** Paket tidak mengunduh peramban otomatis. Pilih salah satu: setel `CHROMIUM_PATH` ke Chromium sistem
(mis. `/usr/bin/chromium`), atau jalankan `npx playwright install chromium` sekali. Tanpa keduanya Playwright berhenti
dengan pesan "Executable doesn't exist". Bila peramban gagal start di lingkungan tanpa sandbox (kontainer), setel
`E2E_NO_SANDBOX=1`.

**Cara kerja.** `npm run test:e2e` menjalankan `npm run build`, lalu `e2e/support/start-server.mjs` memulai **build
produksi** di `127.0.0.1:4180` (ubah dengan `E2E_PORT`) dengan database baru di `test-results/e2e-data/` yang dihapus
setiap eksekusi; `./data/app.db` tidak disentuh. Server dijalankan dengan `PROTOCOL_HEADER=x-forwarded-proto` dan klien
uji mengirim `X-Forwarded-Proto: http`, meniru reverse proxy TLS (lihat bagian Admin). Variabel `ADMIN_SEED_*` sengaja
dikosongkan agar akun awal bawaan ikut teruji. Permintaan ke luar server uji (mis. `wa.me`) tidak keluar jaringan.

**Memakai server yang sudah berjalan** (iterasi cepat, atau menguji kontainer): setel `E2E_BASE_URL` dan `E2E_DB`
(jalur berkas SQLite server itu). Suite tidak membangun atau menjalankan server sendiri. Tes `first-login` di-skip
bila akun awal sudah pernah diganti; gunakan database baru untuk menjalankannya lagi. Tes pemilih foto butuh Unsplash tiruan
(`e2e/support/unsplash-stub.mjs`, port server uji + 1): jalankan server dengan `UNSPLASH_ACCESS_KEY=kunci-uji` dan
`UNSPLASH_API_URL=http://127.0.0.1:<port+1>` sambil menyalakan stub itu, atau biarkan peluncur bawaan yang mengurusnya.

**Konvensi.**
- Judul tes: `[capability] Requirement › skenario`, sama dengan nama capability di `openspec/specs/`.
- Tanpa `waitForTimeout`. Setelah navigasi penuh, tunggu penanda hidrasi (`gotoReady`, `submit` di
  `e2e/support/fixtures.ts`; aplikasi memasang `data-hydrated="true"` di `<html>`).
- Setiap tes gagal bila ada galat konsol, peringatan, atau `pageerror` (kecuali "Failed to load resource" dari respons
  4xx yang disengaja); gunakan `allowConsole(/pola/)` bila memang diharapkan.
- Tes admin memakai akun dengan login unik (`insertAdmin(uniqueLogin(...))`) dan tidak membuat pernyataan tentang
  jumlah akun global. Tes yang sementara mengubah data yang dilihat publik (menerbitkan atau menyembunyikan paket,
  urutan, harga, foto yang tampil, nomor WhatsApp) hanya boleh berada di `e2e/mutating/`, yang berjalan sesudah proyek
  utama (satu proyek berantai per file, jadi tidak pernah bersamaan) dan memulihkan data. Tes CMS di proyek utama
  (`e2e/admin/package-cms.spec.ts`, `image-uploads.spec.ts`) hanya membuat dan mengubah paket **draft** dengan judul
  berawalan "Tes CMS"/"Tes Foto"; sisanya dibersihkan oleh tes mutating. Unggahan e2e berada di
  `test-results/e2e-data/uploads`.
- Harga fixture (Offroad 250.000, Rafting 200.000 dengan minimal 10, Paintball 150.000) diatur `ensureFixtures()`.

## Variabel environment

| Nama | Default | Keterangan |
|---|---|---|
| `DATABASE_URL` | (kosong) | URL libSQL: `libsql://<nama>.turso.io` untuk Turso, atau `file:…`. **Wajib di Vercel.** Mengalahkan `DATABASE_PATH`. |
| `DATABASE_AUTH_TOKEN` | (kosong) | Token otentikasi Turso (untuk `libsql://`). |
| `DATABASE_PATH` | `./data/app.db` (container: `/data/app.db`) | Berkas SQLite lokal bila `DATABASE_URL` tidak diset; direktori dibuat otomatis. |
| `BLOB_READ_WRITE_TOKEN` | (kosong) | Bila diset, foto unggahan disimpan di Vercel Blob. **Wajib di Vercel** (disk fungsi tidak persisten). |
| `VERCEL_REGIONS` | (kosong) | Saat build di Vercel: daftar wilayah fungsi dipisah koma (mis. `sin1`), samakan dengan wilayah Turso. |
| `PUBLIC_SITE_URL` | `http://localhost:3000` | Alamat publik untuk canonical, Open Graph, JSON-LD, sitemap, RSS, dan robots. **Wajib diisi domain produksi**; bila masih `localhost` saat `NODE_ENV=production`, server mencatat peringatan. |
| `PROTOCOL_HEADER` / `HOST_HEADER` / `PORT_HEADER` | (kosong) | Header dari reverse proxy untuk menurunkan alamat asal (mis. `x-forwarded-proto`, `x-forwarded-host`). Tanpa ini protokol dianggap `https` dan host diambil dari `Host`. |
| `PORT` | `3000` | Port server produksi. |
| `UPLOAD_DIR` | `<folder database>/uploads` (kontainer: `/data/uploads`) | Folder foto paket bila `BLOB_READ_WRITE_TOKEN` tidak diset; dibuat otomatis. Ikut volume dan backup. |
| `BODY_SIZE_LIMIT` | `512K` (kontainer: `8M`) | Batas ukuran body permintaan. Unggah foto (maks. 4 MB) butuh minimal `8M`; batas reverse proxy juga minimal 5 MB. Hanya untuk adapter-node (tidak berlaku di Vercel). |
| `UNSPLASH_ACCESS_KEY` | (kosong) | Kunci akses API Unsplash untuk pemilih foto sampul artikel. Kosong = tombol "Cari di Unsplash" tidak tampil. Hanya dibaca di server. |
| `UNSPLASH_APP_NAME` | `lembang_adventures` | Nama aplikasi Unsplash; menjadi `utm_source` pada tautan kredit foto. Samakan dengan nama aplikasi yang didaftarkan. |
| `UNSPLASH_API_URL` | `https://api.unsplash.com` | Hanya untuk tes e2e (server Unsplash tiruan). Jangan diisi di produksi. |
| `ADMIN_SEED_LOGIN` / `ADMIN_SEED_PASSWORD` | `admin@looxtravel` / `12345678` | Akun admin awal (hanya bila tabel `user` kosong; wajib ganti password). |
| `ADMIN_RESET_LOGIN` / `ADMIN_RESET_PASSWORD` | (kosong) | Pemulihan: atur ulang password satu akun saat start. Hapus setelah dipakai. |
| `ADDRESS_HEADER` / `XFF_DEPTH` | (kosong) | Header dan kedalaman IP klien di balik reverse proxy (dipakai pembatasan login dan kiriman lead). |
| `XENDIT_SECRET_KEY` | (tidak dibaca) | **Belum dipakai.** Disiapkan untuk DP 30% nanti. Jangan diisi dan jangan di-commit. Aplikasi mengabaikan variabel ini. |
| `XENDIT_WEBHOOK_VERIFICATION_TOKEN` | (tidak dibaca) | **Belum dipakai.** Token verifikasi webhook Xendit, nanti. Jangan di-commit. |

Nilai ini dibaca dari environment proses (di dev, default sudah cukup; file `.env` tidak dimuat otomatis).

## SEO

- **Metadata** semua halaman publik dirender oleh `src/lib/components/Seo.svelte` (title, description, canonical, Open Graph, Twitter card, JSON-LD). Halaman baru cukup memakai komponen itu.
- **Sitemap** `/sitemap.xml` berisi beranda, `/artikel`, dan tiap artikel terbit dengan `lastmod`. **RSS** ada di `/artikel/rss.xml` (20 artikel terbaru). Keduanya di-cache CDN selama 1 jam (`s-maxage=3600`), jadi artikel baru bisa terlambat muncul sampai satu jam.
- **Gambar bagikan**: artikel memakai sampul unggahan JPEG/PNG/WebP sebagai `og:image`; sampul SVG bawaan, AVIF, atau tanpa sampul memakai `static/og-default.png` (1200×630). Untuk membuat ulang gambar bawaan, ubah `scripts/og-default.html` lalu ambil tangkapan layar Chromium berukuran 1200×630 dari berkas itu ke `static/og-default.png`.
- Respons galat publik (4xx/5xx) membawa `X-Robots-Tag: noindex`; area admin selalu `noindex`.
- Setelah deploy: cek JSON-LD di Rich Results Test, pratinjau tautan di WhatsApp/Facebook Debugger, dan kirim `/sitemap.xml` ke Search Console (verifikasi domain lewat DNS TXT).

## Foto sampul dari Unsplash

Admin dapat mencari foto gratis di Unsplash dari form artikel (tombol **Cari di Unsplash**). Cara mengaktifkan:

1. Masuk ke <https://unsplash.com/developers>, pilih **Your apps → New Application**, setujui ketentuan, dan beri nama aplikasi (mis. `lembang_adventures`).
2. Salin **Access Key** (bukan Secret Key) ke environment `UNSPLASH_ACCESS_KEY`, dan isi `UNSPLASH_APP_NAME` dengan nama aplikasi tadi. Di Vercel: *Settings → Environment Variables*, lalu deploy ulang.
3. Aplikasi baru berstatus **demo**: 50 permintaan/jam ke API Unsplash (pencarian di-cache 10 menit; memuat gambar tidak dihitung). Bila kurang, ajukan *Apply for production* di halaman aplikasi.

Cara kerjanya mengikuti [panduan API Unsplash](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines):

- Foto **tidak disalin**: ditayangkan langsung dari `images.unsplash.com` (hotlink) memakai URL dari API. Akibatnya alamat IP pengunjung terlihat oleh CDN Unsplash, dan foto yang dihapus fotografernya akan jatuh ke gambar bawaan situs.
- Kunci akses tidak pernah sampai ke browser; pencarian lewat proxy di server (`/admin/artikel/unsplash`, hanya admin).
- Memilih foto lalu menyimpan artikel memicu pelaporan unduhan ke Unsplash, dan halaman artikel menampilkan kredit "Foto oleh … di Unsplash" dengan tautan ber-UTM.
- Satu artikel hanya punya satu sampul: unggahan atau foto Unsplash. Memilih yang satu menggantikan yang lain.

## Deploy ke Vercel

Build memakai `adapter-vercel` otomatis di Vercel (variabel `VERCEL` terisi). Yang perlu disiapkan:

1. **Database Turso**: buat database (pilih wilayah terdekat dengan wilayah fungsi), lalu ambil URL dan token
   (`turso db show <nama> --url`, `turso db tokens create <nama>`). Migrasi dan seed berjalan otomatis saat instance
   pertama start; tidak ada langkah migrasi manual.
2. **Vercel Blob**: buat store **privat** dan hubungkan ke proyek (Storage → Blob); `BLOB_READ_WRITE_TOKEN` terisi otomatis.
3. **Environment variable** di proyek Vercel: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`,
   `PUBLIC_SITE_URL` (alamat publik), dan opsional `VERCEL_REGIONS` (mis. `sin1`). Isi **berbeda untuk Production dan
   Preview** (database dan Blob terpisah) supaya deployment Preview tidak menulis ke data produksi.
4. **Ganti password admin bawaan** (`admin@looxtravel` / `12345678`) segera setelah deployment pertama, sebelum situs
   dibuka ke publik; atau setel `ADMIN_SEED_LOGIN`/`ADMIN_SEED_PASSWORD` sejak awal.

Catatan: batas badan permintaan fungsi Vercel 4,5 MB, maka batas foto 4 MB. Setiap render halaman membaca database lewat
jaringan, jadi samakan wilayah fungsi dan Turso. Syarat layanan paket Vercel Hobby setahu kami hanya untuk penggunaan
non-komersial; periksa ketentuan terbaru Vercel sebelum dipakai untuk situs bisnis.

## Container

```sh
docker build -t lembang-adventures .
docker run -d --name lembang -p 3000:3000 \
  -v lembang-data:/data \
  -e PROTOCOL_HEADER=x-forwarded-proto -e HOST_HEADER=x-forwarded-host \
  -e PUBLIC_SITE_URL=https://lembangadventures.com \
  lembang-adventures
```

**Pasang volume di `/data`.** Tanpa volume, database ikut hilang saat container diganti. Jika memakai bind mount,
pastikan direktori host dapat ditulis oleh user `node` (uid 1000).

`GET /healthz` mengembalikan `{"ok":true}` (200) bila database terbaca, 503 bila tidak.

## Backup manual

**Vercel.** Database ada di Turso (gunakan fitur backup/point-in-time Turso; ekspor manual:
`turso db shell <nama> .dump > backup.sql`). Foto ada di Vercel Blob; unduh isi store bila perlu salinan.

**Container.** Yang perlu dibackup ada dua: database **dan folder `uploads/`** (foto paket; keduanya di volume `/data`).
Database memakai mode WAL, jadi jangan menyalin berkas `app.db` mentah saat server berjalan. Gunakan:

```sh
docker exec lembang node -e "require('@libsql/client').createClient({url:'file:/data/app.db'}).execute(\"VACUUM INTO '/data/backup.db'\").then(()=>console.log('ok'))"
docker cp lembang:/data/backup.db ./backup.db
docker cp lembang:/data/uploads ./uploads-backup
```

Memulihkan: letakkan `backup.db` sebagai `app.db` dan salin folder `uploads` kembali ke samping database. Database tanpa
folder `uploads` tetap berjalan, tetapi foto yang diunggah akan tampil rusak.

## Struktur

- `src/routes/(site)/` — halaman publik, termasuk `/invoice/[nomor]`; `src/routes/api/leads/` — simpan lead
- `src/routes/admin/` — area admin (login, leads, paket, artikel, pengaturan, akun, ganti password)
- `src/routes/uploads/[name]/` — penyajian foto unggahan (hanya nama berpola `<uuid>.<jpg|png|webp|avif>`)
- `src/lib/server/` — database, migrasi, seed, akses data, autentikasi (password, sesi, akun, pembatas login), pengelolaan paket, unggahan; hanya server
- `src/lib/package-form.ts`, `slug.ts` — validasi form paket (harga, minimal peserta, batas teks) dan pembuat slug (murni, dites unit)
- `src/lib/components/` — komponen Svelte per section
- `src/lib/content/` — teks statis Hero, Planner, dan section Artikel populer (artikel sendiri ada di database)
- `src/lib/pricing.ts`, `estimate.ts`, `invoice.ts` — hitungan estimasi, teks WhatsApp, nomor invoice, dan DP 30% (`DP_PERCENT`)
- `src/lib/server/leads.ts` — simpan dan baca lead di database yang sama dengan paket (`DATABASE_URL` / berkas SQLite). Tidak ada database baru.
- `migrations/` — SQL bernomor
- `e2e/` — tes end-to-end Playwright (`public/`, `admin/`, `mutating/`, `support/`; proyek `main`, `mutating`, `mutating-cms`); `playwright.config.ts`
- `legacy/` — situs statis lama (Cloudflare Pages + Pages CMS), disimpan sebagai arsip
