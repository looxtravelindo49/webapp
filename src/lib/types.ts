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
