/* Member-learning curriculum. Intro content is public; protected lesson bodies are fetched
 * only with an authenticated Supabase token and enforced by PostgreSQL RLS.
 * No quiz-bank content, scoring data or answers are read or modified.
 */
(() => {
 'use strict';
 const data=window.NUMEROLOGY_CURRICULUM;
 const anchor=document.getElementById('guestbook');
 if(!anchor||document.getElementById('learningMap'))return;
 const el=(tag,content='',cls='')=>{
  const node=document.createElement(tag);node.textContent=content;if(cls)node.className=cls;return node;
 };
 const root=el('section','','learn-map');root.id='learningMap';root.setAttribute('aria-labelledby','learningMapTitle');
 if(!data||!Array.isArray(data.topics)||!Array.isArray(data.mansions)||!data.sources){
  root.append(el('h2','數術知識學習地圖'),el('p','公開課程索引尚未載入。'));
  anchor.before(root);return;
 }
 const topics=data.topics,mansions=data.mansions;
 const all=[...topics,...mansions];
 const ids=new Set(all.map(l=>l.id));
 if(ids.size!==39||all.filter(l=>l.access_tier==='intro').length!==3){
  root.append(el('h2','數術知識學習地圖'),el('p','教材權限與索引有誤，暫停顯示教材。'));
  anchor.before(root);return;
 }
 const memberMeta=new Map(all.filter(x=>x.access_tier==='member').map(x=>[x.id,x]));
 const cfg=window.QUIZ_AUTH_CONFIG||{};
 const base=String(cfg.supabaseUrl||'').replace(/\/$/,'');
 const key=String(cfg.publishableKey||'');
 const token=()=>window.quizMemberToken?.()||'';
 let protectedLessons=new Map(),activeToken='',requestId=0,loading=false,loadError='';
 let route='topics',selected=topics[0].id;
 const STORAGE_KEY='numerology-standalone-learning-reading-v1';
 let saved=new Set(),canSave=true;
 try{
   const parsed=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||'[]');
   if(Array.isArray(parsed))saved=new Set(parsed.filter(id=>typeof id==='string'&&ids.has(id)));
 }catch(_){canSave=false;}
 function persist(){
  try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify([...saved]));canSave=true;return true;}
  catch(_){canSave=false;return false;}
 }
 function lessonFor(meta){
  if(meta.access_tier==='intro')return meta;
  return activeToken&&token()===activeToken?protectedLessons.get(meta.id)||null:null;
 }
 function available(meta){return meta.access_tier==='intro'||Boolean(lessonFor(meta));}
 function count(){
   const unlocked=all.filter(x=>available(x));
   return {done:unlocked.filter(x=>saved.has(x.id)).length,total:unlocked.length};
 }
  const css=el('style');
  css.textContent=[
    '.learn-map{margin:26px 0 28px;padding:25px;border:1px solid #cfc3a8;border-radius:18px;background:linear-gradient(130deg,#fffcf4,#f0e7d8);box-shadow:0 8px 24px #473e2710}',
    '.learn-map *{box-sizing:border-box}',
    '.learn-map-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:18px}',
    '.learn-map-kicker{font-weight:700;font-size:.75rem;letter-spacing:.19em;color:#8a6f3d;margin:0 0 8px}',
    '.learn-map h2{margin:0;font-size:clamp(1.35rem,2.5vw,1.8rem);letter-spacing:.06em}',
    '.learn-map-intro{max-width:700px;font-size:.88rem;color:#50616a;line-height:1.85;margin:9px 0}',
    '.learn-map-meter{background:#fffcf5;border:1px solid #daceb6;border-radius:12px;padding:13px 15px;min-width:220px;flex:1;max-width:300px}',
    '.learn-map-meter strong{display:block;font-size:.89rem}',
    '.learn-map-track,.learn-map-node-track{height:8px;border-radius:99px;background:#e2e6df;overflow:hidden;margin-top:10px}',
    '.learn-map-fill,.learn-map-node-fill{height:100%;background:#447c6c;border-radius:99px;width:0;display:block}',
    '.learn-map-tabs{display:flex;gap:9px;flex-wrap:wrap;margin:18px 0}',
    '.learn-map-tabs button{font:inherit;cursor:pointer;padding:10px 15px;background:#fffdf5;color:#3b4a50;border:1px solid #cbbb9e;border-radius:10px}',
    '.learn-map-tabs button[aria-pressed=true]{background:#244e4a;color:#fff;border-color:#244e4a}',
    '.learn-map-body{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,1fr);gap:17px;align-items:start}',
    '.learn-map-path{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-content:start}',
    '.learn-map-path-heading{grid-column:1/-1;margin:10px 0 0;border-bottom:1px solid #dfd2b8;padding:7px 0;font-size:.95rem;color:#416259}',
    '.learn-map-node{display:flex;flex-direction:column;gap:9px;min-width:0;text-align:left;min-height:132px;background:#fffef9;border:1px solid #d3c6af;border-radius:13px;padding:13px 14px;color:#263b42;font:inherit;cursor:pointer}',
    '.learn-map-node:hover,.learn-map-node:focus-visible{border-color:#8e6c3c;box-shadow:0 4px 13px #54482922}',
    '.learn-map-node[aria-pressed=true]{border:2px solid #417866;background:#edf7ef}',
    '.learn-map-node[data-locked=true]{background:#f7f3ea;border-style:dashed}',
    '.learn-map-locked{border:1px dashed #b49a72;border-radius:10px;background:#f7f0e4;padding:15px;margin-top:12px}',
    '.learn-map-node-top{display:flex;justify-content:space-between;align-items:center;gap:8px}',
    '.learn-map-node-group{font-size:.71rem;color:#886a3e}',
    '.learn-map-node-number{background:#ede3d0;border-radius:100px;min-width:31px;height:31px;display:grid;place-items:center;font:700 .8rem system-ui,sans-serif}',
    '.learn-map-node strong{font-size:.94rem}',
    '.learn-map-node-desc{font-size:.77rem;line-height:1.55;color:#65706d;flex:1}',
    '.learn-map-node-meta{font-size:.75rem;color:#3f7561;font-weight:600}',
    '.learn-map-detail{min-width:0;background:#fffdf8;border:1px solid #d3c29f;border-radius:13px;padding:20px;position:sticky;top:12px;max-height:88vh;overflow:auto}',
    '.learn-map-detail h3{font-size:1.25rem;line-height:1.45;margin:6px 0 13px}',
    '.learn-map-detail h4{font-size:.93rem;color:#345d58;margin:18px 0 6px}',
    '.learn-map-detail p,.learn-map-detail li{font-size:.85rem;line-height:1.85;color:#44545b}',
    '.learn-map-detail ul{padding-left:22px;margin:6px 0}',
    '.learn-map-detail-label{font-size:.72rem!important;color:#927040!important;font-weight:700;letter-spacing:.09em;margin:0}',
    '.learn-map-notice{background:#f6f0e4;border-left:3px solid #bd9350;padding:10px 12px;border-radius:3px}',
    '.learn-map-action{display:block;width:100%;background:#245b54;color:#fff;font:inherit;font-weight:700;cursor:pointer;border:0;border-radius:9px;padding:12px;margin-top:16px}',
    '.learn-map-action[aria-pressed=true]{background:#e5f2ec;color:#245b54;border:1px solid #568f79}',
    '.learn-map-auth-action{background:#315a71}',
    '.learn-map-sources{display:grid;gap:7px;margin:10px 0 0}',
    '.learn-map-sources a,.learn-map-atlas{display:block;font-size:.83rem;color:#1c6868;line-height:1.7;overflow-wrap:anywhere}',
    '.learn-map-disclaimer{border-top:1px solid #dbcfb8;margin:20px 0 0;padding-top:13px;font-size:.78rem;color:#65716e;line-height:1.8}',
    '.learn-map-status{font-size:.8rem;color:#446b60;margin:9px 0;min-height:1.5em}',
    '@media(max-width:880px){.learn-map-body{grid-template-columns:1fr}.learn-map-detail{position:static;max-height:none}.learn-map-meter{max-width:none}}',
    '@media(max-width:550px){.learn-map{padding:14px}.learn-map-path{grid-template-columns:1fr}.learn-map-node{min-height:110px}.learn-map-detail{padding:14px}}'
  ].join('\n');
  document.head.append(css);


 const head=el('header','','learn-map-head');
 const intro=el('div');intro.append(el('p','MEMBER LEARNING CURRICULUM','learn-map-kicker'));
 const heading=el('h2','數術知識學習地圖');heading.id='learningMapTitle';intro.append(heading);
 intro.append(el('p','遊客免費閱讀 3 個入門單元；登入會員可閱讀全部 39 個獨立教材單元。教材與遊戲題庫、排行榜及文昌點數完全分離。','learn-map-intro'));
 const meter=el('div','','learn-map-meter'),meterLabel=el('strong','閱讀進度');
 const meterTrack=el('div','','learn-map-track'),meterFill=el('span','','learn-map-fill');
 meterTrack.setAttribute('role','progressbar');meterTrack.setAttribute('aria-label','目前可閱讀教材的閱讀進度');
 meterTrack.setAttribute('aria-valuemin','0');meterTrack.setAttribute('aria-valuemax','100');
 meterTrack.append(meterFill);meter.append(meterLabel,meterTrack);head.append(intro,meter);
 const tabs=el('nav','','learn-map-tabs');tabs.setAttribute('aria-label','學習地圖分區');
 const tabTopics=el('button','數術專題 11 單元'),tabMansions=el('button','四象二十八宿 28 單元');
 tabTopics.id='learn-map-tab-topics';tabMansions.id='learn-map-tab-mansions';
 tabTopics.type=tabMansions.type='button';tabs.append(tabTopics,tabMansions);
 const body=el('div','','learn-map-body'),path=el('div','','learn-map-path'),detail=el('article','','learn-map-detail');
 detail.setAttribute('aria-live','polite');body.append(path,detail);
 const status=el('p','','learn-map-status');status.setAttribute('role','status');
 const disclaimer=el('p','入門教材可供遊客閱讀，其餘教材正文僅在會員登入並通過資料庫權限核對後提供。閱讀標記保留在這台裝置，不是會員跨裝置紀錄；教材仍屬研究提要，引用原始史料前須另行查證。','learn-map-disclaimer');
 root.append(head,tabs,body,status,disclaimer);anchor.before(root);
 tabTopics.addEventListener('click',()=>{route='topics';selected=topics[0].id;render();});
 tabMansions.addEventListener('click',()=>{route='mansions';selected=mansions[0].id;render();});
 function loginPrompt(){
   const button=el('button','註冊／登入會員解鎖全部教材','learn-map-action learn-map-auth-action');
   button.type='button';button.addEventListener('click',()=>{
     const login=document.getElementById('playerSignInBtn');
     if(login&&!login.hidden)login.click();
     else status.textContent='請使用頁面會員登入功能，完成登入後再返回教材。';
   });
   return button;
 }
 function renderNode(meta,index){
  const locked=!available(meta),btn=el('button','','learn-map-node');
  btn.type='button';btn.dataset.lessonId=meta.id;btn.dataset.locked=String(locked);
  btn.setAttribute('aria-pressed',String(selected===meta.id));
  const top=el('div','','learn-map-node-top');
  top.append(el('span',meta.group,'learn-map-node-group'),el('span',String(index+1).padStart(2,'0'),'learn-map-node-number'));
  const p=el('div','','learn-map-node-track'),fill=el('span','','learn-map-node-fill');
  fill.style.width=!locked&&saved.has(meta.id)?'100%':'0%';p.append(fill);
  const label=locked?'🔒 會員限定':saved.has(meta.id)?'✓ 已標記閱讀':'尚未標記閱讀';
  const info=locked?'登入會員後閱讀完整教材':meta.lead;
  btn.append(top,el('strong',meta.title),el('span',info,'learn-map-node-desc'),el('span',label,'learn-map-node-meta'),p);
  btn.addEventListener('click',()=>{
   selected=meta.id;render();[...path.querySelectorAll('button')].find(x=>x.dataset.lessonId===selected)?.focus({preventScroll:true});
  });
  path.append(btn);
 }
 function renderDetail(meta){
  detail.replaceChildren();
  const lesson=lessonFor(meta);
  detail.append(el('p',meta.group+'・'+(meta.access_tier==='intro'?'免費入門教材':'會員專屬教材'),'learn-map-detail-label'),
    el('h3',meta.title));
  if(!lesson){
   const message=loading?'正在核對會員身分並載入教材…':
     token()?loadError||'會員教材尚未解鎖，請重新登入。':'此單元僅供已登入會員閱讀。';
   detail.append(el('p',message,'learn-map-locked'));
   if(!token())detail.append(loginPrompt());
   else {
    const reload=el('button','重新載入會員教材','learn-map-action');
    reload.type='button';reload.addEventListener('click',()=>void loadMemberLessons());
    detail.append(reload);
   }
   return;
  }
  detail.append(el('p',lesson.lead),el('h4','學習重點'));
  const ul=el('ul');lesson.points.forEach(point=>ul.append(el('li',point)));detail.append(ul);
  detail.append(el('h4','史料與研究方法'),el('p',lesson.method),
    el('h4','值得思考的問題'),el('p',lesson.question),
    el('h4','證據界線'),el('p',lesson.caution,'learn-map-notice'),el('h4','參考來源'));
  const sources=el('div','','learn-map-sources');
  lesson.sources.forEach(id=>{
   const src=data.sources[id];if(!src||!/^https:\/\//.test(src.url))return;
   const link=el('a',src.label+'（'+src.type+'）');link.href=src.url;link.target='_blank';link.rel='noopener noreferrer';sources.append(link);
  });detail.append(sources);
  if(lesson.atlasName){
    const atlas=el('a','延伸：開啟「'+lesson.atlasName+'宿」互動圖鑑','learn-map-atlas');
    atlas.href='./mansions-atlas.html?m='+encodeURIComponent(lesson.atlasName);detail.append(atlas);
  }
  const mark=el('button',saved.has(meta.id)?'✓ 已閱讀（點擊取消標記）':'閱讀後標記本單元','learn-map-action');
  mark.type='button';mark.setAttribute('aria-pressed',String(saved.has(meta.id)));
  mark.addEventListener('click',()=>{
   if(!available(meta))return;
   if(saved.has(meta.id))saved.delete(meta.id);else saved.add(meta.id);
   const ok=persist();render();
   status.textContent=ok?'閱讀標記已保存在此裝置；不會修改任何正式答題成績。':
     '目前瀏覽器無法儲存，重新載入後標記可能消失。';
  });
  detail.append(mark);
 }
 function render(){
  const list=route==='topics'?topics:mansions;
  if(!list.some(x=>x.id===selected))selected=list[0].id;
  tabTopics.setAttribute('aria-pressed',String(route==='topics'));
  tabMansions.setAttribute('aria-pressed',String(route==='mansions'));
  const progress=count(),pct=progress.total?Math.round(100*progress.done/progress.total):0;
  meterLabel.textContent=(!token()?'遊客入門':'會員教材')+'：已標記閱讀 '+progress.done+'／'+progress.total+' 單元';
  meterFill.style.width=pct+'%';meterTrack.setAttribute('aria-valuenow',String(pct));
  meterTrack.setAttribute('aria-valuetext','已標記閱讀 '+progress.done+'／'+progress.total+' 單元');
  path.replaceChildren();let group='';
  list.forEach((meta,i)=>{
   if(meta.group!==group){path.append(el('h3',meta.group,'learn-map-path-heading'));group=meta.group;}
   renderNode(meta,i);
  });
  renderDetail(list.find(x=>x.id===selected));
  if(!canSave)status.textContent='本瀏覽器可能無法儲存閱讀標記，但仍可閱讀教材。';
 }
 async function loadMemberLessons(){
  const current=token();
  requestId++;const epoch=requestId;
  protectedLessons.clear();activeToken='';loadError='';loading=Boolean(current);render();
  if(!current){status.textContent='遊客可閱讀 3 個入門單元，登入後解鎖其他 36 個單元。';return;}
  if(!base||!key){loading=false;loadError='會員教材服務尚未設定。';render();return;}
  status.textContent='正在驗證會員登入並取得獨立教材…';
  try{
   const response=await fetch(base+'/rest/v1/learning_curriculum_lessons?select=id,lead,points,method,question,caution,sources,atlas_name,access_tier&access_tier=eq.member&published=eq.true&order=id.asc',{
    headers:{apikey:key,Authorization:'Bearer '+current},cache:'no-store'
   });
   if(!response.ok)throw Error('HTTP '+response.status);
   const records=await response.json();
   if(!Array.isArray(records)||records.length!==memberMeta.size
     ||records.some(x=>!memberMeta.has(x.id)||x.access_tier!=='member'||!Array.isArray(x.points)||!Array.isArray(x.sources)))throw Error('會員教材回傳不完整');
   if(epoch!==requestId||token()!==current)return;
   protectedLessons=new Map(records.map(row=>[row.id,{
    ...memberMeta.get(row.id),...row,atlasName:row.atlas_name||null
   }]));
   activeToken=current;loading=false;
   status.textContent='已驗證會員，可閱讀全部 39 個教材單元。';
  }catch(err){
   if(epoch!==requestId||token()!==current)return;
   protectedLessons.clear();activeToken='';loading=false;
   loadError='未能通過會員教材驗證（'+String(err.message||err)+'）。';
   status.textContent=loadError;
  }
  render();
 }
 window.addEventListener('quiz-member-session-changed',()=>void loadMemberLessons());
 render();
 if(token())void loadMemberLessons();
})();
