package main

func defaultJadwal() ModeJadwal {
	b := toneDir
	j := make(ModeJadwal)
	for _, m := range AllModes {
		j[m] = map[string][]Entry{}
		for _, h := range AllHari {
			j[m][h] = []Entry{}
		}
	}

	seninKamis := func(pagi []Entry) []Entry {
		e := []Entry{
			{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
			{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		}
		e = append(e, pagi...)
		return append(e,
			Entry{Waktu: "07:50", Audio: b + "/pelajaran-1.mp3"},
			Entry{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
			Entry{Waktu: "09:10", Audio: b + "/pelajaran-3.mp3"},
			Entry{Waktu: "09:50", Audio: b + "/istirahat-1.mp3"},
			Entry{Waktu: "10:10", Audio: b + "/pelajaran-4.mp3"},
			Entry{Waktu: "10:50", Audio: b + "/pelajaran-5.mp3"},
			Entry{Waktu: "11:30", Audio: b + "/istirahat-2.mp3"},
			Entry{Waktu: "12:40", Audio: b + "/pelajaran-6.mp3"},
			Entry{Waktu: "13:20", Audio: b + "/pelajaran-7.mp3"},
			Entry{Waktu: "14:00", Audio: b + "/pelajaran-8.mp3"},
			Entry{Waktu: "14:40", Audio: b + "/pelajaran-9.mp3"},
			Entry{Waktu: "15:20", Audio: b + "/pelajaran-selesai.mp3"},
			Entry{Waktu: "15:21", Audio: b + "/tanah-airku.mp3"},
		)
	}
	j["reguler"]["Senin"] = seninKamis([]Entry{{Waktu: "07:00", Audio: b + "/upacara.mp3"}})
	j["reguler"]["Selasa"] = seninKamis(nil)
	j["reguler"]["Rabu"] = seninKamis([]Entry{{Waktu: "07:00", Audio: b + "/literasi.mp3"}})
	j["reguler"]["Kamis"] = seninKamis([]Entry{{Waktu: "07:00", Audio: b + "/rohani.mp3"}})
	j["reguler"]["Jumat"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/rohani.mp3"},
		{Waktu: "07:50", Audio: b + "/pelajaran-1.mp3"},
		{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "09:10", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:50", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "10:10", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "10:50", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "11:30", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "13:10", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "13:50", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "14:30", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "15:10", Audio: b + "/akhir-pekan.mp3"},
		{Waktu: "15:11", Audio: b + "/pramuka.mp3"},
		{Waktu: "15:12", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "16:00", Audio: b + "/hymne-madrasah.mp3"},
	}

	j["ramadhan"]["Senin"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/upacara.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:00", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:30", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:40", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:20", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Selasa"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:10", Audio: b + "/pelajaran-1.mp3"},
		{Waktu: "07:50", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:30", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:10", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:40", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:50", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Rabu"] = copyEntries(j["ramadhan"]["Selasa"])
	j["ramadhan"]["Kamis"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/literasi.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:00", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:30", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:40", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:20", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Jumat"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/rohani.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:00", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:10", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "09:50", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "10:20", Audio: b + "/akhir-pekan.mp3"},
		{Waktu: "10:21", Audio: b + "/tanah-airku.mp3"},
	}

	ptsEntry := func(hari string) []Entry {
		if hari == "Jumat" {
			return []Entry{
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "09:31", Audio: b + "/tanah-airku.mp3"},
			}
		}
		return []Entry{
			{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
			{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
			{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
			{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
			{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
			{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
		}
	}
	for _, h := range []string{"Senin", "Selasa", "Rabu", "Kamis", "Jumat"} {
		j["pts"][h] = ptsEntry(h)
		j["pas"][h] = ptsEntry(h)
	}
	return j
}
