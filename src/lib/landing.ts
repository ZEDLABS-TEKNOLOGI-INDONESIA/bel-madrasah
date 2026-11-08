import {
  BellRing,
  CalendarClock,
  CalendarOff,
  Download,
  Layers,
  Music2,
  ScrollText,
  Server,
  Smartphone,
  Upload,
  Volume2,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
}

export interface IconText {
  title: string;
  desc: string;
  icon: LucideIcon;
}

export interface Step extends IconText {
  time: string;
}

export interface ServerLayer {
  title: string;
  desc: string;
}

export type RoleKey = "log" | "jadwal" | "status";

export interface Role {
  key: RoleKey;
  title: string;
  lead: string;
  points: readonly string[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface PreviewRow {
  waktu: string;
  audio: string;
}

export interface DemoRow extends PreviewRow {
  result: "played" | "skipped";
}

export const LANDING = {
  description:
    "Bel otomatis untuk madrasah dan sekolah. Jadwal, nada, dan hari libur diatur dari satu panel, dan bel tetap berbunyi tepat waktu dari server.",
  eyebrow: "Bel otomatis untuk madrasah dan sekolah",
  headline: "Bel berbunyi tepat waktu. Guru piket tidak perlu menekan apa pun.",
  lead: "Susun jadwal sekali, pilih nada, dan tandai hari libur. Scheduler berjalan di server, jadi bel tetap berbunyi walaupun panel ditutup.",
  primaryCta: "Masuk ke panel",
  secondaryCta: "Coba demonya",
  madeBy: "Dibuat oleh",
  stepsEyebrow: "Cara kerja",
  stepsTitle: "Satu kali atur, lima tahap berjalan sendiri",
  stepsLead: "Dari nada diunggah sampai riwayat tercatat, tidak ada yang perlu dibunyikan manual.",
  serverEyebrow: "Berjalan di server",
  serverTitle: "Browser ditutup? Bel tetap berbunyi.",
  serverLead:
    "Scheduler hidup di server madrasah. Panel ini hanya untuk mengatur, bukan untuk menjalankan bel.",
  benefitsEyebrow: "Keunggulan",
  benefitsTitle: "Dibuat untuk jam pelajaran yang tidak boleh meleset",
  rolesEyebrow: "Untuk setiap peran",
  rolesTitle: "Setiap orang di madrasah mengerjakan lebih sedikit",
  faqEyebrow: "Pertanyaan",
  faqTitle: "Hal yang sering ditanyakan",
  ctaTitle: "Siap mengotomatiskan bel madrasah?",
  ctaLead: "Masuk dengan akun administrator untuk mulai mengatur jadwal.",
  nowAt: "Dipakai di",
} as const;

export const DEMO = {
  title: "Coba sendiri",
  liburLabel: "Hari libur",
  ring: "Bunyikan bel contoh",
  ringing: "Bel berbunyi:",
  idle: "Tekan tombol, lalu aktifkan hari libur dan tekan lagi.",
  done: "Selesai. Bel tercatat di riwayat.",
  skipped: "Hari libur aktif, bel dilewati dan tidak berbunyi.",
  waiting: "Menunggu bel berikutnya",
  empty: "Belum ada bel pada demo ini.",
  played: "Berbunyi",
  skippedBadge: "Dilewati",
  ringMs: 3000,
  maxRows: 4,
} as const;

export const NAV_LINKS: readonly NavLink[] = [
  { label: "Cara kerja", href: "#cara-kerja" },
  { label: "Keunggulan", href: "#keunggulan" },
  { label: "Fitur", href: "#fitur" },
  { label: "Pertanyaan", href: "#tanya" },
];

export const PREVIEW: readonly PreviewRow[] = [
  { waktu: "06:45", audio: "Indonesia Raya" },
  { waktu: "07:00", audio: "Pelajaran 1" },
  { waktu: "07:45", audio: "Pelajaran 2" },
  { waktu: "09:30", audio: "Istirahat 1" },
  { waktu: "12:00", audio: "Pelajaran selesai" },
];

export const STEPS: readonly Step[] = [
  {
    time: "Sekali",
    title: "Nada diunggah",
    desc: "Tambahkan file mp3, wav, atau ogg untuk bel, upacara, dan pengumuman.",
    icon: Upload,
  },
  {
    time: "Per mode",
    title: "Jadwal disusun",
    desc: "Pilih mode, hari, jam, dan audio. Satu bel dapat berlaku untuk beberapa hari.",
    icon: CalendarClock,
  },
  {
    time: "Setiap hari",
    title: "Server menentukan mode",
    desc: "Mode aktif mengikuti rentang tanggal atau override manual. Hari libur dilewati.",
    icon: Layers,
  },
  {
    time: "Tepat waktu",
    title: "Bel berbunyi",
    desc: "Audio diputar lewat speaker yang terhubung ke server, tanpa browser terbuka.",
    icon: BellRing,
  },
  {
    time: "Kapan saja",
    title: "Riwayat tercatat",
    desc: "Setiap bel yang berbunyi masuk ke log lengkap dengan mode, hari, dan jam.",
    icon: ScrollText,
  },
];

export const SERVER_LAYERS: readonly ServerLayer[] = [
  {
    title: "Mode otomatis",
    desc: "Ramadhan, PTS, PAS, dan pesantren berganti sesuai rentang tanggal, atau dipaksa lewat override manual.",
  },
  {
    title: "Libur dilewati",
    desc: "Libur nasional dan libur lokal membuat bel tidak berbunyi pada tanggal itu.",
  },
  {
    title: "Hari bisa dimatikan",
    desc: "Nonaktifkan hari tertentu pada satu mode tanpa menghapus jadwalnya.",
  },
  {
    title: "Mudah dicadangkan",
    desc: "Jadwal diekspor ke satu berkas JSON dan dapat dipulihkan kapan saja.",
  },
];

export const BENEFITS: readonly IconText[] = [
  {
    title: "Berjalan di server",
    desc: "Bel tidak bergantung pada browser atau perangkat guru piket.",
    icon: Server,
  },
  {
    title: "Banyak mode jadwal",
    desc: "Reguler, Ramadhan, PTS, PAS, pesantren, dan lainnya dengan jadwal sendiri.",
    icon: CalendarClock,
  },
  {
    title: "Libur sekali impor",
    desc: "Tarik libur nasional dan cuti bersama, lalu tambah libur lokal sendiri.",
    icon: CalendarOff,
  },
  {
    title: "Nada dengan pratinjau",
    desc: "Dengarkan setiap audio sebelum dipakai, tanpa menunggu jam bel.",
    icon: Music2,
  },
  {
    title: "Volume sampai 200 persen",
    desc: "Atur keluaran speaker dari panel, dari senyap sampai diperkeras.",
    icon: Volume2,
  },
  {
    title: "Riwayat bel",
    desc: "Lihat bel apa saja yang sudah berbunyi, kapan, dan pada mode apa.",
    icon: ScrollText,
  },
  {
    title: "Backup dan restore",
    desc: "Cadangkan seluruh jadwal ke JSON dan pulihkan bila ada yang salah hapus.",
    icon: Download,
  },
  {
    title: "Bisa dipasang di HP",
    desc: "Panel mengikuti ukuran layar dan dapat dipasang sebagai aplikasi.",
    icon: Smartphone,
  },
];

export const ROLES: readonly Role[] = [
  {
    key: "log",
    title: "Kepala madrasah",
    lead: "Bel berjalan sesuai jadwal, dan buktinya tercatat.",
    points: [
      "Riwayat bel yang sudah berbunyi, lengkap dengan mode, hari, dan jam",
      "Status scheduler dan mode aktif terlihat langsung di dasbor",
      "Hari libur tampak jelas sehingga tidak ada bel yang berbunyi sia-sia",
    ],
  },
  {
    key: "jadwal",
    title: "Operator dan tata usaha",
    lead: "Jadwal semester baru selesai tanpa mengetik ulang.",
    points: [
      "Satu bel dapat berlaku untuk beberapa hari sekaligus",
      "Reset ke jadwal bawaan untuk setiap mode",
      "Impor libur nasional dan cuti bersama dalam satu klik",
      "Unggah nada baru berformat mp3, wav, atau ogg",
    ],
  },
  {
    key: "status",
    title: "Teknisi dan pengelola",
    lead: "Layanan tetap sehat tanpa membuka terminal.",
    points: [
      "Cek kesehatan layanan dari halaman pengaturan",
      "Backup jadwal ke berkas JSON dan restore kapan saja",
      "Atur volume keluaran hingga 200 persen",
      "Ganti password administrator langsung dari panel",
    ],
  },
];

export const FAQ: readonly FaqItem[] = [
  {
    q: "Apakah browser harus tetap terbuka agar bel berbunyi?",
    a: "Tidak. Scheduler berjalan di server. Panel hanya dipakai untuk mengatur jadwal, nada, dan hari libur.",
  },
  {
    q: "Apa yang terjadi pada hari libur?",
    a: "Bel dilewati otomatis pada tanggal yang terdaftar sebagai libur, baik libur nasional hasil impor maupun libur lokal.",
  },
  {
    q: "Format audio apa yang didukung?",
    a: "File mp3, wav, dan ogg dengan ukuran maksimal 32 MB per file.",
  },
  {
    q: "Bisakah dipakai dari smartphone?",
    a: "Bisa. Tampilan menyesuaikan layar kecil dan panel dapat dipasang ke layar utama sebagai aplikasi.",
  },
  {
    q: "Bagaimana jika jadwal tidak sengaja terhapus?",
    a: "Pulihkan dari berkas backup JSON, atau reset satu mode ke jadwal bawaan dari halaman Jadwal.",
  },
];
