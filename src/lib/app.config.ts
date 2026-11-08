export const APP = {
  name: "Bel Madrasah",
  logo: "/icon.svg",
  themeColor: "#0969da",
  watermark: "ZEDLABS",
  login: {
    title: "Masuk ke panel",
    description: "Gunakan username dan password akun administrator.",
    headline: "Bel madrasah Anda, tepat waktu setiap hari.",
    lead: "Jadwal, nada, dan hari libur dikelola dari satu tempat.",
    features: [
      {
        title: "Berbunyi otomatis sesuai jadwal",
        desc: "Scheduler berjalan di server dan tidak bergantung pada browser.",
      },
      {
        title: "Mode jadwal yang fleksibel",
        desc: "Reguler, Ramadhan, PTS, PAS, dan pesantren siap dipakai.",
      },
      {
        title: "Libur dan nada mudah diatur",
        desc: "Impor libur nasional dan unggah audio dalam beberapa klik.",
      },
    ],
  },
} as const;
