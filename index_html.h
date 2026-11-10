#pragma once
#include <Arduino.h>

const char INDEX_HTML[] PROGMEM = R"HTMLPAGE(<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d1117">
<title>Bel Madrasah</title>
<style>
:root{--bg:#f6f8fa;--panel:#fff;--bg2:#f6f8fa;--bg3:#eaeef2;--border:#d0d7de;--text:#1f2328;--muted:#656d76;--accent:#0969da;--accent-soft:rgba(9,105,218,.1);--success:#1a7f37;--success-soft:rgba(26,127,55,.12);--danger:#cf222e;--danger-soft:rgba(207,34,46,.1);--warning:#9a6700;--warning-soft:rgba(154,103,0,.12);--overlay:rgba(31,35,40,.4);--r:6px;--rl:8px;--bar:56px;--side:220px;color-scheme:light}
[data-theme="dark"]{--bg:#0d1117;--panel:#161b22;--bg2:#0d1117;--bg3:#21262d;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--accent:#2f81f7;--accent-soft:rgba(47,129,247,.15);--success:#3fb950;--success-soft:rgba(46,160,67,.15);--danger:#f85149;--danger-soft:rgba(248,81,73,.12);--warning:#d29922;--warning-soft:rgba(210,153,34,.15);--overlay:rgba(1,4,9,.7);color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:var(--bg);color:var(--text);font-size:13px;-webkit-font-smoothing:antialiased}
[hidden]{display:none!important}
button{font:inherit;cursor:pointer}
input,select{font:inherit;width:100%;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);outline:none}
input:focus,select:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
input[type=checkbox]{width:auto}
input[type=range]{padding:0;accent-color:var(--accent);background:none;border:none;box-shadow:none}
@media(max-width:767px){input,select{font-size:16px}}
a{color:var(--accent);text-decoration:none}
.tab{font-variant-numeric:tabular-nums}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border-radius:var(--r);border:1px solid var(--border);background:var(--bg3);color:var(--text);font-weight:500;white-space:nowrap}
.btn:hover:not(:disabled){filter:brightness(1.1);text-decoration:none}.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.p{background:var(--accent);border-color:transparent;color:#fff}
.btn.d{background:var(--danger-soft);border-color:var(--danger);color:var(--danger)}
.btn.g{background:transparent;border-color:transparent;color:var(--muted)}
.btn.sm{height:28px;padding:0 10px;font-size:12px}
.btn.full{width:100%}
.card{background:var(--panel);border:1px solid var(--border);border-radius:var(--rl);overflow:hidden}
.ch{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;min-height:48px;padding:8px 16px;border-bottom:1px solid var(--border);font-weight:600}
.cb{padding:16px;display:flex;flex-direction:column;gap:12px}
.cb.flush{padding:0;gap:0}
.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}
.c12{grid-column:span 12}
@media(min-width:900px){.c5{grid-column:span 5}.c6{grid-column:span 6}.c7{grid-column:span 7}}
.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media(min-width:900px){.stats{grid-template-columns:repeat(4,minmax(0,1fr))}}
.stat{background:var(--panel);border:1px solid var(--border);border-radius:var(--rl);padding:14px 16px;min-width:0}
.stat .l{font-size:12px;color:var(--muted)}.stat .v{font-size:18px;font-weight:600;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stat .s{font-size:11px;color:var(--muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);min-width:0}
.row:last-child{border-bottom:none}
.row .grow{flex:1;min-width:0}
.t{font-weight:600}
.ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.muted{color:var(--muted)}.small{font-size:11px}
.field{display:flex;flex-direction:column;gap:6px;min-width:0}
.field>label{font-size:12px;font-weight:600;color:var(--muted)}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.f3{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:600px){.f3{grid-template-columns:1fr 1fr 1fr}}
.actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}
.badge{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:var(--bg3);color:var(--muted);white-space:nowrap}
.badge.ok{background:var(--success-soft);color:var(--success)}.badge.err{background:var(--danger-soft);color:var(--danger)}.badge.warn{background:var(--warning-soft);color:var(--warning)}.badge.acc{background:var(--accent-soft);color:var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{min-height:30px;padding:0 12px;border-radius:99px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:12px;font-weight:500}
.chip.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:600}
.sw{position:relative;width:40px;height:24px;flex:none;display:inline-block}
.sw input{opacity:0;width:0;height:0;position:absolute}
.sw span{position:absolute;inset:0;background:var(--bg3);border:1px solid var(--border);border-radius:99px;transition:.2s}
.sw span:before{content:"";position:absolute;width:18px;height:18px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.2s}
.sw input:checked+span{background:var(--accent);border-color:var(--accent)}
.sw input:checked+span:before{transform:translateX(16px)}
.sw input:focus-visible+span{box-shadow:0 0 0 3px var(--accent-soft)}
.setting{display:flex;align-items:center;justify-content:space-between;gap:12px}
.alert{padding:12px 14px;border-radius:var(--rl);border:1px solid;font-size:13px}
.alert.err{background:var(--danger-soft);border-color:var(--danger);color:var(--danger)}
.alert.warn{background:var(--warning-soft);border-color:var(--warning);color:var(--warning)}
.alert.info{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}
.empty{padding:28px 16px;text-align:center;color:var(--muted)}
.progress{height:6px;background:var(--bg3);border-radius:99px;overflow:hidden}.progress>div{height:100%;background:var(--accent);width:0;transition:width .2s}
.group{padding:8px 16px;background:var(--bg3);font-weight:600;font-size:12px;display:flex;justify-content:space-between}
.stack{display:flex;flex-direction:column;gap:16px}
.next{background:var(--accent-soft)}
.past{opacity:.55}
.app{display:flex;height:100dvh;overflow:hidden}
.side{width:var(--side);flex:none;background:var(--panel);border-right:1px solid var(--border);display:flex;flex-direction:column}
.brand{height:var(--bar);display:flex;align-items:center;gap:10px;padding:0 20px;border-bottom:1px solid var(--border);font-weight:700;font-size:14px}
.logo{width:26px;height:26px;border-radius:7px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}
.nav{flex:1;padding:8px 0}
.nav a{display:flex;align-items:center;gap:12px;padding:10px 20px;color:var(--muted);border-left:3px solid transparent}
.nav a:hover{background:var(--bg3);text-decoration:none}
.nav a.on{color:var(--text);background:var(--accent-soft);border-left-color:var(--accent);font-weight:600}
.nav svg,.bnav svg{width:18px;height:18px;flex:none}
.side .foot{border-top:1px solid var(--border)}
.side .foot button{width:100%;height:44px;display:flex;align-items:center;gap:10px;padding:0 20px;border:none;background:none;color:var(--muted)}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.top{height:var(--bar);flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 24px;background:var(--panel);border-bottom:1px solid var(--border)}
.top .ttl{font-weight:600;font-size:14px;min-width:0}
.top .right{display:flex;align-items:center;gap:6px;flex:none}
.pill{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 10px;border:1px solid var(--border);border-radius:99px;font-size:12px;color:var(--muted);white-space:nowrap}
.dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex:none}.dot.ok{background:var(--success)}.dot.err{background:var(--danger)}.dot.warn{background:var(--warning)}
.ibtn{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:var(--r);background:var(--bg3);color:var(--muted)}
.ibtn svg{width:16px;height:16px}
.content{flex:1;overflow-y:auto;padding:24px 32px}
.inner{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.ph h1{font-size:20px;font-weight:600}.ph p{color:var(--muted);font-size:12px;margin-top:4px}
.bnav{display:none}
footer{text-align:center;color:var(--muted);font-size:11px;padding:8px 0 4px}
@media(max-width:899px){
.side{display:none}
.top{padding:0 12px}
.content{padding:16px 12px calc(88px + env(safe-area-inset-bottom))}
.bnav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:50;background:var(--panel);border-top:1px solid var(--border);padding-bottom:env(safe-area-inset-bottom)}
.bnav a{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px;color:var(--muted);font-size:10px;border-top:2px solid transparent}
.bnav a.on{color:var(--accent);border-top-color:var(--accent);font-weight:600}
.pill .full{display:none}
}
@media(min-width:900px){.mobile-only{display:none!important}.pill .short{display:none}}
.center{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:16px}
.auth{width:100%;max-width:380px}
.auth .head{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px}
.overlay{position:fixed;inset:0;z-index:100;background:var(--overlay);display:flex;align-items:center;justify-content:center;padding:16px}
.dialog{width:100%;max-width:420px;background:var(--panel);border:1px solid var(--border);border-radius:var(--rl);box-shadow:0 16px 48px rgba(1,4,9,.3)}
#toast{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;gap:8px;width:min(92vw,420px)}
#toast div{padding:10px 14px;border-radius:var(--rl);border:1px solid var(--border);background:var(--panel);box-shadow:0 8px 24px rgba(1,4,9,.25);font-size:13px}
#toast div.ok{border-color:var(--success)}#toast div.err{border-color:var(--danger)}
</style>
</head>
<body>
<div id="toast" role="status" aria-live="polite"></div>

<div class="overlay" id="dlg" hidden>
 <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
  <div class="ch" id="dlgTitle"></div>
  <div class="cb"><p id="dlgMsg"></p>
   <div class="actions"><button class="btn g" id="dlgNo">Batal</button><button class="btn p" id="dlgYes">Lanjutkan</button></div>
  </div>
 </div>
</div>

<section id="loginView" class="center" hidden>
 <form class="card auth" id="loginForm">
  <div class="cb">
   <div class="head"><div class="logo">B</div>Bel Madrasah</div>
   <div class="field"><label for="loginPass">Password admin</label><input type="password" id="loginPass" autocomplete="current-password" required></div>
   <div class="alert err" id="loginErr" hidden></div>
   <button class="btn p full" type="submit" id="loginBtn">Masuk</button>
   <p class="muted small">Lupa password? Sambungkan perangkat ke komputer lewat USB, buka Serial Monitor (115200), lalu ketik <b>reset-password</b>.</p>
  </div>
 </form>
</section>

<section id="changeView" class="center" hidden>
 <form class="card auth" id="forceForm">
  <div class="cb">
   <div class="head"><div class="logo">B</div>Ganti password bawaan</div>
   <p class="muted">Perangkat masih memakai password bawaan. Ganti sebelum melanjutkan.</p>
   <div class="field" id="fOldWrap"><label for="fOld">Password saat ini</label><input type="password" id="fOld" autocomplete="current-password"></div>
   <div class="field"><label for="fNew">Password baru (minimal 8 karakter)</label><input type="password" id="fNew" minlength="8" autocomplete="new-password" required></div>
   <div class="field"><label for="fNew2">Ulangi password baru</label><input type="password" id="fNew2" minlength="8" autocomplete="new-password" required></div>
   <div class="alert err" id="forceErr" hidden></div>
   <button class="btn p full" type="submit">Simpan password</button>
  </div>
 </form>
</section>

<div class="app" id="app" hidden>
 <aside class="side">
  <div class="brand"><div class="logo">B</div>Bel Madrasah</div>
  <nav class="nav" id="sideNav" aria-label="Menu utama"></nav>
  <div class="foot"><button id="sideLogout" aria-label="Keluar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>Keluar</button></div>
 </aside>
 <div class="main">
  <header class="top">
   <div class="ttl ellipsis" id="pageTitle">Dashboard</div>
   <div class="right">
    <span class="pill" id="statusPill" role="status"><span class="dot" id="statusDot"></span><span class="full" id="statusFull">-</span><span class="short" id="statusShort">-</span></span>
    <button class="ibtn" id="themeBtn" aria-label="Ganti tema"></button>
    <button class="ibtn mobile-only" id="topLogout" title="Keluar" aria-label="Keluar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></button>
   </div>
  </header>
  <main class="content" id="content">
   <div class="inner">

    <div data-page="dashboard" class="stack">
     <div class="ph"><h1>Dashboard</h1><p id="dashDate">-</p></div>
     <div class="stack" id="alerts" hidden></div>
     <div class="stats">
      <div class="stat"><div class="l">Waktu</div><div class="v tab" id="stTime">-</div><div class="s" id="stClock">-</div></div>
      <div class="stat"><div class="l">Mode aktif</div><div class="v" id="stMode">-</div><div class="s" id="stModeSrc">-</div></div>
      <div class="stat"><div class="l">Status hari</div><div class="v" id="stDay">-</div><div class="s" id="stDaySub">-</div></div>
      <div class="stat"><div class="l">Bel terakhir</div><div class="v" id="stLast">-</div><div class="s" id="stPlay">-</div></div>
     </div>
     <div class="grid">
      <div class="card c12 c7"><div class="ch">Jadwal hari ini<span class="badge" id="todayCount">0 bel</span></div><div class="cb flush" id="todayList"></div></div>
      <div class="c12 c5 stack">
       <div class="card"><div class="ch">Aksi cepat</div><div class="cb">
        <button class="btn d full" data-act="stop">Hentikan bel</button>
        <div class="setting"><div><div class="t">Libur manual</div><div class="muted small">Semua bel berhenti sampai dimatikan</div></div><label class="sw"><input type="checkbox" class="holToggle" aria-label="Libur manual"><span></span></label></div>
        <div class="field"><label for="quickTrack">Putar track</label><div class="f2"><select id="quickTrack"></select><button class="btn" id="quickPlay">Putar</button></div></div>
       </div></div>
       <div class="card"><div class="ch">Perangkat</div><div class="cb flush" id="deviceInfo"></div></div>
      </div>
     </div>
    </div>

    <div data-page="jadwal" class="stack" hidden>
     <div class="ph"><h1>Jadwal</h1><p>Bel per mode, mode otomatis per tanggal, dan nama track</p></div>
     <div class="grid">
      <div class="card c12 c5"><div class="ch">Mode jadwal<span class="badge acc" id="modeActive">-</span></div><div class="cb">
       <div class="setting"><div><div class="t">Pilih mode manual</div><div class="muted small">Matikan untuk memilih mode otomatis dari tanggal</div></div><label class="sw"><input type="checkbox" id="mManual" aria-label="Mode manual"><span></span></label></div>
       <div class="field" id="mManualWrap"><label for="mManualMode">Mode manual</label><select id="mManualMode" class="modeSel"></select></div>
       <div id="mRanges" class="stack"></div>
       <p class="muted small">Bila rentang tumpang tindih, prioritasnya PTS, PAS, Pesantren, lalu Ramadhan. Di luar semua rentang dipakai mode Reguler.</p>
       <div class="actions"><button class="btn p" id="mSave">Simpan mode</button></div>
      </div></div>
      <div class="card c12 c7"><div class="ch">Jadwal bel<select id="viewMode" class="modeSel" style="width:auto" aria-label="Mode yang ditampilkan"></select></div><div class="cb">
       <div class="field"><label>Hari aktif untuk mode ini</label><div class="chips" id="dayToggles"></div></div>
       <div class="chips" id="dayChips"></div>
       <div id="sched"></div>
       <form id="slotForm" class="stack" style="border-top:1px solid var(--border);padding-top:14px">
        <div class="t" id="fTitle">Tambah bel</div>
        <div class="f3">
         <div class="field"><label for="fMode">Mode</label><select id="fMode" class="modeSel"></select></div>
         <div class="field"><label for="fDay">Hari</label><select id="fDay"></select></div>
         <div class="field"><label for="fTime">Jam</label><input type="time" id="fTime" value="07:00" required></div>
        </div>
        <div class="field"><label for="fTrack">Track</label><select id="fTrack" required></select></div>
        <div class="setting"><span>Aktif</span><label class="sw"><input type="checkbox" id="fEn" checked aria-label="Bel aktif"><span></span></label></div>
        <div class="actions"><button type="button" class="btn g" id="fCancel" hidden>Batal</button><button type="submit" class="btn p" id="fSave">Tambah</button></div>
       </form>
      </div></div>
      <div class="card c12"><div class="ch">Daftar track<span class="badge" id="trackCount">0</span></div><div class="cb">
       <p class="muted small">Nomor track sama dengan nama file di kartu SD DFPlayer: folder <b>mp3</b>, berkas 0001.mp3, 0002.mp3, dan seterusnya. Nama di sini hanya label.</p>
       <div class="card" id="trackList"></div>
       <form id="trackForm" class="f3" style="align-items:end">
        <div class="field"><label for="tNum">Nomor</label><input type="number" id="tNum" min="1" max="2999" required></div>
        <div class="field"><label for="tLabel">Nama</label><input type="text" id="tLabel" maxlength="40" required></div>
        <button class="btn p" type="submit">Simpan nama</button>
       </form>
      </div></div>
     </div>
    </div>

    <div data-page="libur" class="stack" hidden>
     <div class="ph"><h1>Hari libur</h1><p>Bel tidak berbunyi pada tanggal yang terdaftar</p></div>
     <div class="grid">
      <div class="c12 c7 stack">
       <div class="card"><div class="ch">Libur manual</div><div class="cb"><div class="setting"><div><div class="t">Hentikan semua bel</div><div class="muted small">Untuk libur mendadak. Matikan kembali secara manual.</div></div><label class="sw"><input type="checkbox" class="holToggle" aria-label="Libur manual"><span></span></label></div></div></div>
       <div class="card"><div class="ch">Tanggal libur<span class="badge" id="holCount">0</span></div><div class="cb">
        <form id="holForm" class="f3" style="align-items:end">
         <div class="field"><label for="hDate">Tanggal</label><input type="date" id="hDate" required></div>
         <div class="field"><label for="hName">Keterangan</label><input type="text" id="hName" maxlength="60"></div>
         <button class="btn p" type="submit">Tambah</button>
        </form>
        <div class="card" id="holList"></div>
       </div></div>
      </div>
      <div class="card c12 c5"><div class="ch">Libur nasional<select id="natYear" style="width:auto" aria-label="Tahun"></select></div><div class="cb">
       <p class="muted small">Diambil perangkat dari kalender hari libur Indonesia milik Google. Perangkat harus terhubung ke internet.</p>
       <div class="actions"><button class="btn" id="natFetch">Ambil data</button><button class="btn p" id="natAll" disabled>Tambah semua</button></div>
       <div class="setting"><span class="muted">Sertakan cuti bersama</span><label class="sw"><input type="checkbox" id="natCuti" checked aria-label="Sertakan cuti bersama"><span></span></label></div>
       <div class="alert info" id="natMsg" hidden></div>
       <div class="card" id="natList" hidden></div>
      </div></div>
     </div>
    </div>

    <div data-page="log" class="stack" hidden>
     <div class="ph"><h1>Log aktivitas</h1><p>Bel terjadwal yang berbunyi atau gagal berbunyi</p></div>
     <div class="card"><div class="ch">Riwayat<span style="display:flex;gap:8px;align-items:center"><span class="badge" id="logCount">0</span><button class="btn sm" id="logClear">Kosongkan</button></span></div><div class="cb flush" id="logList"></div></div>
    </div>

    <div data-page="pengaturan" class="stack" hidden>
     <div class="ph"><h1>Pengaturan</h1><p>Audio, waktu, akun, firmware, backup, dan jaringan</p></div>
     <div class="grid">
      <div class="c12 c6 stack">
       <div class="card"><div class="ch">Audio<span class="badge tab" id="volLabel">-</span></div><div class="cb">
        <div class="field"><label for="vol">Volume (0 sampai 30)</label><input type="range" id="vol" min="0" max="30"></div>
        <div class="field"><label for="eq">Equalizer DFPlayer</label><select id="eq"><option value="0">Normal</option><option value="1">Pop</option><option value="2">Rock</option><option value="3">Jazz</option><option value="4">Classic</option><option value="5">Bass</option></select></div>
        <button class="btn d" data-act="stop">Hentikan bel</button>
       </div></div>
       <div class="card"><div class="ch">Mode tidur</div><div class="cb">
        <p class="muted small">Pada rentang ini bel tidak berbunyi dan layar OLED dapat dimatikan. Boleh melewati tengah malam.</p>
        <div class="setting"><span>Aktifkan</span><label class="sw"><input type="checkbox" id="slEn" aria-label="Aktifkan mode tidur"><span></span></label></div>
        <div class="f2"><div class="field"><label for="slStart">Mulai</label><input type="time" id="slStart"></div><div class="field"><label for="slEnd">Selesai</label><input type="time" id="slEnd"></div></div>
        <div class="setting"><span>Matikan layar OLED saat tidur</span><label class="sw"><input type="checkbox" id="slOled" aria-label="Matikan OLED"><span></span></label></div>
        <div class="actions"><button class="btn p" id="slSave">Simpan</button></div>
       </div></div>
       <div class="card"><div class="ch">Waktu<span class="badge" id="clkBadge">-</span></div><div class="cb">
        <p class="muted small" id="clkInfo">-</p>
        <div class="f2"><div class="field"><label for="tmDate">Tanggal</label><input type="date" id="tmDate"></div><div class="field"><label for="tmTime">Jam</label><input type="time" id="tmTime"></div></div>
        <div class="actions"><button class="btn" id="tmFill">Isi dari perangkat ini</button><button class="btn p" id="tmSave">Simpan waktu</button></div>
       </div></div>
       <div class="card"><div class="ch">Akun</div><div class="cb">
        <form id="pwForm" class="stack">
         <div class="field"><label for="pwOld">Password lama</label><input type="password" id="pwOld" autocomplete="current-password" required></div>
         <div class="f2"><div class="field"><label for="pwNew">Password baru</label><input type="password" id="pwNew" minlength="8" autocomplete="new-password" required></div><div class="field"><label for="pwNew2">Ulangi</label><input type="password" id="pwNew2" minlength="8" autocomplete="new-password" required></div></div>
         <div class="actions"><button class="btn p" type="submit">Ganti password</button></div>
        </form>
       </div></div>
      </div>
      <div class="c12 c6 stack">
       <div class="card"><div class="ch">Firmware<span class="badge acc tab" id="fwVer">-</span></div><div class="cb">
        <div class="alert" id="fwMsg" hidden></div>
        <div class="progress" id="fwProg" hidden><div></div></div>
        <div class="setting"><div><div class="t">Pembaruan otomatis</div><div class="muted small">Dicek tiap 6 jam, dipasang saat tidak ada bel dalam 5 menit</div></div><label class="sw"><input type="checkbox" id="fwAuto" aria-label="Pembaruan otomatis"><span></span></label></div>
        <p class="muted small" id="fwInfo">-</p>
        <div class="actions"><button class="btn" id="fwCheck">Periksa pembaruan</button><button class="btn p" id="fwInstall" hidden>Pasang</button></div>
        <div class="field"><label for="fwFile">Pasang dari file (bel-madrasah-fw-...-app.bin)</label><input type="file" id="fwFile" accept=".bin"></div>
        <div class="actions"><button class="btn" id="fwUpload" disabled>Unggah dan pasang</button></div>
       </div></div>
       <div class="card"><div class="ch">Backup</div><div class="cb">
        <p class="muted small">Jadwal, nama track, mode, hari libur, dan pengaturan. Password dan jaringan tidak ikut.</p>
        <div class="actions"><input type="file" id="rsFile" accept=".json,application/json" hidden><button class="btn" id="rsBtn">Pulihkan dari file</button><a class="btn p" href="/api/backup" download="bel-madrasah-backup.json">Unduh backup</a></div>
       </div></div>
       <div class="card"><div class="ch">Jaringan</div><div class="cb flush" id="netInfo"></div><div class="cb" style="border-top:1px solid var(--border)">
        <div class="setting"><span>Pakai IP statis</span><label class="sw"><input type="checkbox" id="stEn" aria-label="IP statis"><span></span></label></div>
        <input type="text" id="stIp" placeholder="192.168.1.50" aria-label="Alamat IP statis">
        <p class="muted small" id="stHint"></p>
        <div class="actions"><button class="btn d" id="wifiReset">Reset WiFi</button><button class="btn p" id="stSave">Simpan dan restart</button></div>
       </div></div>
      </div>
     </div>
    </div>

    <footer>Firmware <span id="ver">-</span> &middot; Powered by <a href="https://zedlabs.id" target="_blank" rel="noopener noreferrer">ZEDLABS Teknologi Indonesia</a></footer>
   </div>
  </main>
 </div>
 <nav class="bnav" id="bottomNav" aria-label="Menu utama"></nav>
</div>

<script>
(function(){
"use strict";
var $=function(id){return document.getElementById(id);};
var qa=function(sel){return Array.prototype.slice.call(document.querySelectorAll(sel));};
var MODES=[["reguler","Reguler"],["ramadhan","Ramadhan"],["pts","PTS"],["pas","PAS"],["pesantren","Pesantren"],["lainnya","Lainnya"]];
var RANGED=["ramadhan","pts","pas","pesantren"];
var DAYS={"all":"Setiap hari","mon-sat":"Senin-Sabtu","mon-fri":"Senin-Jumat","mon-thu":"Senin-Kamis","mon":"Senin","tue":"Selasa","wed":"Rabu","thu":"Kamis","fri":"Jumat","sat":"Sabtu","sun":"Minggu"};
var DAY_ORDER=["all","mon-sat","mon-fri","mon-thu","mon","tue","wed","thu","fri","sat","sun"];
var WEEK=[["mon","Sen"],["tue","Sel"],["wed","Rab"],["thu","Kam"],["fri","Jum"],["sat","Sab"],["sun","Min"]];
var DOW=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
var MONTHS=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
var SRC={manual:"Dipilih manual",tanggal:"Otomatis dari rentang tanggal",bawaan:"Bawaan, di luar semua rentang"};
var ICON={
 dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 jadwal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 libur:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 14l6 6M15 14l-6 6"/>',
 log:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
 pengaturan:'<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>'
};
var PAGES=[["dashboard","Dashboard"],["jadwal","Jadwal"],["libur","Libur"],["log","Log"],["pengaturan","Pengaturan","Setelan"]];
var state={status:null,tracks:[],slots:[],modes:null,holidays:[],national:null,editId:-1,editSig:"",dayFilter:"",page:"dashboard",timers:[],currentPass:"",viewSet:false};

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function svg(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[name]+'</svg>';}
function toast(msg,ok){if(!msg)return;var t=document.createElement("div");t.className=ok?"ok":"err";t.textContent=msg;$("toast").appendChild(t);setTimeout(function(){t.remove();},4500);}
function modeName(c){for(var i=0;i<MODES.length;i++)if(MODES[i][0]===c)return MODES[i][1];return c||"-";}
function fmtDate(iso){if(!iso||iso.length<10)return"-";var p=iso.split("-");return(+p[2])+" "+MONTHS[+p[1]-1]+" "+p[0];}
function rows(list){return list.map(function(r){return '<div class="row"><span class="grow muted">'+r[0]+'</span><span class="tab ellipsis">'+esc(r[1])+'</span></div>';}).join("");}

function api(url,data){
 var o={method:data===undefined?"GET":"POST",credentials:"same-origin"};
 if(data!==undefined){o.headers={"Content-Type":"application/x-www-form-urlencoded"};o.body=new URLSearchParams(data);}
 return fetch(url,o).then(function(r){
  return r.json().catch(function(){return{};}).then(function(j){
   if(j.ok===undefined)j.ok=r.ok;j.status=r.status;
   if(r.status===401&&url!=="/api/login"&&url!=="/api/session")showLogin();
   return j;
  });
 }).catch(function(){return{ok:false,msg:"Koneksi ke perangkat terputus",status:0};});
}
function act(url,data){return api(url,data).then(function(j){if(j.status!==401)toast(j.msg,j.ok);return j;});}

function ask(title,msg,yes,danger){
 return new Promise(function(res){
  var d=$("dlg"),y=$("dlgYes"),n=$("dlgNo"),prev=document.activeElement;
  $("dlgTitle").textContent=title;$("dlgMsg").textContent=msg;y.textContent=yes||"Lanjutkan";y.className="btn "+(danger?"d":"p");
  d.hidden=false;y.focus();
  function done(v){d.hidden=true;y.onclick=n.onclick=d.onclick=null;document.removeEventListener("keydown",key);if(prev&&prev.focus)prev.focus();res(v);}
  function key(e){if(e.key==="Escape")done(false);if(e.key==="Tab"){e.preventDefault();(document.activeElement===y?n:y).focus();}}
  y.onclick=function(){done(true);};n.onclick=function(){done(false);};
  d.onclick=function(e){if(e.target===d)done(false);};
  document.addEventListener("keydown",key);
 });
}

function setTheme(t){
 document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("theme",t);}catch(e){}
 var b=$("themeBtn");
 b.innerHTML=t==="dark"?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>';
 b.title=t==="dark"?"Tema terang":"Tema gelap";b.setAttribute("aria-label",b.title);
 document.querySelector('meta[name="theme-color"]').content=t==="dark"?"#0d1117":"#ffffff";
}
(function(){var t="dark";try{t=localStorage.getItem("theme")||"dark";}catch(e){}setTheme(t);})();
$("themeBtn").onclick=function(){setTheme(document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark");};

function buildNav(){
 $("sideNav").innerHTML=PAGES.map(function(p){return '<a href="#'+p[0]+'" data-nav="'+p[0]+'">'+svg(p[0])+'<span>'+p[1]+'</span></a>';}).join("");
 $("bottomNav").innerHTML=PAGES.map(function(p){return '<a href="#'+p[0]+'" data-nav="'+p[0]+'" aria-label="'+p[1]+'">'+svg(p[0])+'<span>'+(p[2]||p[1])+'</span></a>';}).join("");
}
function go(){
 var p=(location.hash||"#dashboard").slice(1);if(!PAGES.some(function(x){return x[0]===p;}))p="dashboard";
 state.page=p;
 qa("[data-page]").forEach(function(el){el.hidden=el.getAttribute("data-page")!==p;});
 qa("[data-nav]").forEach(function(a){var on=a.getAttribute("data-nav")===p;a.classList.toggle("on",on);if(on)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
 PAGES.forEach(function(x){if(x[0]===p)$("pageTitle").textContent=x[1];});
 $("content").scrollTop=0;
 if(p==="dashboard")loadToday();
 if(p==="jadwal")loadModes().then(loadSched);
 if(p==="libur")loadHolidays();
 if(p==="log")loadLog();
 if(p==="pengaturan")loadSettings();
}
window.addEventListener("hashchange",go);

function showLogin(){stopTimers();$("app").hidden=true;$("changeView").hidden=true;$("loginView").hidden=false;$("loginPass").value="";setTimeout(function(){$("loginPass").focus();},50);}
function showChange(){stopTimers();$("app").hidden=true;$("loginView").hidden=true;$("changeView").hidden=false;$("fOldWrap").hidden=!!state.currentPass;$("fOld").required=!state.currentPass;(state.currentPass?$("fNew"):$("fOld")).focus();}
function showApp(){$("loginView").hidden=true;$("changeView").hidden=true;$("app").hidden=false;startApp();}

$("loginForm").onsubmit=function(e){e.preventDefault();var b=$("loginBtn");b.disabled=true;$("loginErr").hidden=true;
 api("/api/login",{password:$("loginPass").value}).then(function(j){b.disabled=false;
  if(!j.ok){$("loginErr").textContent=j.msg||"Gagal masuk";$("loginErr").hidden=false;return;}
  if(j.must_change){state.currentPass=$("loginPass").value;showChange();}else showApp();});};
$("forceForm").onsubmit=function(e){e.preventDefault();$("forceErr").hidden=true;
 if($("fNew").value!==$("fNew2").value){$("forceErr").textContent="Kedua password baru tidak sama";$("forceErr").hidden=false;return;}
 api("/api/password",{old:state.currentPass||$("fOld").value,new:$("fNew").value}).then(function(j){
  if(!j.ok){$("forceErr").textContent=j.msg;$("forceErr").hidden=false;return;}
  state.currentPass="";$("forceForm").reset();toast(j.msg,true);showApp();});};
function logout(){api("/api/logout",{}).then(showLogin);}
$("sideLogout").onclick=logout;$("topLogout").onclick=logout;

function stopTimers(){state.timers.forEach(clearInterval);state.timers=[];}
function startApp(){
 stopTimers();buildNav();
 loadStatus();loadTracks();go();
 state.timers.push(setInterval(function(){if(!document.hidden)loadStatus();},5000));
 state.timers.push(setInterval(function(){if(!document.hidden&&state.page==="dashboard")loadToday();},30000));
}

function loadStatus(){
 return api("/api/status").then(function(s){
  if(!s.ok)return;state.status=s;
  var d=s.time.substr(0,10);
  $("stTime").textContent=s.time.substr(11);
  $("stClock").textContent=(s.trusted?"":"Belum tepercaya, ")+(s.clock==="rtc"?"RTC":"NTP");
  $("dashDate").textContent=DOW[s.dow]+", "+fmtDate(d);
  $("stMode").textContent=modeName(s.active_mode);$("stModeSrc").textContent=SRC[s.mode_source]||"-";
  $("stLast").textContent=s.last_bell||"-";$("stPlay").textContent=s.playing?"Sedang diputar: track "+s.track:"Tidak ada yang diputar";
  var full,short,cls;
  if(!s.trusted){cls="err";full="Waktu belum valid";short="Terkunci";}
  else if(!s.dfp||!s.sd){cls="err";full="DFPlayer tidak siap";short="Error";}
  else if(s.holiday){cls="warn";full="Libur manual";short="Libur";}
  else if(s.sleeping){cls="warn";full="Mode tidur";short="Tidur";}
  else{cls="ok";full="Bel aktif";short="Aktif";}
  $("statusDot").className="dot "+cls;$("statusFull").textContent=full;$("statusShort").textContent=short;$("statusPill").title=full;
  qa(".holToggle").forEach(function(c){c.checked=s.holiday;});
  $("ver").textContent=s.version;
  var al=[];
  if(s.must_change)al.push(["err","Password admin masih bawaan. Ganti di Pengaturan, bagian Akun."]);
  if(!s.trusted)al.push(["err","Waktu perangkat belum tepercaya. Bel dikunci sampai perangkat tersambung internet atau waktu diatur manual di Pengaturan."]);
  if(!s.dfp)al.push(["err","DFPlayer tidak terdeteksi. Periksa kabel TX/RX dan catu daya modul."]);
  else if(!s.sd)al.push(["err","Kartu SD DFPlayer tidak terpasang."]);
  if(s.dfp_error)al.push(["warn",s.dfp_error]);
  if(s.rolled_back)al.push(["warn","Firmware terbaru gagal berjalan sehingga perangkat kembali ke versi sebelumnya."]);
  $("alerts").innerHTML=al.map(function(a){return '<div class="alert '+a[0]+'">'+esc(a[1])+'</div>';}).join("");
  $("alerts").hidden=!al.length;
  if(document.activeElement!==$("vol")){$("vol").value=s.volume;$("volLabel").textContent=s.volume+"/30";}
  if(document.activeElement!==$("eq"))$("eq").value=s.eq;
  $("deviceInfo").innerHTML=rows([["Jaringan",s.mode==="STA"?"WiFi ("+s.rssi+" dBm)":"Mode AP"],["Alamat IP",s.ip],["DFPlayer",!s.dfp?"Tidak terdeteksi":(s.sd?"Siap":"Kartu SD dicabut")],["Volume",s.volume+"/30"],["Mode tidur",s.sleep_on?s.sleep_start+" - "+s.sleep_end:"Nonaktif"]]);
  $("clkBadge").textContent=s.trusted?"Tepercaya":"Belum tepercaya";$("clkBadge").className="badge "+(s.trusted?"ok":"err");
  $("clkInfo").textContent="Sumber "+(s.clock==="rtc"?"RTC DS1307":"NTP (tanpa RTC)")+". Sinkronisasi NTP "+(s.ntp?"berhasil":"belum berhasil")+". Waktu perangkat "+s.time+".";
 });
}

function loadToday(){
 return api("/api/today").then(function(d){
  if(!d.ok)return;
  var labels={libur:"Libur",hari_nonaktif:"Hari nonaktif",tidur:"Mode tidur"};
  $("stDay").textContent=!d.trusted?"Terkunci":(d.blocked?labels[d.blocked]:"Bel aktif");
  $("stDaySub").textContent=d.holiday||(d.blocked==="hari_nonaktif"?"Dinonaktifkan untuk mode "+modeName(d.mode):d.bells.length+" bel hari ini");
  $("todayCount").textContent=d.bells.length+" bel";
  if(!d.bells.length){$("todayList").innerHTML='<div class="empty">Tidak ada bel hari ini pada mode '+esc(modeName(d.mode))+'.</div>';return;}
  var next=-1;for(var i=0;i<d.bells.length;i++)if(d.bells[i].time>=d.now){next=i;break;}
  $("todayList").innerHTML=d.bells.map(function(b,i){
   var past=next<0||i<next,cls=i===next?"next":(past?"past":"");
   var badge=i===next?'<span class="badge acc">Berikutnya</span>':(past?'<span class="badge">Lewat</span>':"");
   return '<div class="row '+cls+'"><span class="t tab">'+b.time+'</span><span class="grow ellipsis">#'+b.track+(b.label?" "+esc(b.label):"")+'</span>'+badge+'</div>';
  }).join("");
 });
}

qa("[data-act=stop]").forEach(function(b){b.onclick=function(){act("/api/stop",{}).then(loadStatus);};});
qa(".holToggle").forEach(function(c){c.onchange=function(){act("/api/holiday",{value:c.checked?1:0}).then(function(){loadStatus();loadToday();});};});
$("quickPlay").onclick=function(){if($("quickTrack").value)act("/api/ring",{track:$("quickTrack").value});};

function loadTracks(){
 return api("/api/tracks").then(function(j){
  if(!j.ok)return;state.tracks=j.tracks;
  var opts=j.tracks.map(function(t){return '<option value="'+t.track+'">#'+t.track+" "+esc(t.label)+'</option>';}).join("")||'<option value="">Belum ada track</option>';
  var cur=$("fTrack").value;$("fTrack").innerHTML=opts;if(cur)$("fTrack").value=cur;
  $("quickTrack").innerHTML=opts;
  $("trackCount").textContent=j.tracks.length;
  $("trackList").innerHTML=j.tracks.length?j.tracks.map(function(t){
   return '<div class="row"><span class="t tab">#'+t.track+'</span><span class="grow ellipsis">'+esc(t.label)+'</span><button class="btn sm g" data-play="'+t.track+'" aria-label="Putar track '+t.track+'">Putar</button><button class="btn sm g" data-deltrack="'+t.track+'" style="color:var(--danger)" aria-label="Hapus nama track '+t.track+'">Hapus</button></div>';
  }).join(""):'<div class="empty">Belum ada nama track.</div>';
  if(state.slots.length)renderSched();
 });
}
$("trackList").onclick=function(e){
 var p=e.target.closest("[data-play]"),d=e.target.closest("[data-deltrack]");
 if(p)act("/api/ring",{track:p.getAttribute("data-play")});
 if(d){var n=d.getAttribute("data-deltrack");ask("Hapus nama track","Hapus nama track #"+n+"? File di kartu SD tidak terhapus.","Hapus",true).then(function(ok){if(ok)act("/api/tracks/delete",{track:n}).then(loadTracks);});}
};
$("trackForm").onsubmit=function(e){e.preventDefault();act("/api/tracks/add",{track:$("tNum").value,label:$("tLabel").value}).then(function(j){if(j.ok){$("trackForm").reset();loadTracks();}});};

function fillSelects(){
 var m=MODES.map(function(x){return '<option value="'+x[0]+'">'+x[1]+'</option>';}).join("");
 qa(".modeSel").forEach(function(s){s.innerHTML=m;});
 $("fDay").innerHTML=DAY_ORDER.map(function(k){return '<option value="'+k+'">'+DAYS[k]+'</option>';}).join("");
 var y=new Date().getFullYear();$("natYear").innerHTML=[y-1,y,y+1].map(function(v){return '<option'+(v===y?" selected":"")+'>'+v+'</option>';}).join("");
}

function loadModes(){
 return api("/api/modes").then(function(m){
  if(!m.ok)return;state.modes=m;
  $("modeActive").textContent="Aktif: "+modeName(m.active);
  $("mManual").checked=m.manual_override;$("mManualMode").value=m.mode;$("mManualWrap").hidden=!m.manual_override;
  $("mRanges").innerHTML=RANGED.map(function(c){var r=(m.ranges&&m.ranges[c])||{};
   return '<div class="field"><label>'+modeName(c)+'</label><div class="f2"><input type="date" data-rs="'+c+'" value="'+esc(r.start||"")+'" aria-label="Mulai '+modeName(c)+'"><input type="date" data-re="'+c+'" value="'+esc(r.end||"")+'" aria-label="Selesai '+modeName(c)+'"></div></div>';}).join("");
  $("mRanges").hidden=m.manual_override;
  if(!state.viewSet){$("viewMode").value=m.active;$("fMode").value=m.active;state.viewSet=true;}
  renderDayToggles();
 });
}
$("mManual").onchange=function(){$("mManualWrap").hidden=!this.checked;$("mRanges").hidden=this.checked;};
function modePayload(){
 var m=state.modes,p={manual_override:$("mManual").checked,mode:$("mManualMode").value,ranges:{},disabled_days:m.disabled_days||{}};
 RANGED.forEach(function(c){p.ranges[c]={start:document.querySelector('[data-rs="'+c+'"]').value,end:document.querySelector('[data-re="'+c+'"]').value};});
 return p;
}
$("mSave").onclick=function(){
 var p=modePayload();
 for(var i=0;i<RANGED.length;i++){var r=p.ranges[RANGED[i]];if(!r.start!==!r.end){toast("Lengkapi tanggal mulai dan selesai untuk "+modeName(RANGED[i]),false);return;}}
 act("/api/modes",{data:JSON.stringify(p)}).then(function(j){if(j.ok){loadModes();loadStatus();}});
};
function renderDayToggles(){
 var m=state.modes;if(!m)return;var mode=$("viewMode").value,off=(m.disabled_days&&m.disabled_days[mode])||[];
 $("dayToggles").innerHTML=WEEK.map(function(w){var on=off.indexOf(w[0])<0;return '<button type="button" class="chip'+(on?" on":"")+'" data-dt="'+w[0]+'" aria-pressed="'+on+'">'+w[1]+'</button>';}).join("");
}
$("dayToggles").onclick=function(e){
 var b=e.target.closest("[data-dt]");if(!b||!state.modes)return;
 var m=state.modes,mode=$("viewMode").value,dd=JSON.parse(JSON.stringify(m.disabled_days||{})),list=dd[mode]||[],day=b.getAttribute("data-dt"),i=list.indexOf(day);
 if(i<0)list.push(day);else list.splice(i,1);dd[mode]=list;
 var p={manual_override:m.manual_override,mode:m.mode,ranges:m.ranges,disabled_days:dd};
 act("/api/modes",{data:JSON.stringify(p)}).then(function(j){if(j.ok){loadModes();loadToday();}});
};

function loadSched(){
 return api("/api/schedule?mode="+$("viewMode").value).then(function(j){if(!j.ok)return;state.slots=j.slots;renderSched();});
}
$("viewMode").onchange=function(){state.dayFilter="";if(state.editId<0)$("fMode").value=this.value;renderDayToggles();loadSched();};
function trackName(n){for(var i=0;i<state.tracks.length;i++)if(state.tracks[i].track==n)return "#"+n+" "+esc(state.tracks[i].label);return "#"+n+' <span class="muted">(belum diberi nama)</span>';}
function renderSched(){
 var g={};state.slots.forEach(function(s){(g[s.day]=g[s.day]||[]).push(s);});
 var present=DAY_ORDER.filter(function(d){return g[d];});
 if(state.dayFilter&&!g[state.dayFilter])state.dayFilter="";
 $("dayChips").innerHTML=state.slots.length?'<button type="button" class="chip'+(state.dayFilter?"":" on")+'" data-df="" aria-pressed="'+!state.dayFilter+'">Semua ('+state.slots.length+')</button>'+present.map(function(d){var on=state.dayFilter===d;return '<button type="button" class="chip'+(on?" on":"")+'" data-df="'+d+'" aria-pressed="'+on+'">'+DAYS[d]+' ('+g[d].length+')</button>';}).join(""):"";
 if(!state.slots.length){$("sched").innerHTML='<div class="empty">Belum ada bel untuk mode ini.</div>';return;}
 $("sched").innerHTML='<div class="card">'+present.filter(function(d){return!state.dayFilter||state.dayFilter===d;}).map(function(d){
  var list=g[d].slice().sort(function(a,b){return a.time<b.time?-1:a.time>b.time?1:0;});
  return '<div class="group"><span>'+DAYS[d]+'</span><span>'+list.length+' bel</span></div>'+list.map(function(s){
   var name="bel "+s.time+" "+DAYS[d];
   return '<div class="row"'+(s.enabled?"":' style="opacity:.55"')+'><span class="t tab">'+s.time+'</span><span class="grow ellipsis">'+trackName(s.track)+'</span>'+
   '<label class="sw"><input type="checkbox" data-toggle="'+s.id+'"'+(s.enabled?" checked":"")+' aria-label="Aktifkan '+name+'"><span></span></label>'+
   '<button class="btn sm g" data-edit="'+s.id+'" aria-label="Ubah '+name+'">Ubah</button><button class="btn sm g" data-del="'+s.id+'" style="color:var(--danger)" aria-label="Hapus '+name+'">Hapus</button></div>';
  }).join("");
 }).join("")+'</div>';
}
function findSlot(id){for(var i=0;i<state.slots.length;i++)if(state.slots[i].id==id)return state.slots[i];return null;}
$("dayChips").onclick=function(e){var b=e.target.closest("[data-df]");if(b){state.dayFilter=b.getAttribute("data-df");renderSched();}};
$("sched").onchange=function(e){var t=e.target.closest("[data-toggle]");if(!t)return;var s=findSlot(t.getAttribute("data-toggle"));if(!s)return;
 act("/api/schedule/update",{id:s.id,sig:s.sig,mode:s.mode,day:s.day,time:s.time,track:s.track,enabled:t.checked?1:0}).then(loadSched);};
$("sched").onclick=function(e){
 var ed=e.target.closest("[data-edit]"),del=e.target.closest("[data-del]");
 if(ed){var s=findSlot(ed.getAttribute("data-edit"));if(!s)return;state.editId=s.id;state.editSig=s.sig;
  $("fMode").value=s.mode;$("fDay").value=s.day;$("fTime").value=s.time;$("fTrack").value=s.track;$("fEn").checked=s.enabled;
  $("fTitle").textContent="Ubah bel";$("fSave").textContent="Simpan";$("fCancel").hidden=false;$("slotForm").scrollIntoView({behavior:"smooth",block:"center"});}
 if(del){var d=findSlot(del.getAttribute("data-del"));if(!d)return;
  ask("Hapus bel","Hapus bel "+d.time+" ("+DAYS[d.day]+")?","Hapus",true).then(function(ok){if(ok)act("/api/schedule/delete",{id:d.id,sig:d.sig}).then(loadSched);});}
};
function resetForm(){state.editId=-1;state.editSig="";$("fTitle").textContent="Tambah bel";$("fSave").textContent="Tambah";$("fCancel").hidden=true;$("fEn").checked=true;$("fMode").value=$("viewMode").value;}
$("fCancel").onclick=resetForm;
$("slotForm").onsubmit=function(e){e.preventDefault();
 var d={mode:$("fMode").value,day:$("fDay").value,time:$("fTime").value,track:$("fTrack").value,enabled:$("fEn").checked?1:0},url="/api/schedule/add";
 if(state.editId>=0){d.id=state.editId;d.sig=state.editSig;url="/api/schedule/update";}
 act(url,d).then(function(j){if(j.ok)resetForm();loadSched();loadToday();});
};

function loadHolidays(){
 return api("/api/holidays").then(function(j){
  if(!j.ok)return;state.holidays=j.holidays;
  $("holCount").textContent=j.holidays.length+"/"+j.max;
  var today=state.status?state.status.time.substr(0,10):"";
  $("holList").innerHTML=j.holidays.length?j.holidays.map(function(h){
   return '<div class="row'+(h.date<today?" past":"")+'"><div class="grow"><div class="t ellipsis">'+esc(h.name||"Libur")+'</div><div class="muted small">'+fmtDate(h.date)+(h.date===today?' <span class="badge warn">Hari ini</span>':"")+'</div></div><button class="btn sm g" data-delhol="'+h.date+'" style="color:var(--danger)" aria-label="Hapus libur '+fmtDate(h.date)+'">Hapus</button></div>';
  }).join(""):'<div class="empty">Belum ada tanggal libur.</div>';
  renderNational();
 });
}
$("holForm").onsubmit=function(e){e.preventDefault();act("/api/holidays/add",{date:$("hDate").value,name:$("hName").value}).then(function(j){if(j.ok){$("holForm").reset();loadHolidays();loadToday();}});};
$("holList").onclick=function(e){var b=e.target.closest("[data-delhol]");if(!b)return;var d=b.getAttribute("data-delhol");
 ask("Hapus hari libur","Hapus libur "+fmtDate(d)+"?","Hapus",true).then(function(ok){if(ok)act("/api/holidays/delete",{date:d}).then(function(){loadHolidays();loadToday();});});};

function natVisible(){var n=state.national;return(n&&n.holidays?n.holidays:[]).filter(function(h){return $("natCuti").checked||!h.cuti;});}
function natMissing(){var have={};state.holidays.forEach(function(h){have[h.date]=1;});return natVisible().filter(function(h){return!have[h.date];});}
function renderNational(){
 var n=state.national;if(!n)return;
 var msg=$("natMsg"),running=n.state==="running";
 msg.hidden=!(running||n.message);msg.className="alert "+(n.state==="error"?"err":"info");
 msg.textContent=running?"Mengambil data libur nasional "+n.year+"...":n.message;
 $("natFetch").disabled=running;
 var have={};state.holidays.forEach(function(h){have[h.date]=1;});
 var list=natVisible(),missing=natMissing();
 $("natAll").disabled=!missing.length||running;$("natAll").textContent="Tambah semua ("+missing.length+")";
 $("natList").hidden=!list.length;
 $("natList").innerHTML=list.map(function(h){
  var added=have[h.date];
  return '<div class="row'+(added?" past":"")+'"><div class="grow"><div class="t ellipsis">'+esc(h.name)+(h.cuti?' <span class="badge warn">Cuti</span>':"")+'</div><div class="muted small">'+fmtDate(h.date)+'</div></div>'+(added?'<span class="badge ok">Terdaftar</span>':'<button class="btn sm" data-addnat="'+h.date+'">Tambah</button>')+'</div>';
 }).join("");
}
function pollNational(){
 return api("/api/holidays/national").then(function(n){if(!n.ok)return;state.national=n;renderNational();if(n.state==="running")setTimeout(pollNational,1500);});
}
$("natFetch").onclick=function(){act("/api/holidays/national",{year:$("natYear").value}).then(function(j){if(j.ok)pollNational();});};
$("natCuti").onchange=renderNational;
$("natList").onclick=function(e){var b=e.target.closest("[data-addnat]");if(!b)return;var d=b.getAttribute("data-addnat");
 var h=natVisible().filter(function(x){return x.date===d;})[0];if(h)act("/api/holidays/add",{date:h.date,name:h.name}).then(function(){loadHolidays();loadToday();});};
$("natAll").onclick=function(){
 var list=natMissing();
 ask("Tambah libur nasional","Tambahkan "+list.length+" tanggal libur ke daftar?","Tambah").then(function(ok){
  if(!ok)return;$("natAll").disabled=true;var added=0,fail=0;
  list.reduce(function(p,h){return p.then(function(){return api("/api/holidays/add",{date:h.date,name:h.name}).then(function(j){if(j.ok)added++;else fail++;});});},Promise.resolve())
  .then(function(){toast(added+" tanggal ditambahkan"+(fail?", "+fail+" gagal":""),!fail);loadHolidays();loadToday();});
 });
};

function loadLog(){
 return api("/api/log").then(function(j){
  if(!j.ok)return;$("logCount").textContent=j.logs.length;
  $("logList").innerHTML=j.logs.length?j.logs.map(function(l){
   var ok=l.s==="ok";
   return '<div class="row"><span class="t tab">'+esc(String(l.t).substr(11))+'</span><div class="grow"><div class="ellipsis">'+esc(l.l)+' <span class="muted small">'+esc(modeName(l.m))+'</span></div><div class="muted small">'+fmtDate(String(l.t).substr(0,10))+(l.r?", "+esc(l.r):"")+'</div></div><span class="badge '+(ok?"ok":"err")+'">'+(ok?"Berbunyi":"Gagal")+'</span></div>';
  }).join(""):'<div class="empty">Belum ada aktivitas.</div>';
 });
}
$("logClear").onclick=function(){ask("Kosongkan log","Semua riwayat aktivitas akan dihapus.","Kosongkan",true).then(function(ok){if(ok)act("/api/log/clear",{}).then(loadLog);});};

function loadSettings(){
 api("/api/sleep").then(function(j){if(!j.ok)return;$("slEn").checked=j.enabled;$("slStart").value=j.start;$("slEnd").value=j.end;$("slOled").checked=j.oled;});
 loadNet();loadFirmware();fillNow();
}
$("vol").oninput=function(){$("volLabel").textContent=this.value+"/30";};
$("vol").onchange=function(){act("/api/volume",{value:this.value}).then(loadStatus);};
$("eq").onchange=function(){act("/api/eq",{value:this.value});};
$("slSave").onclick=function(){act("/api/sleep",{enabled:$("slEn").checked?1:0,start:$("slStart").value,end:$("slEnd").value,oled:$("slOled").checked?1:0}).then(loadStatus);};
function fillNow(){var d=new Date(),p=function(n){return String(n).padStart(2,"0");};$("tmDate").value=d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());$("tmTime").value=p(d.getHours())+":"+p(d.getMinutes());}
$("tmFill").onclick=fillNow;
$("tmSave").onclick=function(){act("/api/time/set",{date:$("tmDate").value,time:$("tmTime").value}).then(loadStatus);};
$("pwForm").onsubmit=function(e){e.preventDefault();
 if($("pwNew").value!==$("pwNew2").value){toast("Kedua password baru tidak sama",false);return;}
 act("/api/password",{old:$("pwOld").value,new:$("pwNew").value}).then(function(j){if(j.ok)$("pwForm").reset();loadStatus();});};

function loadNet(){
 return api("/api/network").then(function(n){
  if(!n.ok)return;
  $("netInfo").innerHTML=rows([["Mode",n.mode==="STA"?"Terhubung WiFi":"Access Point"],["SSID",n.ssid],["Alamat IP",n.ip],["Gateway",n.gateway||"-"],["Rentang IP",n.range_start?n.range_start+" - "+n.range_end:"-"]]);
  $("stEn").checked=n.static_enabled;$("stIp").value=n.static_enabled?n.static_ip:(n.range_start?n.ip:"");
  $("stHint").textContent=n.range_start?"IP harus di rentang "+n.range_start+" - "+n.range_end+", di luar rentang DHCP router.":"Sambungkan perangkat ke WiFi dulu untuk mengatur IP statis.";
 });
}
$("stSave").onclick=function(){ask("Simpan IP statis","Perangkat akan restart.","Simpan").then(function(ok){if(!ok)return;
 act("/api/network/static",{enabled:$("stEn").checked?1:0,ip:$("stIp").value}).then(function(j){if(j.ok&&j.new_ip)setTimeout(function(){location.href="http://"+j.new_ip+"/";},9000);});});};
$("wifiReset").onclick=function(){ask("Reset WiFi","Kredensial WiFi dihapus dan perangkat membuka portal di 192.168.4.1.","Reset",true).then(function(ok){if(ok)act("/api/network/reset",{});});};

$("rsBtn").onclick=function(){$("rsFile").click();};
$("rsFile").onchange=function(){var f=this.files[0];this.value="";if(!f)return;
 ask("Pulihkan backup","Jadwal, nama track, mode, hari libur, dan pengaturan akan diganti dengan isi "+f.name+".","Pulihkan",true).then(function(ok){if(!ok)return;
  var rd=new FileReader();rd.onload=function(){act("/api/restore",{data:rd.result}).then(function(j){if(j.ok){loadTracks();loadStatus();}});};
  rd.onerror=function(){toast("File tidak dapat dibaca",false);};rd.readAsText(f);});};

function loadFirmware(){
 return api("/api/firmware").then(function(f){
  if(!f.ok)return;
  $("fwVer").textContent="v"+f.version;$("fwAuto").checked=f.auto;
  $("fwInfo").textContent="Partisi aktif "+(f.partition||"-")+". "+(f.last_check?"Terakhir diperiksa "+f.last_check+".":"Belum pernah diperiksa.")+(f.pending_verify?" Firmware baru sedang diverifikasi.":"");
  var m=$("fwMsg");m.hidden=!f.message;m.textContent=f.message;m.className="alert "+(f.state==="error"?"err":"info");
  var run=f.state==="running";$("fwProg").hidden=!run||!f.progress;$("fwProg").firstChild.style.width=f.progress+"%";
  $("fwCheck").disabled=run;$("fwInstall").hidden=!f.available||run;$("fwInstall").textContent="Pasang v"+f.available;
  if(run)setTimeout(loadFirmware,1500);
 });
}
$("fwAuto").onchange=function(){act("/api/firmware/auto",{value:this.checked?1:0});};
$("fwCheck").onclick=function(){act("/api/firmware/check",{}).then(function(){setTimeout(loadFirmware,800);});};
$("fwInstall").onclick=function(){ask("Pasang firmware","Perangkat mengunduh firmware baru lalu restart. Bel tidak berbunyi selama sekitar satu menit.","Pasang").then(function(ok){if(ok)act("/api/firmware/install",{}).then(function(){setTimeout(loadFirmware,800);});});};
$("fwFile").onchange=function(){$("fwUpload").disabled=!this.files.length;};
$("fwUpload").onclick=function(){var f=$("fwFile").files[0];if(!f)return;
 ask("Pasang firmware dari file","Pasang "+f.name+"? Perangkat restart setelah selesai.","Pasang").then(function(ok){if(!ok)return;
  var fd=new FormData();fd.append("firmware",f,f.name);var x=new XMLHttpRequest(),bar=$("fwProg");
  bar.hidden=false;bar.firstChild.style.width="0";$("fwUpload").disabled=true;
  x.upload.onprogress=function(e){if(e.lengthComputable)bar.firstChild.style.width=Math.round(e.loaded*100/e.total)+"%";};
  x.onload=function(){var j={};try{j=JSON.parse(x.responseText);}catch(e){}toast(j.msg||"Selesai",x.status===200);$("fwUpload").disabled=false;if(x.status===401)showLogin();if(x.status!==200)bar.hidden=true;};
  x.onerror=function(){toast("Unggah terputus",false);$("fwUpload").disabled=false;bar.hidden=true;};
  x.open("POST","/api/firmware/upload");x.send(fd);});};

fillSelects();
api("/api/session").then(function(s){if(!s.authenticated)showLogin();else if(s.must_change)showChange();else showApp();});
})();
</script>
</body>
</html>
)HTMLPAGE";
