-- Cara hitung paket. per_person = harga × peserta. per_unit = pembulatan ke atas per satuan.
ALTER TABLE package ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'per_person';
ALTER TABLE package ADD COLUMN kapasitas_per_unit INTEGER;
ALTER TABLE package ADD COLUMN nama_unit TEXT;

-- Pengaturan awal Offroad. Hitungan membaca kolom ini, bukan slug.
UPDATE package
SET pricing_mode = 'per_unit', kapasitas_per_unit = 7, nama_unit = 'mobil'
WHERE slug = 'offroad';
