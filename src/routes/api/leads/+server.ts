import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { submitLead } from '#lib/server/leads.js';
import { LoginLimiter } from '#lib/server/rate-limit.js';
import type { RequestHandler } from './$types';

const MAX_BODY = 20_000;
const SAVE_FAILED = 'Estimasi belum tersimpan. WhatsApp tidak kami buka. Coba lagi, ya.';

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) return json({ message: 'Kiriman ditolak.' }, { status: 403 });

	const type = request.headers.get('content-type') ?? '';
	if (!type.includes('application/json')) return json({ message: 'Data tidak bisa dibaca.' }, { status: 415 });

	const text = await request.text();
	if (text.length > MAX_BODY) return json({ message: 'Data yang dikirim terlalu besar.' }, { status: 413 });

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return json({ message: 'Data tidak bisa dibaca.' }, { status: 400 });
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ message: 'Data tidak bisa dibaca.' }, { status: 400 });
	}

	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		// tanpa alamat klien, semua kiriman semacam ini berbagi satu batas
	}

	const db = await getDb();
	const limiter = new LoginLimiter(db, 20, 15 * 60 * 1000);
	const now = Date.now();
	const key = `lead|${ip}`;
	const check = await limiter.check(key, now);
	if (!check.allowed) {
		return json(
			{ message: 'Terlalu banyak kiriman. Coba lagi beberapa menit lagi.' },
			{ status: 429, headers: { 'retry-after': String(check.retryAfterSeconds) } }
		);
	}
	await limiter.fail(key, now);

	try {
		const result = await submitLead(db, body as Record<string, unknown>, {
			origin: url.origin,
			userAgent: request.headers.get('user-agent')
		});
		if (!result.ok) return json({ message: result.message }, { status: result.status });
		return json({
			nomor: result.lead.nomor_invoice,
			invoicePath: `/invoice/${result.lead.nomor_invoice}`,
			invoiceUrl: result.lead.invoice_url,
			waUrl: result.waUrl
		});
	} catch (err) {
		console.error('[lead] gagal simpan', err);
		return json({ message: SAVE_FAILED }, { status: 500 });
	}
};
