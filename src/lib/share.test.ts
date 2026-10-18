import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareFile, downloadBlob, sharePdf } from './share';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

const file = () => new File(['%PDF'], 'x.pdf', { type: 'application/pdf' });

describe('canShareFile', () => {
	it('false bila navigator tidak ada', () => {
		vi.stubGlobal('navigator', undefined);
		expect(canShareFile()).toBe(false);
	});
	it('false bila share atau canShare tidak tersedia', () => {
		vi.stubGlobal('navigator', {});
		expect(canShareFile()).toBe(false);
		vi.stubGlobal('navigator', { share: vi.fn() });
		expect(canShareFile()).toBe(false);
	});
	it('true bila canShare menyetujui berkas PDF dummy, dan dipanggil dengan application/pdf', () => {
		const canShare = vi.fn(() => true);
		vi.stubGlobal('navigator', { share: vi.fn(), canShare });
		expect(canShareFile()).toBe(true);
		const arg = (canShare.mock.calls[0] as unknown as [{ files: File[] }])[0];
		expect(arg.files).toHaveLength(1);
		expect(arg.files[0].type).toBe('application/pdf');
	});
	it('false bila canShare menolak atau melempar', () => {
		vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => false });
		expect(canShareFile()).toBe(false);
		vi.stubGlobal('navigator', {
			share: vi.fn(),
			canShare: () => {
				throw new Error('x');
			}
		});
		expect(canShareFile()).toBe(false);
	});
});

describe('sharePdf', () => {
	it('shared: share dipanggil dengan satu berkas dan teks', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { share });
		const f = file();
		expect(await sharePdf(f, 'halo')).toBe('shared');
		expect(share).toHaveBeenCalledWith({ files: [f], text: 'halo' });
	});
	it('aborted: AbortError berarti pengguna membatalkan', async () => {
		vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')) });
		expect(await sharePdf(file(), 't')).toBe('aborted');
	});
	it('failed: NotAllowedError dan galat lain', async () => {
		vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('x', 'NotAllowedError')) });
		expect(await sharePdf(file(), 't')).toBe('failed');
		vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('boom')) });
		expect(await sharePdf(file(), 't')).toBe('failed');
		vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(undefined) });
		expect(await sharePdf(file(), 't')).toBe('failed');
	});
});

describe('downloadBlob', () => {
	it('membuat tautan unduh dengan nama berkas, mengkliknya, lalu membersihkan', () => {
		vi.useFakeTimers();
		const click = vi.fn();
		const remove = vi.fn();
		const anchor: Record<string, unknown> = { click, remove };
		const append = vi.fn();
		vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild: append } });
		const create = vi.fn(() => 'blob:abc');
		const revoke = vi.fn();
		vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });

		downloadBlob(new Blob(['x']), 'estimasi-trip-tim.pdf');

		expect(anchor.href).toBe('blob:abc');
		expect(anchor.download).toBe('estimasi-trip-tim.pdf');
		expect(append).toHaveBeenCalledWith(anchor);
		expect(click).toHaveBeenCalledOnce();
		expect(remove).toHaveBeenCalledOnce();
		expect(revoke).not.toHaveBeenCalled();
		vi.advanceTimersByTime(10_000);
		expect(revoke).toHaveBeenCalledWith('blob:abc');
	});
});
