-- Sampul dari Unsplash: `cover_image` menyimpan URL foto (hotlink) dan ketiga kolom ini kreditnya.
-- Sampul berasal dari Unsplash bila dan hanya bila `cover_unsplash_id` terisi.
ALTER TABLE article ADD COLUMN cover_credit_name TEXT;
ALTER TABLE article ADD COLUMN cover_credit_url TEXT;
ALTER TABLE article ADD COLUMN cover_unsplash_id TEXT;
