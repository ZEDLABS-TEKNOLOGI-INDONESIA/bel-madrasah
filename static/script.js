const MODE_LABELS = { reguler: "Reguler", ramadhan: "Ramadhan", pts: "PTS", pas: "PAS" };
const DAY_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

let currentJadwalMode = "reguler";
let currentHari = null;
let editIndex = -1;
let allTones = [];
let jadwalData = {};
let configData = {};
let deferredInstall = null;

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = "toast"), 3000);
}

async function api(url, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
  return data;
}

function switchTab(id, btn) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById("sec-" + id).classList.add("active");
  btn.classList.add("active");
  if (id === "audio") loadTones();
  if (id === "log") loadLog();
  if (id === "libur") loadLibur();
  if (id === "mode") renderModeUI();
}

function logout() {
  window.location.href = "/logout";
}

async function loadStatus() {
  try {
    const d = await api("/api/service/status");
    const dot = document.getElementById("statusDot");
    dot.className = "dot" + (d.running ? " on" : "");
    document.getElementById("statusText").textContent = d.running ? "Aktif" : "Nonaktif";
    document.getElementById("toggleBtn").textContent = d.running ? "Hentikan" : "Aktifkan";

    const mode = d.active_mode || "reguler";
    const badge = document.getElementById("modeBadge");
    badge.textContent = MODE_LABELS[mode] || mode;
    badge.className = "badge badge-mode " + mode;

    const liburBadge = document.getElementById("liburBadge");
    liburBadge.style.display = d.is_libur ? "" : "none";
  } catch (_) {}
}

async function toggleService() {
  try {
    const d = await api("/api/service/toggle", "POST");
    toast(d.message);
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadConfig() {
  try {
    const d = await api("/api/config");
    configData = d.config;
    return d;
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderModeUI() {
  if (!configData.mode) return;
  const m = configData.mode;
  const map = {
    reguler: "modeOptReguler",
    ramadhan: "modeOptRamadhan",
    pts: "modeOptPTS",
    pas: "modeOptPAS",
  };

  ["reguler", "ramadhan", "pts", "pas"].forEach((k) => {
    const el = document.getElementById(map[k]);
    const base = k === "reguler" ? "mode-opt" : `mode-opt ${k}`;
    el.className = base + (m === k ? " active" : "");
  });

  document.getElementById("overrideToggle").checked = configData.manual_override;
  document.getElementById("ramadhanStart").value = configData.ramadhan_start || "";
  document.getElementById("ramadhanEnd").value = configData.ramadhan_end || "";
  document.getElementById("ptsStart").value = configData.pts_start || "";
  document.getElementById("ptsEnd").value = configData.pts_end || "";
  document.getElementById("pasStart").value = configData.pas_start || "";
  document.getElementById("pasEnd").value = configData.pas_end || "";
}

function selectMode(mode) {
  configData.mode = mode;
  renderModeUI();
}

function onOverrideChange() {
  configData.manual_override = document.getElementById("overrideToggle").checked;
}

async function saveConfig() {
  const start = document.getElementById("ramadhanStart").value.trim();
  const end = document.getElementById("ramadhanEnd").value.trim();
  const mmdd = /^\d{2}-\d{2}$/;

  if (start && !mmdd.test(start)) {
    toast("Format Ramadhan harus MM-DD", "error");
    return;
  }
  if (end && !mmdd.test(end)) {
    toast("Format Ramadhan harus MM-DD", "error");
    return;
  }

  try {
    await api("/api/config", "POST", {
      mode: configData.mode,
      manual_override: document.getElementById("overrideToggle").checked,
      ramadhan_start: start,
      ramadhan_end: end,
      pts_start: document.getElementById("ptsStart").value,
      pts_end: document.getElementById("ptsEnd").value,
      pas_start: document.getElementById("pasStart").value,
      pas_end: document.getElementById("pasEnd").value,
    });
    toast("Pengaturan disimpan");
    loadStatus();
    await loadConfig();
    renderModeUI();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadLibur() {
  try {
    const d = await api("/api/libur");
    const list = d.libur || [];
    document.getElementById("liburCount").textContent = list.length;
    const c = document.getElementById("liburList");
    if (!list.length) {
      c.innerHTML = '<div class="empty">Belum ada hari libur terdaftar</div>';
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    c.innerHTML = list
      .map((date) => {
        const isToday = date === today;
        return `<div class="libur-item${isToday ? " today" : ""}">
        <div class="libur-date">${formatDate(date)}${isToday ? '<span class="today-tag">Hari Ini</span>' : ""}</div>
        <button class="btn danger sm" onclick="deleteLibur('${date}')">Hapus</button>
      </div>`;
      })
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

function formatDate(d) {
  const mon = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const day = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const [y, m, dd] = d.split("-");
  return `${day[new Date(d).getDay()]}, ${parseInt(dd)} ${mon[parseInt(m)]} ${y}`;
}

async function addLibur() {
  const date = document.getElementById("newLiburDate").value;
  if (!date) {
    toast("Pilih tanggal terlebih dahulu", "error");
    return;
  }
  try {
    await api("/api/libur", "POST", { action: "add", date });
    toast("Tanggal libur ditambahkan");
    document.getElementById("newLiburDate").value = "";
    loadLibur();
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteLibur(date) {
  if (!confirm(`Hapus ${formatDate(date)} dari daftar libur?`)) return;
  try {
    await api("/api/libur", "POST", { action: "delete", date });
    toast("Tanggal libur dihapus");
    loadLibur();
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

function switchJadwalMode(mode, btn) {
  currentJadwalMode = mode;
  currentHari = null;
  document.querySelectorAll(".mtab").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  loadJadwal();
}

async function loadJadwal() {
  try {
    const d = await api("/api/jadwal?mode=" + currentJadwalMode);
    jadwalData = d.jadwal || {};
    renderHariTabs(Object.keys(jadwalData));
    if (currentHari && jadwalData[currentHari]) {
      renderJadwalTable(currentHari);
    } else {
      currentHari = null;
      document.getElementById("jadwalTitle").textContent = "Pilih hari";
      document.getElementById("hariInfo").textContent = "";
      document.getElementById("jadwalTable").innerHTML =
        '<div class="empty">Pilih hari untuk melihat jadwal bel</div>';
      document.getElementById("jadwalActions").style.display = "none";
    }
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderHariTabs(days) {
  const c = document.getElementById("hariTabs");
  if (!days.length) {
    c.innerHTML =
      '<span style="font-size:12px;color:var(--ink-4)">Belum ada hari. Tambahkan di atas.</span>';
    return;
  }
  days.sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a),
      bi = DAY_ORDER.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  c.innerHTML = days
    .map(
      (h) =>
        `<button class="hari-tab${h === currentHari ? " active" : ""}" onclick="selectHari('${h}')">${h}</button>`
    )
    .join("");
}

function selectHari(hari) {
  currentHari = hari;
  document
    .querySelectorAll(".hari-tab")
    .forEach((b) => b.classList.toggle("active", b.textContent === hari));
  renderJadwalTable(hari);
  document.getElementById("jadwalActions").style.display = "";
}

function renderJadwalTable(hari) {
  document.getElementById("jadwalTitle").textContent =
    `${hari} \u2014 ${MODE_LABELS[currentJadwalMode] || currentJadwalMode}`;
  const entries = jadwalData[hari] || [];
  document.getElementById("hariInfo").textContent = `${entries.length} entri`;

  if (!entries.length) {
    document.getElementById("jadwalTable").innerHTML =
      '<div class="empty">Belum ada jadwal bel untuk hari ini</div>';
    return;
  }

  let html = `<div class="table-wrap"><table><thead><tr>
    <th style="width:32px">#</th><th>Waktu</th><th>Audio</th><th style="width:120px">Aksi</th>
  </tr></thead><tbody>`;

  entries.forEach((e, i) => {
    const name = e.audio.split("/").pop();
    html += `<tr>
      <td class="t-num">${i + 1}</td>
      <td class="t-time">${e.waktu}</td>
      <td class="t-audio">${name}</td>
      <td><div class="btn-row">
        <button class="btn ghost sm" onclick="openEditEntry(${i})">Edit</button>
        <button class="btn danger sm" onclick="deleteEntry(${i})">Hapus</button>
      </div></td>
    </tr>`;
  });

  html += "</tbody></table></div>";
  document.getElementById("jadwalTable").innerHTML = html;
}

async function addHari() {
  const input = document.getElementById("newHariInput");
  const hari = input.value.trim();
  if (!hari) {
    toast("Nama hari tidak boleh kosong", "error");
    return;
  }
  try {
    await api("/api/jadwal/hari", "POST", { action: "add", mode: currentJadwalMode, hari });
    toast(`Hari ${hari} ditambahkan`);
    input.value = "";
    await loadJadwal();
    selectHari(hari);
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteHari() {
  if (!currentHari) return;
  if (!confirm(`Hapus hari ${currentHari} beserta seluruh jadwalnya?`)) return;
  try {
    await api("/api/jadwal/hari", "POST", {
      action: "delete",
      mode: currentJadwalMode,
      hari: currentHari,
    });
    toast(`Hari ${currentHari} dihapus`);
    currentHari = null;
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

function openAddEntry() {
  editIndex = -1;
  document.getElementById("modalTitle").textContent = `Tambah Bel`;
  document.getElementById("modalSubtitle").textContent =
    `${currentHari} \u2014 ${MODE_LABELS[currentJadwalMode]}`;
  document.getElementById("entryWaktu").value = "";
  populateAudioSelect("");
  document.getElementById("entryModal").classList.add("open");
}

function openEditEntry(idx) {
  editIndex = idx;
  const entry = jadwalData[currentHari][idx];
  document.getElementById("modalTitle").textContent = `Edit Bel`;
  document.getElementById("modalSubtitle").textContent =
    `${currentHari} \u2014 ${MODE_LABELS[currentJadwalMode]}`;
  document.getElementById("entryWaktu").value = entry.waktu;
  populateAudioSelect(entry.audio);
  document.getElementById("entryModal").classList.add("open");
}

function populateAudioSelect(current) {
  const sel = document.getElementById("entryAudio");
  sel.innerHTML = allTones
    .map((t) => {
      const fp = "/opt/bel-madrasah/tone/" + t;
      return `<option value="${fp}"${current === fp ? " selected" : ""}>${t}</option>`;
    })
    .join("");
}

function closeModal() {
  document.getElementById("entryModal").classList.remove("open");
}

async function saveEntry() {
  const waktu = document.getElementById("entryWaktu").value;
  const audio = document.getElementById("entryAudio").value;
  if (!waktu) {
    toast("Waktu harus diisi", "error");
    return;
  }
  if (!audio) {
    toast("Pilih file audio", "error");
    return;
  }
  const action = editIndex === -1 ? "add" : "edit";
  try {
    await api("/api/jadwal/entry", "POST", {
      action,
      mode: currentJadwalMode,
      hari: currentHari,
      index: editIndex,
      entry: { waktu, audio },
    });
    toast(action === "add" ? "Bel ditambahkan" : "Bel diperbarui");
    closeModal();
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteEntry(idx) {
  if (!confirm("Hapus entri bel ini?")) return;
  try {
    await api("/api/jadwal/entry", "POST", {
      action: "delete",
      mode: currentJadwalMode,
      hari: currentHari,
      index: idx,
      entry: {},
    });
    toast("Entri dihapus");
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadLog() {
  const c = document.getElementById("logContainer");
  try {
    const d = await api("/api/log");
    const logs = d.logs || [];
    if (!logs.length) {
      c.innerHTML = '<div class="empty">Belum ada aktivitas tercatat</div>';
      return;
    }

    let html = `<div class="table-wrap"><table><thead><tr>
      <th>Waktu</th><th>Mode</th><th>Hari</th><th>Jam</th><th>Audio</th>
    </tr></thead><tbody>`;

    logs.forEach((l) => {
      html += `<tr>
        <td style="white-space:nowrap;color:var(--ink-4);font-size:11.5px">${l.time}</td>
        <td><span class="log-badge ${l.mode}">${MODE_LABELS[l.mode] || l.mode}</span></td>
        <td style="font-size:13px">${l.hari}</td>
        <td class="t-time">${l.waktu}</td>
        <td class="t-audio">${l.audio}</td>
      </tr>`;
    });

    html += "</tbody></table></div>";
    c.innerHTML = html;
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadTones() {
  try {
    const d = await api("/api/tones");
    allTones = d.tones || [];
    document.getElementById("toneCount").textContent = allTones.length;
    const list = document.getElementById("toneList");
    if (!allTones.length) {
      list.innerHTML = '<div class="empty">Belum ada file audio</div>';
      return;
    }

    list.innerHTML = allTones
      .map(
        (f) => `
      <div class="tone-item">
        <span class="tone-name">${f}</span>
        <div class="btn-row">
          <button class="btn success sm" onclick="previewTone('${f}')">Putar</button>
          <button class="btn danger sm"  onclick="deleteTone('${f}')">Hapus</button>
        </div>
      </div>`
      )
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function uploadFile(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  try {
    toast("Mengunggah " + file.name + "...");
    const res = await fetch("/api/tones/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(data.message);
    document.getElementById("fileInput").value = "";
    loadTones();
  } catch (e) {
    toast(e.message, "error");
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById("uploadZone").classList.remove("over");
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
}

async function previewTone(filename) {
  try {
    await api("/api/tones/preview", "POST", { filename });
    toast("Memutar " + filename);
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteTone(filename) {
  if (!confirm(`Hapus file ${filename}?`)) return;
  try {
    await api("/api/tones/delete", "POST", { filename });
    toast(filename + " berhasil dihapus");
    loadTones();
  } catch (e) {
    toast(e.message, "error");
  }
}

function downloadBackup() {
  window.location.href = "/api/backup";
}

async function restoreBackup(file) {
  if (!file) return;
  if (!confirm("Restore akan mengganti seluruh jadwal yang ada. Lanjutkan?")) return;
  const fd = new FormData();
  fd.append("file", file);
  try {
    toast("Merestore jadwal...");
    const res = await fetch("/api/restore", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(data.message);
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function changePassword() {
  const old = document.getElementById("oldPass").value;
  const nw = document.getElementById("newPass").value;
  const cf = document.getElementById("confirmPass").value;
  if (nw !== cf) {
    toast("Konfirmasi password tidak cocok", "error");
    return;
  }
  if (nw.length < 6) {
    toast("Password baru minimal 6 karakter", "error");
    return;
  }
  try {
    const d = await api("/api/change-password", "POST", { old_password: old, new_password: nw });
    toast(d.message);
    ["oldPass", "newPass", "confirmPass"].forEach((id) => (document.getElementById(id).value = ""));
  } catch (e) {
    toast(e.message, "error");
  }
}

function setupOffline() {
  const bar = document.getElementById("offlineBar");
  const update = () => bar.classList.toggle("show", !navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function setupPWA() {
  const banner = document.getElementById("pwaBanner");
  const btn = document.getElementById("installAppBtn");
  const info = document.getElementById("installInfo");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (btn) {
      btn.style.display = "";
      if (info) info.style.display = "none";
    }
    if (banner) setTimeout(() => banner.classList.add("show"), 1800);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    if (banner) banner.classList.remove("show");
    if (btn) btn.style.display = "none";
    if (info) {
      info.textContent = "Aplikasi sudah terpasang.";
      info.style.display = "";
    }
  });
}

function dismissBanner() {
  const banner = document.getElementById("pwaBanner");
  if (banner) banner.classList.remove("show");
}

async function promptInstall() {
  dismissBanner();
  if (!deferredInstall) {
    toast("Instalasi tidak tersedia di perangkat ini", "error");
    return;
  }
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
}

function applyTabFromQuery() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (!tab) return;
  const btn = Array.from(document.querySelectorAll(".nav-btn")).find(
    (b) => b.getAttribute("onclick") && b.getAttribute("onclick").includes(`'${tab}'`)
  );
  if (btn) switchTab(tab, btn);
}

window.addEventListener("click", (e) => {
  if (e.target === document.getElementById("entryModal")) closeModal();
});

(async () => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    );
  }
  setupOffline();
  setupPWA();
  applyTabFromQuery();
  await Promise.all([loadStatus(), loadJadwal(), loadTones(), loadConfig()]);
  setInterval(loadStatus, 10000);
  const splash = document.getElementById("splash");
  if (splash) splash.classList.add("gone");
})();
