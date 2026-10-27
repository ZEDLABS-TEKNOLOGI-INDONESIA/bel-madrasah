#pragma once
#include <Arduino.h>

const char INDEX_HTML[] PROGMEM = R"HTMLPAGE(
<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bel Madrasah</title>
<style>
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#eef1f5;color:#1a1a1a;font-size:14px;min-height:100vh;display:flex;flex-direction:column}
.wrap{flex:1}
header{background:#1e3a8a;color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;z-index:5}
header h1{font-size:18px;margin:0}
header .clk{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.wrap{width:100%;padding:16px}
.layout{display:grid;grid-template-columns:1fr;gap:16px;align-items:start}
@media(min-width:900px){
 .wrap{padding:20px 24px}
 .layout{grid-template-columns:360px minmax(0,1fr)}
 aside{position:sticky;top:78px;max-height:calc(100vh - 94px);overflow-y:auto;padding-bottom:2px}
}
.card{background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card h2{font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin:0 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.it{background:#f8f9fb;border-radius:8px;padding:10px 12px;min-width:0}
.l{font-size:11px;color:#888;margin-bottom:2px}
.v{font-size:14px;font-weight:600;word-break:break-all}
.mut{color:#777;font-size:12px}
.warn{display:none;background:#fee2e2;color:#991b1b;border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;font-weight:600}
input[type=text],input[type=time],input[type=date],input[type=number],select{width:100%;padding:10px 12px;border:1px solid #d4d9e0;border-radius:8px;font-size:14px;background:#fff;color:#1a1a1a}
button{padding:10px 16px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
button:hover{filter:brightness(1.08)}
button.sec{background:#6b7280}button.danger{background:#dc2626}
button.sm{padding:6px 10px;font-size:12px}button.full{width:100%;margin-top:10px}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0}
.sw{position:relative;width:44px;height:24px;flex:none;display:inline-block}
.sw input{opacity:0;width:0;height:0}
.sl{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#ccc;border-radius:24px;transition:.2s}
.sl:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
input:checked+.sl{background:#2563eb}
input:checked+.sl:before{transform:translateX(20px)}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
.f3{display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px}
@media(min-width:600px){.f3{grid-template-columns:1fr 1fr 1fr}}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}
.chip{padding:6px 12px;border-radius:999px;background:#e5e9f0;color:#334155;font-size:12px;font-weight:600;cursor:pointer;border:none}
.chip.on{background:#2563eb;color:#fff}
.day{margin-top:16px}
.day h3{font-size:13px;margin:0 0 8px;padding:6px 10px;background:#e8eefc;color:#1e3a8a;border-radius:8px;display:flex;justify-content:space-between}
.slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
.slot{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e5e9f0;border-radius:8px;background:#fff}
.slot.off .sinfo{opacity:.45}
.sinfo{flex:1;min-width:0;font-size:14px}
.sinfo b{font-size:16px;font-variant-numeric:tabular-nums}
.sinfo .mut{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tl{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
#msg{display:none;position:fixed;top:64px;left:50%;transform:translateX(-50%);padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;z-index:9;max-width:90%;box-shadow:0 2px 8px rgba(0,0,0,.15)}
#msg.ok{background:#dcfce7;color:#166534}#msg.err{background:#fee2e2;color:#991b1b}
footer{text-align:center;padding:4px 16px 16px;color:#64748b;font-size:12px}
footer a{color:#1e3a8a;font-weight:700;text-decoration:none}
footer a:hover{text-decoration:underline}
</style></head><body>
<div id="msg"></div>
<header><h1>Bel Madrasah</h1><div class="clk" id="hTime">-</div></header>
<div class="wrap">
<div class="warn" id="dfWarn">DFPlayer / kartu SD tidak terdeteksi. Bel tidak akan berbunyi. Periksa kabel dan kartu SD di modul DFPlayer.</div>
<div class="warn" id="timeWarn">Waktu perangkat belum tepercaya (RTC bermasalah / belum sinkron). Bel dikunci sampai waktu diperbaiki. Sambungkan ke internet atau atur waktu manual.</div>
<div class="layout">

<aside>
<div class="card"><h2>Status</h2><div class="grid">
<div class="it"><div class="l">Waktu</div><div class="v" id="sTime">-</div></div>
<div class="it"><div class="l">Jaringan</div><div class="v" id="sNet">-</div></div>
<div class="it"><div class="l">IP Address</div><div class="v" id="sIp">-</div></div>
<div class="it"><div class="l">Sedang Diputar</div><div class="v" id="sPlay">-</div></div>
<div class="it"><div class="l">DFPlayer</div><div class="v" id="sSd">-</div></div>
<div class="it"><div class="l">Mode Libur</div><div class="v" id="sHol">-</div></div>
<div class="it" style="grid-column:1/-1"><div class="l">Mode Tidur</div><div class="v" id="sSleep">-</div></div>
</div></div>

<div class="card"><h2>Kontrol</h2>
<div class="row"><label>Volume: <b id="volVal">0</b>/30</label></div>
<input type="range" id="vol" min="0" max="30" style="width:100%"
 oninput="$('volVal').textContent=this.value" onchange="setVol(this.value)">
<div class="row"><label>Mode Jadwal Aktif</label></div>
<select id="modeSel" onchange="setMode(this.value)">
<option value="reguler">Reguler</option>
<option value="ramadhan">Ramadhan</option>
<option value="pts">PTS</option>
<option value="pas">PAS</option>
</select>
<div class="row"><label>Mode Libur (nonaktifkan semua jadwal)</label>
<label class="sw"><input type="checkbox" id="hol" onchange="setHol(this.checked)"><span class="sl"></span></label></div>
<button class="danger full" onclick="act('/api/stop')">Stop Bel</button>
</div>

<div class="card"><h2>Mode Tidur</h2>
<p class="mut" style="margin-top:0">Pada rentang jam ini bel tidak berbunyi dan layar OLED bisa dimatikan. Web tetap aktif. Boleh melewati tengah malam (mis. 18:00 - 05:00).</p>
<form onsubmit="saveSleep(event)">
<div class="row"><label>Aktifkan Mode Tidur</label>
<label class="sw"><input type="checkbox" id="slEn"><span class="sl"></span></label></div>
<div class="f2">
<div><div class="l">Mulai</div><input type="time" id="slStart" value="18:00" required></div>
<div><div class="l">Selesai</div><input type="time" id="slEnd" value="05:00" required></div>
</div>
<div class="row"><label>Matikan layar OLED saat tidur</label>
<label class="sw"><input type="checkbox" id="slOled" checked><span class="sl"></span></label></div>
<button type="submit" class="full" style="margin-top:0">Simpan Mode Tidur</button>
</form></div>

<div class="card"><h2>Atur Waktu</h2>
<form onsubmit="setTimeManual(event)">
<div class="f2"><input type="date" id="tmDate" required><input type="time" id="tmTime" required></div>
<button type="submit" class="full" style="margin-top:0">Simpan Waktu</button>
<button type="button" class="sec full" onclick="fillNow()">Isi dari perangkat ini</button>
</form></div>

<div class="card"><h2>Jaringan</h2>
<div class="grid">
<div class="it"><div class="l">Mode</div><div class="v" id="nMode">-</div></div>
<div class="it"><div class="l">SSID</div><div class="v" id="nSsid">-</div></div>
<div class="it"><div class="l">Gateway</div><div class="v" id="nGw">-</div></div>
<div class="it"><div class="l">Rentang IP</div><div class="v" id="nRange">-</div></div>
</div>
<form onsubmit="saveStatic(event)" style="margin-top:12px">
<div class="row"><label>Pakai IP Statis</label>
<label class="sw"><input type="checkbox" id="stEn"><span class="sl"></span></label></div>
<input type="text" id="stIp" placeholder="192.168.1.50">
<p class="mut" id="stHint"></p>
<button type="submit" class="full" style="margin-top:0">Simpan &amp; Restart</button>
</form>
<button class="sec full" onclick="resetWifi()">Reset WiFi</button>
</div>
</aside>

<main>
<div class="card"><h2>Jadwal Bel</h2>
<div class="row" style="margin-top:0"><label>Tampilkan mode</label>
<select id="viewMode" onchange="dayFilter='';loadSched()" style="max-width:220px">
<option value="reguler">Reguler</option>
<option value="ramadhan">Ramadhan</option>
<option value="pts">PTS</option>
<option value="pas">PAS</option>
</select></div>
<div class="chips" id="dayChips"></div>
<div id="sched"></div>

<h2 id="fTitle" style="margin-top:24px">Tambah Jadwal</h2>
<form onsubmit="saveSlot(event)">
<div class="f3"><select id="fMode"></select><select id="fDay"></select><input type="time" id="fTime" value="07:00" required></div>
<select id="fTrack" style="margin-bottom:8px"></select>
<div class="row"><label>Aktif</label>
<label class="sw"><input type="checkbox" id="fEn" checked><span class="sl"></span></label></div>
<div class="f2"><button type="submit" id="fSave">Tambah</button>
<button type="button" class="sec" id="fCancel" onclick="resetForm()" style="display:none">Batal</button></div>
</form></div>

<div class="card"><h2>Daftar Track</h2>
<p class="mut">Nomor track sesuai file di kartu SD DFPlayer, folder mp3, format 0001.mp3, 0002.mp3, dst. Halaman ini hanya untuk memberi nama pada nomor track supaya mudah dipilih di jadwal.</p>
<div class="tl" id="tlist"></div>
<form onsubmit="addTrack(event)" style="margin-top:12px">
<div class="f2"><input type="number" id="tNum" min="1" max="2999" placeholder="No. track" required>
<input type="text" id="tLabel" placeholder="Nama (mis. sholawat)" required></div>
<button type="submit" class="full" style="margin-top:0">Simpan Nama Track</button>
</form>
</div>
</main>

</div></div>

<footer>Powered By <a href="https://zedlabs.id" target="_blank" rel="noopener noreferrer">ZEDLABS Teknologi Indonesia</a></footer>

<script>
var $=function(id){return document.getElementById(id);};
var DAYS={"all":"Setiap hari","mon-sat":"Senin-Sabtu","mon-fri":"Senin-Jumat","mon-thu":"Senin-Kamis","mon":"Senin","tue":"Selasa","wed":"Rabu","thu":"Kamis","fri":"Jumat","sat":"Sabtu","sun":"Minggu"};
var DAY_ORDER=["all","mon-sat","mon-fri","mon-thu","mon","tue","wed","thu","fri","sat","sun"];
var MODES={"reguler":"Reguler","ramadhan":"Ramadhan","pts":"PTS","pas":"PAS"};
var DOW=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
var slots=[],tracks=[],editId=-1,dfOk,dayFilter='';
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function msg(t,ok){var m=$('msg');m.textContent=t;m.className=ok?'ok':'err';m.style.display='block';clearTimeout(msg.t);msg.t=setTimeout(function(){m.style.display='none';},4500);}
function post(url,data){
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data||{})})
    .then(function(r){return r.json();}).catch(function(e){return {ok:false,msg:'Koneksi gagal'};});
}
function act(url,data){return post(url,data).then(function(j){msg(j.msg||'',j.ok);loadStatus();return j;});}
function getj(url){return fetch(url).then(function(r){return r.json();});}

$('fDay').innerHTML=DAY_ORDER.map(function(k){return '<option value="'+k+'">'+DAYS[k]+'</option>';}).join('');
$('fMode').innerHTML=Object.keys(MODES).map(function(k){return '<option value="'+k+'">'+MODES[k]+'</option>';}).join('');

function fillNow(){
 var d=new Date(),p=function(n){return String(n).padStart(2,'0');};
 $('tmDate').value=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
 $('tmTime').value=p(d.getHours())+':'+p(d.getMinutes());
}
function setTimeManual(e){
 e.preventDefault();
 post('/api/time/set',{date:$('tmDate').value,time:$('tmTime').value}).then(function(j){msg(j.msg,j.ok);loadStatus();});
}
fillNow();

function loadSleep(){
 return getj('/api/sleep').then(function(j){
  $('slEn').checked=j.enabled;
  $('slStart').value=j.start;
  $('slEnd').value=j.end;
  $('slOled').checked=j.oled;
 });
}
function saveSleep(e){
 e.preventDefault();
 post('/api/sleep',{enabled:$('slEn').checked?1:0,start:$('slStart').value,end:$('slEnd').value,oled:$('slOled').checked?1:0})
  .then(function(j){msg(j.msg,j.ok);loadStatus();});
}

function loadStatus(){
 getj('/api/status').then(function(s){
 var t=s.time.substr(11);
 $('sTime').textContent=DOW[s.dow]+', '+t;
 $('hTime').textContent=DOW[s.dow]+' '+t;
 $('sNet').textContent=s.mode=='STA'?'WiFi ('+s.rssi+' dBm)':'Mode AP';
 $('sIp').textContent=s.ip;
 $('sPlay').textContent=s.playing?('Track '+s.track):'-';
 $('sSd').textContent=s.dfp?'Terpasang':'Tidak ada';
 $('sHol').textContent=s.holiday?'Aktif':'Nonaktif';
 $('sSleep').textContent=s.sleeping?('Sedang tidur (s/d '+s.sleep_end+')'):(s.sleep_on?('Siaga ('+s.sleep_start+' - '+s.sleep_end+')'):'Nonaktif');
 $('timeWarn').style.display=s.trusted?'none':'block';
 $('dfWarn').style.display=s.dfp?'none':'block';
 if(document.activeElement!==$('vol')){$('vol').value=s.volume;$('volVal').textContent=s.volume;}
 $('hol').checked=s.holiday;
 if(document.activeElement!==$('modeSel'))$('modeSel').value=s.sched_mode||'reguler';
 dfOk=s.dfp;
 }).catch(function(e){});
}
function setVol(v){act('/api/volume',{value:v});}
function setHol(c){act('/api/holiday',{value:c?1:0});}
function setMode(v){$('viewMode').value=v;dayFilter='';act('/api/mode',{value:v}).then(loadSched);}

function loadTracks(){return getj('/api/tracks').then(function(j){tracks=j.tracks;renderTracks();});}
function renderTracks(){
 $('tlist').innerHTML=tracks.length?tracks.map(function(t){return '<div class="slot"><div class="sinfo">#'+t.track+' &middot; '+esc(t.label)+'</div>'+
 '<button class="sm" onclick="playTest('+t.track+')">Putar</button>'+
 '<button class="sm danger" onclick="delTrack('+t.track+')">Hapus</button></div>';}).join(''):'<p class="mut">Belum ada nama track.</p>';
 var sel=$('fTrack'),cur=sel.value;
 sel.innerHTML=tracks.length?tracks.map(function(t){return '<option value="'+t.track+'">#'+t.track+' - '+esc(t.label)+'</option>';}).join(''):'<option value="">(belum ada track)</option>';
 if(cur)sel.value=cur;
}
function playTest(n){act('/api/ring',{track:n});}
function delTrack(n){
 if(!confirm('Hapus nama track #'+n+'? (file di SD DFPlayer tidak terhapus)'))return;
 post('/api/tracks/delete',{track:n}).then(function(j){msg(j.msg,j.ok);loadTracks();});
}
function addTrack(e){
 e.preventDefault();
 post('/api/tracks/add',{track:$('tNum').value,label:$('tLabel').value}).then(function(j){
  msg(j.msg,j.ok);
  if(j.ok){$('tNum').value='';$('tLabel').value='';loadTracks();}
 });
}

function loadSched(){
 var m=$('viewMode').value;
 return getj('/api/schedule?mode='+m).then(function(j){slots=j.slots;renderSched();});
}
function trackName(n){
 for(var i=0;i<tracks.length;i++){if(tracks[i].track==n)return '#'+n+' - '+esc(tracks[i].label);}
 return '#'+n+' (nama belum diisi)';
}
function renderSched(){
 var el=$('sched'),chips=$('dayChips');
 if(!slots.length){el.innerHTML='<p class="mut">Belum ada jadwal untuk mode ini.</p>';chips.innerHTML='';return;}
 var g={};
 slots.forEach(function(s){(g[s.day]=g[s.day]||[]).push(s);});
 var present=DAY_ORDER.filter(function(d){return g[d];});
 if(dayFilter&&!g[dayFilter])dayFilter='';
 chips.innerHTML='<button class="chip'+(dayFilter?'':' on')+'" onclick="setDayFilter(\'\')">Semua ('+slots.length+')</button>'+
  present.map(function(d){return '<button class="chip'+(dayFilter==d?' on':'')+'" onclick="setDayFilter(\''+d+'\')">'+DAYS[d]+' ('+g[d].length+')</button>';}).join('');
 el.innerHTML=present.filter(function(d){return !dayFilter||dayFilter==d;}).map(function(d){
  var list=g[d].slice().sort(function(a,b){return a.time<b.time?-1:(a.time>b.time?1:0);});
  return '<div class="day"><h3><span>'+DAYS[d]+'</span><span>'+list.length+' bel</span></h3><div class="slots">'+
  list.map(function(s){
   return '<div class="slot'+(s.enabled?'':' off')+'">'+
   '<div class="sinfo"><b>'+s.time+'</b><span class="mut">'+trackName(s.track)+'</span></div>'+
   '<label class="sw"><input type="checkbox" '+(s.enabled?'checked':'')+' onchange="toggleSlot('+s.id+',this.checked)"><span class="sl"></span></label>'+
   '<button class="sm sec" onclick="editSlot('+s.id+')">Edit</button>'+
   '<button class="sm danger" onclick="delSlot('+s.id+')">Hapus</button></div>';
  }).join('')+'</div></div>';
 }).join('');
}
function setDayFilter(d){dayFilter=d;renderSched();}
function findSlot(id){
 for(var i=0;i<slots.length;i++){if(slots[i].id==id)return slots[i];}
 return null;
}
function toggleSlot(id,en){
 var s=findSlot(id);if(!s)return;
 post('/api/schedule/update',{id:id,mode:s.mode,day:s.day,time:s.time,track:s.track,enabled:en?1:0}).then(function(j){msg(j.msg,j.ok);loadSched();});
}
function delSlot(id){
 if(!confirm('Hapus jadwal ini?'))return;
 post('/api/schedule/delete',{id:id}).then(function(j){msg(j.msg,j.ok);loadSched();});
}
function editSlot(id){
 var s=findSlot(id);if(!s)return;
 editId=id;
 $('fMode').value=s.mode;$('fDay').value=s.day;$('fTime').value=s.time;$('fTrack').value=s.track;$('fEn').checked=s.enabled;
 $('fTitle').textContent='Edit Jadwal';$('fSave').textContent='Simpan';$('fCancel').style.display='block';
 $('fTitle').scrollIntoView({behavior:'smooth'});
}
function resetForm(){editId=-1;$('fTitle').textContent='Tambah Jadwal';$('fSave').textContent='Tambah';$('fCancel').style.display='none';$('fEn').checked=true;$('fMode').value=$('viewMode').value;}
function saveSlot(e){
 e.preventDefault();
 var d={mode:$('fMode').value,day:$('fDay').value,time:$('fTime').value,track:$('fTrack').value,enabled:$('fEn').checked?1:0};
 var p;
 if(editId>=0){d.id=editId;p=post('/api/schedule/update',d);}else p=post('/api/schedule/add',d);
 p.then(function(j){msg(j.msg,j.ok);if(j.ok){resetForm();loadSched();}});
}

function loadNet(){
 return getj('/api/network').then(function(n){
 $('nMode').textContent=n.mode=='STA'?'Terhubung WiFi':'AP (192.168.4.1)';
 $('nSsid').textContent=n.ssid||'-';
 $('nGw').textContent=n.gateway||'-';
 $('nRange').textContent=n.range_start?n.range_start+' - '+n.range_end:'-';
 $('stEn').checked=n.static_enabled;
 $('stIp').value=n.static_enabled?n.static_ip:(n.range_start?n.ip:'');
 $('stHint').textContent=n.range_start?
  'IP harus dalam rentang '+n.range_start+' - '+n.range_end+'. Pilih IP di luar rentang DHCP router agar tidak bentrok.':
  'Sambungkan perangkat ke WiFi dulu untuk mengatur IP statis.';
 });
}
function saveStatic(e){
 e.preventDefault();
 var en=$('stEn').checked;
 if(!confirm('Perangkat akan restart. Lanjutkan?'))return;
 post('/api/network/static',{enabled:en?1:0,ip:$('stIp').value}).then(function(j){
  msg(j.msg,j.ok);
  if(j.ok&&j.new_ip)setTimeout(function(){location.href='http://'+j.new_ip+'/';},9000);
 });
}
function resetWifi(){
 if(!confirm('Reset koneksi WiFi? Perangkat akan restart dan membuka portal di 192.168.4.1'))return;
 post('/api/network/reset').then(function(j){msg(j.msg,j.ok);});
}

loadTracks().then(loadSched).then(loadNet).then(loadSleep).then(loadStatus).then(function(){
 setInterval(function(){if(!document.hidden)loadStatus();},5000);
});
</script></body></html>
)HTMLPAGE";