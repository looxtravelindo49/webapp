-- Batas berlaku invoice, waktu UTC dalam teks ISO-8601.
-- NULL = invoice lama atau invoice tanpa penghitung waktu. Tidak ada bawaan.
ALTER TABLE lead ADD COLUMN berlaku_hingga TEXT;
