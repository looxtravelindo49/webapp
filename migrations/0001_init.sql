CREATE TABLE package (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	summary TEXT NOT NULL,
	body TEXT NOT NULL DEFAULT '',
	includes TEXT NOT NULL DEFAULT '',
	notes TEXT NOT NULL DEFAULT '',
	image TEXT,
	image_alt TEXT,
	duration TEXT,
	price_per_person INTEGER CHECK (price_per_person IS NULL OR price_per_person >= 0),
	min_pax INTEGER NOT NULL DEFAULT 1 CHECK (min_pax >= 1),
	published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX package_published_order ON package (published, sort_order, id);

CREATE TABLE setting (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
