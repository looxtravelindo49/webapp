CREATE TABLE user (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	login TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	last_login_at TEXT
);

-- id berisi hash SHA-256 (hex) dari token cookie; token asli tidak pernah disimpan.
CREATE TABLE session (
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
	created_at TEXT NOT NULL,
	expires_at TEXT NOT NULL
);

CREATE INDEX session_user ON session (user_id);
CREATE INDEX session_expires ON session (expires_at);
