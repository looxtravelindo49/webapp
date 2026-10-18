/** Pecah teks menjadi paragraf (dipisah baris kosong); teks tetap polos agar aman di-escape Svelte. */
export function paragraphs(text: string | null | undefined): string[] {
	return String(text ?? '')
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}

/** Pecah teks menjadi butir (satu per baris), buang bullet di awal baris. */
export function lines(text: string | null | undefined): string[] {
	return String(text ?? '')
		.split('\n')
		.map((l) => l.trim().replace(/^[-•]\s*/, ''))
		.filter(Boolean);
}
