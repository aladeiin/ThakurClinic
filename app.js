'use strict';
/* Thakur Clinic EMR — main app. Data lives in `db` (synced to Google Cloud by cloud.js via save()). */
const KEY='thakurClinicEMR_v1';
const clinic={name:'Thakur Clinic',doctor:'Dr Ashwin Thakur MD (AM), BAMS, PGDEMS',reg:'I-108768-A',
  address:'Opp Balaji Nagar Garden, Gadgadeshwar Mandir Road, Amravati, Maharashtra',phones:'9284967619 / 8378889854'};
const COLS_DEFAULT=['patients','visits','medicines','appointments','payments','templates'];
const SEED_MEDS=[['Paracetamol','500 mg','Tablet'],['Amoxicillin','500 mg','Capsule'],['Azithromycin','500 mg','Tablet'],['Metformin','500 mg','Tablet'],
  ['Cetirizine','10 mg','Tablet'],['Levocetirizine','5 mg','Tablet'],['Pantoprazole','40 mg','Tablet'],['Domperidone','10 mg','Tablet'],['Ondansetron','4 mg','Tablet'],
  ['Ibuprofen','400 mg','Tablet'],['Diclofenac','50 mg','Tablet'],['Ciprofloxacin','500 mg','Tablet'],['Doxycycline','100 mg','Capsule'],['Metronidazole','400 mg','Tablet'],
  ['Amlodipine','5 mg','Tablet'],['Telmisartan','40 mg','Tablet'],['Atorvastatin','10 mg','Tablet'],['Glimepiride','1 mg','Tablet'],['Montelukast','10 mg','Tablet'],
  ['Salbutamol','100 mcg','Inhaler'],['Vitamin D3','60000 IU','Sachet'],['ORS','','Sachet']]
  .map((m,i)=>({id:'M'+String(i+1).padStart(3,'0'),generic:m[0],brand:'',strength:m[1],form:m[2],content:(m[0]+' '+m[1]).trim()}));

function ensure(d){
  d=d&&typeof d==='object'?d:{};
  for(const c of COLS_DEFAULT)if(!Array.isArray(d[c]))d[c]=[];
  if(!d.medicines.length)d.medicines=SEED_MEDS.map(m=>({...m}));
  d.settings=Object.assign({upi:'',logo:'',fee:''},d.settings||{});
  return d;
}
let db;try{db=ensure(JSON.parse(localStorage.getItem(KEY)||'null'))}catch(e){db=ensure(null)}
let page='today',selectedPatient=null,vctx=null;

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID();
function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}window.Cloud&&Cloud.changed()}
function toast(x){const el=$('toast');el.textContent=x;el.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.display='none',2600)}
function esc(x=''){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function localISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function today(){return localISO(new Date())}
function addDays(n,from){const d=from?new Date(from+'T00:00:00'):new Date();d.setDate(d.getDate()+n);return localISO(d)}
function diffDays(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5)}
function fmt(d){return d?new Date(d+(String(d).length===10?'T00:00:00':'')).toLocaleDateString(lang==='mr'?'mr-IN':'en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—'}
function money(n){return '₹'+Number(n||0).toLocaleString('en-IN')}
function patientById(id){return db.patients.find(x=>x.id===id)}
function patientName(id){const p=patientById(id);return p?p.name:'?'}
function stKey(s){return String(s||'Booked').replace(/ /g,'_')}
function ageOf(p){if(p.dob){const a=Math.floor((Date.now()-new Date(p.dob))/315576e5);if(a>=0&&a<130)return a}return p.age||''}
function nextUHID(){const n=db.patients.reduce((m,p)=>Math.max(m,parseInt(String(p.uhid||'').replace(/\D/g,''))||0),0)+1;return 'TC-'+String(n).padStart(6,'0')}
function waNumber(m){const d=String(m||'').replace(/\D/g,'');if(d.length===10)return '91'+d;if(d.length===11&&d[0]==='0')return '91'+d.slice(1);return d.length>=11?d:''}
function waBtn(mobile,text,label,cls=''){const n=waNumber(mobile);return `<a class="btn wa ${cls} ${n?'':'off'}" target="_blank" rel="noopener" href="${n?'https://wa.me/'+n+'?text='+encodeURIComponent(text):'#'}">${label||('💬 '+t('whatsapp'))}</a>`}
function F(id,lab,val='',o={}){return `<div class="${o.full?'full':''}"><label>${lab}${o.area?`<textarea id="${id}" ${o.attr||''}>${esc(val)}</textarea>`:`<input id="${id}" type="${o.type||'text'}" value="${esc(val)}" ${o.attr||''}>`}</label></div>`}
function S(id,lab,opts,val,o={}){return `<div class="${o.full?'full':''}"><label>${lab}<select id="${id}" ${o.attr||''}>${opts.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(val)?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div>`}
function openModal(html,narrow){const b=$('modalBox');b.className='modalbox'+(narrow?' narrow':'');b.innerHTML=html;$('modal').classList.remove('hidden');$('modal').scrollTop=0}
function closeModal(){$('modal').classList.add('hidden');$('modalBox').innerHTML=''}
function modalHead(title,backFn){return `<div class="section-title"><h2>${title}</h2><button class="btn" onclick="${backFn||'closeModal()'}">✕</button></div>`}
function printHTML(title,body,css=''){
  const w=window.open('','_blank');if(!w){toast(t('popup_blocked'));return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,"Noto Sans Devanagari",sans-serif;color:#111;font-size:14px}h1{margin:0}.muted{color:#555}.line{border-bottom:2px solid #0f766e;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:7px 6px;text-align:left}.hdr{display:flex;gap:14px;align-items:center}.hdr img{height:64px}.sig{margin-top:70px;text-align:right}${css}</style></head><body>${body}</body></html>`);
  w.document.close();setTimeout(()=>{w.focus();w.print()},400);
}
function letterhead(){return `<div class="hdr">${db.settings.logo?`<img src="${db.settings.logo}">`:''}<div><h1>${esc(clinic.name)}</h1><b>${esc(clinic.doctor)}</b><div>${esc(t('reg_no'))} ${esc(clinic.reg)}</div></div></div><div class="muted">${esc(clinic.address)} · ${esc(clinic.phones)}</div><div class="line"></div>`}

/* ---------- navigation ---------- */
const PAGES=[['today','🏠'],['patients','👥'],['appointments','📅'],['payments','₹'],['templates','📋'],['medicines','💊'],['reports','📊'],['settings','⚙️']];
function buildNav(){
  const reg=(window.Cloud&&Cloud.regs.length)||0;
  $('nav').innerHTML=PAGES.map(([p,ic])=>`<button data-page="${p}" class="${p===page?'active':''}"><span class="ic">${ic}</span><span>${esc(t('nav_'+p))}</span>${p==='today'&&reg?`<span class="badge">${reg}</span>`:''}</button>`).join('');
  $('nav').querySelectorAll('button').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
}
function setPage(p){page=p;render()}
function render(){
  document.documentElement.lang=lang==='mr'?'mr':'en';
  document.querySelectorAll('[data-i]').forEach(e=>e.textContent=t(e.dataset.i));
  document.querySelectorAll('[data-ip]').forEach(e=>e.placeholder=t(e.dataset.ip));
  $('langBtn').textContent=lang==='en'?'मराठी':'English';
  buildNav();
  const l=db.settings.logo;$('logoBox').innerHTML=l?`<img src="${l}">`:'TC';
  $('page').innerHTML=views[page]();
  if(after[page])after[page]();
}
window.onRegsChanged=()=>{if(page==='today')render();else buildNav()};

/* ---------- views ---------- */
const views={today:viewToday,patients:viewPatients,appointments:viewAppointments,payments:viewPayments,templates:viewTemplates,medicines:viewMedicines,reports:viewReports,settings:viewSettings};
const after={settings:()=>{}};

function qOrder(a){return {In_consultation:0,Waiting:1,Booked:2,Done:3}[stKey(a.status)]??4}
function todayQueue(){const td=today();return db.appointments.filter(a=>a.date===td&&a.status!=='Cancelled').sort((a,b)=>qOrder(a)-qOrder(b)||(a.token||999)-(b.token||999)||(a.time||'').localeCompare(b.time||''))}
function queueAdd(pid,reason,type){
  const td=today(),ex=db.appointments.find(a=>a.patientId===pid&&a.date===td&&!['Done','Cancelled'].includes(a.status));
  if(ex){if(ex.status==='Booked'){ex.status='Waiting';ex.token=ex.token||nextToken();save()}else toast(t('already_in_queue'));return ex}
  const a={id:uid(),patientId:pid,date:td,time:'',type:type||'Walk-in',reason:reason||'',status:'Waiting',token:nextToken()};
  db.appointments.push(a);save();return a;
}
function nextToken(){return db.appointments.filter(a=>a.date===today()).reduce((m,a)=>Math.max(m,a.token||0),0)+1}
function setApptStatus(id,s){const a=db.appointments.find(x=>x.id===id);if(!a)return;a.status=s;if(s==='Waiting'&&!a.token)a.token=nextToken();save();render()}
function startVisit(aid){const a=db.appointments.find(x=>x.id===aid);if(!a)return;if(a.status!=='In consultation'){a.status='In consultation';save()}openVisitForm(a.patientId,null,{apptId:aid})}

function followupsDue(){
  const lim=addDays(3),out=[];
  db.visits.forEach(v=>{if(!v.followup||v.followup>lim)return;
    if(db.visits.some(x=>x.patientId===v.patientId&&x.date>v.date))return;   // patient already came back
    out.push(v)});
  return out.sort((a,b)=>a.followup.localeCompare(b.followup));
}
function backupAge(){const d=localStorage.getItem('tc_lastBackup');return d?diffDays(d,today()):null}

function viewToday(){
  const td=today(),q=todayQueue(),cnt=s=>q.filter(a=>stKey(a.status)===s).length;
  const collected=db.payments.filter(p=>p.date===td).reduce((s,p)=>s+Number(p.amount||0),0);
  const regs=(window.Cloud&&Cloud.regs)||[],fu=followupsDue(),age=backupAge();
  const hour=new Date().getHours(),greet=hour<12?t('good_morning'):hour<17?t('good_afternoon'):t('good_evening');
  return `<div class="section-title"><div><h1>${greet}, Dr Thakur</h1><div class="muted">${new Date().toLocaleDateString(lang==='mr'?'mr-IN':'en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div>
  <div class="row"><button class="btn primary" onclick="openPatientForm()">+ ${t('new_patient')}</button><button class="btn" onclick="openQueuePicker()">➕ ${t('add_to_queue')}</button><button class="btn" onclick="openQR()">📱 ${t('patient_qr')}</button></div></div>
  ${(age===null&&db.patients.length>0)||(age!==null&&age>7)?`<div class="warnbox banner"><span>💾 ${t('backup_due')}</span><button class="btn sm" onclick="exportData()">${t('export_now')}</button></div>`:''}
  ${regs.length?`<div class="card" style="margin-bottom:14px;border-color:#f59e0b"><h3>📲 ${t('new_selfreg',regs.length)}</h3>${regs.map(r=>`<div class="qrow"><div class="qinfo"><b>${esc(r.name)}</b> <span class="muted">${esc(r.age||'')} ${esc(r.sex||'')} · ${esc(r.mobile)}</span><div>${esc(r.reason||'')}</div>${r.allergies?`<div class="pill bad">⚠ ${esc(r.allergies)}</div>`:''}</div><div class="qact"><button class="btn primary sm" onclick="acceptReg('${r.id}')">✓ ${t('accept_queue')}</button><button class="btn sm danger" onclick="dismissReg('${r.id}')">${t('dismiss')}</button></div></div>`).join('')}</div>`:''}
  <div class="grid stats" style="margin-bottom:14px">
   <div class="card stat"><div class="muted">${t('st_Waiting')}</div><div class="n">${cnt('Waiting')}</div></div>
   <div class="card stat"><div class="muted">${t('st_In_consultation')}</div><div class="n">${cnt('In_consultation')}</div></div>
   <div class="card stat"><div class="muted">${t('st_Done')}</div><div class="n">${cnt('Done')}</div></div>
   <div class="card stat"><div class="muted">${t('collected_today')}</div><div class="n">${money(collected)}</div></div></div>
  <div class="grid two">
   <div class="card"><h3>${t('todays_queue')}</h3>${q.length?q.map(queueRow).join(''):`<p class="muted">${t('queue_empty')}</p>`}</div>
   <div class="card"><h3>${t('followups_due')}</h3>${fu.length?fu.map(v=>{const p=patientById(v.patientId);if(!p)return '';const late=v.followup<td;
     return `<div class="qrow"><div class="qinfo"><b>${esc(p.name)}</b><div class="muted">${esc(p.mobile)} · ${esc(v.diagnosis||'')}</div><span class="pill ${late?'bad':'warn'}">${late?t('overdue'):t('due')}: ${fmt(v.followup)}</span></div><div class="qact">${waBtn(p.whatsapp||p.mobile,t('wa_followup',p.name,fmt(v.followup),clinic.name),'💬 '+t('remind'))}<button class="btn sm" onclick="queueAdd('${p.id}','${t('followup')}','Follow-up');render()">${t('add_to_queue')}</button></div></div>`}).join(''):`<p class="muted">${t('no_followups')}</p>`}</div></div>`;
}
function queueRow(a){
  const p=patientById(a.patientId);if(!p)return '';const s=stKey(a.status);
  const lastVisitToday=db.visits.filter(v=>v.patientId===p.id&&v.date===today()).pop();
  let acts='';
  if(s==='Booked')acts=`<button class="btn primary sm" onclick="setApptStatus('${a.id}','Waiting')">${t('arrived')}</button><button class="btn sm danger" onclick="setApptStatus('${a.id}','Cancelled')">${t('cancel')}</button>`;
  if(s==='Waiting')acts=`<button class="btn primary" onclick="startVisit('${a.id}')">▶ ${t('start_visit')}</button><button class="btn sm danger" onclick="setApptStatus('${a.id}','Cancelled')">${t('cancel')}</button>`;
  if(s==='In_consultation')acts=`<button class="btn primary" onclick="startVisit('${a.id}')">📝 ${t('open_visit')}</button><button class="btn sm" onclick="setApptStatus('${a.id}','Done')">✓ ${t('mark_done')}</button>`;
  if(s==='Done')acts=`${lastVisitToday?`<button class="btn sm" onclick="printPrescription('${lastVisitToday.id}')">🖨 Rx</button>`:''}<button class="btn sm" onclick="openPayment('${p.id}')">₹ ${t('collect_fee')}</button>`;
  return `<div class="qrow st-${s}"><div class="tok">${a.token?'#'+a.token:'·'}</div><div class="qinfo"><b>${esc(p.name)}</b> <span class="pill ${s==='Done'?'ok':s==='Waiting'?'warn':'blue'}">${t('st_'+s)}</span><div class="muted">${esc(ageOf(p))} ${esc(p.sex||'')} · ${esc(a.reason||a.type||'')}${a.time?' · '+esc(a.time):''}</div>${p.allergies?`<div class="pill bad">⚠ ${esc(p.allergies)}</div>`:''}</div><div class="qact">${acts}<button class="btn sm" onclick="openPatient('${p.id}')">${t('record')}</button></div></div>`;
}
function openQueuePicker(){
  openModal(modalHead(t('add_to_queue'))+`<input id="qpSearch" data-ip="search_ph" placeholder="${esc(t('search_ph'))}" oninput="qpFilter(this.value)" autocomplete="off"><div id="qpList" class="results-list"></div><div class="row" style="margin-top:12px"><button class="btn" onclick="openPatientForm(null,true)">+ ${t('new_patient')}</button></div>`,true);
  qpFilter('');setTimeout(()=>$('qpSearch')&&$('qpSearch').focus(),50);
}
function matchPatients(q){q=String(q||'').trim().toLowerCase();return db.patients.filter(p=>!q||[p.name,p.mobile,p.uhid].some(v=>String(v||'').toLowerCase().includes(q)))}
function qpFilter(q){const r=matchPatients(q).sort((a,b)=>(b.created||'').localeCompare(a.created||'')).slice(0,10);
  $('qpList').innerHTML=r.map(p=>`<div class="sr" onclick="qpPick('${p.id}')"><b>${esc(p.name)}</b><span class="muted">${esc(p.uhid)} · ${esc(p.mobile)}</span></div>`).join('')||`<p class="muted">${t('no_results')}</p>`}
function qpPick(pid){queueAdd(pid,'','Walk-in');closeModal();page='today';render()}

/* self-registration inbox */
function acceptReg(id){
  const r=Cloud.regs.find(x=>x.id===id);if(!r)return;
  let p=db.patients.find(x=>x.mobile&&x.mobile===r.mobile&&x.name.trim().toLowerCase()===r.name.trim().toLowerCase());
  if(p){if(!confirm(t('confirm_existing',p.name,p.uhid)))return}
  else{p={id:uid(),uhid:nextUHID(),name:r.name.trim(),dob:'',age:r.age||'',sex:r.sex||'',mobile:r.mobile,whatsapp:r.mobile,address:r.address||'',emergency:'',allergies:r.allergies||'',chronic:r.chronic||'',surgical:'',family:'',notes:'',created:today()};db.patients.push(p)}
  queueAdd(p.id,r.reason||'','New patient');
  Cloud.removeReg(id).catch(()=>{});Cloud.regs=Cloud.regs.filter(x=>x.id!==id);
  save();toast(t('added_to_queue'));render();
}
function dismissReg(id){if(!confirm(t('confirm_dismiss')))return;Cloud.removeReg(id).catch(()=>{});Cloud.regs=Cloud.regs.filter(x=>x.id!==id);render()}

function openQR(){
  if(!Cloud.enabled)return toast(t('qr_need_cloud'));
  const url=location.origin+'/register.html';
  openModal(modalHead(t('patient_qr'))+`<div class="poster"><p>${t('qr_help')}</p><div id="qrBox" style="display:inline-block;padding:14px;background:#fff"></div><p class="small muted" style="word-break:break-all">${esc(url)}</p><div class="row" style="justify-content:center"><button class="btn primary" onclick="printPoster()">🖨 ${t('print_poster')}</button><button class="btn" onclick="navigator.clipboard&&navigator.clipboard.writeText('${url}').then(()=>toast(t('copied')))">${t('copy_link')}</button></div></div>`,true);
  drawQR('qrBox',url,240);
}
function drawQR(elId,text,size){const el=$(elId);el.innerHTML='';if(typeof QRCode==='undefined'){el.textContent=text;return}new QRCode(el,{text,width:size,height:size,correctLevel:QRCode.CorrectLevel.M})}
function qrDataURL(elId){const el=$(elId);const c=el&&el.querySelector('canvas');if(c)return c.toDataURL('image/png');const i=el&&el.querySelector('img');return i?i.src:''}
function printPoster(){
  const src=qrDataURL('qrBox');
  printHTML('QR',`<div style="text-align:center;padding-top:30px"><h1 style="font-size:40px">${esc(clinic.name)}</h1><p style="font-size:20px">${esc(clinic.doctor)}</p><img src="${src}" style="width:380px;margin:30px 0"><p style="font-size:30px;font-weight:bold">Scan to register / तपासणीसाठी नोंदणी करा</p><p style="font-size:20px">Scan with your phone camera · फोनच्या कॅमेऱ्याने स्कॅन करा</p><p class="muted" style="margin-top:40px">${esc(clinic.address)}<br>${esc(clinic.phones)}</p></div>`);
}

/* ---------- patients ---------- */
function viewPatients(){
  return `<div class="section-title"><h1>${t('nav_patients')}</h1><div class="row"><button class="btn" onclick="exportPatientsCSV()">⬇ CSV</button><button class="btn primary" onclick="openPatientForm()">+ ${t('new_patient')}</button></div></div>
  <div class="card"><div class="table-wrap">${patientTable(db.patients.slice().sort((a,b)=>(b.created||'').localeCompare(a.created||'')))}</div></div>`;
}
function lastVisitDate(pid){const v=db.visits.filter(x=>x.patientId===pid).sort((a,b)=>b.date.localeCompare(a.date))[0];return v&&v.date}
function patientTable(arr){
  if(!arr.length)return `<p class="muted">${t('no_patients')}</p>`;
  return `<table><thead><tr><th>${t('uhid')}</th><th>${t('name')}</th><th>${t('age_sex')}</th><th>${t('mobile')}</th><th>${t('last_visit')}</th><th></th></tr></thead><tbody>${arr.map(p=>`<tr><td>${esc(p.uhid)}</td><td><b>${esc(p.name)}</b></td><td>${esc(ageOf(p)||'—')} / ${esc(p.sex||'—')}</td><td>${esc(p.mobile)}</td><td>${fmt(lastVisitDate(p.id))}</td><td><button class="btn sm" onclick="openPatient('${p.id}')">${t('open')}</button></td></tr>`).join('')}</tbody></table>`;
}
function exportPatientsCSV(){
  const cols=['uhid','name','age','sex','mobile','whatsapp','address','allergies','chronic','created'];
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv=[cols.join(',')].concat(db.patients.map(p=>cols.map(c=>q(c==='age'?ageOf(p):p[c])).join(','))).join('\n');
  download('thakur-clinic-patients.csv','﻿'+csv,'text/csv');
}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}

function openPatientForm(id,thenQueue){
  const p=id?patientById(id):{};
  openModal(modalHead(id?t('edit_patient'):t('new_patient'))+`<div class="form">
  ${F('pname',t('full_name'),p.name,{full:true})}${F('pmobile',t('mobile'),p.mobile,{type:'tel',attr:'inputmode="numeric" maxlength="10"'})}${F('pwa',t('whatsapp_no'),p.whatsapp&&p.whatsapp!==p.mobile?p.whatsapp:'',{type:'tel',attr:'inputmode="numeric" maxlength="10"'})}
  ${F('pdob',t('dob'),p.dob,{type:'date'})}${F('pageyr',t('age'),p.age,{type:'number'})}
  ${S('psex',t('sex'),[['Male',t('male')],['Female',t('female')],['Other',t('other')]],p.sex||'Male')}${F('pem',t('emergency'),p.emergency)}
  ${F('paddr',t('address'),p.address,{area:true,full:true})}
  ${F('pall',t('allergies'),p.allergies,{full:true,attr:`placeholder="${esc(t('allergy_ph'))}"`})}
  ${F('pchronic',t('chronic'),p.chronic)}${F('psurg',t('surgical'),p.surgical)}${F('pfam',t('family_hx'),p.family)}${F('pnotes',t('notes'),p.notes)}
  </div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeModal()">${t('cancel')}</button><button class="btn primary" onclick="savePatient('${id||''}',${thenQueue?1:0})">${t('save')}</button></div>`);
  $('pname').focus();
}
function savePatient(id,thenQueue){
  const name=$('pname').value.trim(),mobile=$('pmobile').value.replace(/\D/g,'');
  if(!name)return toast(t('name_required'));
  if(mobile&&mobile.length!==10)return toast(t('mobile_10'));
  const wa=$('pwa').value.replace(/\D/g,'')||mobile;
  const dob=$('pdob').value,age=$('pageyr').value||(dob?String(ageOf({dob})):'');
  const f={name,mobile,whatsapp:wa,dob,age,sex:$('psex').value,address:$('paddr').value.trim(),emergency:$('pem').value.trim(),allergies:$('pall').value.trim(),chronic:$('pchronic').value.trim(),surgical:$('psurg').value.trim(),family:$('pfam').value.trim(),notes:$('pnotes').value.trim()};
  let p;
  if(id){p=patientById(id);Object.assign(p,f)}
  else{
    const dup=db.patients.find(x=>mobile&&x.mobile===mobile&&x.name.toLowerCase()===name.toLowerCase());
    if(dup&&!confirm(t('confirm_existing',dup.name,dup.uhid)))return;
    p={id:uid(),uhid:nextUHID(),created:today(),...f};db.patients.push(p);
  }
  save();closeModal();toast(t('saved'));
  if(thenQueue){queueAdd(p.id,'','New patient');page='today';render()}
  else{render();if(!id)openPatient(p.id)}
}

/* global search */
function doSearch(q){
  const box=$('searchResults');q=q.trim();
  if(q.length<2){box.classList.add('hidden');box.innerHTML='';return}
  const r=matchPatients(q).slice(0,8);
  box.innerHTML=r.map(p=>`<div class="sr" onclick="pickSearch('${p.id}')"><b>${esc(p.name)}</b><span class="muted">${esc(p.uhid)} · ${esc(p.mobile)}</span></div>`).join('')||`<div class="sr muted">${t('no_results')}</div>`;
  box.classList.remove('hidden');
}
function pickSearch(id){$('searchResults').classList.add('hidden');$('globalSearch').value='';openPatient(id)}

/* ---------- patient 360 ---------- */
function openPatient(id,tab='overview'){
  const p=patientById(id);if(!p)return;selectedPatient=id;
  const tabs=[['overview',t('tab_overview')],['meds',t('tab_meds')],['docs',t('tab_docs')],['pay',t('tab_pay')]];
  openModal(`<div class="section-title"><div><h2>${esc(p.name)} <span class="pill">${esc(ageOf(p)||'—')} / ${esc(p.sex||'—')}</span></h2><div class="muted">${esc(p.uhid)} · ${esc(p.mobile||'—')}</div></div><button class="btn" onclick="closeModal()">✕</button></div>
  <div class="row"><button class="btn primary" onclick="openVisitForm('${id}')">+ ${t('new_visit')}</button><button class="btn" onclick="queueAdd('${id}','','Walk-in');toast(t('added_to_queue'));render()">➕ ${t('add_to_queue')}</button><button class="btn" onclick="openPatientForm('${id}')">✎ ${t('edit')}</button>${waBtn(p.whatsapp||p.mobile,t('wa_hello',p.name,clinic.name))}</div>
  ${p.allergies?`<div class="alert"><b>⚠ ${t('allergies')}:</b> ${esc(p.allergies)}</div>`:''}${p.chronic?`<div class="okbox"><b>${t('chronic')}:</b> ${esc(p.chronic)}</div>`:''}
  <div class="tabs">${tabs.map(([k,l])=>`<button class="${k===tab?'active':''}" onclick="openPatient('${id}','${k}')">${l}</button>`).join('')}</div><div id="ptab"></div>`);
  const el=$('ptab');
  if(tab==='overview')el.innerHTML=patientOverview(p);
  if(tab==='meds')el.innerHTML=patientMeds(id);
  if(tab==='pay')el.innerHTML=patientPay(id);
  if(tab==='docs')patientDocs(id);
}
function vitalsLine(v){return [v.bp&&'BP '+v.bp,v.pulse&&'P '+v.pulse,v.spo&&'SpO₂ '+v.spo,v.temp&&'T '+v.temp,v.rr&&'RR '+v.rr,v.weight&&'Wt '+v.weight+'kg',v.height&&'Ht '+v.height+'cm'].filter(Boolean).join(' · ')}
function patientOverview(p){
  const vs=db.visits.filter(v=>v.patientId===p.id).sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="grid two"><div><h3>${t('timeline')}</h3><div class="timeline">${vs.map(v=>`<div class="event"><b>${fmt(v.date)} — ${esc(v.diagnosis||t('visit'))}</b><div class="muted">${esc(v.complaint||'')}</div>${vitalsLine(v)?`<div class="small muted">${esc(vitalsLine(v))}</div>`:''}<div>${esc((v.medicines||[]).map(m=>[m.name,m.dose,m.frequency,m.duration].filter(Boolean).join(' ')).join('; ')||t('no_meds'))}</div>
  <div class="row" style="margin-top:6px"><button class="btn sm" onclick="printPrescription('${v.id}')">🖨 ${t('print_rx')}</button>${waBtn(p.whatsapp||p.mobile,rxText(v,p),'💬 Rx','sm')}<button class="btn sm" onclick="openVisitForm('${p.id}','${v.id}')">✎ ${t('edit')}</button></div></div>`).join('')||`<p class="muted">${t('no_visits')}</p>`}</div></div>
  <div><h3>${t('patient_info')}</h3><p><b>${t('address')}:</b> ${esc(p.address||'—')}<br><b>${t('emergency')}:</b> ${esc(p.emergency||'—')}<br><b>${t('surgical')}:</b> ${esc(p.surgical||'—')}<br><b>${t('family_hx')}:</b> ${esc(p.family||'—')}<br><b>${t('notes')}:</b> ${esc(p.notes||'—')}</p></div></div>`;
}
function patientMeds(id){
  const meds=[];db.visits.filter(v=>v.patientId===id).sort((a,b)=>b.date.localeCompare(a.date)).forEach(v=>(v.medicines||[]).forEach(m=>meds.push({...m,date:v.date})));
  return meds.length?`<div class="table-wrap"><table><thead><tr><th>${t('date')}</th><th>${t('medicine')}</th><th>${t('dose')}</th><th>${t('frequency')}</th><th>${t('duration')}</th></tr></thead><tbody>${meds.map(m=>`<tr><td>${fmt(m.date)}</td><td>${esc(m.name)}</td><td>${esc(m.dose)}</td><td>${esc(m.frequency)}</td><td>${esc(m.duration)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="muted">${t('no_meds')}</p>`;
}
function patientPay(id){
  const ps=db.payments.filter(x=>x.patientId===id).sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="row" style="margin-bottom:10px"><button class="btn primary" onclick="openPayment('${id}')">₹ ${t('collect_fee')}</button></div>${ps.length?`<table><tbody>${ps.map(x=>`<tr><td>${fmt(x.date)}</td><td>${esc(x.receiptNo||'')}</td><td><b>${money(x.amount)}</b></td><td>${esc(x.mode)}</td><td><button class="btn sm" onclick="printReceipt('${x.id}')">🖨</button></td></tr>`).join('')}</tbody></table>`:`<p class="muted">${t('no_payments')}</p>`}`;
}

/* documents (stored in Google Cloud; images are shrunk first) */
async function patientDocs(id){
  $('ptab').innerHTML=`<label>${t('upload_doc')}<input type="file" id="docFile" accept="image/*,.pdf" onchange="uploadDoc('${id}',this)"></label><p class="small muted">${t('doc_help')}</p><div id="docList"><p class="muted">…</p></div>`;
  if(!Cloud.enabled){$('docList').innerHTML=`<p class="muted">${t('docs_need_cloud')}</p>`;return}
  try{
    const ds=(await Cloud.docs(id)).sort((a,b)=>b.date.localeCompare(a.date));
    $('docList').innerHTML=ds.length?ds.map(d=>`<div class="qrow"><div class="qinfo"><b>${esc(d.name)}</b><div class="muted small">${fmt(d.date)} · ${Math.round(d.size/1024)} KB</div></div><div class="qact"><button class="btn sm" onclick="viewDoc('${d.id}')">${t('view')}</button><button class="btn sm danger" onclick="removeDoc('${d.id}','${id}')">${t('delete')}</button></div></div>`).join(''):`<p class="muted">${t('no_docs')}</p>`;
  }catch(e){console.error(e);$('docList').innerHTML=`<p class="muted">${t('docs_err')}</p>`}
}
function shrinkImage(file,max=1400){
  return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{let w=img.width,h=img.height;const s=Math.min(1,max/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(u);
      let q=.72,d=c.toDataURL('image/jpeg',q);while(d.length>900000&&q>.3){q-=.1;d=c.toDataURL('image/jpeg',q)}
      d.length>900000?rej(new Error('big')):res(d)};
    img.onerror=()=>rej(new Error('img'));img.src=u});
}
function readDataURL(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}
async function uploadDoc(pid,input){
  const f=input.files[0];if(!f)return;
  try{
    let data;
    if(f.type.startsWith('image/'))data=await shrinkImage(f);
    else if(f.type==='application/pdf'){if(f.size>650*1024)return toast(t('pdf_big'));data=await readDataURL(f)}
    else return toast(t('bad_file'));
    toast(t('uploading'));
    await Cloud.putDoc({id:uid(),patientId:pid,name:f.name,type:f.type,size:Math.round(data.length*.75),date:today()},data);
    toast(t('saved'));patientDocs(pid);
  }catch(e){console.error(e);toast(t('docs_err'))}
}
async function viewDoc(id){
  const w=window.open('','_blank');
  try{const d=await Cloud.docData(id);if(!d)throw 0;const b=await (await fetch(d)).blob();const u=URL.createObjectURL(b);if(w)w.location=u;else location.href=u}
  catch(e){if(w)w.close();toast(t('docs_err'))}
}
async function removeDoc(id,pid){if(!confirm(t('confirm_delete')))return;try{await Cloud.delDoc(id);patientDocs(pid)}catch(e){toast(t('docs_err'))}}

/* ---------- visit + prescription ---------- */
function medLabel(m){return (m.generic+' '+(m.strength||'')).trim()+(m.brand?' ('+m.brand+')':'')}
function findMed(raw){
  const r=raw.trim().toLowerCase();
  return db.medicines.find(m=>medLabel(m).toLowerCase()===r)||db.medicines.find(m=>(m.generic+' '+(m.strength||'')).trim().toLowerCase()===r)||db.medicines.find(m=>m.generic.toLowerCase()===r&&db.medicines.filter(x=>x.generic.toLowerCase()===r).length===1);
}
function rxRowHTML(m={}){
  const med=m.medId?db.medicines.find(x=>x.id===m.medId):null;
  return `<div class="rx-row"><input class="rxmed" list="medList" placeholder="${esc(t('medicine'))}" value="${esc(med?medLabel(med):m.name||'')}" oninput="checkRx()"><input class="rxdose" list="doseList" placeholder="${esc(t('dose'))}" value="${esc(m.dose||'')}"><input class="rxfreq" list="freqList" placeholder="${esc(t('frequency'))}" value="${esc(m.frequency||'')}"><input class="rxdur" list="durList" placeholder="${esc(t('duration'))}" value="${esc(m.duration||'')}"><button class="btn" onclick="this.parentNode.remove();checkRx()">✕</button></div>`;
}
function setRows(meds,box='rxRows'){$(box).innerHTML=(meds&&meds.length?meds:[{}]).map(rxRowHTML).join('')}
function addRxRow(box='rxRows'){$(box).insertAdjacentHTML('beforeend',rxRowHTML())}
function readRows(box='rxRows'){
  return [...$(box).querySelectorAll('.rx-row')].map(r=>{
    const raw=r.querySelector('.rxmed').value.trim();if(!raw)return null;const m=findMed(raw);
    return {name:m?(m.generic+' '+(m.strength||'')).trim():raw,brand:m?m.brand:'',medId:m?m.id:'',dose:r.querySelector('.rxdose').value.trim(),frequency:r.querySelector('.rxfreq').value.trim(),duration:r.querySelector('.rxdur').value.trim(),status:'Prescribed'};
  }).filter(Boolean);
}
function openVisitForm(pid,vid,opts={}){
  const p=patientById(pid);if(!p)return;
  const v=vid?db.visits.find(x=>x.id===vid):{};
  const prev=db.visits.filter(x=>x.patientId===pid&&x.id!==vid).sort((a,b)=>b.date.localeCompare(a.date))[0];
  vctx={pid,vid:vid||null,apptId:opts.apptId||null};
  $('medList').innerHTML=db.medicines.map(m=>`<option value="${esc(medLabel(m))}">`).join('');
  openModal(modalHead((vid?t('edit_visit'):t('new_visit'))+' — '+esc(p.name))+
  (p.allergies?`<div class="alert"><b>⚠ ${t('allergies')}:</b> ${esc(p.allergies)}</div>`:'')+
  (prev?`<div class="okbox"><b>${t('prev_visit')}:</b> ${fmt(prev.date)} · ${esc(prev.diagnosis||'')} · ${esc((prev.medicines||[]).map(m=>m.name).join(', ')||t('no_meds'))}</div>`:'')+
  `<div class="form" style="margin-top:12px">${F('vdate',t('date'),v.date||today(),{type:'date'})}${F('vfollow',t('followup_date'),v.followup||'',{type:'date'})}
  ${F('vcomplaint',t('complaint'),v.complaint,{full:true})}
  ${F('vbp','BP',v.bp,{attr:'placeholder="120/80"'})}${F('vpulse',t('pulse'),v.pulse,{type:'number'})}${F('vspo','SpO₂ %',v.spo,{type:'number'})}${F('vtemp',t('temp'),v.temp,{type:'number',attr:'step="0.1"'})}
  ${F('vrr',t('rr'),v.rr,{type:'number'})}${F('vwt',t('weight'),v.weight,{type:'number',attr:'step="0.1"'})}${F('vht',t('height'),v.height,{type:'number'})}${F('vdiag',t('diagnosis'),v.diagnosis)}
  ${F('vexam',t('exam'),v.exam,{area:true,full:true})}${F('vinv',t('investigations'),v.investigations,{area:true,full:true})}${F('vadvice',t('advice'),v.advice,{area:true,full:true})}${F('vnotes',t('notes'),v.notes,{area:true,full:true})}</div>
  <h3 style="margin-top:16px">${t('prescription')}</h3>
  <div class="row" style="margin-bottom:8px"><select id="tplSel" style="max-width:260px" onchange="applyTemplate(this.value)"><option value="">📋 ${t('use_template')}</option>${db.templates.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>${prev&&(prev.medicines||[]).length?`<button class="btn" onclick="repeatLast('${prev.id}')">🔁 ${t('repeat_last')}</button>`:''}<button class="btn" onclick="saveAsTemplate()">💾 ${t('save_template')}</button></div>
  <div id="rxRows"></div><button class="btn" onclick="addRxRow()">+ ${t('add_medicine')}</button>
  <div id="rxWarn"></div>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeModal()">${t('cancel')}</button><button class="btn primary" onclick="saveVisit()">${t('save_visit')}</button></div>`);
  setRows(v.medicines);checkRx();
}
function applyTemplate(id){
  const tp=db.templates.find(x=>x.id===id);if(!tp)return;
  if(!$('vdiag').value)$('vdiag').value=tp.diagnosis||'';
  if(!$('vadvice').value)$('vadvice').value=tp.advice||'';
  if(tp.followDays)$('vfollow').value=addDays(Number(tp.followDays),$('vdate').value||today());
  setRows(tp.medicines);checkRx();$('tplSel').value='';
}
function repeatLast(vid){const v=db.visits.find(x=>x.id===vid);if(v){setRows(v.medicines.map(m=>({...m})));checkRx()}}
function saveAsTemplate(){
  const meds=readRows();if(!meds.length)return toast(t('add_meds_first'));
  const name=prompt(t('tpl_name_prompt'),$('vdiag').value||'');if(!name)return;
  const fd=$('vfollow').value?diffDays($('vdate').value||today(),$('vfollow').value):0;
  db.templates.push({id:uid(),name:name.trim(),diagnosis:$('vdiag').value.trim(),advice:$('vadvice').value.trim(),followDays:fd>0?fd:'',medicines:meds});
  save();toast(t('template_saved'));
}

/* basic safety checks: recorded-allergy match + duplicate drug. NOT a full drug-interaction engine. */
const ALLERGY_CLASSES={
  penicillin:['penicillin','amoxicillin','ampicillin','cloxacillin','piperacillin','amoxyclav','clavulan'],
  sulfa:['sulfa','sulpha','cotrimoxazole','co-trimoxazole','sulfamethoxazole','sulfasalazine'],
  nsaid:['ibuprofen','diclofenac','aspirin','naproxen','ketorolac','nimesulide','aceclofenac','piroxicam','mefenamic','etoricoxib','indomethacin'],
  cephalosporin:['cef','cephalexin'],macrolide:['azithromycin','clarithromycin','erythromycin'],
  quinolone:['floxacin'],tetracycline:['tetracycline','doxycycline','minocycline']
};
function rxWarnings(p,rows){
  const out=[];
  const toks=String(p&&p.allergies||'').toLowerCase().split(/[,;\/\n]|\band\b/).map(s=>s.trim()).filter(s=>s.length>=3);
  rows.forEach(r=>{
    const m=r.medId?db.medicines.find(x=>x.id===r.medId):null;
    const hay=(r.name+' '+(m?m.generic+' '+m.content+' '+m.brand:'')).toLowerCase();
    toks.forEach(tk=>{
      let hit=hay.includes(tk);
      for(const [cls,names] of Object.entries(ALLERGY_CLASSES))if(tk.includes(cls)||(cls==='sulfa'&&tk.includes('sulpha')))hit=hit||names.some(n=>hay.includes(n));
      if(hit)out.push(t('warn_allergy',tk,r.name));
    });
  });
  const seen={};rows.forEach(r=>{const g=r.name.split(' ')[0].toLowerCase();seen[g]=(seen[g]||0)+1});
  Object.entries(seen).filter(([,n])=>n>1).forEach(([g])=>out.push(t('warn_dup',g)));
  return [...new Set(out)];
}
function checkRx(){
  if(!vctx||!$('rxWarn'))return;
  const w=rxWarnings(patientById(vctx.pid),readRows());
  $('rxWarn').innerHTML=w.length?`<div class="alert">${w.map(x=>'⚠ '+esc(x)).join('<br>')}<div class="small" style="margin-top:6px">${t('warn_basic')}</div></div>`:'';
}
function saveVisit(){
  const {pid,vid,apptId}=vctx,meds=readRows(),p=patientById(pid);
  const w=rxWarnings(p,meds);
  if(w.length&&!confirm(w.join('\n')+'\n\n'+t('warn_confirm')))return;
  const f={date:$('vdate').value||today(),followup:$('vfollow').value,complaint:$('vcomplaint').value.trim(),bp:$('vbp').value.trim(),pulse:$('vpulse').value,spo:$('vspo').value,temp:$('vtemp').value,rr:$('vrr').value,weight:$('vwt').value,height:$('vht').value,diagnosis:$('vdiag').value.trim(),exam:$('vexam').value.trim(),investigations:$('vinv').value.trim(),advice:$('vadvice').value.trim(),notes:$('vnotes').value.trim(),medicines:meds};
  let v;
  if(vid){v=db.visits.find(x=>x.id===vid);Object.assign(v,f)}
  else{v={id:uid(),patientId:pid,...f};db.visits.push(v)}
  if(v.followup&&!db.appointments.some(a=>a.patientId===pid&&a.date===v.followup&&a.status!=='Cancelled'))
    db.appointments.push({id:uid(),patientId:pid,date:v.followup,time:'',type:'Follow-up',reason:t('followup'),status:'Booked'});
  const a=apptId?db.appointments.find(x=>x.id===apptId):db.appointments.find(x=>x.patientId===pid&&x.date===today()&&['Waiting','In consultation','Booked'].includes(x.status));
  if(a&&!vid)a.status='Done';
  save();render();
  openModal(`<div style="text-align:center"><div style="font-size:48px">✅</div><h2>${t('visit_saved')}</h2><p class="muted">${esc(p.name)}</p>
  <div class="grid" style="gap:10px;margin-top:16px"><button class="btn primary big" onclick="printPrescription('${v.id}','en')">🖨 ${t('print_rx')} (English)</button><button class="btn primary big" onclick="printPrescription('${v.id}','mr')">🖨 ${t('print_rx')} (मराठी)</button>
  ${waBtn(p.whatsapp||p.mobile,rxText(v,p),'💬 '+t('send_rx_wa'),'big')}<button class="btn big" onclick="openPayment('${pid}')">₹ ${t('collect_fee')}</button><button class="btn big" onclick="closeModal()">${t('done')}</button></div></div>`,true);
}
function rxText(v,p,lg=lang){
  const T=(k,...a)=>tl(lg,k,...a);
  return `*${clinic.name}* — ${clinic.doctor}\n${T('patient')}: ${p.name} (${p.uhid})\n${T('date')}: ${fmt(v.date)}\n${v.diagnosis?T('diagnosis')+': '+v.diagnosis+'\n':''}\n*Rx*\n${(v.medicines||[]).map((m,i)=>`${i+1}. ${m.name} — ${[m.dose,m.frequency,m.duration].filter(Boolean).join(', ')}`).join('\n')}\n${v.advice?'\n'+T('advice')+': '+v.advice:''}${v.followup?'\n'+T('followup_date')+': '+fmt(v.followup):''}\n\n${clinic.phones}`;
}
function printPrescription(vid,lg=lang){
  const v=db.visits.find(x=>x.id===vid),p=v&&patientById(v.patientId);if(!v||!p)return;
  const T=(k,...a)=>tl(lg,k,...a);
  const vit=vitalsLine(v);
  printHTML('Rx — '+p.name,`${letterhead()}
  <table style="margin-bottom:6px"><tr><td><b>${T('patient')}:</b> ${esc(p.name)}</td><td><b>${T('age_sex')}:</b> ${esc(ageOf(p)||'')} / ${esc(p.sex||'')}</td><td><b>${T('uhid')}:</b> ${esc(p.uhid)}</td><td><b>${T('date')}:</b> ${fmt(v.date)}</td></tr></table>
  ${p.allergies?`<p><b>${T('allergies')}:</b> ${esc(p.allergies)}</p>`:''}${vit?`<p class="muted">${esc(vit)}</p>`:''}
  ${v.complaint?`<p><b>${T('complaint')}:</b> ${esc(v.complaint)}</p>`:''}${v.diagnosis?`<p><b>${T('diagnosis')}:</b> ${esc(v.diagnosis)}</p>`:''}
  <h2 style="margin:14px 0 4px">℞</h2>
  <table><thead><tr><th>#</th><th>${T('medicine')}</th><th>${T('dose')}</th><th>${T('frequency')}</th><th>${T('duration')}</th></tr></thead><tbody>${(v.medicines||[]).map((m,i)=>`<tr><td>${i+1}</td><td><b>${esc(m.name)}</b>${m.brand?` <span class="muted">(${esc(m.brand)})</span>`:''}</td><td>${esc(m.dose)}</td><td>${esc(m.frequency)}</td><td>${esc(m.duration)}</td></tr>`).join('')}</tbody></table>
  ${v.investigations?`<p><b>${T('investigations')}:</b> ${esc(v.investigations)}</p>`:''}${v.advice?`<p><b>${T('advice')}:</b> ${esc(v.advice)}</p>`:''}${v.followup?`<p><b>${T('followup_date')}:</b> ${fmt(v.followup)}</p>`:''}
  <div class="sig">${T('signature')}<br><br>______________________<br>${esc(clinic.doctor)}</div>`);
}

/* ---------- templates ---------- */
function viewTemplates(){
  return `<div class="section-title"><div><h1>${t('nav_templates')}</h1><div class="muted">${t('tpl_help')}</div></div><button class="btn primary" onclick="openTemplateForm()">+ ${t('new_template')}</button></div>
  <div class="grid two">${db.templates.map(x=>`<div class="card"><div class="section-title"><h3 style="margin:0">${esc(x.name)}</h3><div class="row"><button class="btn sm" onclick="openTemplateForm('${x.id}')">✎</button><button class="btn sm danger" onclick="delTemplate('${x.id}')">🗑</button></div></div><div class="muted">${esc(x.diagnosis||'')}</div><ul>${(x.medicines||[]).map(m=>`<li>${esc(m.name)} — ${esc([m.dose,m.frequency,m.duration].filter(Boolean).join(', '))}</li>`).join('')}</ul>${x.advice?`<div class="small muted">${esc(x.advice)}</div>`:''}</div>`).join('')||`<div class="card"><p class="muted">${t('no_templates')}</p></div>`}</div>`;
}
function openTemplateForm(id){
  const x=id?db.templates.find(y=>y.id===id):{};
  $('medList').innerHTML=db.medicines.map(m=>`<option value="${esc(medLabel(m))}">`).join('');
  vctx=null;
  openModal(modalHead(id?t('edit'):t('new_template'))+`<div class="form">${F('tname',t('template_name'),x.name,{full:true})}${F('tdiag',t('diagnosis'),x.diagnosis)}${F('tfd',t('followup_days'),x.followDays||'',{type:'number'})}${F('tadv',t('advice'),x.advice,{area:true,full:true})}</div><h3 style="margin-top:14px">${t('prescription')}</h3><div id="tRows"></div><button class="btn" onclick="addRxRow('tRows')">+ ${t('add_medicine')}</button><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeModal()">${t('cancel')}</button><button class="btn primary" onclick="saveTemplate('${id||''}')">${t('save')}</button></div>`);
  setRows(x.medicines,'tRows');
}
function saveTemplate(id){
  const name=$('tname').value.trim();if(!name)return toast(t('name_required'));
  const f={name,diagnosis:$('tdiag').value.trim(),advice:$('tadv').value.trim(),followDays:$('tfd').value,medicines:readRows('tRows')};
  if(id)Object.assign(db.templates.find(x=>x.id===id),f);else db.templates.push({id:uid(),...f});
  save();closeModal();render();
}
function delTemplate(id){if(!confirm(t('confirm_delete')))return;db.templates=db.templates.filter(x=>x.id!==id);save();render()}

/* ---------- appointments ---------- */
let apptDate=null;
function viewAppointments(){
  apptDate=apptDate||today();
  return `<div class="section-title"><h1>${t('nav_appointments')}</h1><button class="btn primary" onclick="openAppointment()">+ ${t('appointment')}</button></div>
  <div class="card"><div class="row" style="margin-bottom:12px"><button class="btn" onclick="shiftAppt(-1)">‹</button><input type="date" id="apptDate" value="${apptDate}" style="max-width:190px" onchange="apptDate=this.value;render()"><button class="btn" onclick="shiftAppt(1)">›</button><button class="btn" onclick="apptDate=today();render()">${t('today')}</button></div>${appointmentRows(apptDate)}</div>`;
}
function shiftAppt(n){apptDate=addDays(n,apptDate||today());render()}
function appointmentRows(date){
  const a=db.appointments.filter(x=>x.date===date).sort((x,y)=>(x.time||'').localeCompare(y.time||'')||(x.token||0)-(y.token||0));
  if(!a.length)return `<p class="muted">${t('no_appts')}</p>`;
  return a.map(x=>{const p=patientById(x.patientId);if(!p)return '';
    return `<div class="qrow st-${stKey(x.status)}"><div class="tok">${esc(x.time||'—')}</div><div class="qinfo"><b>${esc(p.name)}</b> <span class="pill">${t('st_'+stKey(x.status))}</span><div class="muted">${esc(x.reason||x.type||'')} · ${esc(p.mobile||'')}</div></div><div class="qact">${waBtn(p.whatsapp||p.mobile,t('wa_appt',p.name,fmt(x.date),x.time||'',clinic.name),'💬 '+t('remind'),'sm')}${x.date===today()&&['Booked'].includes(x.status)?`<button class="btn sm primary" onclick="setApptStatus('${x.id}','Waiting')">${t('arrived')}</button>`:''}${['Booked','Waiting'].includes(x.status)?`<button class="btn sm danger" onclick="setApptStatus('${x.id}','Cancelled')">${t('cancel')}</button>`:''}</div></div>`}).join('');
}
function openAppointment(){
  openModal(modalHead(t('appointment'))+`<div class="form"><div class="full"><label>${t('patient')}<input id="apq" list="apPatients" placeholder="${esc(t('search_ph'))}" autocomplete="off"></label><datalist id="apPatients">${db.patients.map(p=>`<option value="${esc(p.name)} — ${esc(p.uhid)}">`).join('')}</datalist></div>${F('ad',t('date'),apptDate||today(),{type:'date'})}${F('at',t('time'),'',{type:'time'})}${F('areason',t('reason'),'',{full:true})}</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeModal()">${t('cancel')}</button><button class="btn primary" onclick="saveAppointment()">${t('save')}</button></div>`,true);
}
function saveAppointment(){
  const v=$('apq').value,p=db.patients.find(x=>`${x.name} — ${x.uhid}`===v);
  if(!p)return toast(t('select_patient'));
  db.appointments.push({id:uid(),patientId:p.id,date:$('ad').value||today(),time:$('at').value,type:'Appointment',reason:$('areason').value.trim(),status:'Booked'});
  save();closeModal();render();
}

/* ---------- payments ---------- */
function viewPayments(){
  const td=today(),tot=db.payments.reduce((s,p)=>s+Number(p.amount||0),0),todayTot=db.payments.filter(p=>p.date===td).reduce((s,p)=>s+Number(p.amount||0),0);
  return `<div class="section-title"><h1>${t('nav_payments')}</h1><button class="btn primary" onclick="openPayment()">+ ${t('record_payment')}</button></div>
  <div class="grid stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px"><div class="card stat"><div class="muted">${t('collected_today')}</div><div class="n">${money(todayTot)}</div></div><div class="card stat"><div class="muted">${t('total_recorded')}</div><div class="n">${money(tot)}</div></div><div class="card stat"><div class="muted">${t('transactions')}</div><div class="n">${db.payments.length}</div></div></div>
  <div class="card"><div class="table-wrap">${db.payments.length?`<table><thead><tr><th>${t('receipt')}</th><th>${t('date')}</th><th>${t('patient')}</th><th>${t('amount')}</th><th>${t('mode')}</th><th></th></tr></thead><tbody>${db.payments.slice().reverse().map(x=>`<tr><td>${esc(x.receiptNo||'')}</td><td>${fmt(x.date)}</td><td>${esc(patientName(x.patientId))}</td><td><b>${money(x.amount)}</b></td><td>${esc(x.mode)}</td><td><button class="btn sm" onclick="printReceipt('${x.id}')">🖨</button></td></tr>`).join('')}</tbody></table>`:`<p class="muted">${t('no_payments')}</p>`}</div></div>`;
}
function openPayment(pid){
  openModal(modalHead(t('record_payment'))+`<div class="form"><div class="full"><label>${t('patient')}<select id="pp"><option value="">${t('select_patient')}</option>${db.patients.map(p=>`<option value="${p.id}" ${p.id===pid?'selected':''}>${esc(p.name)} — ${esc(p.uhid)}</option>`).join('')}</select></label></div>
  ${F('pa',t('amount'),db.settings.fee||'',{type:'number',attr:'inputmode="numeric" oninput="payQR()"'})}${S('pm',t('mode'),[['Cash',t('cash')],['UPI','UPI'],['Card',t('card')],['Other',t('other')]],'Cash',{attr:'onchange="payQR()"'})}${F('pd',t('date'),today(),{type:'date'})}${F('pnote',t('notes'),'')}</div>
  <div id="upiBox" style="text-align:center;margin-top:12px"></div>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeModal()">${t('cancel')}</button><button class="btn primary" onclick="savePayment()">${t('save')}</button></div>`,true);
  payQR();
}
function upiURI(amt){return `upi://pay?pa=${encodeURIComponent(db.settings.upi)}&pn=${encodeURIComponent(clinic.name)}${amt?'&am='+encodeURIComponent(amt)+'&tn='+encodeURIComponent('Consultation'):''}&cu=INR`}
function payQR(){
  const box=$('upiBox');if(!box)return;
  if($('pm').value!=='UPI'){box.innerHTML='';return}
  if(!db.settings.upi){box.innerHTML=`<p class="muted">${t('upi_missing')}</p>`;return}
  box.innerHTML=`<div id="upiQR" style="display:inline-block;padding:10px;background:#fff"></div><div class="small muted">${t('scan_to_pay')} ${money($('pa').value)} · ${esc(db.settings.upi)}</div>`;
  drawQR('upiQR',upiURI($('pa').value),200);
}
function savePayment(){
  const pid=$('pp').value,amt=Number($('pa').value);
  if(!pid||!amt)return toast(t('patient_amount_req'));
  const n=db.payments.reduce((m,x)=>Math.max(m,parseInt(String(x.receiptNo||'').replace(/\D/g,''))||0),0)+1;
  const x={id:uid(),receiptNo:'R-'+String(n).padStart(5,'0'),patientId:pid,date:$('pd').value||today(),amount:amt,mode:$('pm').value,note:$('pnote').value.trim(),status:'Paid'};
  db.payments.push(x);save();render();
  const p=patientById(pid);
  openModal(`<div style="text-align:center"><div style="font-size:48px">✅</div><h2>${money(amt)} ${t('recorded')}</h2><p class="muted">${esc(p.name)} · ${x.receiptNo}</p><div class="grid" style="gap:10px;margin-top:16px"><button class="btn primary big" onclick="printReceipt('${x.id}')">🖨 ${t('print_receipt')}</button>${waBtn(p.whatsapp||p.mobile,t('wa_receipt',p.name,money(amt),x.receiptNo,clinic.name),'💬 '+t('send_receipt_wa'),'big')}<button class="btn big" onclick="closeModal()">${t('done')}</button></div></div>`,true);
}
function printReceipt(id,lg=lang){
  const x=db.payments.find(y=>y.id===id),p=x&&patientById(x.patientId);if(!x||!p)return;const T=(k,...a)=>tl(lg,k,...a);
  printHTML('Receipt '+x.receiptNo,`${letterhead()}<h2>${T('receipt')}</h2><table><tr><td><b>${T('receipt')} #</b> ${esc(x.receiptNo)}</td><td><b>${T('date')}:</b> ${fmt(x.date)}</td></tr><tr><td><b>${T('patient')}:</b> ${esc(p.name)} (${esc(p.uhid)})</td><td><b>${T('mode')}:</b> ${esc(x.mode)}</td></tr></table><p style="font-size:22px;margin:24px 0"><b>${T('amount')}: ${money(x.amount)}</b></p>${x.note?`<p>${esc(x.note)}</p>`:''}<p class="muted">${T('thank_you')}</p><div class="sig">${T('signature')}<br><br>______________________</div>`);
}

/* ---------- medicines ---------- */
let medQ='';
function viewMedicines(){
  const list=db.medicines.filter(m=>!medQ||(m.generic+' '+m.brand+' '+m.content).toLowerCase().includes(medQ.toLowerCase())).sort((a,b)=>a.generic.localeCompare(b.generic));
  return `<div class="section-title"><h1>${t('nav_medicines')}</h1><button class="btn primary" onclick="openMedicine()">+ ${t('add_medicine')}</button></div>
  <div class="card"><input id="medQ" placeholder="${esc(t('search_med'))}" value="${esc(medQ)}" oninput="medQ=this.value;medSearch()" style="max-width:360px;margin-bottom:12px"><div id="medTable" class="table-wrap">${medicineTable(list)}</div></div>`;
}
function medSearch(){const list=db.medicines.filter(m=>!medQ||(m.generic+' '+m.brand+' '+m.content).toLowerCase().includes(medQ.toLowerCase())).sort((a,b)=>a.generic.localeCompare(b.generic));$('medTable').innerHTML=medicineTable(list)}
function medicineTable(list){return `<table><thead><tr><th>${t('generic')}</th><th>${t('brand')}</th><th>${t('strength')}</th><th>${t('form')}</th><th></th></tr></thead><tbody>${list.map(m=>`<tr><td><b>${esc(m.generic)}</b></td><td>${esc(m.brand)}</td><td>${esc(m.strength)}</td><td>${esc(m.form)}</td><td><button class="btn sm" onclick="openMedicine('${m.id}')">✎</button> <button class="btn sm danger" onclick="delMedicine('${m.id}')">🗑</button></td></tr>`).join('')}</tbody></table>`}
function openMedicine(id){
  const m=id?db.medicines.find(x=>x.id===id):{};
  openModal(modalHead(id?t('edit'):t('add_medicine'))+`<div class="form">${F('mg',t('generic'),m.generic)}${F('mb',t('brand'),m.brand)}${F('ms',t('strength'),m.strength)}${F('mf',t('form'),m.form,{attr:'placeholder="Tablet / Capsule / Syrup"'})}${F('mc',t('composition'),m.content,{full:true})}</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeModal()">${t('cancel')}</button><button class="btn primary" onclick="saveMedicine('${id||''}')">${t('save')}</button></div>`,true);
}
function saveMedicine(id){
  const g=$('mg').value.trim();if(!g)return toast(t('name_required'));
  const f={generic:g,brand:$('mb').value.trim(),strength:$('ms').value.trim(),form:$('mf').value.trim(),content:$('mc').value.trim()||(g+' '+$('ms').value.trim()).trim()};
  if(id)Object.assign(db.medicines.find(x=>x.id===id),f);else db.medicines.push({id:uid(),...f});
  save();closeModal();render();
}
function delMedicine(id){if(!confirm(t('confirm_delete')))return;db.medicines=db.medicines.filter(x=>x.id!==id);save();render()}

/* ---------- reports ---------- */
function viewReports(){
  const by=(arr,key,val)=>{const o={};arr.forEach(x=>{const k=key(x);if(k)o[k]=(o[k]||0)+val(x)});return o};
  const vm=by(db.visits,v=>(v.date||'').slice(0,7),()=>1),rm=by(db.payments,p=>(p.date||'').slice(0,7),p=>Number(p.amount||0)),dg=by(db.visits,v=>(v.diagnosis||'').trim().toLowerCase(),()=>1);
  const bars=(o,f=x=>x)=>{const e=Object.entries(o).sort().reverse().slice(0,12),mx=Math.max(1,...e.map(x=>x[1]));return e.map(([k,n])=>`<div class="row" style="margin:8px 0"><b style="width:80px">${esc(k)}</b><div style="height:14px;background:#d8ebe8;border-radius:20px;flex:1"><div style="height:100%;width:${Math.round(n/mx*100)}%;background:var(--brand);border-radius:20px"></div></div><span style="min-width:70px;text-align:right">${f(n)}</span></div>`).join('')||`<p class="muted">—</p>`};
  const top=Object.entries(dg).sort((a,b)=>b[1]-a[1]).slice(0,10);
  return `<h1>${t('nav_reports')}</h1><div class="grid stats" style="margin-bottom:14px"><div class="card stat"><div class="muted">${t('total_patients')}</div><div class="n">${db.patients.length}</div></div><div class="card stat"><div class="muted">${t('total_visits')}</div><div class="n">${db.visits.length}</div></div><div class="card stat"><div class="muted">${t('total_recorded')}</div><div class="n">${money(db.payments.reduce((s,p)=>s+Number(p.amount||0),0))}</div></div><div class="card stat"><div class="muted">${t('new_this_month')}</div><div class="n">${db.patients.filter(p=>(p.created||'').slice(0,7)===today().slice(0,7)).length}</div></div></div>
  <div class="grid two"><div class="card"><h3>${t('visits_by_month')}</h3>${bars(vm)}</div><div class="card"><h3>${t('revenue_by_month')}</h3>${bars(rm,money)}</div></div>
  <div class="card" style="margin-top:14px"><h3>${t('top_diagnoses')}</h3>${top.map(([k,n])=>`<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:8px 0"><span>${esc(k)}</span><b>${n}</b></div>`).join('')||`<p class="muted">—</p>`}</div>`;
}

/* ---------- settings / backup ---------- */
function viewSettings(){
  const age=backupAge();
  return `<h1>${t('nav_settings')}</h1><div class="grid two" style="margin-top:12px">
  <div class="card"><h3>${t('clinic')}</h3><p><b>${esc(clinic.name)}</b><br>${esc(clinic.doctor)}<br>${t('reg_no')} ${esc(clinic.reg)}<br>${esc(clinic.address)}<br>${esc(clinic.phones)}</p>
   <div class="form">${F('upi','UPI ID',db.settings.upi,{attr:'placeholder="name@bank"'})}${F('fee',t('default_fee'),db.settings.fee,{type:'number'})}</div><button class="btn primary" style="margin-top:10px" onclick="saveSettings()">${t('save')}</button></div>
  <div class="card"><h3>${t('logo')}</h3><input type="file" id="logoFile" accept="image/*" onchange="uploadLogo(this)"><p class="small muted">${t('logo_help')}</p>${db.settings.logo?`<img src="${db.settings.logo}" style="height:70px"><br><button class="btn sm danger" onclick="db.settings.logo='';save();render()">${t('delete')}</button>`:''}
   <hr><h3>${t('patient_qr')}</h3><p class="small muted">${t('qr_help')}</p><button class="btn" onclick="openQR()">📱 ${t('patient_qr')}</button></div></div>
  <div class="card" style="margin-top:14px"><h3>${t('backup')}</h3><p class="muted">${Cloud.enabled?t('backup_cloud'):t('backup_local')} ${age===null?t('never_backed'):t('last_backup',age)}</p>
   <div class="row"><button class="btn primary" onclick="exportData()">⬇ ${t('export_backup')}</button><button class="btn" onclick="exportPatientsCSV()">⬇ CSV</button><button class="btn danger" onclick="$('restoreFile').click()">${t('restore_backup')}</button><input id="restoreFile" type="file" accept=".json" hidden onchange="restoreData(this)"></div></div>
  ${Cloud.enabled?`<div class="card" style="margin-top:14px"><h3>${t('audit_log')}</h3><p class="muted small">${t('audit_help')}</p><button class="btn" onclick="loadAudit()">${t('show')}</button><div id="auditBox" class="table-wrap"></div></div>`:''}`;
}
function saveSettings(){db.settings.upi=$('upi').value.trim();db.settings.fee=$('fee').value;save();toast(t('saved'))}
function uploadLogo(input){
  const f=input.files[0];if(!f)return;const img=new Image(),u=URL.createObjectURL(f);
  img.onload=()=>{const s=Math.min(1,240/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);db.settings.logo=c.toDataURL('image/png');save();render()};img.src=u;
}
function exportData(){download('thakur-clinic-backup-'+today()+'.json',JSON.stringify(db,null,2),'application/json');localStorage.setItem('tc_lastBackup',today());toast(t('backup_done'));if(page==='today'||page==='settings')render()}
function restoreData(input){
  const f=input.files[0];if(!f)return;
  if(!confirm(t('confirm_restore'))){input.value='';return}
  const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.patients))throw 0;db=ensure(d);save();render();toast(t('restored'))}catch(e){toast(t('invalid_backup'))}};r.readAsText(f);
}
async function loadAudit(){
  try{const a=await Cloud.auditList();$('auditBox').innerHTML=`<table><thead><tr><th>${t('time')}</th><th>${t('user')}</th><th>${t('action')}</th></tr></thead><tbody>${a.map(x=>`<tr><td>${x.t?x.t.toLocaleString('en-IN'):''}</td><td>${esc(x.by)}</td><td>${esc(x.act)} ${esc(x.col)} ${esc(x.label||'')}</td></tr>`).join('')}</tbody></table>`}
  catch(e){$('auditBox').textContent=t('docs_err')}
}

/* ---------- boot ---------- */
function bind(){
  $('newPatientBtn').onclick=()=>openPatientForm();
  $('langBtn').onclick=()=>{setLang(lang==='en'?'mr':'en');render()};
  $('globalSearch').oninput=e=>doSearch(e.target.value);
  document.addEventListener('click',e=>{if(!e.target.closest('.search'))$('searchResults').classList.add('hidden')});
  $('modal').addEventListener('mousedown',e=>{if(e.target===$('modal')&&!document.querySelector('#modalBox input:not([type=file]):not([type=hidden]),#modalBox textarea'))closeModal()});
}
function boot(){db=ensure(db);bind();render()}
Cloud.init(boot);
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
