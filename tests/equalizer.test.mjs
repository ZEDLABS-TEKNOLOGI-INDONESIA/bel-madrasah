import assert from "node:assert/strict";
import { test } from "node:test";
import { EQ_PRESETS, matchPreset } from "../src/lib/constants.ts";
import { formatFrequency, formatGain, stripAudioExt } from "../src/lib/format.ts";

test("setiap preset punya lima band dalam rentang -12 sampai 12 dB", () => {
  for (const p of EQ_PRESETS) {
    assert.equal(p.gains.length, 5, p.key);
    for (const g of p.gains) assert.ok(g >= -12 && g <= 12, `${p.key} ${g}`);
  }
  assert.equal(new Set(EQ_PRESETS.map((p) => p.key)).size, EQ_PRESETS.length);
});

test("matchPreset mengenali preset dan menolak nilai kustom", () => {
  assert.equal(matchPreset([0, 0, 0, 0, 0]), "flat");
  assert.equal(matchPreset([6, 3, 0, 0, 0]), "bass");
  assert.equal(matchPreset([1, 0, 0, 0, 0]), null);
  assert.equal(matchPreset([0, 0, 0]), null);
});

test("formatFrequency memakai Hz dan kHz", () => {
  assert.equal(formatFrequency(60), "60 Hz");
  assert.equal(formatFrequency(1000), "1 kHz");
  assert.equal(formatFrequency(2500), "2.5 kHz");
  assert.equal(formatFrequency(12000), "12 kHz");
});

test("formatGain memberi tanda", () => {
  assert.equal(formatGain(0), "0 dB");
  assert.equal(formatGain(3), "+3 dB");
  assert.equal(formatGain(-2.5), "-2.5 dB");
});

test("stripAudioExt hanya membuang ekstensi audio", () => {
  assert.equal(stripAudioExt("bel-masuk.mp3"), "bel-masuk");
  assert.equal(stripAudioExt("Bel.OGG"), "Bel");
  assert.equal(stripAudioExt("versi.2"), "versi.2");
});
