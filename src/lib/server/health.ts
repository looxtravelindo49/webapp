import type { Db } from './db';

/** 200 `{"ok":true}` bila database terbaca, 503 bila tidak. */
export function health(getDatabase: () => Db): Response {
	try {
		getDatabase().prepare('SELECT 1').pluck().get();
		return Response.json({ ok: true });
	} catch {
		return Response.json({ ok: false }, { status: 503 });
	}
}
