import MarkdownIt from 'markdown-it';

/**
 * Markdown minimal untuk isi artikel. Parser dimulai dari preset `zero` (semua aturan mati) lalu
 * hanya menyalakan daftar putih: paragraf, subjudul, daftar, kutipan, garis pemisah, tebal/miring,
 * dan tautan. HTML mentah, gambar, kode, dan tabel tidak dirender.
 */
const md = new MarkdownIt('zero', { html: false, linkify: false, typographer: false });
md.enable(['heading', 'list', 'blockquote', 'hr', 'emphasis', 'link', 'newline', 'escape']);

const EXTERNAL = /^https?:/i;
/** Skema yang diizinkan: http(s), mailto, tel, dan path relatif (bukan `//host`). */
md.validateLink = (url) => /^(?:https?:|mailto:|tel:)/i.test(url) || /^\/(?!\/)/.test(url);

// `h1` milik judul halaman: level 1–2 → h2, level 3 ke atas → h3.
md.core.ruler.push('heading_levels', (state) => {
	for (const t of state.tokens) {
		if (t.type === 'heading_open' || t.type === 'heading_close') t.tag = t.tag === 'h1' || t.tag === 'h2' ? 'h2' : 'h3';
	}
});

const defaultLinkOpen =
	md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	const token = tokens[idx];
	const href = String(token.attrGet('href') ?? '');
	if (EXTERNAL.test(href)) {
		token.attrSet('rel', 'noopener noreferrer');
		token.attrSet('target', '_blank');
	}
	return defaultLinkOpen(tokens, idx, options, env, self);
};

/** Render markdown artikel menjadi HTML aman (satu-satunya sumber `{@html}` untuk isi artikel). */
export function renderMarkdown(source: string | null | undefined): string {
	return md.render(String(source ?? ''));
}
