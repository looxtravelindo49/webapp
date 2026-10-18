LEMBANG ADVENTURES — CLOUDFLARE PAGES + PAGES CMS

Mulai dengan membuka MULAI-DI-SINI.html di browser.
Untuk melihat contoh lokal, buka LIHAT-PREVIEW.html.

Pengaturan Cloudflare Pages:
Production branch: main
Framework preset: None
Build command: npm run build
Build output directory: dist
NODE_VERSION: 22

Unggah content/, public/, scripts/, package.json, package-lock.json, dan
.pages.yml ke akar repositori GitHub. Jangan unggah semuanya hanya di dalam
satu folder pembungkus tanpa mengisi Root directory di Cloudflare.

CMS-CONFIG.txt berisi salinan konfigurasi .pages.yml untuk memudahkan
pembuatan file tersebut melalui GitHub jika file titik tersembunyi di Finder.

Editor harian: https://app.pagescms.org/
Aktivitas: content/activities
Tambahan: content/extras
Artikel: content/articles
Identitas dan WhatsApp: content/settings.json
Teks beranda: content/home.json
Foto unggahan: public/media

Harga awal belum diisi dengan nominal. Ganti ilustrasi dengan dokumentasi
asli dan isi nomor WhatsApp sebelum peluncuran.

Nama domain adalah rencana pengguna. Paket lokal ini belum tersambung ke
akun hosting atau domain.

Pemeriksaan developer:
npm test
npm run build

Tidak ada dependency npm eksternal. Montserrat dimuat melalui Google Fonts
pada halaman online, dengan font cadangan saat offline.
