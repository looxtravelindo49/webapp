import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DP_PERCENT, INVOICE_NUMBER } from '#lib/invoice.js';
import { all, migrate, migrations, openDatabase, run, type Db } from './db';
import { createManualLead, getLeadByNomor, listLeads, setLeadStatus, submitLead, updateIssuedInvoice } from './leads';
import { seed } from './seed';

const dbs: Db[] = [];
const dirs: string[] = [];

async function fresh() {
	const dir = mkdtempSync(join(tmpdir(), 'lead-'));
	dirs.push(dir);
	const db = await openDatabase(join(dir, 'app.db'));
	dbs.push(db);
	await seed(db);
	await run(db, "UPDATE package SET price_per_person = 249000, min_pax = 7, title = 'Offroad Cikole Lembang' WHERE slug = 'offroad'");
	await run(db, "UPDATE package SET price_per_person = 125000, min_pax = 5, title = 'Rafting (Arung Jeram)' WHERE slug = 'rafting'");
	await run(db, "UPDATE package SET published = 0 WHERE slug = 'paintball'");
	return db;
}

afterEach(() => {
	for (const db of dbs.splice(0)) db.close();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const body = (extra: Record<string, unknown> = {}) => ({
	nama: 'Tim Alfa',
	whatsapp: '0812-3456-7890',
	paket: ['offroad'],
	jumlahPeserta: '40',
	tanggal: '2026-11-20',
	catatan: 'Ada vegetarian',
	estimasi: 1,
	...extra
});

describe('submitLead', () => {
	it('menyimpan lead, menghitung ulang total, dan menolak angka klien', async () => {
		const db = await fresh();
		const result = await submitLead(db, body(), {
			origin: 'https://www.lembangadventure.com',
			userAgent: 'uji',
			now: new Date('2026-10-20T02:00:00.000Z'),
			random: () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7])
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.lead.nomor_invoice).toMatch(INVOICE_NUMBER);
		const offroad = 6 * 7 * 249000;
		expect(result.lead.estimasi_total).toBe(offroad);
		expect(result.lead.dp_nominal).toBe(Math.round((offroad * DP_PERCENT) / 100));
		expect(JSON.parse(result.lead.paket)).toMatchObject([
			{ slug: 'offroad', pricingMode: 'per_unit', units: 6, unitPrice: 7 * 249000, capacity: 7, unitName: 'mobil', subtotal: offroad }
		]);
		expect(decodeURIComponent(result.waUrl)).toContain('6 mobil × Rp 1.743.000 (maks. 7 orang/mobil)');
		expect(result.lead.dp_persen).toBe(DP_PERCENT);
		expect(result.lead.whatsapp).toBe('6281234567890');
		expect(result.lead.nama).toBe('Tim Alfa');
		expect(result.lead.jumlah_peserta).toBe(40);
		expect(result.lead.tanggal_acara).toBe('2026-11-20');
		expect(result.lead.catatan).toBe('Ada vegetarian');
		expect(result.lead.status).toBe('baru');
		expect(result.lead.jumlah_diterima).toBeNull();
		expect(result.lead.diterima_pada).toBeNull();
		expect(result.lead.nomor_invoice).not.toBe(String(result.lead.id));
		expect(result.lead.currency).toBe('IDR');
		expect(result.lead.xendit_invoice_id).toBeNull();
		expect(result.lead.invoice_url).toBe(`https://www.lembangadventure.com/invoice/${result.lead.nomor_invoice}`);
		expect(result.waUrl.startsWith('https://wa.me/6282120209900?text=')).toBe(true);
		expect(decodeURIComponent(result.waUrl.split('text=')[1])).toContain(result.lead.invoice_url);
		expect(decodeURIComponent(result.waUrl).toLowerCase()).not.toContain('pdf');
		const listed = await listLeads(db);
		expect(listed.map((l) => l.nomor_invoice)).toEqual([result.lead.nomor_invoice]);
		expect(await getLeadByNomor(db, result.lead.nomor_invoice)).not.toBeNull();
	});

	it('paket tanpa harga: estimasi dan DP kosong, bukan angka karangan', async () => {
		const db = await fresh();
		await run(db, "UPDATE package SET price_per_person = NULL WHERE slug = 'fun-games'");
		const result = await submitLead(db, body({ paket: ['fun-games'], jumlahPeserta: 8 }), {
			origin: 'http://localhost:3000',
			userAgent: null,
			random: () => Uint8Array.from([9, 9, 9, 9, 9, 9, 9, 9])
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.lead.estimasi_total).toBeNull();
		expect(result.lead.dp_nominal).toBeNull();
	});

	it('gagal validasi tidak menulis baris', async () => {
		const db = await fresh();
		const bad = await submitLead(db, body({ whatsapp: '123' }), { origin: 'http://localhost:3000', userAgent: null });
		expect(bad.ok).toBe(false);
		if (bad.ok) return;
		expect(bad.status).toBe(400);
		expect(await listLeads(db)).toEqual([]);
	});

	it('mengabaikan paket draft dan slug asing', async () => {
		const db = await fresh();
		const result = await submitLead(db, body({ paket: ['paintball', 'tidak-ada'] }), {
			origin: 'http://localhost:3000',
			userAgent: null
		});
		expect(result.ok).toBe(false);
		expect(await listLeads(db)).toEqual([]);
	});

	it('tambahan dihitung di server dan masuk pesan WhatsApp', async () => {
		const db = await fresh();
		const result = await submitLead(
			db,
			body({ jumlahPeserta: '10', tambahan: ['dok-pro', 'bukan', 'liwet', 'dok-basic'] }),
			{ origin: 'http://localhost:3000', userAgent: null, random: () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.lead.estimasi_total).toBe(2 * 7 * 249_000 + 10 * 50_000 + 700_000);
		const text = decodeURIComponent(result.waUrl.split('text=')[1] ?? '');
		expect(text).toContain('Paket: Offroad Cikole Lembang');
		expect(text).not.toContain('Paket: Offroad Cikole Lembang, Makan');
		expect(text).toContain('Tambahan: Makan siang Liwet di hutan — 10 x Rp 50.000 = Rp 500.000');
		expect(text).toContain('Tambahan: Dokumentasi Basic (Foto & Video cinematic, 4 jam) — Rp 700.000');
		expect(text).not.toContain('Dokumentasi Pro');
		expect(text).toContain('Estimasi: Rp 4.686.000');
		expect(text).toContain('Per peserta: Rp 468.600');
	});

	it('beberapa paket dijumlahkan di server', async () => {
		const db = await fresh();
		const result = await submitLead(db, body({ paket: ['offroad', 'rafting'], jumlahPeserta: '10' }), {
			origin: 'http://localhost:3000',
			userAgent: null,
			random: () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.lead.estimasi_total).toBe(2 * 7 * 249000 + 125000 * 10);
	});

	it('nomor bentrok dicoba lagi', async () => {
		const db = await fresh();
		let calls = 0;
		const random = () => {
			calls += 1;
			return calls < 3 ? new Uint8Array(8) : Uint8Array.from([3, 3, 3, 3, 3, 3, 3, 3]);
		};
		const first = await submitLead(db, body(), { origin: 'http://localhost:3000', userAgent: null, random });
		const second = await submitLead(db, body({ nama: 'Tim Beta' }), {
			origin: 'http://localhost:3000',
			userAgent: null,
			random
		});
		expect(first.ok && second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(first.lead.nomor_invoice).not.toBe(second.lead.nomor_invoice);
		expect(calls).toBeGreaterThanOrEqual(3);
	});

	it('mencatat DP dan lunas, batal tidak menghapus nominal', async () => {
		const db = await fresh();
		const created = await submitLead(db, body(), {
			origin: 'http://localhost:3000',
			userAgent: null,
			random: () => Uint8Array.from([4, 4, 4, 4, 4, 4, 4, 4])
		});
		if (!created.ok) throw new Error('lead gagal');
		const nomor = created.lead.nomor_invoice;
		expect(await setLeadStatus(db, nomor, { status: 'dp_diterima', diterimaPada: '', jumlah: 1_500_000, now: new Date('2026-10-19T17:30:00.000Z') })).toBe('ok');
		const dp = await getLeadByNomor(db, nomor);
		expect(dp?.status).toBe('dp_diterima');
		expect(dp?.diterima_pada).toBe('2026-10-20');
		expect(dp?.jumlah_diterima).toBe(1_500_000);
		expect(await setLeadStatus(db, nomor, { status: 'lunas', diterimaPada: '2026-10-21', jumlah: null })).toBe('ok');
		const lunas = await getLeadByNomor(db, nomor);
		expect(lunas?.status).toBe('lunas');
		expect(lunas?.diterima_pada).toBe('2026-10-21');
		expect(lunas?.jumlah_diterima).toBe(1_500_000);
		expect(await setLeadStatus(db, nomor, { status: 'batal', diterimaPada: '2026-01-01', jumlah: 1 })).toBe('ok');
		const batal = await getLeadByNomor(db, nomor);
		expect(batal?.status).toBe('batal');
		expect(batal?.diterima_pada).toBe('2026-10-21');
		expect(batal?.jumlah_diterima).toBe(1_500_000);
		expect(await setLeadStatus(db, nomor, { status: 'dp_diterima', diterimaPada: '2026-02-31', jumlah: null })).toBe('bad-date');
		expect((await listLeads(db, 20, 'batal')).map((l) => l.nomor_invoice)).toEqual([nomor]);
		expect(await listLeads(db, 20, 'baru')).toEqual([]);
	});
});

describe('createManualLead', () => {
	it('menyimpan baris bebas, diskon, DP, dan sumber manual', async () => {
		const db = await fresh();
		const result = await createManualLead(
			db,
			{
				nama: 'Sari',
				perusahaan: 'PT Contoh',
				whatsapp: '081234567890',
				tanggal: '2026-12-01',
				jumlahPeserta: '12',
				catatan: 'Termasuk makan',
				diskon: '50.000',
				deskripsi: ['Offroad', ''],
				qty: ['2', ''],
				harga: ['249000', '']
			},
			{
				origin: 'https://lembangadventure.com',
				userAgent: null,
				now: new Date('2026-10-20T02:00:00.000Z'),
				random: () => Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])
			}
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.lead.source).toBe('manual');
		expect(result.lead.status).toBe('baru');
		expect(result.lead.perusahaan).toBe('PT Contoh');
		expect(result.lead.estimasi_total).toBe(249000 * 2 - 50_000);
		expect(result.lead.dp_nominal).toBe(Math.round(((249000 * 2 - 50_000) * DP_PERCENT) / 100));
		expect(result.lead.diskon).toBe(50_000);
		expect(result.lead.nomor_invoice).toMatch(INVOICE_NUMBER);
		const lines = JSON.parse(result.lead.paket) as { title: string; kind: string; subtotal: number }[];
		expect(lines).toEqual([{ slug: '', title: 'Offroad', price: 249000, minPax: 1, billedPax: 2, subtotal: 498000, kind: 'bebas' }]);
		expect(await createManualLead(db, { nama: 'Sari', whatsapp: '0812', deskripsi: ['A'], qty: ['1'], harga: ['1000'], jumlahPeserta: '1' }, { origin: 'http://localhost', userAgent: null })).toMatchObject({ ok: false });
		expect(result.lead.dp_mode).toBeNull();
	});

	it('menyimpan Include, Fee Services, dan DP nominal', async () => {
		const db = await fresh();
		const result = await createManualLead(
			db,
			{
				nama: 'Sari',
				whatsapp: '081234567890',
				jumlahPeserta: '8',
				deskripsi: ['Jeep'],
				qty: ['2'],
				harga: ['249000'],
				include: ['Pemandu\nMakan'],
				diskon: '49000',
				fee_aktif: '1',
				fee_label: 'Jasa',
				fee_mode: 'persen',
				fee_nilai: '10',
				dp_mode: 'nominal',
				dp_nilai: '200000'
			},
			{ origin: 'https://lembangadventure.com', userAgent: null, random: () => Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 9]) }
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.lead.estimasi_total).toBe(493_900);
		expect(result.lead.dp_nominal).toBe(200_000);
		expect(result.lead.dp_mode).toBe('nominal');
		expect(JSON.parse(result.lead.paket)).toMatchObject([
			{ title: 'Jeep', includes: 'Pemandu\nMakan', subtotal: 498_000, kind: 'bebas' },
			{ title: 'Jasa', kind: 'fee', feeMode: 'persen', feeRate: 1000, subtotal: 44_900 }
		]);
	});
});

describe('updateIssuedInvoice', () => {
	it('menyimpan perubahan dan tidak mengubah status bayar atau nomor', async () => {
		const db = await fresh();
		const created = await submitLead(db, body(), {
			origin: 'https://lembangadventure.com',
			userAgent: null,
			now: new Date('2026-10-20T02:00:00.000Z'),
			random: () => Uint8Array.from([4, 4, 4, 4, 4, 4, 4, 4])
		});
		if (!created.ok) throw new Error('lead gagal');
		const nomor = created.lead.nomor_invoice;
		const totalAwal = created.lead.estimasi_total;
		expect(await setLeadStatus(db, nomor, { status: 'dp_diterima', diterimaPada: '2026-10-20', jumlah: 1_500_000 })).toBe('ok');
		const updated = await updateIssuedInvoice(db, nomor, {
			nama: 'Tim Baru',
			perusahaan: 'PT Edit',
			whatsapp: '081234567890',
			jumlahPeserta: '40',
			tanggal: '2026-11-21',
			catatan: 'Catatan baru',
			deskripsi: ['Offroad diubah'],
			qty: ['6'],
			harga: [String(7 * 249_000)],
			satuan: ['mobil'],
			kapasitas: ['7'],
			include: ['Helm'],
			slug: ['offroad'],
			kind: ['paket'],
			min_pax: ['7'],
			diskon: '',
			dp_mode: 'persen',
			dp_nilai: '30'
		});
		expect(updated.ok).toBe(true);
		if (!updated.ok) return;
		expect(updated.lead.nomor_invoice).toBe(nomor);
		expect(updated.lead.invoice_url).toBe(created.lead.invoice_url);
		expect(updated.lead.status).toBe('dp_diterima');
		expect(updated.lead.jumlah_diterima).toBe(1_500_000);
		expect(updated.lead.diterima_pada).toBe('2026-10-20');
		expect(updated.lead.nama).toBe('Tim Baru');
		expect(updated.lead.perusahaan).toBe('PT Edit');
		expect(updated.lead.tanggal_acara).toBe('2026-11-21');
		expect(updated.lead.catatan).toBe('Catatan baru');
		expect(updated.lead.estimasi_total).toBe(totalAwal);
		expect(updated.lead.dp_mode).toBeNull();
		expect(JSON.parse(updated.lead.paket)[0]).toMatchObject({
			title: 'Offroad diubah',
			includes: 'Helm',
			pricingMode: 'per_unit',
			units: 6,
			subtotal: totalAwal
		});

		const priced = await updateIssuedInvoice(db, nomor, {
			nama: 'Tim Baru',
			whatsapp: '081234567890',
			jumlahPeserta: '40',
			deskripsi: ['Offroad diubah'],
			qty: ['6'],
			harga: [String(7 * 249_000)],
			include: ['Helm'],
			diskon: '0',
			fee_aktif: '1',
			fee_label: 'Fee Services',
			fee_mode: 'nominal',
			fee_nilai: '100000',
			dp_mode: 'persen',
			dp_nilai: '15'
		});
		expect(priced.ok).toBe(true);
		if (!priced.ok) return;
		expect(priced.lead.status).toBe('dp_diterima');
		expect(priced.lead.estimasi_total).toBe((totalAwal ?? 0) + 100_000);
		expect(priced.lead.dp_mode).toBe('persen');
		expect(priced.lead.dp_persen).toBe(15);
		expect(priced.lead.dp_nominal).toBe(Math.round((((totalAwal ?? 0) + 100_000) * 15) / 100));
		const again = await getLeadByNomor(db, nomor);
		expect(again?.estimasi_total).toBe(priced.lead.estimasi_total);
		expect(again?.nama).toBe('Tim Baru');
	});
});

describe('migrasi status lama', () => {
	it('menjadi Baru atau Lunas dan id berikutnya tidak mulai dari 1', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'lead-mig-'));
		dirs.push(dir);
		const before = migrations.filter((m) => m.version < '0007_lead_payment');
		const db = await openDatabase(join(dir, 'app.db'), before);
		dbs.push(db);
		await run(
			db,
			`INSERT INTO lead (nomor_invoice, nama, whatsapp, paket, jumlah_peserta, invoice_url, status)
			 VALUES ('LA-20261019-AAAAAAAA', 'Lama', '628111111111', '[]', 2, 'http://local/a', 'menunggu_konfirmasi')`
		);
		await run(
			db,
			`INSERT INTO lead (nomor_invoice, nama, whatsapp, paket, jumlah_peserta, invoice_url, status, paid_at)
			 VALUES ('LA-20261019-BBBBBBBB', 'Lunas', '628111111112', '[]', 2, 'http://local/b', 'lunas_dp', '2026-10-01T00:00:00.000Z')`
		);
		expect(await migrate(db)).toEqual(['0007_lead_payment', '0008_lead_manual', '0009_package_pricing', '0010_package_photo', '0011_portfolio_testimonial', '0012_portfolio_photos', '0013_invoice_dp_mode']);
		const rows = await all<{ id: number; status: string; diterima_pada: string | null }>(
			db,
			'SELECT id, status, diterima_pada FROM lead ORDER BY id'
		);
		expect(rows).toEqual([
			{ id: 1, status: 'baru', diterima_pada: null },
			{ id: 2, status: 'lunas', diterima_pada: '2026-10-01' }
		]);
		await run(
			db,
			`INSERT INTO lead (nomor_invoice, nama, whatsapp, paket, jumlah_peserta, invoice_url)
			 VALUES ('LA-20261020-CCCCCCCC', 'Baru', '628111111113', '[]', 1, 'http://local/c')`
		);
		const next = await all<{ id: number }>(db, "SELECT id FROM lead WHERE nomor_invoice = 'LA-20261020-CCCCCCCC'");
		expect(next[0].id).toBe(3);
	});
});
