-- Galeri foto paket, maksimal 4 baris per paket (dibatasi di aplikasi).
-- Penghapusan baris ikut penghapusan paket di kode, bukan lewat foreign key.
CREATE TABLE package_photo (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	package_id INTEGER NOT NULL,
	path TEXT NOT NULL,
	alt TEXT,
	sort_order INTEGER NOT NULL CHECK (sort_order >= 1),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX package_photo_package_order ON package_photo (package_id, sort_order, id);
