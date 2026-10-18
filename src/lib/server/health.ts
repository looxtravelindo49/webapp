import { scalar, type Db } from './db';

/** 200 `{"ok":true}` bila database terbaca, 503 bila tidak. */
export async function health(getDatabase: () => Promise<Db>): Promise<Response> {
	try {
		await scalar(await getDatabase(), 'SELECT 1');
		return Response.json({ ok: true });
	} catch {
		return Response.json({ ok: false }, { status: 503 });
	}
}
