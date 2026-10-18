/** Paket sebagaimana dikirim ke browser (tipe bersama server dan komponen). */
export type Package = {
	id: number;
	slug: string;
	title: string;
	summary: string;
	body: string;
	includes: string;
	notes: string;
	image: string | null;
	image_alt: string | null;
	duration: string | null;
	/** Rupiah utuh per orang; null berarti "harga menyusul". */
	price_per_person: number | null;
	min_pax: number;
	published: number;
	sort_order: number;
};

/** Artikel lengkap (halaman artikel dan CMS). */
export type Article = {
	id: number;
	slug: string;
	title: string;
	category: string;
	excerpt: string;
	body: string;
	cover_image: string | null;
	cover_alt: string | null;
	/** Kredit foto Unsplash; ketiganya terisi bersama bila sampul berasal dari Unsplash. */
	cover_credit_name: string | null;
	cover_credit_url: string | null;
	cover_unsplash_id: string | null;
	published: number;
	featured: number;
	published_at: string | null;
	created_at: string;
	updated_at: string;
};

/** Artikel untuk kartu dan daftar: tanpa isi. */
export type ArticleSummary = Omit<Article, 'body'>;
