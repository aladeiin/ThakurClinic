// Cloud layer: Google sign-in (Firebase Auth) + Firestore for Thakur Clinic EMR.
// clinics/main/{patients|visits|medicines|appointments|payments|templates}/{id}  <- synced from the in-memory `db`
// clinics/main/meta/settings, clinics/main/{documents|docdata|registrations|audit}
(function(){
  const COLS=['patients','visits','medicines','appointments','payments','templates'];
  const cfg=window.FIREBASE_CONFIG||{};
  const C=window.Cloud={enabled:!!cfg.apiKey,user:null,regs:[],COLS};
  let fs,auth,last={},pushing=false,timer=null,dirty=false,unsubRegs=null;
  const $=id=>document.getElementById(id);
  const root=()=>fs.collection('clinics').doc('main');
  const who=()=>(C.user&&C.user.email)||'';

  function status(k,cls){const s=$('syncStatus');if(s){s.textContent=window.t?t(k):k;s.className='sync '+(cls||'')}}
  function showLogin(msg){$('loginBox').classList.remove('hidden');$('loginMsg').textContent=msg||''}
  function hideLogin(){$('loginBox').classList.add('hidden')}

  async function loadAll(){
    const out={};let any=false;
    for(const c of COLS){const s=await root().collection(c).get();out[c]=s.docs.map(d=>d.data());if(s.size)any=true}
    const st=await root().collection('meta').doc('settings').get();
    out.settings=st.exists?st.data():null;
    return {out,any};
  }
  function applyLoaded(out){
    for(const c of COLS)db[c]=out[c];
    if(out.settings)db.settings=Object.assign({},db.settings,out.settings);
    snapshotLast();
    try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}
  }
  function snapshotLast(){
    last={};
    for(const c of COLS)for(const x of db[c])last[c+'/'+x.id]=JSON.stringify(x);
    last.settings=JSON.stringify(db.settings);
  }
  async function start(){
    status('st_loading');
    const {out,any}=await loadAll();
    if(any)applyLoaded(out);
    else{last={};dirty=true;await push()}      // first ever login: upload whatever this browser holds
    watchRegs();
    status('st_saved','ok');
  }
  function watchRegs(){
    if(unsubRegs)unsubRegs();
    unsubRegs=root().collection('registrations').onSnapshot(s=>{
      C.regs=s.docs.map(d=>{const x=d.data();x.id=d.id;x.createdAt=x.created&&x.created.toDate?x.created.toDate().toISOString():'';return x})
        .sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
      if(window.onRegsChanged)onRegsChanged();
    },e=>console.warn('registrations',e));
  }
  function label(col,x){return x?(x.name||x.generic||x.diagnosis||x.date||x.receiptNo||''):''}
  async function push(){
    if(!C.enabled||!C.user||pushing)return;
    pushing=true;dirty=false;status('st_saving');
    try{
      const ops=[],seen=new Set();
      for(const c of COLS)for(const x of db[c]){
        const k=c+'/'+x.id,s=JSON.stringify(x);seen.add(k);
        if(last[k]!==s)ops.push({ref:root().collection(c).doc(x.id),t:'set',d:x,k,s,act:last[k]?'update':'create',c,id:x.id,l:label(c,x)});
      }
      for(const k of Object.keys(last)){
        if(k==='settings'||seen.has(k))continue;
        const [c,id]=k.split('/');
        let old={};try{old=JSON.parse(last[k])}catch(e){}
        ops.push({ref:root().collection(c).doc(id),t:'del',k,act:'delete',c,id,l:label(c,old)});
      }
      const ss=JSON.stringify(db.settings);
      if(last.settings!==ss)ops.push({ref:root().collection('meta').doc('settings'),t:'set',d:db.settings,k:'settings',s:ss,act:'update',c:'settings',id:'settings',l:''});
      for(let i=0;i<ops.length;i+=200){
        const part=ops.slice(i,i+200),b=fs.batch();
        part.forEach(o=>{
          o.t==='set'?b.set(o.ref,o.d):b.delete(o.ref);
          b.set(root().collection('audit').doc(),{ts:firebase.firestore.FieldValue.serverTimestamp(),by:who(),act:o.act,col:o.c,id:o.id,label:o.l||''});
        });
        await b.commit();
        part.forEach(o=>{if(o.t==='set')last[o.k]=o.s;else delete last[o.k]});
      }
      status('st_saved','ok');
    }catch(e){console.error(e);status('st_notsaved','bad');dirty=true}
    pushing=false;
    if(dirty)schedule();
  }
  function schedule(){dirty=true;clearTimeout(timer);timer=setTimeout(push,500)}
  C.changed=function(){if(C.enabled&&C.user)schedule()};
  C.flush=async function(){clearTimeout(timer);if(dirty||pushing){pushing=false;await push()}};

  // ---- patient self-registrations ----
  C.removeReg=id=>root().collection('registrations').doc(id).delete();
  // ---- documents (small files stored in Firestore; metadata and data are separate docs) ----
  C.docs=async pid=>(await root().collection('documents').where('patientId','==',pid).get()).docs.map(d=>d.data());
  C.docData=async id=>{const s=await root().collection('docdata').doc(id).get();return s.exists?s.data().data:null};
  C.putDoc=async(meta,data)=>{
    const b=fs.batch();
    b.set(root().collection('docdata').doc(meta.id),{data});
    b.set(root().collection('documents').doc(meta.id),meta);
    b.set(root().collection('audit').doc(),{ts:firebase.firestore.FieldValue.serverTimestamp(),by:who(),act:'create',col:'documents',id:meta.id,label:meta.name});
    await b.commit();
  };
  C.delDoc=async(id,name)=>{
    const b=fs.batch();
    b.delete(root().collection('docdata').doc(id));b.delete(root().collection('documents').doc(id));
    b.set(root().collection('audit').doc(),{ts:firebase.firestore.FieldValue.serverTimestamp(),by:who(),act:'delete',col:'documents',id,label:name||''});
    await b.commit();
  };
  C.auditList=async()=>(await root().collection('audit').orderBy('ts','desc').limit(100).get()).docs.map(d=>{const x=d.data();x.t=x.ts&&x.ts.toDate?x.ts.toDate():null;return x});

  C.signIn=async function(){
    try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())}
    catch(e){$('loginMsg').textContent=t('login_failed')}
  };
  C.signOut=async function(){
    try{await C.flush()}catch(e){}
    try{localStorage.removeItem(KEY)}catch(e){}   // don't leave patient data on a shared computer
    await auth.signOut();location.reload();
  };

  C.init=function(boot){
    if(!C.enabled){hideLogin();status('st_local','bad');boot();return}
    firebase.initializeApp(cfg);
    auth=firebase.auth();fs=firebase.firestore();
    fs.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    $('googleBtn').onclick=C.signIn;
    $('logoutBtn').onclick=C.signOut;
    let booted=false;
    auth.onAuthStateChanged(async u=>{
      if(!u){C.user=null;$('logoutBtn').style.display='none';showLogin();return}
      C.user=u;
      try{
        await start();
        hideLogin();$('logoutBtn').style.display='';
        if(!booted){booted=true;boot()}else if(window.render)render();
      }catch(e){
        console.error(e);
        C.user=null;await auth.signOut();
        showLogin(t('not_allowed',u.email||''));
      }
    });
    // pick up changes made on another device when this tab is reopened
    document.addEventListener('visibilitychange',async()=>{
      if(document.visibilityState!=='visible'||!C.user||pushing||dirty)return;
      try{const {out,any}=await loadAll();if(any){applyLoaded(out);if(window.render)render()}}catch(e){}
    });
  };
})();
