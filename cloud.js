// Cloud sync: Google sign-in (Firebase Auth) + Firestore storage for Thakur Clinic EMR.
// Data layout: clinics/main/{patients|visits|medicines|appointments|payments}/{id}, clinics/main/meta/settings
(function(){
  const COLS=['patients','visits','medicines','appointments','payments'];
  const cfg=window.FIREBASE_CONFIG||{};
  const C=window.Cloud={enabled:!!cfg.apiKey,user:null};
  let fs,auth,last={},pushing=false,timer=null,dirty=false;
  const $=id=>document.getElementById(id);
  const root=()=>fs.collection('clinics').doc('main');

  function status(t,cls){const s=$('syncStatus');if(s){s.textContent=t;s.className='sync '+(cls||'')}}
  function showLogin(msg){$('loginBox').classList.remove('hidden');$('loginMsg').textContent=msg||''}
  function hideLogin(){$('loginBox').classList.add('hidden')}

  async function loadAll(){
    const out={};let any=false;
    for(const c of COLS){const s=await root().collection(c).get();out[c]=s.docs.map(d=>d.data());if(s.size)any=true}
    const st=await root().collection('meta').doc('settings').get();
    out.settings=st.exists?st.data():null;
    return {out,any};
  }
  function snapshotLast(){
    last={};
    for(const c of COLS)for(const x of db[c])last[c+'/'+x.id]=JSON.stringify(x);
    last['settings']=JSON.stringify(db.settings);
  }
  async function start(first){
    status('Loading…');
    const {out,any}=await loadAll();
    if(any){
      for(const c of COLS)db[c]=out[c];
      if(out.settings)db.settings=out.settings;
      snapshotLast();
      localStorage.setItem(KEY,JSON.stringify(db));
    }else{last={}; dirty=true; await push()}   // first login: upload whatever is in this browser
    status('Saved ✓','ok');
  }
  async function push(){
    if(!C.enabled||!C.user||pushing)return;
    pushing=true;dirty=false;status('Saving…');
    try{
      const ops=[],seen=new Set();
      for(const c of COLS)for(const x of db[c]){
        const k=c+'/'+x.id,s=JSON.stringify(x);seen.add(k);
        if(last[k]!==s)ops.push([root().collection(c).doc(x.id),'set',x,k,s]);
      }
      for(const k of Object.keys(last)){
        if(k==='settings'||seen.has(k))continue;
        const [c,id]=k.split('/');ops.push([root().collection(c).doc(id),'del',null,k,null]);
      }
      const ss=JSON.stringify(db.settings);
      if(last.settings!==ss)ops.push([root().collection('meta').doc('settings'),'set',db.settings,'settings',ss]);
      for(let i=0;i<ops.length;i+=400){
        const b=fs.batch();
        ops.slice(i,i+400).forEach(([ref,t,d])=>t==='set'?b.set(ref,d):b.delete(ref));
        await b.commit();
        ops.slice(i,i+400).forEach(([,t,,k,s])=>{if(t==='set')last[k]=s;else delete last[k]});
      }
      status('Saved ✓','ok');
    }catch(e){console.error(e);status('Not saved — check internet','bad');dirty=true}
    pushing=false;
    if(dirty)schedule();
  }
  function schedule(){dirty=true;clearTimeout(timer);timer=setTimeout(push,500)}

  // called from save() in index.html
  C.changed=function(){if(C.enabled&&C.user)schedule()};

  C.signIn=async function(){
    try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())}
    catch(e){$('loginMsg').textContent='Sign-in did not complete. Please try again.'}
  };
  C.signOut=async function(){
    if(dirty||pushing){await push()}
    localStorage.removeItem(KEY);   // don't leave patient data on a shared computer
    await auth.signOut();location.reload();
  };

  C.init=function(boot){
    if(!C.enabled){hideLogin();status('Local mode (not connected)','bad');boot();return}
    firebase.initializeApp(cfg);
    auth=firebase.auth();fs=firebase.firestore();
    fs.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    $('googleBtn').onclick=C.signIn;
    $('logoutBtn').onclick=C.signOut;
    auth.onAuthStateChanged(async u=>{
      if(!u){C.user=null;$('logoutBtn').style.display='none';showLogin();return}
      C.user=u;
      try{
        await start();
        hideLogin();$('logoutBtn').style.display='';boot();
      }catch(e){
        console.error(e);
        C.user=null;await auth.signOut();
        showLogin('This Google account ('+(u.email||'')+') is not allowed to open the clinic records. Ask the clinic admin to add it.');
      }
    });
    // pick up changes made on another device when the tab is reopened
    document.addEventListener('visibilitychange',async()=>{
      if(document.visibilityState!=='visible'||!C.user||pushing||dirty)return;
      try{const {out,any}=await loadAll();if(any){for(const c of COLS)db[c]=out[c];if(out.settings)db.settings=out.settings;snapshotLast();render()}}catch(e){}
    });
  };
})();
