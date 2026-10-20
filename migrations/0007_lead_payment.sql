-- Konfirmasi bayar manual selagi Xendit belum disambung.
-- Status lama (draft / menunggu_*) menjadi Baru. lunas_dp menjadi Lunas.
-- Tabel dibuat ulang karena CHECK status tidak bisa diubah di SQLite.

CREATE TABLE lead_next (
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
	status TEXT NOT NULL DEFAULT 'baru'
		CHECK (status IN ('baru', 'dp_diterima', 'lunas', 'batal')),
	invoice_url TEXT NOT NULL,
	wa_opened INTEGER NOT NULL DEFAULT 0 CHECK (wa_opened IN (0, 1)),
	xendit_invoice_id TEXT,
	xendit_status TEXT,
	paid_at TEXT,
	user_agent TEXT,
	source TEXT,
	catatan_admin TEXT,
	jumlah_diterima INTEGER CHECK (jumlah_diterima IS NULL OR jumlah_diterima >= 0),
	diterima_pada TEXT
);

INSERT INTO lead_next (
	id, nomor_invoice, created_at, nama, whatsapp, paket, jumlah_peserta, tanggal_acara, catatan,
	estimasi_total, dp_persen, dp_nominal, currency, status, invoice_url, wa_opened,
	xendit_invoice_id, xendit_status, paid_at, user_agent, source, catatan_admin,
	jumlah_diterima, diterima_pada
)
SELECT
	id, nomor_invoice, created_at, nama, whatsapp, paket, jumlah_peserta, tanggal_acara, catatan,
	estimasi_total, dp_persen, dp_nominal, currency,
	CASE status WHEN 'lunas_dp' THEN 'lunas' ELSE 'baru' END,
	invoice_url, wa_opened,
	xendit_invoice_id, xendit_status, paid_at, user_agent, source, catatan_admin,
	NULL,
	CASE
		WHEN status = 'lunas_dp' AND paid_at GLOB '????-??-??*' THEN substr(paid_at, 1, 10)
		ELSE NULL
	END
FROM lead;

DROP TABLE lead;
ALTER TABLE lead_next RENAME TO lead;

CREATE INDEX lead_created ON lead (created_at, id);
CREATE INDEX lead_status ON lead (status, created_at, id);

UPDATE sqlite_sequence
SET name = 'lead', seq = (SELECT COALESCE(MAX(id), 0) FROM lead)
WHERE name = 'lead_next';

UPDATE sqlite_sequence
SET seq = (SELECT COALESCE(MAX(id), 0) FROM lead)
WHERE name = 'lead';
