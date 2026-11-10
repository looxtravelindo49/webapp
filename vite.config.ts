import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { vercelRegions } from './src/lib/vercel-regions.ts';

// Di Vercel (VERCEL=1 diset otomatis saat build) pakai adapter-vercel; selain itu adapter-node
// (kontainer, `npm start`, dan suite e2e yang menjalankan `node build`).
// Wilayah fungsi sedekat mungkin dengan database Turso: VERCEL_REGIONS bila diatur, selain itu hnd1 (Tokyo).
const onVercel = !!process.env.VERCEL;
const regions = vercelRegions(process.env);

export default defineConfig({
	ssr: { external: ['sharp'] },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: onVercel ? adapterVercel({ runtime: 'nodejs22.x', regions }) : adapterNode()
		})
	],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
