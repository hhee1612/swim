const { useState, useEffect, useLayoutEffect, useRef, useMemo } = React;
const holdUpdates = () => window.swimUpdates?.setSafeToReload(false);
const C = SwimCore, F = SwimFeatures;
const STROKES = ["自由泳", "蛙泳", "仰泳", "蝶泳", "混合"];
const MOODS = [{emoji:"😄",label:"超开心"},{emoji:"🙂",label:"还不错"},{emoji:"😮‍💨",label:"有点累"},{emoji:"😴",label:"好困"},{emoji:"💪",label:"超有劲"}];
const MODES = {elapsed:"含休息",moving:"净游泳",unknown:"未注明"};
const BADGES = [{d:1,emoji:"🐣",name:"游泳萌新"},{d:7,emoji:"🐠",name:"快乐小鱼"},{d:21,emoji:"🐬",name:"灵动海豚"},{d:50,emoji:"🐳",name:"深海鲸鱼"},{d:100,emoji:"🥉",name:"铜牌泳将"},{d:200,emoji:"🥈",name:"银牌健将"},{d:365,emoji:"🥇",name:"金牌冠军"},{d:500,emoji:"👑",name:"奥运传奇"}];
const todayStr = () => {const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const shiftDate = (date,n) => {const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const uuid = () => window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now()+"-"+Math.random().toString(36).slice(2);
const fmtNum = value => Number(value.toFixed(2)).toLocaleString("zh-CN");
const message = err => err?.name==="QuotaExceededError" ? "设备存储空间不足，请先导出备份，再释放空间重试。" : err?.message || "操作失败，请重试。";
function streaks(records,today) {
  const dates=[...new Set(records.filter(r=>r.swam && r.date<=today).map(r=>r.date))].sort();
  let longest=0,run=0,prev=null;
  for(const date of dates){run=prev && shiftDate(prev,1)===date ? run+1 : 1;longest=Math.max(longest,run);prev=date;}
  const set=new Set(dates);let cursor=set.has(today)?today:shiftDate(today,-1),current=0;
  while(set.has(cursor)){current++;cursor=shiftDate(cursor,-1);}
  return {current,longest};
}
function download(content,type,name) {
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function compressImage(file) {
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error("照片无法读取，请换一张图片。"));img.src=url;});
    const scale=Math.min(1,1000/Math.max(img.width,img.height)),canvas=document.createElement("canvas");
    canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/jpeg",0.72);
  } finally {URL.revokeObjectURL(url);}
}
function App(){
  const [data,setData]=useState(()=>C.validateState({records:[]}));
  const [loading,setLoading]=useState(true),[loadFailed,setLoadFailed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [tab,setTab]=useState("records"),[modal,setModal]=useState(null),[form,setForm]=useState(null),[formError,setFormError]=useState("");
  const [deleted,setDeleted]=useState(null),[lightbox,setLightbox]=useState(null),[photoBusy,setPhotoBusy]=useState(false);
  const [month,setMonth]=useState(todayStr().slice(0,7)),[selectedDate,setSelectedDate]=useState(null);
  const [filters,setFilters]=useState({query:"",stroke:"",pool:"",from:"",to:""}),[filtersOpen,setFiltersOpen]=useState(false);
  const [trend,setTrend]=useState({period:"week",stroke:"自由泳",durationMode:"elapsed"});
  const [goalDraft,setGoalDraft]=useState({period:"week",type:"count",value:"3"});
  const [incoming,setIncoming]=useState(null),[importMode,setImportMode]=useState("merge"),[conflict,setConflict]=useState("keep"),[importReading,setImportReading]=useState(false);
  const [online,setOnline]=useState(navigator.onLine),[offline,setOffline]=useState(window.swimOffline||{ready:false,updateAvailable:false});
  const [today,setToday]=useState(todayStr());
  const [sharing,setSharing]=useState(false),[checkingUpdates,setCheckingUpdates]=useState(false);
  const safeToUpdate=!loading&&!loadFailed&&!busy&&!modal&&!photoBusy&&!importReading&&!deleted&&!lightbox&&!sharing;
  useLayoutEffect(()=>{window.swimUpdates?.setSafeToReload(safeToUpdate);},[safeToUpdate]);
  useEffect(()=>()=>holdUpdates(),[]);
  const repo=useRef(null),lock=useRef(false),fields=useRef(null),photoRequest=useRef(0),importRef=useRef(null),importRequest=useRef(0);
  useEffect(()=>{
    let active=true;
    (async()=>{try {repo.current=C.createRepository({indexedDB:window.indexedDB,localStorage:window.localStorage});const state=await repo.current.load();if(active)setData(state);}
    catch(err){if(active){setLoadFailed(true);setError("读取失败："+message(err)+" 原始数据仍保留，可导出原始数据或恢复备份。");}}
    finally{if(active)setLoading(false);}})();
    const net=()=>setOnline(navigator.onLine),off=e=>setOffline(e.detail),date=()=>setToday(todayStr());
    window.addEventListener("online",net);window.addEventListener("offline",net);window.addEventListener("swim-offline-status",off);
    window.addEventListener("focus",date);const timer=setInterval(date,60000);
    return()=>{active=false;window.removeEventListener("online",net);window.removeEventListener("offline",net);window.removeEventListener("swim-offline-status",off);window.removeEventListener("focus",date);clearInterval(timer);};
  },[]);
  async function persist(next,restoring=false){
    if(lock.current||loading||(loadFailed&&!restoring))return false;
    holdUpdates();lock.current=true;setBusy(true);
    try {if(!repo.current)throw new Error("本机存储不可用，请检查浏览器权限。");const saved=await repo.current.save(C.validateState(next));setData(saved);setError("");setLoadFailed(false);return true;}
    catch(err){setError("保存失败："+message(err)+" 当前数据未更改。");return false;}
    finally{lock.current=false;setBusy(false);}
  }
  function closeModal(){if(lock.current)return;photoRequest.current++;importRequest.current++;setPhotoBusy(false);setImportReading(false);setModal(null);setFormError("");}
  function openAdd(date=today){
    if(loadFailed||lock.current)return;
    holdUpdates();
    const p=data.preferences||{stroke:"自由泳",pool:"",durationMode:"elapsed"};
    photoRequest.current++;setPhotoBusy(false);setFormError("");
    setForm({id:null,date,swam:true,mood:MOODS[0],stroke:p.stroke||"自由泳",distance:"",duration:"",durationMode:p.durationMode||"elapsed",pool:p.pool||"",note:"",photo:null});
    setModal("record");
  }
  function editRecord(r){
    if(lock.current||loadFailed)return;
    holdUpdates();
    photoRequest.current++;setPhotoBusy(false);setFormError("");
    setForm({...r,distance:r.distance?String(r.distance):"",duration:r.duration?String(r.duration):"",photo:data.photos[r.id]||null});
    setModal("record");
  }
  function setField(key,value){setForm(prev=>({...prev,[key]:value}));}
  async function pickPhoto(e){
    const file=e.target.files?.[0];e.target.value="";if(!file)return;
    const token=++photoRequest.current;setPhotoBusy(true);setFormError("");
    try{const photo=await compressImage(file);if(token===photoRequest.current)setField("photo",photo);}
    catch(err){if(token===photoRequest.current)setFormError(message(err));}
    finally{if(token===photoRequest.current)setPhotoBusy(false);}
  }
  async function saveRecord(e){
    e.preventDefault();if(lock.current||photoBusy)return;
    if([...fields.current.querySelectorAll("input")].some(input=>input.validity.badInput)){setFormError("请填写完整有效的日期和数字。");return;}
    if(!C.validDate(form.date)){setFormError("请选择有效日期。");return;}
    if(form.date>today){setFormError("游泳日记暂不记录未来的日期。");return;}
    const distance=form.swam?Number(form.distance):0,duration=form.swam?Number(form.duration):0;
    if(!Number.isFinite(distance)||distance<0||!Number.isFinite(duration)||duration<0){setFormError("距离和时间须为非负数字，未记录的项目可留空。");return;}
    const editing=form.id!==null,id=editing?form.id:uuid();
    const record={id,date:form.date,swam:form.swam,mood:form.swam?form.mood:null,stroke:form.swam?form.stroke:null,distance,duration,durationMode:form.durationMode||"unknown",pool:form.swam?form.pool.trim():"",note:form.note.trim(),hasPhoto:!!form.photo};
    const photos={...data.photos};if(form.photo)photos[id]=form.photo;else delete photos[id];
    const records=[record,...data.records.filter(r=>r.id!==id)].sort((a,b)=>b.date.localeCompare(a.date));
    const preferences=!editing&&form.swam ? {stroke:form.stroke,pool:form.pool.trim(),durationMode:form.durationMode} : data.preferences;
    const next={...data,records,photos,preferences};
    try{C.validateState(next);}catch(err){setFormError(message(err));return;}
    if(await persist(next)){
      const oldBest=data.records.filter(r=>r.swam).reduce((best,r)=>Math.max(best,r.distance),0);
      setModal(null);setNotice(editing?"记录已更新":form.swam&&oldBest>0&&distance>oldBest?"记录已保存 · 最长距离新纪录 🎉":"记录已保存");setSelectedDate(record.date);
    }
  }
  async function removeRecord(record){
    const photos={...data.photos};delete photos[record.id];
    if(await persist({...data,records:data.records.filter(r=>r.id!==record.id),photos})){setDeleted({record,photo:data.photos[record.id]||null});setNotice("");}
  }
  async function undoDelete(){
    if(!deleted)return;const {record,photo}=deleted,photos={...data.photos};if(photo)photos[record.id]=photo;
    if(data.records.some(r=>r.id===record.id))return;
    if(await persist({...data,records:[record,...data.records].sort((a,b)=>b.date.localeCompare(a.date)),photos})){setDeleted(null);setNotice("记录和照片已恢复");}
  }
  function openGoal(period="week"){
    holdUpdates();
    const found=period==="all"?data.goal:data.periodGoals.find(g=>g.period===period&&g.startDate<=today&&(!g.endDate||g.endDate>=today));
    setGoalDraft({period,type:found?.type||(period==="month"?"distance":"count"),value:String(found?.value||(period==="month"?10:3))});
    setFormError("");setModal("goal");
  }
  async function saveGoal(e){
    e.preventDefault();const value=Number(goalDraft.value),type=goalDraft.type,period=goalDraft.period;
    if(!Number.isFinite(value)||value<=0||(type!=="distance"&&!Number.isSafeInteger(value))){setFormError("距离须大于0，次数和天数须为正整数。");return;}
    let next;
    if(period==="all")next={...data,goal:{type,value}};
    else{
      const startDate=F.periodBounds(period,today).start;
      const periodGoals=data.periodGoals.flatMap(g=>{
        if(g.period!==period||(g.endDate&&g.endDate<startDate))return [g];
        if(g.startDate>=startDate)return [];
        return [{...g,endDate:shiftDate(startDate,-1)}];
      });
      periodGoals.push({id:uuid(),period,type,value,startDate,endDate:null});
      next={...data,periodGoals};
    }
    if(await persist(next)){setModal(null);setNotice("目标已更新，已结束周期的目标保持不变");}
  }
  async function exportBackup(){
    if(lock.current||loadFailed)return;
    try{
      const exported=F.markBackup(data,new Date().toISOString());
      download(JSON.stringify({...exported,exportedAt:new Date().toISOString()}),"application/json","游泳备份_"+today+".json");
      if(await persist(exported))setNotice("已发起完整备份下载，请确认文件已保存");
      else setNotice("下载已发起，但导出时间未能保存");
    }catch(err){setFormError("导出失败："+message(err));}
  }
  function exportCSV(){download(C.toCSV(data.records),"text/csv;charset=utf-8;","游泳记录_"+today+".csv");}
  function exportRaw(){
    try{download(JSON.stringify({format:"swim-legacy-raw",data:repo.current.readLegacyRaw()}),"application/json","游泳原始数据_"+today+".json");}
    catch(err){setError("导出失败："+message(err));}
  }
  async function readImport(e){
    const file=e.target.files?.[0];e.target.value="";if(!file||lock.current)return;
    const request=++importRequest.current;setImportReading(true);setFormError("");setIncoming(null);
    try{const state=C.validateState(JSON.parse(await file.text()));if(request!==importRequest.current)return;setIncoming(state);setImportMode(loadFailed?"replace":"merge");setConflict("keep");}
    catch(err){if(request===importRequest.current)setFormError("无法导入："+message(err));}
    finally{if(request===importRequest.current)setImportReading(false);}
  }
  async function confirmImport(){
    if(!incoming||lock.current)return;
    if(importMode==="replace"&&!confirm("将用备份替换当前全部记录、照片和目标。确定继续吗？"))return;
    try{
      const next=F.applyImport(data,incoming,{mode:importMode,conflict});
      if(await persist(next,true)){setModal(null);setIncoming(null);setDeleted(null);setNotice(importMode==="merge"?"备份已合并，重复记录未重复添加":"备份已恢复");}
    }catch(err){setFormError("导入失败："+message(err));}
  }
  async function shareCard(){
    if(sharing)return;
    holdUpdates();setSharing(true);
    try {
    const sum=C.summarize(data.records.filter(r=>r.date<=today)),c=document.createElement("canvas");c.width=1080;c.height=1350;
    const ctx=c.getContext("2d");ctx.imageSmoothingEnabled=false;
    ctx.fillStyle="#F1ECE0";ctx.fillRect(0,0,1080,1350);ctx.fillStyle="#117C0D";ctx.fillRect(70,70,32,32);ctx.fillRect(102,102,16,16);
    ctx.textAlign="left";ctx.font="bold 36px sans-serif";ctx.fillText("游进奥运",140,108);
    ctx.textAlign="center";ctx.font="bold 76px sans-serif";ctx.fillText("每一次下水，",540,250);ctx.fillText("都算数。",540,350);
    const poolImage=new Image();await new Promise((resolve,reject)=>{poolImage.onload=resolve;poolImage.onerror=()=>reject(new Error("分享插画未能加载"));poolImage.src="./icons/pixel-pool.svg";});
    ctx.drawImage(poolImage,300,405,480,330);
    await document.fonts?.load("64px SwimPixel","0123456789.,/:+-");
    const metrics=[{x:220,value:fmtNum(sum.totalDistance/1000),label:"累计公里"},{x:540,value:String(sum.sessionCount),label:"游泳次数"},{x:860,value:String(sum.dayCount),label:"打卡天数"}];
    for(const metric of metrics){ctx.fillStyle="#117C0D";ctx.font="64px SwimPixel, monospace";ctx.fillText(metric.value,metric.x,845);ctx.fillStyle="#5D6558";ctx.font="30px sans-serif";ctx.fillText(metric.label,metric.x,912);}
    ctx.fillStyle="#FAC75E";ctx.fillRect(88,987,904,105);ctx.fillStyle="#26352B";ctx.font="bold 34px sans-serif";ctx.fillText("最长连续 "+streaks(data.records,today).longest+" 天，每一步都算数",540,1054);
    ctx.fillStyle="#5D6558";ctx.font="30px sans-serif";ctx.fillText(today+" · 我的游泳日记",540,1222);
    const blob=await new Promise(resolve=>c.toBlob(resolve,"image/png"));
    if(!blob)throw new Error("分享图片生成失败，请重试。");
    const file=new File([blob],"游泳打卡.png",{type:"image/png"});
    if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:"我的游泳打卡"});return;}catch(err){if(err.name==="AbortError")return;}}
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="游泳打卡.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    }catch(err){setNotice("分享失败："+message(err));}
    finally{setSharing(false);}
  }
  async function checkForUpdates(){
    if(checkingUpdates)return;
    if(!online){setNotice("联网后会自动检查更新");return;}
    if(!window.swimUpdates){setNotice("请关闭网站后重新打开，以启用自动更新");return;}
    setCheckingUpdates(true);
    try{await window.swimUpdates.check();setNotice("已检查更新，新版准备完成后会自动启用");}
    catch(err){setNotice("暂时无法检查更新，恢复网络后会自动重试");}
    finally{setCheckingUpdates(false);}
  }
  const all=C.summarize(data.records.filter(r=>r.date<=today)),week=F.periodBounds("week",today),weekStats=C.summarize(F.filterRecords(data.records,{from:week.start,to:today}));
  const streak=streaks(data.records,today),badge=BADGES.filter(b=>b.d<=all.dayCount).at(-1),nextBadge=BADGES.find(b=>b.d>all.dayCount);
  const validFilters=(!filters.from||C.validDate(filters.from))&&(!filters.to||C.validDate(filters.to));
  const backup=useMemo(()=>F.backupInfo(data),[data]),filtered=validFilters?F.filterRecords(data.records,filters):[],pools=[...new Set(data.records.map(r=>r.pool).filter(Boolean))].sort();
  const activeGoals=["week","month"].map(period=>({period,goal:data.periodGoals.find(g=>g.period===period&&g.startDate<=today&&(!g.endDate||g.endDate>=today))}));
  const history=F.goalHistory(data.records,data.periodGoals,today,6);
  const comparison=F.comparePeriods(data.records,{...trend,date:today}),points=F.paceSeries(data.records,trend);
  const swims=data.records.filter(r=>r.swam&&r.date<=today);
  const maxDistance=swims.reduce((n,r)=>Math.max(n,r.distance),0),maxTime=swims.reduce((n,r)=>Math.max(n,r.duration),0);
  const sameMode=swims.filter(r=>r.stroke===trend.stroke&&r.durationMode===trend.durationMode);
  const paces=sameMode.map(r=>C.paceSeconds(r.distance,r.duration)).filter(p=>p!==null);
  const monthDistances=Array.from({length:6},(_,i)=>{const d=new Date(today+"T12:00:00Z");d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-5+i);const key=d.toISOString().slice(0,7);return {label:key.slice(5)+"月",value:swims.filter(r=>r.date.startsWith(key)).reduce((n,r)=>n+r.distance,0)/1000};});
  const recentDistances=[...swims].filter(r=>r.distance>0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-10).map(r=>({label:r.date.slice(5),value:r.distance}));
  const importPreview=useMemo(()=>incoming?F.mergePreview(data,incoming):null,[data,incoming]);
  const cumulative=data.goal.type==="distance"?all.totalDistance/1000:data.goal.type==="count"?all.sessionCount:streak.current;
  const cumulativeUnit=data.goal.type==="distance"?"km":data.goal.type==="count"?"次":"天";
  const monthRecords=data.records.filter(r=>r.date.startsWith(month)&&r.date<=today),monthStats=C.summarize(monthRecords);
  function openBackup(){holdUpdates();importRequest.current++;setImportReading(false);setFormError("");setIncoming(null);setModal("backup");}
  if(loading)return <main className="loading" role="status"><Icon name="swim"/>正在读取游泳记录…</main>;

  return <main className={"app-shell tab-"+tab}>
    <header className="app-header">
      <div className="brand"><span className="brand-icon"><Icon name="swim"/></span><h1>游进奥运</h1></div>
      <div className="header-actions"><Btn small onClick={shareCard} disabled={loadFailed||sharing}><Icon name="share"/>分享</Btn><Btn small onClick={openBackup}><Icon name="backup"/>备份{backup.changed&&data.records.length>0&&<i className="dot" />}</Btn></div>
    </header>
    <div className="connection-line" role="status"><span className={online?"online-dot":"offline-dot"}/>{online?(offline.ready?"已可离线使用":offline.error?"离线资源未就绪":"正在准备离线使用"):"当前离线"}{offline.updating?<span> · 正在更新至新版…</span>:offline.updateAvailable&&<span> · {safeToUpdate?(offline.updateBlocked?"新版已就绪，请先完成或关闭其他页面":"新版已就绪，即将自动更新"):"新版已就绪，当前操作结束后自动更新"}</span>}</div>
    {loadFailed&&<section className="alert" role="alert"><p>{error}</p><div className="button-row"><Btn small onClick={exportRaw}>导出原始数据</Btn><Btn small onClick={openBackup}>从备份恢复</Btn></div></section>}
    {!loadFailed&&error&&<p className="alert" role="alert">{error}</p>}
    {notice&&<div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={()=>setNotice("")}>×</button></div>}
    {tab==="records"&&<>
      <section className="welcome">
        <div className="hero-row"><div className="hero-copy"><h2>每一次下水，<br/>都算数。</h2><p>慢慢游，也在前进。</p></div><img className="hero-pool" src="./icons/pixel-pool.svg" width="160" height="110" alt="像素风小泳池"/></div>
        <Btn primary onClick={()=>openAdd()} disabled={busy||loadFailed} aria-label="＋ 记录今天"><Icon name="plus"/>记录今天</Btn>
      </section>
      <section className="week-summary" aria-label="本周概况">
        <div className="section-top"><h2>本周概况</h2><span className="muted small">{week.start.slice(5)} — {week.end.slice(5)}</span></div>
        <div className="metrics three"><Metric label="游泳距离" value={fmtNum(weekStats.totalDistance/1000)} unit="km"/><Metric label="游泳次数" value={weekStats.sessionCount} unit="次"/><Metric label="打卡天数" value={weekStats.dayCount} unit="天"/></div>
      </section>
      <section className="period-goals" aria-label="周期目标">
        {activeGoals.filter(({period})=>period==="week").map(({period,goal})=>goal?<GoalCard key={period} period={period} goal={goal} progress={F.periodProgress(data.records,goal,today)} onEdit={()=>openGoal(period)} disabled={busy||loadFailed}/>:<button key={period} className="goal-placeholder" onClick={()=>openGoal(period)} disabled={busy||loadFailed}><span><Icon name="medal"/>本周目标</span><strong>＋ 设定每周次数</strong></button>)}
      </section>
    </>}
    {tab!=="records"&&<div className="page-intro"><div><p className="eyebrow">我的游泳日记</p><h2>{{calendar:"日历",data:"一点点进步",badges:"我的勋章"}[tab]}</h2></div><Btn small onClick={()=>openAdd()} disabled={busy||loadFailed} aria-label="＋ 记录今天"><Icon name="plus"/>记一次</Btn></div>}
    {backup.changed&&data.records.length>0&&<button className="backup-nudge" onClick={openBackup}><span><Icon name="backup"/>{backup.unbackedCount>0?backup.unbackedCount+" 条新增记录待备份":"记录或目标有更新，建议备份"}</span><span>去备份 ›</span></button>}
    <nav className="tabs" aria-label="主视图">{[["records","记录","record"],["calendar","日历","calendar"],["data","进步","chart"],["badges","勋章","medal"]].map(([key,label,icon])=><button key={key} aria-pressed={tab===key} className={tab===key?"active":""} onClick={()=>setTab(key)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
    {tab==="records"&&<section aria-label="历史记录" className="section-stack">
      <div className="records-heading"><div><h2>最近记录</h2><span className="small muted">{Object.values(filters).some(Boolean)?"显示 "+filtered.length+" / "+data.records.length+" 条":"共 "+data.records.length+" 条记录"}</span></div><button className={"filter-toggle "+(Object.values(filters).some(Boolean)?"has-filter":"")} aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><Icon name="search"/>{filtersOpen?"收起筛选":"筛选记录"}</button></div>
      {filtersOpen&&<div className="card filters">
        <label className="search-field"><Icon name="search"/><input aria-label="搜索备注或泳馆" placeholder="搜索备注、泳馆…" value={filters.query} onChange={e=>setFilters({...filters,query:e.target.value})}/></label>
        <div className="filter-grid">
          <Field label="泳姿"><select aria-label="筛选泳姿" value={filters.stroke} onChange={e=>setFilters({...filters,stroke:e.target.value})}><option value="">全部泳姿</option>{STROKES.map(s=><option key={s}>{s}</option>)}</select></Field>
          <Field label="泳馆"><select aria-label="筛选泳馆" value={filters.pool} onChange={e=>setFilters({...filters,pool:e.target.value})}><option value="">全部泳馆</option>{pools.map(p=><option key={p}>{p}</option>)}</select></Field>
          <Field label="开始日期"><input aria-label="筛选开始日期" type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></Field>
          <Field label="结束日期"><input aria-label="筛选结束日期" type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></Field>
          {!validFilters&&<p role="alert" className="field-error full">请输入有效的四位年份日期。</p>}
          {filters.from&&filters.to&&filters.from>filters.to&&<p className="field-error full">结束日期应不早于开始日期。</p>}
          <button className="text-button full" onClick={()=>setFilters({query:"",stroke:"",pool:"",from:"",to:""})}>清除全部筛选</button>
        </div>
      </div>}
      {filtered.length?filtered.map(r=><RecordCard key={r.id} record={r} photo={data.photos[r.id]} disabled={busy} onEdit={()=>editRecord(r)} onDelete={()=>removeRecord(r)} onPhoto={()=>{holdUpdates();setLightbox(data.photos[r.id]);}}/>):<div className="card empty"><Icon name="swim"/><h3>{data.records.length?"没有符合条件的记录":"从今天的游泳开始"}</h3><p>{data.records.length?"换个条件试试，原记录都还在。":"记下距离、感受，或只记下一次坚持。"}</p>{!data.records.length&&<Btn onClick={()=>openAdd()} disabled={loadFailed}>记录第一次游泳</Btn>}</div>}
    </section>}
    {tab==="calendar"&&<section className="section-stack">
      <div className="card"><Calendar month={month} setMonth={setMonth} records={data.records} today={today} selected={selectedDate} onSelect={date=>{setSelectedDate(date);if(!data.records.some(r=>r.date===date))openAdd(date);}} disabled={busy||loadFailed}/><p className="small muted">点选日期可补记，同一天支持多次游泳。</p></div>
      <div className="card"><div className="section-top"><h2>{month} 月小结</h2></div><div className="metrics three"><Metric label="游泳" value={monthStats.sessionCount} unit="次"/><Metric label="距离" value={fmtNum(monthStats.totalDistance/1000)} unit="km"/><Metric label="时长" value={fmtNum(monthStats.totalTime)} unit="分"/></div></div>
      {selectedDate&&<div className="section-stack"><div className="section-top"><h2>{selectedDate}</h2><Btn small onClick={()=>openAdd(selectedDate)} disabled={busy||loadFailed||selectedDate>today}>＋ 再记一次</Btn></div>{data.records.filter(r=>r.date===selectedDate).map(r=><RecordCard key={r.id} record={r} photo={data.photos[r.id]} onEdit={()=>editRecord(r)} onDelete={()=>removeRecord(r)} onPhoto={()=>{holdUpdates();setLightbox(data.photos[r.id]);}} disabled={busy}/>)}</div>}
    </section>}
    {tab==="data"&&<section className="section-stack">
      <section className="period-goals month-goal" aria-label="本月目标">
        {activeGoals.filter(({period})=>period==="month").map(({period,goal})=>goal?<GoalCard key={period} period={period} goal={goal} progress={F.periodProgress(data.records,goal,today)} onEdit={()=>openGoal(period)} disabled={busy||loadFailed}/>:<button key={period} className="goal-placeholder" onClick={()=>openGoal(period)} disabled={busy||loadFailed}><span><Icon name="medal"/>本月目标</span><strong>＋ 设定每月距离</strong></button>)}
      </section>
      <div className="card"><div className="section-top"><h2>看见你的进步</h2></div><div className="filter-grid">
        <Field label="比较周期"><select aria-label="比较周期" value={trend.period} onChange={e=>setTrend({...trend,period:e.target.value})}><option value="week">本周 / 上周</option><option value="month">本月 / 上月</option></select></Field>
        <Field label="泳姿"><select aria-label="趋势泳姿" value={trend.stroke} onChange={e=>setTrend({...trend,stroke:e.target.value})}>{STROKES.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="时长口径" className="full"><select aria-label="趋势时长口径" value={trend.durationMode} onChange={e=>setTrend({...trend,durationMode:e.target.value})}>{Object.entries(MODES).map(([key,label])=><option key={key} value={key}>{label}{key==="unknown"?"（旧记录）":""}</option>)}</select></Field>
      </div><div className="comparison">
        <div><span>{trend.period==="week"?"本周":"本月"}</span><strong><span className="metric-value">{fmtNum(comparison.current.totalDistance/1000)}</span> <small>km</small></strong><p>{comparison.current.sessionCount} 次 · {comparison.current.avgPace||"—"} /100m</p></div>
        <div><span>{trend.period==="week"?"上周":"上月"}</span><strong><span className="metric-value">{fmtNum(comparison.previous.totalDistance/1000)}</span> <small>km</small></strong><p>{comparison.previous.sessionCount} 次 · {comparison.previous.avgPace||"—"} /100m</p></div>
      </div><p className="small muted">仅比较所选泳姿与计时方式。当前周期未结束时，数据为阶段结果。</p></div>
      <div className="card"><div className="section-top"><h2>配速趋势</h2><span className="small muted">最近 {points.length} 个训练日</span></div><PaceChart points={points}/><p className="small muted">数值越小，配速越快；未填写距离或时长的记录不计入。</p></div>
      <div className="card"><div className="section-top"><h2>累计目标</h2><Btn small onClick={()=>openGoal("all")} disabled={busy||loadFailed}>修改</Btn></div><Progress current={cumulative} target={data.goal.value}/><p className="goal-copy">{fmtNum(cumulative)} / {fmtNum(data.goal.value)} {cumulativeUnit}{cumulative>=data.goal.value?" · 已达成 🎉":""}</p><div className="metrics three"><Metric label="总距离" value={fmtNum(all.totalDistance/1000)} unit="km"/><Metric label="总次数" value={all.sessionCount} unit="次"/><Metric label="最长连续" value={streak.longest} unit="天"/></div></div>
      <div className="card"><div className="section-top"><h2>目标达成记录</h2></div>{history.length?<ul className="goal-history">{history.map((h,i)=><li key={h.goalId+"-"+h.start+"-"+i}><div><strong>{h.label||h.start+" — "+h.end}</strong><span>{fmtNum(h.current)} / {fmtNum(h.target)} {h.type==="distance"?"km":"次"}</span></div><b className={h.done?"achieved":""}>{h.done?"已达成":"未达成"}</b></li>)}</ul>:<p className="muted">设定周/月目标后，已结束周期的结果会保留在这里。</p>}</div>
      <details className="card more-stats"><summary>个人最佳与更多统计</summary>
        <div className="metrics three"><Metric label="最长距离" value={fmtNum(maxDistance)} unit="米"/><Metric label="最长时长" value={fmtNum(maxTime)} unit="分"/><Metric label="最长连续" value={streak.longest} unit="天"/></div>
        <p className="helper">所选泳姿 / 计时方式的最快配速：{paces.length?C.fmtPace(Math.min(...paces))+" /100m":"暂无"}</p>
        <h3>近 6 个月距离（km）</h3><DistanceBars items={monthDistances}/>
        <h3>近期每次距离（米）</h3><DistanceBars items={recentDistances}/>
        <h3>泳姿统计</h3><ul className="stroke-counts">{STROKES.map(stroke=><li key={stroke}><span>{stroke}</span><b>{swims.filter(r=>r.stroke===stroke).length} 次</b></li>)}</ul>
      </details>
    </section>}
    {tab==="badges"&&<section className="section-stack"><div className="card badge-hero"><span>{badge?.emoji||"🌱"}</span><h2>{badge?.name||"等待第一次打卡"}</h2><p>累计 {all.dayCount} 天 · 共 {all.sessionCount} 次游泳</p><p className="muted">当前连续 {streak.current} 天</p>{nextBadge&&<p className="muted">再游 {nextBadge.d-all.dayCount} 天，解锁「{nextBadge.name}」</p>}</div><div className="card badge-grid">{BADGES.map(b=><div key={b.d} className={all.dayCount>=b.d?"badge unlocked":"badge"}><span>{all.dayCount>=b.d?b.emoji:"🔒"}</span><strong>{b.name}</strong><small>{all.dayCount>=b.d?"已获得":b.d+" 天"}</small></div>)}</div></section>}
    <footer>数据保存在当前浏览器 · <button className="text-button" onClick={openBackup}>定期导出备份</button><br/><button className="text-button" onClick={checkForUpdates} disabled={checkingUpdates}>{checkingUpdates?"正在检查更新…":"检查更新"}</button> · 联网时自动更新</footer>
    {deleted&&<div className="undo-toast" role="status"><span>已删除 {deleted.record.date} 的记录</span><Btn small onClick={undoDelete} disabled={busy}>撤销删除</Btn><button aria-label="关闭撤销提示" onClick={()=>setDeleted(null)}>×</button></div>}
    {modal==="record"&&form&&<Modal title={form.id===null?"记录一次游泳":"编辑游泳记录"} onClose={closeModal} busy={busy}><form onSubmit={saveRecord} noValidate>
      {formError&&<p className="alert" role="alert">{formError}</p>}{error&&<p className="alert" role="alert">{error}</p>}
      <fieldset ref={fields} disabled={busy}>
        <Field label="日期"><input aria-label="日期" type="date" value={form.date} max={today} required onChange={e=>setField("date",e.target.value)}/></Field>
        <div className="segments"><button type="button" className={form.swam?"active":""} onClick={()=>setField("swam",true)}>🏊 游了</button><button type="button" className={!form.swam?"active":""} onClick={()=>setField("swam",false)}>🛋️ 休息</button></div>
        {form.swam&&<><Field label="泳姿"><div className="chips">{STROKES.map(s=><button type="button" key={s} aria-pressed={form.stroke===s} onClick={()=>setField("stroke",s)} className={form.stroke===s?"selected":""}>{s}</button>)}</div></Field>
          <div className="filter-grid"><Field label="距离（米）"><input aria-label="距离 (米)" type="number" min="0" step="any" inputMode="decimal" value={form.distance} placeholder="可留空" onChange={e=>setField("distance",e.target.value)}/></Field><Field label="时间（分钟）"><input aria-label="时间 (分钟)" type="number" min="0" step="any" inputMode="decimal" value={form.duration} placeholder="可留空" onChange={e=>setField("duration",e.target.value)}/></Field></div>
          <div className="chips quick-distances" aria-label="常用距离">{[500,1000,1500,2000].map(d=><button type="button" key={d} onClick={()=>setField("distance",String(d))}>{d} 米</button>)}</div>
          <Field label="这段时间如何计时？"><select aria-label="时长口径" value={form.durationMode} onChange={e=>setField("durationMode",e.target.value)}><option value="elapsed">含休息：从开始到结束</option><option value="moving">净游泳：已扣除休息</option><option value="unknown">未注明 / 不确定</option></select></Field>
          {C.paceStr(Number(form.distance),Number(form.duration))&&<p className="pace-preview">配速 {C.paceStr(Number(form.distance),Number(form.duration))} /100m · {MODES[form.durationMode]}</p>}
          <Field label="泳馆"><input aria-label="游泳馆" list="pool-options" value={form.pool} onChange={e=>setField("pool",e.target.value)} placeholder="例如：市体育中心"/><datalist id="pool-options">{pools.map(p=><option key={p} value={p}/>)}</datalist></Field>
          <Field label="今天的感受"><div className="chips moods">{MOODS.map(m=><button type="button" key={m.label} className={form.mood?.label===m.label?"selected":""} aria-label={m.label} aria-pressed={form.mood?.label===m.label} onClick={()=>setField("mood",m)}><span>{m.emoji}</span>{m.label}</button>)}</div></Field>
        </>}
        <Field label="备注"><textarea aria-label="备注" rows="3" value={form.note} onChange={e=>setField("note",e.target.value)} placeholder={form.swam?"今天练了什么，有什么小进步？":"休息一下，也给自己留句话。"} /></Field>
        <Field label="照片"><input aria-label="添加照片" type="file" accept="image/*" onChange={pickPhoto}/>{form.photo&&<div className="photo-preview"><img src={form.photo} alt="所选照片预览"/><button type="button" onClick={()=>{photoRequest.current++;setPhotoBusy(false);setField("photo",null);}}>移除照片</button></div>}</Field>
        {photoBusy&&<p role="status" className="muted">正在处理照片…</p>}
        <Btn primary wide type="submit" disabled={busy||photoBusy}>{busy?"正在保存…":form.id===null?"保存记录":"保存修改"}</Btn>
      </fieldset>
    </form></Modal>}
    {modal==="goal"&&<Modal title="设定你的目标" onClose={closeModal} busy={busy}><form onSubmit={saveGoal} noValidate>
      {formError&&<p className="alert" role="alert">{formError}</p>}{error&&<p className="alert" role="alert">{error}</p>}
      <fieldset disabled={busy}><Field label="目标周期"><select aria-label="目标周期" value={goalDraft.period} onChange={e=>setGoalDraft({...goalDraft,period:e.target.value,type:goalDraft.type==="days"&&e.target.value!=="all"?"count":goalDraft.type})}><option value="week">每周</option><option value="month">每月</option><option value="all">累计</option></select></Field>
      <Field label="目标类型"><select aria-label="目标类型" value={goalDraft.type} onChange={e=>setGoalDraft({...goalDraft,type:e.target.value})}><option value="count">游泳次数</option><option value="distance">游泳距离（km）</option>{goalDraft.period==="all"&&<option value="days">连续打卡天数</option>}</select></Field>
      <Field label={"目标数值（"+(goalDraft.type==="distance"?"km":goalDraft.type==="count"?"次":"天")+"）"}><input aria-label="目标数值" type="number" min="0" step={goalDraft.type==="distance"?"any":"1"} value={goalDraft.value} onChange={e=>setGoalDraft({...goalDraft,value:e.target.value})}/></Field>
      <p className="helper">{goalDraft.period==="all"?"累计目标使用全部记录；连续天数使用当前连续打卡。":"目标从当前周期开始，之后每周 / 每月继续使用。修改不会改变已结束周期的目标。"}</p>
      <Btn primary wide type="submit" disabled={busy}>{busy?"正在保存…":"保存目标"}</Btn></fieldset></form></Modal>}
    {modal==="backup"&&<Modal title="备份与恢复" onClose={closeModal} busy={busy}>
      <p className="helper">完整备份包含记录、照片、目标和偏好。数据只保存在这台设备的当前浏览器，请确认下载后文件已保存。</p>
      <div className="backup-summary"><span>最近导出</span><strong>{backup.lastBackupAt?new Date(backup.lastBackupAt).toLocaleString("zh-CN"):"尚未导出"}</strong><p>{backup.unbackedCount} 条新增记录待备份{backup.changed&&backup.unbackedCount===0?" · 有其他内容更新":""}</p></div>
      {formError&&<p className="alert" role="alert">{formError}</p>}{error&&<p className="alert" role="alert">{error}</p>}
      <div className="section-stack"><Btn primary wide onClick={exportBackup} disabled={busy||loadFailed}>导出完整备份（含照片）</Btn><Btn wide onClick={exportCSV} disabled={busy||loadFailed}>导出 CSV 表格</Btn><input ref={importRef} aria-label="导入备份文件" type="file" accept=".json,application/json" onChange={readImport} disabled={busy}/></div>
      {importReading&&<p role="status" className="helper">正在读取备份文件…</p>}
      {incoming&&<section className="import-preview"><h3>导入预览</h3><p>文件内共 {incoming.records.length} 条记录</p>
        <div className="segments"><button type="button" disabled={loadFailed||busy} className={importMode==="merge"?"active":""} onClick={()=>setImportMode("merge")}>合并到本机</button><button type="button" disabled={busy} className={importMode==="replace"?"active":""} onClick={()=>setImportMode("replace")}>替换全部</button></div>
        {importMode==="merge"?<><div className="import-counts"><span>新增 <b>{importPreview.added}</b></span><span>重复 <b>{importPreview.duplicates}</b></span><span>内容不同 <b>{importPreview.conflicts}</b></span></div><p className="helper">完全相同的记录会跳过。本机目标与偏好保持不变。</p>
        {importPreview.conflicts>0&&<Field label="相同记录有不同内容时"><select aria-label="冲突处理" value={conflict} disabled={busy} onChange={e=>setConflict(e.target.value)}><option value="keep">保留本机版本</option><option value="incoming">使用备份版本（含照片）</option></select><ul className="conflict-list">{importPreview.conflictIds.slice(0,5).map(id=>{const r=incoming.records.find(r=>String(r.id)===String(id));return <li key={String(id)}>{r?.date} · {r?.stroke||"休息"} · {r?.distance||0}米</li>;})}</ul>{importPreview.conflicts>5&&<p className="small muted">另有 {importPreview.conflicts-5} 条，统一使用上方选择。</p>}</Field>}</>:<p className="alert">替换会覆盖本机全部记录、照片和目标。建议先导出当前备份。</p>}
        <Btn primary wide onClick={confirmImport} disabled={busy}>{busy?"正在保存…":importMode==="merge"?"确认合并":"确认替换全部数据"}</Btn>
      </section>}
    </Modal>}
    {lightbox&&<Modal title="游泳照片" onClose={()=>setLightbox(null)}><img className="lightbox-image" src={lightbox} alt="游泳照片"/></Modal>}
  </main>;
}

function Icon({name,className=""}){return <svg className={"pixel-icon "+className} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href={"./icons/pixel-icons.svg#"+name}/></svg>;}
function Btn({children,primary,small,wide,className="",type="button",...props}){return <button type={type} className={["btn",primary&&"primary",small&&"small-btn",wide&&"wide",className].filter(Boolean).join(" ")} {...props}>{children}</button>;}
function Field({label,children,className=""}){return <div className={"field "+className} role="group" aria-label={label}><span>{label}</span>{children}</div>;}
function Metric({label,value,unit}){return <div className="metric"><strong><span className="metric-value">{value}</span><small>{unit}</small></strong><span>{label}</span></div>;}
function Progress({current,target}){const pct=Math.min(100,Math.max(0,current/target*100));return <div className="progress" role="progressbar" aria-label="目标进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(pct.toFixed(1))}><i style={{width:pct+"%"}}/></div>;}
function GoalCard({period,goal,progress,onEdit,disabled}){return <div className={"goal-card "+(progress.done?"goal-done":"")}><div className="goal-line"><span className="goal-caption"><Icon name="medal"/>{period==="week"?"本周":"本月"}目标{progress.done?" ✓":""}</span><button className="goal-value" onClick={onEdit} disabled={disabled} aria-label={"修改"+(period==="week"?"本周":"本月")+"目标"}><strong className="metric-value">{fmtNum(progress.current)} / {fmtNum(goal.value)}</strong><small>{goal.type==="distance"?"km":"次"}</small><Icon name="settings"/></button></div><Progress current={progress.current} target={goal.value}/></div>;}
function Modal({title,children,onClose,busy=false}){
  const element=useRef(null),close=useRef(onClose),saving=useRef(busy);close.current=onClose;saving.current=busy;
  useEffect(()=>{
    const previous=document.activeElement,oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
    const focusable=()=>[...element.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const timer=setTimeout(()=>focusable()[0]?.focus(),0);
    const key=e=>{if(e.key==="Escape"&&!saving.current){e.preventDefault();close.current();}if(e.key==="Tab"){const elements=focusable(),first=elements[0],last=elements.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    document.addEventListener("keydown",key);
    return()=>{clearTimeout(timer);document.body.style.overflow=oldOverflow;document.removeEventListener("keydown",key);if(previous?.isConnected)previous.focus();};
  },[]);
  return <div className="modal-backdrop"><section ref={element} className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="close-button" aria-label="关闭窗口" disabled={busy} onClick={onClose}>×</button></div><div className="modal-body">{children}</div></section></div>;
}
function RecordCard({record:r,photo,disabled,onEdit,onDelete,onPhoto}){
  const pace=r.swam?C.paceStr(r.distance,r.duration):null;
  return <article className="card record-card">
    <div className="section-top"><time dateTime={r.date}>{r.date}</time><div className="record-actions"><button onClick={onEdit} disabled={disabled} aria-label={"编辑 "+r.date+" 的记录"}>编辑</button><button onClick={onDelete} disabled={disabled} aria-label={"删除 "+r.date+" 的记录"}>删除</button></div></div>
    <div className="record-heading"><span>{r.swam?r.mood?.emoji||"🏊":"🛋️"}</span><h3>{r.swam?r.stroke||"游泳":"休息日"}</h3><span className="record-mood">{r.swam?r.mood?.label:"给自己一点恢复时间"}</span></div>
    {r.swam&&<div className="record-stats">{r.distance>0&&<strong><span className="metric-value">{fmtNum(r.distance)}</span> <small>米</small></strong>}{r.duration>0&&<span>{fmtNum(r.duration)} 分钟 · {MODES[r.durationMode||"unknown"]}</span>}{pace&&<span className="record-pace">{pace} /100m</span>}</div>}
    {r.pool&&<p className="record-pool">泳馆 · {r.pool}</p>}{r.note&&<p className="record-note">{r.note}</p>}
    {photo&&<button className="photo-button" onClick={onPhoto} aria-label={"查看 "+r.date+" 的游泳照片"}><img src={photo} alt="游泳照片" loading="lazy"/></button>}
  </article>;
}
function Calendar({month,setMonth,records,today,selected,onSelect,disabled}){
  const [year,m]=month.split("-").map(Number),offset=(new Date(Date.UTC(year,m-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(year,m,0)).getUTCDate();
  const counts={};for(const r of records){if(!counts[r.date])counts[r.date]={swam:0,rest:0};counts[r.date][r.swam?"swam":"rest"]++;}
  function move(n){const date=new Date(Date.UTC(year,m-1+n,1));setMonth(date.toISOString().slice(0,7));}
  return <><div className="calendar-heading"><button aria-label="上个月" onClick={()=>move(-1)}>‹</button><h2>{year} 年 {m} 月</h2><button aria-label="下个月" onClick={()=>move(1)}>›</button></div><div className="calendar-grid">{["一","二","三","四","五","六","日"].map(x=><span key={x} className="weekday">{x}</span>)}{Array.from({length:offset},(_,i)=><span key={"blank"+i}/>)}{Array.from({length:days},(_,i)=>{const day=i+1,date=month+"-"+String(day).padStart(2,"0"),count=counts[date];return <button key={date} className={["calendar-day",count?.swam&&"swam-day",count?.rest&&!count?.swam&&"rest-day",date===today&&"today",date===selected&&"selected-day"].filter(Boolean).join(" ")} aria-label={date+(count?.swam?"，游泳 "+count.swam+" 次":"")} aria-pressed={date===selected} disabled={disabled||date>today} onClick={()=>onSelect(date)}><strong className="metric-value">{day}</strong><small>{count?.swam?count.swam+"次":count?.rest?"休息":"·"}</small></button>;})}</div></>;
}
function PaceChart({points}){
  if(!points.length)return <div className="chart-empty">所选泳姿和计时方式还没有有效配速记录。</div>;
  const values=points.map(p=>p.seconds),min=Math.min(...values),max=Math.max(...values),range=Math.max(15,max-min),lower=Math.max(0,min-range*.15),upper=max+range*.15;
  const x=i=>points.length===1?190:62+i*(268/(points.length-1)),y=value=>24+(upper-value)/(upper-lower)*132;
  const path=points.map((p,i)=>(i?"L":"M")+x(i)+","+y(p.seconds)).join(" ");
  return <><svg viewBox="0 0 360 198" className="pace-chart" role="img" aria-label={"最近"+points.length+"个训练日的每百米配速"}>{[lower,(lower+upper)/2,upper].map(v=><g key={v}><line x1="58" x2="338" y1={y(v)} y2={y(v)} stroke="#D9DDCB" strokeDasharray="3 4"/><text x="50" y={y(v)+4} textAnchor="end" className="chart-label">{C.fmtPace(v)}</text></g>)}<path d={path} fill="none" stroke="#117C0D" strokeWidth="3" strokeLinejoin="miter"/>{points.map((p,i)=><rect key={p.date} x={x(i)-3} y={y(p.seconds)-3} width="6" height="6" fill="#117C0D"><title>{p.date+"："+C.fmtPace(p.seconds)+"/100m"}</title></rect>)}<text x="62" y="186" className="chart-label">{points[0].date.slice(5)}</text><text x="338" y="186" textAnchor="end" className="chart-label">{points.at(-1).date.slice(5)}</text></svg><details className="chart-details"><summary>查看每日配速</summary><table><thead><tr><th>日期</th><th>配速 /100m</th></tr></thead><tbody>{points.map(p=><tr key={p.date}><td>{p.date}</td><td>{C.fmtPace(p.seconds)}</td></tr>)}</tbody></table></details></>;
}
function DistanceBars({items}){
  if(!items.length)return <p className="helper">记录距离后，这里会出现图表。</p>;
  const max=Math.max(1,...items.map(p=>p.value));
  return <div className="distance-bars" role="img" aria-label={items.map(p=>p.label+"："+p.value).join("；")}>{items.map((p,i)=><div key={i}><span>{fmtNum(p.value)}</span><i style={{height:Math.max(3,p.value/max*82)+"px"}}/><small>{p.label}</small></div>)}</div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);

