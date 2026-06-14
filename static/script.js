var MODE_LABELS = { reguler: "Reguler", ramadhan: "Ramadhan", pts: "PTS", pas: "PAS" };
var DAY_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

var jadwalMode = "reguler";
var activeHari = null;
var editIndex = -1;
var allTones = [];
var jadwalData = {};
var configData = {};
var deferredPWA = null;

var MON_ID = [
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
var DAY_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function $(id) {
  return document.getElementById(id);
}

/* ─── TOAST ─── */
function toast(msg, type) {
  var el = $("toast");
  el.textContent = msg;
  el.className = "toast show" + (type === "error" ? " error" : type === "ok" ? " ok" : "");
  clearTimeout(el._t);
  el._t = setTimeout(function () {
    el.className = "toast";
  }, 3000);
}

/* ─── API ─── */
async function api(url, method, body) {
  var opts = { method: method || "GET", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  var res = await fetch(url, opts);
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
  return data;
}

/* ─── NAV ─── */
function switchTab(id) {
  document.querySelectorAll(".page").forEach(function (el) {
    el.classList.remove("active");
  });
  document.querySelectorAll(".sidenav, .botnav").forEach(function (el) {
    el.classList.remove("active");
  });
  $("page-" + id).classList.add("active");
  document.querySelectorAll('[data-tab="' + id + '"]').forEach(function (el) {
    el.classList.add("active");
  });
  if (id === "audio") loadTones();
  if (id === "log") loadLog();
  if (id === "libur") loadLibur();
  if (id === "mode") renderModeUI();
}

function setupNav() {
  document.querySelectorAll("[data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchTab(btn.dataset.tab);
    });
  });
  document.querySelectorAll(".mode-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      jadwalMode = btn.dataset.mode;
      activeHari = null;
      document.querySelectorAll(".mode-tab").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      loadJadwal();
    });
  });
  document.querySelectorAll(".mode-card").forEach(function (el) {
    el.addEventListener("click", function () {
      selectMode(el.dataset.mode);
    });
  });
}

/* ─── STATUS ─── */
async function loadStatus() {
  try {
    var d = await api("/api/service/status");
    var dot = $("statusDot");
    dot.className = "status-dot" + (d.running ? " on" : "");
    $("statusText").textContent = d.running ? "Aktif" : "Nonaktif";
    $("toggleBtn").textContent = d.running ? "Hentikan" : "Aktifkan";
    var mode = d.active_mode || "reguler";
    var chip = $("modeChip");
    chip.textContent = MODE_LABELS[mode] || mode;
    chip.className = "mode-chip " + mode;
    $("liburChip").className = "libur-chip" + (d.is_libur ? " show" : "");
  } catch (_) {}
}

async function toggleService() {
  try {
    var d = await api("/api/service/toggle", "POST");
    toast(d.message, "ok");
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── CONFIG ─── */
async function loadConfig() {
  try {
    var d = await api("/api/config");
    configData = d.config;
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderModeUI() {
  if (!configData.mode) return;
  var m = configData.mode;
  ["reguler", "ramadhan", "pts", "pas"].forEach(function (k) {
    var el = $("mcard-" + k);
    el.className = "mode-card" + (m === k ? " active" : "");
  });
  $("overrideToggle").checked = configData.manual_override;
  $("ramadhanStart").value = configData.ramadhan_start || "";
  $("ramadhanEnd").value = configData.ramadhan_end || "";
  $("ptsStart").value = configData.pts_start || "";
  $("ptsEnd").value = configData.pts_end || "";
  $("pasStart").value = configData.pas_start || "";
  $("pasEnd").value = configData.pas_end || "";
}

function selectMode(mode) {
  configData.mode = mode;
  renderModeUI();
}

async function saveConfig() {
  var start = $("ramadhanStart").value.trim();
  var end = $("ramadhanEnd").value.trim();
  var mmdd = /^\d{2}-\d{2}$/;
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
      manual_override: $("overrideToggle").checked,
      ramadhan_start: start,
      ramadhan_end: end,
      pts_start: $("ptsStart").value,
      pts_end: $("ptsEnd").value,
      pas_start: $("pasStart").value,
      pas_end: $("pasEnd").value,
    });
    toast("Pengaturan disimpan", "ok");
    loadStatus();
    await loadConfig();
    renderModeUI();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── LIBUR ─── */
function fmtDate(d) {
  var parts = d.split("-");
  return (
    DAY_ID[new Date(d).getDay()] +
    ", " +
    parseInt(parts[2]) +
    " " +
    MON_ID[parseInt(parts[1])] +
    " " +
    parts[0]
  );
}

async function loadLibur() {
  try {
    var d = await api("/api/libur");
    var list = d.libur || [];
    $("liburCount").textContent = list.length;
    var c = $("liburList");
    if (!list.length) {
      c.innerHTML = '<div class="empty-state">Belum ada hari libur terdaftar</div>';
      return;
    }
    var today = new Date().toISOString().slice(0, 10);
    c.innerHTML = list
      .map(function (date) {
        var isTdy = date === today;
        return (
          '<div class="libur-item' +
          (isTdy ? " today" : "") +
          '">' +
          '<div class="libur-date">' +
          fmtDate(date) +
          (isTdy ? '<span class="today-tag">Hari Ini</span>' : "") +
          "</div>" +
          '<button class="btn btn-danger btn-sm" onclick="deleteLibur(\'' +
          date +
          "')\">Hapus</button>" +
          "</div>"
        );
      })
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function addLibur() {
  var date = $("newLiburDate").value;
  if (!date) {
    toast("Pilih tanggal terlebih dahulu", "error");
    return;
  }
  try {
    await api("/api/libur", "POST", { action: "add", date: date });
    toast("Tanggal libur ditambahkan", "ok");
    $("newLiburDate").value = "";
    loadLibur();
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteLibur(date) {
  if (!confirm("Hapus " + fmtDate(date) + " dari daftar libur?")) return;
  try {
    await api("/api/libur", "POST", { action: "delete", date: date });
    toast("Tanggal libur dihapus", "ok");
    loadLibur();
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── JADWAL ─── */
async function loadJadwal() {
  try {
    var d = await api("/api/jadwal?mode=" + jadwalMode);
    jadwalData = d.jadwal || {};
    renderHariStrip(Object.keys(jadwalData));
    if (activeHari && jadwalData[activeHari]) {
      renderJadwalTable(activeHari);
    } else {
      activeHari = null;
      $("jadwalTitle").textContent = "Pilih hari";
      $("jadwalDesc").textContent = "Pilih hari dari tab di atas";
      $("jadwalBody").innerHTML =
        '<div class="empty-state">Pilih hari untuk melihat jadwal bel</div>';
      $("jadwalActions").style.display = "none";
    }
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderHariStrip(days) {
  var c = $("hariStrip");
  if (!days.length) {
    c.innerHTML =
      '<span style="font-size:12px;color:var(--c-ink4)">Belum ada hari. Tambahkan di atas.</span>';
    return;
  }
  days.sort(function (a, b) {
    var ai = DAY_ORDER.indexOf(a),
      bi = DAY_ORDER.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  c.innerHTML = days
    .map(function (h) {
      return (
        '<button class="hari-tab' +
        (h === activeHari ? " active" : "") +
        '" onclick="selectHari(\'' +
        h +
        "')\">" +
        h +
        "</button>"
      );
    })
    .join("");
}

function selectHari(hari) {
  activeHari = hari;
  document.querySelectorAll(".hari-tab").forEach(function (b) {
    b.classList.toggle("active", b.textContent === hari);
  });
  renderJadwalTable(hari);
  $("jadwalActions").style.display = "";
}

function renderJadwalTable(hari) {
  $("jadwalTitle").textContent = hari + " \u2014 " + (MODE_LABELS[jadwalMode] || jadwalMode);
  var entries = jadwalData[hari] || [];
  $("jadwalDesc").textContent = entries.length + " entri bel";
  if (!entries.length) {
    $("jadwalBody").innerHTML =
      '<div class="empty-state">Belum ada jadwal bel untuk hari ini</div>';
    return;
  }
  var rows = entries
    .map(function (e, i) {
      return (
        "<tr>" +
        '<td class="td-num">' +
        (i + 1) +
        "</td>" +
        '<td class="td-time">' +
        e.waktu +
        "</td>" +
        '<td class="td-audio">' +
        e.audio.split("/").pop() +
        "</td>" +
        '<td><div class="btn-group">' +
        '<button class="btn btn-ghost btn-sm" onclick="openEditEntry(' +
        i +
        ')">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteEntry(' +
        i +
        ')">Hapus</button>' +
        "</div></td>" +
        "</tr>"
      );
    })
    .join("");
  $("jadwalBody").innerHTML =
    '<div class="table-wrap"><table>' +
    '<thead><tr><th style="width:32px">#</th><th>Waktu</th><th>Audio</th><th style="width:130px">Aksi</th></tr></thead>' +
    "<tbody>" +
    rows +
    "</tbody></table></div>";
}

async function addHari() {
  var input = $("newHariInput");
  var hari = input.value.trim();
  if (!hari) {
    toast("Nama hari tidak boleh kosong", "error");
    return;
  }
  try {
    await api("/api/jadwal/hari", "POST", { action: "add", mode: jadwalMode, hari: hari });
    toast("Hari " + hari + " ditambahkan", "ok");
    input.value = "";
    await loadJadwal();
    selectHari(hari);
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteHari() {
  if (!activeHari) return;
  if (!confirm("Hapus hari " + activeHari + " beserta seluruh jadwalnya?")) return;
  try {
    await api("/api/jadwal/hari", "POST", { action: "delete", mode: jadwalMode, hari: activeHari });
    toast("Hari " + activeHari + " dihapus", "ok");
    activeHari = null;
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── ENTRY MODAL ─── */
function openAddEntry() {
  editIndex = -1;
  $("modalTitle").textContent = "Tambah Bel";
  $("modalSub").textContent = activeHari + " \u2014 " + (MODE_LABELS[jadwalMode] || jadwalMode);
  $("entryWaktu").value = "";
  fillAudioSelect("");
  $("entryModal").classList.add("open");
}

function openEditEntry(idx) {
  editIndex = idx;
  var e = jadwalData[activeHari][idx];
  $("modalTitle").textContent = "Edit Bel";
  $("modalSub").textContent = activeHari + " \u2014 " + (MODE_LABELS[jadwalMode] || jadwalMode);
  $("entryWaktu").value = e.waktu;
  fillAudioSelect(e.audio);
  $("entryModal").classList.add("open");
}

function fillAudioSelect(current) {
  var sel = $("entryAudio");
  sel.innerHTML = allTones
    .map(function (t) {
      var fp = "/opt/bel-madrasah/tone/" + t;
      return (
        '<option value="' + fp + '"' + (current === fp ? " selected" : "") + ">" + t + "</option>"
      );
    })
    .join("");
}

function closeModal() {
  $("entryModal").classList.remove("open");
}

async function saveEntry() {
  var waktu = $("entryWaktu").value;
  var audio = $("entryAudio").value;
  if (!waktu) {
    toast("Waktu harus diisi", "error");
    return;
  }
  if (!audio) {
    toast("Pilih file audio", "error");
    return;
  }
  var action = editIndex === -1 ? "add" : "edit";
  try {
    await api("/api/jadwal/entry", "POST", {
      action: action,
      mode: jadwalMode,
      hari: activeHari,
      index: editIndex,
      entry: { waktu: waktu, audio: audio },
    });
    toast(action === "add" ? "Bel ditambahkan" : "Bel diperbarui", "ok");
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
      mode: jadwalMode,
      hari: activeHari,
      index: idx,
      entry: {},
    });
    toast("Entri dihapus", "ok");
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── LOG ─── */
async function loadLog() {
  var c = $("logBody");
  try {
    var d = await api("/api/log");
    var logs = d.logs || [];
    if (!logs.length) {
      c.innerHTML = '<div class="empty-state">Belum ada aktivitas tercatat</div>';
      return;
    }
    var rows = logs
      .map(function (l) {
        return (
          "<tr>" +
          '<td style="white-space:nowrap;color:var(--c-ink4);font-size:11.5px">' +
          l.time +
          "</td>" +
          '<td><span class="log-badge ' +
          l.mode +
          '">' +
          (MODE_LABELS[l.mode] || l.mode) +
          "</span></td>" +
          '<td style="font-size:13px">' +
          l.hari +
          "</td>" +
          '<td class="td-time">' +
          l.waktu +
          "</td>" +
          '<td class="td-audio">' +
          l.audio +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    c.innerHTML =
      '<div class="table-wrap"><table>' +
      "<thead><tr><th>Waktu</th><th>Mode</th><th>Hari</th><th>Jam</th><th>Audio</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table></div>";
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── AUDIO / TONES ─── */
async function loadTones() {
  try {
    var d = await api("/api/tones");
    allTones = d.tones || [];
    $("toneCount").textContent = allTones.length;
    var list = $("toneList");
    if (!allTones.length) {
      list.innerHTML = '<div class="empty-state">Belum ada file audio</div>';
      return;
    }
    list.innerHTML = allTones
      .map(function (f) {
        return (
          '<div class="tone-item">' +
          '<span class="tone-name">' +
          f +
          "</span>" +
          '<div class="btn-group">' +
          '<button class="btn btn-success btn-sm" onclick="previewTone(\'' +
          f +
          "')\">Putar</button>" +
          '<button class="btn btn-danger btn-sm" onclick="deleteTone(\'' +
          f +
          "')\">Hapus</button>" +
          "</div></div>"
        );
      })
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function uploadFile(file) {
  if (!file) return;
  var fd = new FormData();
  fd.append("file", file);
  try {
    toast("Mengunggah " + file.name + "...");
    var res = await fetch("/api/tones/upload", { method: "POST", body: fd });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(data.message, "ok");
    $("fileInput").value = "";
    loadTones();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function previewTone(filename) {
  try {
    await api("/api/tones/preview", "POST", { filename: filename });
    toast("Memutar " + filename, "ok");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteTone(filename) {
  if (!confirm("Hapus file " + filename + "?")) return;
  try {
    await api("/api/tones/delete", "POST", { filename: filename });
    toast(filename + " berhasil dihapus", "ok");
    loadTones();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── BACKUP / RESTORE ─── */
function downloadBackup() {
  window.location.href = "/api/backup";
}

async function restoreBackup(file) {
  if (!file) return;
  if (!confirm("Restore akan mengganti seluruh jadwal yang ada. Lanjutkan?")) return;
  var fd = new FormData();
  fd.append("file", file);
  try {
    toast("Merestore jadwal...");
    var res = await fetch("/api/restore", { method: "POST", body: fd });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(data.message, "ok");
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── PASSWORD ─── */
async function changePassword() {
  var old = $("oldPass").value;
  var nw = $("newPass").value;
  var cf = $("confirmPass").value;
  if (nw !== cf) {
    toast("Konfirmasi password tidak cocok", "error");
    return;
  }
  if (nw.length < 6) {
    toast("Password baru minimal 6 karakter", "error");
    return;
  }
  try {
    var d = await api("/api/change-password", "POST", { old_password: old, new_password: nw });
    toast(d.message, "ok");
    ["oldPass", "newPass", "confirmPass"].forEach(function (id) {
      $(id).value = "";
    });
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── OFFLINE ─── */
function setupOffline() {
  var bar = $("offlineBar");
  function update() {
    bar.classList.toggle("show", !navigator.onLine);
  }
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/* ─── PWA ─── */
function setupPWA() {
  var banner = $("pwaBanner");
  var btn = $("installAppBtn");
  var info = $("installInfo");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPWA = e;
    if (btn) {
      btn.style.display = "";
      if (info) info.style.display = "none";
    }
    if (banner)
      setTimeout(function () {
        banner.classList.add("show");
      }, 2000);
  });
  window.addEventListener("appinstalled", function () {
    deferredPWA = null;
    if (banner) banner.classList.remove("show");
    if (btn) btn.style.display = "none";
    if (info) {
      info.textContent = "Aplikasi sudah terpasang.";
      info.style.display = "";
    }
  });
}

function dismissBanner() {
  $("pwaBanner").classList.remove("show");
}

async function promptInstall() {
  dismissBanner();
  if (!deferredPWA) {
    toast("Instalasi tidak tersedia di perangkat ini", "error");
    return;
  }
  deferredPWA.prompt();
  await deferredPWA.userChoice;
  deferredPWA = null;
}

/* ─── EVENTS ─── */
function bindEvents() {
  $("toggleBtn").addEventListener("click", toggleService);
  $("logoutBtn").addEventListener("click", function () {
    window.location.href = "/logout";
  });

  $("addHariBtn").addEventListener("click", addHari);
  $("newHariInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") addHari();
  });
  $("deleteHariBtn").addEventListener("click", deleteHari);
  $("addEntryBtn").addEventListener("click", openAddEntry);

  $("saveEntryBtn").addEventListener("click", saveEntry);
  $("cancelModalBtn").addEventListener("click", closeModal);
  $("cancelModalBtn2").addEventListener("click", closeModal);
  $("entryModal").addEventListener("click", function (e) {
    if (e.target === $("entryModal")) closeModal();
  });

  $("overrideToggle").addEventListener("change", function () {
    configData.manual_override = $("overrideToggle").checked;
  });
  $("saveConfigBtn").addEventListener("click", saveConfig);

  $("addLiburBtn").addEventListener("click", addLibur);
  $("refreshLogBtn").addEventListener("click", loadLog);
  $("backupBtn").addEventListener("click", downloadBackup);
  $("changePassBtn").addEventListener("click", changePassword);

  $("installAppBtn").addEventListener("click", promptInstall);
  $("dismissBannerBtn").addEventListener("click", dismissBanner);
  $("installBannerBtn").addEventListener("click", promptInstall);

  $("restoreInput").addEventListener("change", function (e) {
    restoreBackup(e.target.files[0]);
  });
  $("fileInput").addEventListener("change", function (e) {
    uploadFile(e.target.files[0]);
  });

  var zone = $("uploadZone");
  zone.addEventListener("click", function () {
    $("fileInput").click();
  });
  zone.addEventListener("dragover", function (e) {
    e.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", function () {
    zone.classList.remove("over");
  });
  zone.addEventListener("drop", function (e) {
    e.preventDefault();
    zone.classList.remove("over");
    var f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  });
}

/* ─── INIT ─── */
(async function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
  setupNav();
  bindEvents();
  setupOffline();
  setupPWA();
  await Promise.all([loadStatus(), loadJadwal(), loadTones(), loadConfig()]);
  setInterval(loadStatus, 10000);
  var splash = $("splash");
  if (splash) splash.classList.add("gone");
})();
