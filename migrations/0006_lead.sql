-- Lead dari kalkulator beranda. Satu baris = satu invoice web.
-- Harga disalin apa adanya saat kirim, jadi ubahan harga di CMS tidak mengubah invoice lama.
-- Kolom xendit_* disiapkan untuk DP; belum diisi sampai gateway dihubungkan.
CREATE TABLE lead (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nomor_invoice TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	nama TEXT NOT NULL,
	whatsapp TEXT NOT NULL,
	paket TEXT NOT NULL,
	jumlah_peserta INTEGER NOT NULL CHECK (jumlah_peserta >= 1),
	tanggal_acara TEXT,
	catatan TEXT NOT NULL DEFAULT '',
	estimasi_total INTEGER CHECK (estimasi_total IS NULL OR estimasi_total >= 0),
	dp_persen INTEGER NOT NULL DEFAULT 20 CHECK (dp_persen >= 0 AND dp_persen <= 100),
	dp_nominal INTEGER CHECK (dp_nominal IS NULL OR dp_nominal >= 0),
	currency TEXT NOT NULL DEFAULT 'IDR',
	status TEXT NOT NULL DEFAULT 'menunggu_konfirmasi'
		CHECK (status IN ('draft', 'menunggu_konfirmasi', 'menunggu_dp', 'lunas_dp')),
	invoice_url TEXT NOT NULL,
	wa_opened INTEGER NOT NULL DEFAULT 0 CHECK (wa_opened IN (0, 1)),
	xendit_invoice_id TEXT,
	xendit_status TEXT,
	paid_at TEXT,
	user_agent TEXT,
	source TEXT,
	catatan_admin TEXT
);

CREATE INDEX lead_created ON lead (created_at, id);
