-- Dokumentasi kegiatan dan ulasan yang diisi admin. Foto portfolio boleh kosong.
CREATE TABLE portfolio_item (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL,
	location TEXT NOT NULL,
	event_date TEXT NOT NULL,
	event_type TEXT NOT NULL,
	caption TEXT NOT NULL,
	alt TEXT,
	image TEXT,
	sort_order INTEGER NOT NULL CHECK (sort_order >= 1),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX portfolio_item_order ON portfolio_item (sort_order, id);

CREATE TABLE testimonial (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	reviewer_name TEXT NOT NULL,
	rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
	body TEXT NOT NULL,
	review_date TEXT NOT NULL,
	source_url TEXT,
	sort_order INTEGER NOT NULL CHECK (sort_order >= 1),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX testimonial_order ON testimonial (sort_order, id);
