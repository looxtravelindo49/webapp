-- Pembatas percobaan login (kunci "login|ip"), disimpan di database agar dibagi antar instance
-- dan bertahan saat instance dimulai ulang atau diganti. Waktu dalam milidetik epoch.
CREATE TABLE login_attempt (
	key TEXT PRIMARY KEY,
	count INTEGER NOT NULL CHECK (count >= 1),
	window_start INTEGER NOT NULL
);

CREATE INDEX login_attempt_window ON login_attempt (window_start);
