export type Article = { category: string; title: string; body: string };

export const articlesSection = {
	eyebrow: 'BEKAL SEBELUM BERANGKAT',
	title: 'Ide untuk trip berikutnya.',
	sub: 'Biar obrolan di grup kantor mulai punya arah.'
} as const;

export const articles: Article[] = [
	{
		category: 'PERENCANAAN',
		title: 'Mau gathering kantor? Sepakati 5 hal ini dulu.',
		body: 'Mulai dengan tujuan kegiatan. Apakah tim ingin beristirahat, saling mengenal, atau merayakan pencapaian? Jawaban ini membantu memilih aktivitas yang tepat.\n\nSetelah itu, sepakati jumlah peserta, tanggal, kisaran anggaran, dan titik keberangkatan. Lima hal ini sudah cukup untuk memulai diskusi dengan penyelenggara.\n\nCatat juga kebutuhan khusus peserta, seperti makanan, mobilitas, atau jadwal ibadah. Detail kecil sering menentukan kenyamanan perjalanan.'
	},
	{
		category: 'PILIH KEGIATAN',
		title: 'Offroad atau santai di pantai? Kenali selera timmu.',
		body: 'Sebelum memilih aktivitas, ajak tim menyampaikan keinginan dan batas kenyamanannya. Aktivitas yang seru bagi sebagian orang belum tentu cocok untuk semua peserta.\n\nOffroad bisa menjadi bahan obrolan baru untuk tim yang menyukai petualangan. Kegiatan pantai memberi ruang lebih fleksibel untuk berkumpul dan bersantai.\n\nPilih program dengan mempertimbangkan kondisi peserta, waktu perjalanan, dan tujuan acara. Sisakan pilihan aktivitas ringan bagi yang membutuhkan.'
	},
	{
		category: 'TIPS PANITIA',
		title: 'Itinerary yang enak tidak harus padat acara.',
		body: 'Sisakan waktu untuk perpindahan, istirahat, makan, dan persiapan. Jadwal tanpa jeda mudah membuat peserta lelah dan acara berikutnya terlambat.\n\nTentukan beberapa kegiatan utama sebagai prioritas. Kegiatan tambahan bisa menyesuaikan kondisi di lokasi.\n\nSepakati siapa yang mengambil keputusan saat cuaca berubah atau perjalanan melambat. Siapkan rencana cadangan yang tetap nyaman untuk peserta.'
	}
];
