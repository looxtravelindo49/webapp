// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Pengguna admin dari sesi (hanya diisi untuk path /admin); tanpa hash password. */
			user: { id: number; login: string; must_change_password: number } | null;
			/** Token sesi mentah dari cookie (untuk logout/ganti password). */
			sessionToken: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
