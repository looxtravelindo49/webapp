import type { LayoutServerLoad } from './$types';

// Jangan biarkan router mengalihkan `/admin/` → `/admin` sendiri: pengalihan itu terjadi sebelum
// `handle`, sehingga header keamanan area admin tidak ikut terpasang. Dengan 'ignore', `handle`
// selalu berjalan untuk semua path `/admin*`.
export const trailingSlash = 'ignore';

export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user });
