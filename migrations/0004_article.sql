-- Artikel: konten blog yang dikelola lewat CMS. `body` berisi markdown minimal.
-- `published_at` terisi saat pertama kali terbit dan tidak berubah lagi.
CREATE TABLE article (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	category TEXT NOT NULL,
	excerpt TEXT NOT NULL,
	body TEXT NOT NULL DEFAULT '',
	cover_image TEXT,
	cover_alt TEXT,
	published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
	featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
	published_at TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX article_public ON article (published, featured, published_at);
