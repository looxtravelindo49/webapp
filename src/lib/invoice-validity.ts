/** Jam dan hari yang boleh diisi admin. Tidak ada durasi bawaan. */
export const MAX_VALIDITY_HOURS = 24 * 366;
export const MAX_VALIDITY_DAYS = 366;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ValidityMode = 'jam' | 'hari' | 'waktu';

export type ValidityDecision =
	| { ok: true; iso: string | null }
	| { ok: false; message: string };

/** `YYYY-MM-DDTHH:mm` dibaca sebagai WIB (UTC+7), bukan zona server. */
export function parseJakartaDateTime(raw: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw.trim());
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
	const date = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0));
	if (Number.isNaN(date.getTime())) return null;
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jakarta',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
	if (pick('year') !== match[1] || pick('month') !== match[2] || pick('day') !== match[3] || pick('hour') !== match[4] || pick('minute') !== match[5]) {
		return null;
	}
	return date;
}

/** "28 Oktober 2026, 16.30 WIB". Kosong bila waktu tidak valid. */
export function formatBerlakuHingga(iso: string | null | undefined): string {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const parts = new Intl.DateTimeFormat('id-ID', {
		timeZone: 'Asia/Jakarta',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
	return `${pick('day')} ${pick('month')} ${pick('year')}, ${pick('hour')}.${pick('minute')} WIB`;
}

export function durationMs(mode: 'jam' | 'hari', raw: string): number | null {
	const text = raw.trim();
	if (!/^\d+$/.test(text)) return null;
	const amount = Number(text);
	if (mode === 'jam') {
		if (amount < 1 || amount > MAX_VALIDITY_HOURS) return null;
		return amount * HOUR_MS;
	}
	if (amount < 1 || amount > MAX_VALIDITY_DAYS) return null;
	return amount * DAY_MS;
}

/**
 * `terapkan` mengganti batas. `perpanjang` menambah jam/hari ke batas yang masih jalan,
 * atau dari sekarang bila belum ada / sudah lewat. `reset` mengosongkan.
 */
export function resolveValidity(input: {
	action: string;
	mode: string;
	nilai: string;
	current: string | null;
	now?: Date;
}): ValidityDecision {
	const now = input.now ?? new Date();
	if (input.action === 'reset') return { ok: true, iso: null };
	if (input.action !== 'terapkan' && input.action !== 'perpanjang') {
		return { ok: false, message: 'Aksi masa berlaku tidak dikenal.' };
	}
	if (input.mode !== 'jam' && input.mode !== 'hari' && input.mode !== 'waktu') {
		return { ok: false, message: 'Pilih jam, hari, atau tanggal.' };
	}
	if (input.action === 'perpanjang' && input.mode === 'waktu') {
		return { ok: false, message: 'Perpanjang memakai jumlah jam atau hari.' };
	}
	if (input.mode === 'waktu') {
		const at = parseJakartaDateTime(input.nilai);
		if (!at) return { ok: false, message: 'Tanggal dan waktu berlaku belum valid.' };
		if (at.getTime() <= now.getTime()) return { ok: false, message: 'Waktu berlaku harus setelah sekarang.' };
		return { ok: true, iso: at.toISOString() };
	}
	const span = durationMs(input.mode, input.nilai);
	if (span === null) {
		return {
			ok: false,
			message: input.mode === 'jam' ? `Isi jumlah jam, dari 1 sampai ${MAX_VALIDITY_HOURS}.` : `Isi jumlah hari, dari 1 sampai ${MAX_VALIDITY_DAYS}.`
		};
	}
	let base = now.getTime();
	if (input.action === 'perpanjang' && input.current) {
		const current = new Date(input.current).getTime();
		if (Number.isFinite(current) && current > now.getTime()) base = current;
	}
	return { ok: true, iso: new Date(base + span).toISOString() };
}

export type Remaining = {
	expired: boolean;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
};

export function validityRemaining(expiresAt: string, now = new Date()): Remaining {
	const end = new Date(expiresAt).getTime();
	const totalMs = end - now.getTime();
	if (!Number.isFinite(end) || totalMs <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
	const totalSeconds = Math.floor(totalMs / 1000);
	return {
		expired: false,
		days: Math.floor(totalSeconds / 86400),
		hours: Math.floor((totalSeconds % 86400) / 3600),
		minutes: Math.floor((totalSeconds % 3600) / 60),
		seconds: totalSeconds % 60
	};
}

/** `2 hari 04:12:08` atau `04:12:08` bila kurang dari sehari. */
export function formatSisaWaktu(remaining: Remaining): string {
	const clock = [remaining.hours, remaining.minutes, remaining.seconds].map((part) => String(part).padStart(2, '0')).join(':');
	return remaining.days > 0 ? `${remaining.days} hari ${clock}` : clock;
}

export function validitySnapshot(iso: string | null, now = new Date()): { iso: string; label: string; expired: boolean } | null {
	if (!iso) return null;
	const time = new Date(iso).getTime();
	if (!Number.isFinite(time)) return null;
	return { iso, label: formatBerlakuHingga(iso), expired: time <= now.getTime() };
}
