import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CdpPage, launchChrome } from "./cdp.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const PORT = Number(process.env.E2E_PORT ?? 18083);
const BASE = `http://127.0.0.1:${PORT}`;
const PANEL = ["/", "/jadwal", "/audio", "/libur", "/log", "/settings"];
const PUBLIC = ["/landing", "/login"];
const WIDTHS = [360, 1280];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

if (!existsSync(join(ROOT, "dist/index.html"))) {
  console.error("dist/ belum ada. Jalankan pnpm build terlebih dahulu.");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "bel-e2e-"));
const base = join(work, "base");
mkdirSync(join(base, "tone"), { recursive: true });
cpSync(join(ROOT, "dist"), join(base, "static"), { recursive: true });
for (const f of readdirSync(join(ROOT, "tone"))) cpSync(join(ROOT, "tone", f), join(base, "tone", f));

const bin = join(work, "bel");
execFileSync("go", ["build", "-o", bin, "./server"], { cwd: ROOT, stdio: "inherit" });
const server = spawn(bin, [], {
  env: { ...process.env, BEL_BASE_DIR: base, BEL_PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

let chrome;
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) break;
    } catch {}
    await sleep(100);
  }

  const login = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "administrator", password: "P@ssw0rd" }),
  });
  const token = /bel_session=([^;]+)/.exec(login.headers.get("set-cookie") ?? "")?.[1];
  check("login", Boolean(token));

  chrome = await launchChrome(join(work, "profile"));
  const page = await CdpPage.open(chrome);

  await page.goto(`${BASE}/login`);
  await page.eval(`localStorage.setItem("install-dismissed-at", String(Date.now()))`);

  for (const width of WIDTHS) {
    await page.viewport(width, 900);
    await page.clearCookies();
    for (const path of PUBLIC) {
      await page.goto(BASE + path);
      const w = await page.eval(`document.documentElement.scrollWidth`);
      check(`layout ${path} @${width}`, w <= width, `scrollWidth=${w}`);
    }
    await page.setCookie("bel_session", token, BASE);
    for (const path of PANEL) {
      await page.goto(BASE + path);
      const w = await page.eval(`document.documentElement.scrollWidth`);
      check(`layout ${path} @${width}`, w <= width, `scrollWidth=${w}`);
      if (width < 768) {
        const small = await page.eval(`[...document.querySelectorAll("main button, main select, nav a, [role=switch]")]
          .map((el) => [el, el.getBoundingClientRect()])
          .filter(([, r]) => r.width > 0 && (r.height < 28 || r.width < 28))
          .map(([el, r]) => (el.getAttribute("aria-label") || el.textContent.trim()).slice(0, 30) + " " + Math.round(r.width) + "x" + Math.round(r.height))`);
        check(`touch targets ${path} @${width}`, small.length === 0, small.join(", "));
      }
    }
  }

  await page.viewport(360, 900);
  await page.goto(`${BASE}/audio`);

  await page.click('[aria-label="Ganti nama akhir-pekan.mp3"]');
  check("rename: modal prefilled", (await page.eval(`document.querySelector("#rename-input")?.value`)) === "akhir-pekan");
  check("rename: focus inside modal", await page.eval(`document.activeElement?.id === "rename-input"`));
  await page.type("#rename-input", "Akhir Pekan Baru");
  await page.eval(`document.querySelector("[role=dialog] form").requestSubmit()`);
  check("rename: toast", await page.waitFor(`/akhir-pekan-baru\\.mp3.*jadwal ikut diperbarui/.test(document.body.textContent)`));
  check("rename: list updated", await page.exists('[aria-label="Ganti nama akhir-pekan-baru.mp3"]'));

  await page.click('[aria-label="Ganti nama akhir-pekan-baru.mp3"]');
  await page.type("#rename-input", "hymne madrasah");
  await page.eval(`document.querySelector("[role=dialog] form").requestSubmit()`);
  check("rename: conflict rejected", await page.waitFor(`/sudah ada/.test(document.body.textContent)`));
  await page.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`);
  check("modal: escape closes", await page.waitFor(`!document.querySelector("[role=dialog]")`));

  await page.click('[aria-label="Aktifkan equalizer"]');
  await page.clickText("button", "Bass");
  check("equalizer: preset applied", (await page.eval(`document.querySelector('[aria-label="Gain 60 Hz"]')?.getAttribute("aria-valuetext")`)) === "+6 dB");
  await page.clickText("button", "Simpan");
  await sleep(1000);
  const eq = await page.api("/api/equalizer");
  check("equalizer: stored on server", eq.enabled === true && eq.gains.join(",") === "6,3,0,0,0", JSON.stringify(eq.gains));

  await page.click('[aria-label="Putar pelajaran-1.mp3"]');
  await sleep(1000);
  check("preview: playing in browser", await page.exists('[aria-label="Stop pelajaran-1.mp3"]'));
  await page.click('[aria-label="Stop pelajaran-1.mp3"]');

  const usage = (await page.api("/api/tones?per_page=500")).usage["mars-madrasah.mp3"] ?? 0;
  check("delete: tone has usage", usage > 0, `usage=${usage}`);
  await page.click('[aria-label="Hapus mars-madrasah.mp3"]');
  await page.waitFor(`!!document.querySelector("[role=dialog]")`);
  check("delete: confirm mentions schedules", /dipakai \d+ jadwal/.test(await page.eval(`document.querySelector("[role=dialog]")?.textContent ?? ""`)));
  await page.clickText("[role=dialog] button", "Hapus");
  check("delete: toast reports cascade", await page.waitFor(`/${usage} jadwal ikut dihapus/.test(document.body.textContent)`));
  const jadwalFile = JSON.parse(readFileSync(join(base, "data/jadwal.json"), "utf8"));
  check("delete: no schedule references left", !JSON.stringify(jadwalFile).includes("/mars-madrasah.mp3"));

  await page.goto(`${BASE}/jadwal`);
  await page.select("#jadwal-mode", "lainnya");
  await sleep(800);
  await page.clickText("button", "Tambah bel");
  await sleep(500);
  await page.type("#entry-waktu", "09:15");
  await page.select("#entry-audio", "literasi.mp3");
  await page.clickText("[role=dialog] button", "Simpan");
  await sleep(1500);
  const lainnya = await page.api("/api/jadwal?mode=lainnya");
  const added = lainnya.jadwal.Senin.find((e) => e.waktu === "09:15");
  check("jadwal: add bell with bare filename", added?.audio === join(base, "tone/literasi.mp3"), added?.audio);

  await page.goto(`${BASE}/settings`);
  check("audio: device card rendered", await page.waitFor(`!!document.querySelector("#audio-device")`));
  check(
    "audio: automatic option offered",
    await page.eval(`document.querySelector("#audio-device").options[0].textContent.startsWith("Otomatis")`),
  );
  check("audio: test button present", await page.waitFor(`[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Tes speaker")`));
  await page.select("#audio-device", "default");
  await page.clickText("button", "Simpan");
  const savedDevice = await page.waitFor(`/Perangkat audio disimpan/.test(document.body.textContent)`);
  const devices = await page.api("/api/audio/devices");
  check("audio: choice saved", savedDevice && devices.selected === "default" && devices.source === "pengaturan", JSON.stringify({ selected: devices.selected, source: devices.source }));
  await page.select("#audio-device", "");
  await page.clickText("button", "Simpan");
  await page.waitFor(`/Deteksi otomatis/.test(document.body.textContent)`);
  check("audio: back to automatic", (await page.api("/api/audio/devices")).source === "otomatis");

  check("no console errors", page.errors.length === 0, page.errors.join(" || "));
} catch (e) {
  failures.push(String(e));
  console.error(e);
} finally {
  chrome?.kill();
  server.kill();
  if (failures.length > 0) console.log("\n--- server log ---\n" + serverLog.slice(-3000));
  rmSync(work, { recursive: true, force: true });
}

console.log(`\n${failures.length === 0 ? "e2e lulus" : `${failures.length} gagal: ${failures.join(", ")}`}`);
process.exit(failures.length === 0 ? 0 : 1);
