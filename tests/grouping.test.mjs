import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGroups } from "../src/components/jadwal/grouping.ts";

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const bel = (waktu, audio = "/t/a.mp3") => ({ waktu, audio });

test("menggabungkan bel yang sama pada hari berurutan menjadi satu rentang", () => {
  const jadwal = {
    Senin: [bel("07:00"), bel("09:00", "/t/b.mp3")],
    Selasa: [bel("07:00")],
    Rabu: [bel("07:00")],
  };
  const groups = buildGroups(jadwal, HARI);
  assert.equal(groups[0].label, "Senin-Rabu");
  assert.deepEqual(groups[0].items.map((i) => i.waktu), ["07:00"]);
  assert.equal(groups[1].label, "Senin");
  assert.equal(groups[1].items[0].audio, "/t/b.mp3");
});

test("hari tidak berurutan ditulis dengan koma", () => {
  const groups = buildGroups({ Senin: [bel("07:00")], Rabu: [bel("07:00")] }, HARI);
  assert.equal(groups[0].label, "Senin, Rabu");
});

test("semua hari diberi label setiap hari", () => {
  const jadwal = Object.fromEntries(HARI.map((h) => [h, [bel("06:00")]]));
  assert.equal(buildGroups(jadwal, HARI)[0].label, "Setiap hari");
});

test("isi kelompok diurutkan berdasarkan waktu", () => {
  const groups = buildGroups({ Senin: [bel("10:00"), bel("07:30", "/t/b.mp3")] }, HARI);
  assert.deepEqual(groups[0].items.map((i) => i.waktu), ["07:30", "10:00"]);
});

test("jadwal kosong menghasilkan daftar kosong", () => {
  assert.deepEqual(buildGroups({}, HARI), []);
});
