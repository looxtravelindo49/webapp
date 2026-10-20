-- Invoice manual: nama perusahaan dan diskon nominal. Baris bebas tetap di kolom paket (JSON).
ALTER TABLE lead ADD COLUMN perusahaan TEXT;
ALTER TABLE lead ADD COLUMN diskon INTEGER CHECK (diskon IS NULL OR diskon >= 0);
