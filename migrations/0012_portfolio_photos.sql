-- Portfolio adalah galeri foto, bukan daftar kegiatan per klien.
-- Database yang sudah menjalankan 0011 versi lama (judul, lokasi, tanggal, item tanpa foto)
-- dibangun ulang. Baris lama, termasuk item awal tanpa foto, tidak disalin.
DROP TABLE IF EXISTS portfolio_item;

CREATE TABLE portfolio_item (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	image TEXT NOT NULL,
	alt TEXT NOT NULL,
	caption TEXT,
	sort_order INTEGER NOT NULL CHECK (sort_order >= 1),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX portfolio_item_order ON portfolio_item (sort_order, id);

DELETE FROM setting WHERE key = 'seeded_portfolio';
