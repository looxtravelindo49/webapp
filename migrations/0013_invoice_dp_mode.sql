-- Mode DP yang dikunci admin saat invoice diedit atau dibuat manual.
-- NULL = invoice lama: nominal turunan persen boleh diselaraskan ke DP berjalan.
-- Fee Services dan catatan Include tinggal di JSON kolom paket, jadi baris lama tetap valid.
ALTER TABLE lead ADD COLUMN dp_mode TEXT;
